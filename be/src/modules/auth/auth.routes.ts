// ===========================================
// Auth Routes — Register & Login
// ===========================================

import { Elysia, t } from 'elysia';
import { authPlugin, invalidateAccountCache } from '../../middleware/auth';
import { AuthService } from './auth.service';
import { db } from '../../config/database';
import { users } from '../../db/schema/users';
import { organizations } from '../../db/schema/organizations';
import { superAdmins } from '../../db/schema/super-admins';
import { eq, and, ne } from 'drizzle-orm';
import { RULES, getClientIp, hit, reset, retryAfterSeconds, tooManyRequests } from '../../middleware/rate-limit';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)

  // ─── POST /auth/register ───────────────────
  .post(
    '/register',
    async ({ body, jwt, set, request, server }) => {
      // 🔒 Rate limit registrations per IP
      const ipKey = `register:ip:${getClientIp(request, server)}`;
      const wait = retryAfterSeconds(ipKey, RULES.registerPerIp);
      if (wait > 0) return tooManyRequests(set, wait);
      hit(ipKey, RULES.registerPerIp);

      try {
        const user = await AuthService.register(body);

        // Generate JWT token
        const token = await jwt.sign({
          id: user.id,
          orgId: user.organizationId,
          role: user.role,
          email: user.email,
        });

        set.status = 201;
        return {
          success: true,
          token,
          user,
        };
      } catch (error: any) {
        set.status = 400;
        return {
          success: false,
          error: error.message || 'Registrasi gagal',
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        fullName: t.String({ minLength: 2 }),
        organizationName: t.Optional(t.String()),
        organizationId: t.Optional(t.String()),
        role: t.Optional(
          t.Union([
            t.Literal('ADMINISTRATOR'),
            t.Literal('SUPERVISOR'),
            t.Literal('AGENT'),
          ])
        ),
      }),
    }
  )

  // ─── POST /auth/login ─────────────────────
  .post(
    '/login',
    async ({ body, jwt, set, request, server }) => {
      // 🔒 Brute-force protection: limit FAILED attempts per account and per IP
      const portal = body.portalType || 'TENANT';
      const accountKey = `login:acct:${portal}:${String(body.email || '').trim().toLowerCase()}`;
      const ipKey = `login:ip:${getClientIp(request, server)}`;
      const wait = Math.max(
        retryAfterSeconds(accountKey, RULES.loginPerAccount),
        retryAfterSeconds(ipKey, RULES.loginPerIp)
      );
      if (wait > 0) return tooManyRequests(set, wait);

      try {
        const user = await AuthService.login(body);
        reset(accountKey);

        // Generate JWT token
        const token = await jwt.sign({
          id: user.id,
          orgId: user.organizationId || '',
          role: user.role,
          email: user.email,
        });

        return {
          success: true,
          token,
          user,
        };
      } catch (error: any) {
        hit(accountKey, RULES.loginPerAccount);
        hit(ipKey, RULES.loginPerIp);
        set.status = 401;
        return {
          success: false,
          error: error.message || 'Login gagal',
        };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String(),
        organizationId: t.Optional(t.String()),
        portalType: t.Optional(t.Union([t.Literal('TENANT'), t.Literal('PLATFORM')])),
      }),
    }
  )

  // ─── GET /auth/me — Current user profile ──
  .get('/me', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

      // Platform staff (Super Admin / Finance / Support) live in the super_admins table
      if (!dbUser) {
        const [sa] = await db.select().from(superAdmins).where(eq(superAdmins.id, user.id)).limit(1);
        if (sa) {
          return {
            success: true,
            user: {
              id: sa.id,
              email: sa.email,
              fullName: sa.fullName,
              role: sa.role,
              organizationId: null,
              organizationName: 'Platform Administrator (Independen)',
              isOnline: true,
              isPrimaryAdmin: Boolean(sa.isPrimaryAdmin),
            },
          };
        }
      }

      const [org] = (dbUser?.organizationId)
        ? await db.select().from(organizations).where(eq(organizations.id, dbUser.organizationId)).limit(1)
        : [null];

      return {
        success: true,
        user: {
          id: dbUser?.id || user.id,
          email: dbUser?.email || user.email,
          fullName: dbUser?.fullName || user.email || 'Admin',
          role: dbUser?.role || user.role,
          organizationId: dbUser?.organizationId || null,
          organizationName: org?.name || 'Platform Administrator (Independen)',
          isOnline: dbUser?.isOnline ?? true,
          isPrimaryAdmin: Boolean(dbUser?.isPrimaryAdmin),
        },
      };
    } catch {
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.email || 'Admin',
          role: user.role,
          organizationId: user.orgId || null,
          organizationName: 'Platform Administrator (Independen)',
          isOnline: true,
        },
      };
    }
  })

  // ─── PUT /auth/profile — Update user's own profile & password ──
  .put(
    '/profile',
    async ({ user, body, jwt, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      // Tenant users live in `users`; platform staff live in `super_admins`
      const [tenantUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      const [platformUser] = tenantUser
        ? [undefined]
        : await db.select().from(superAdmins).where(eq(superAdmins.id, user.id)).limit(1);
      const isPlatform = !tenantUser && !!platformUser;
      const dbUser = (tenantUser || platformUser) as
        | { id: string; email: string; fullName: string; role: any; passwordHash: string; organizationId?: string | null }
        | undefined;
      const accountTable: any = isPlatform ? superAdmins : users;

      if (!dbUser) {
        set.status = 404;
        return { success: false, error: 'Pengguna tidak ditemukan' };
      }

      const updateData: Record<string, any> = {};

      if (body.fullName && body.fullName.trim()) {
        updateData.fullName = body.fullName.trim();
      }

      if (body.email && body.email.trim().toLowerCase() !== dbUser.email.toLowerCase()) {
        const cleanEmail = body.email.trim().toLowerCase();
        const [existing] = await db
          .select({ id: accountTable.id })
          .from(accountTable)
          .where(and(eq(accountTable.email, cleanEmail), ne(accountTable.id, user.id)))
          .limit(1);

        if (existing) {
          set.status = 400;
          return { success: false, error: `Email "${body.email}" sudah digunakan oleh akun lain.` };
        }
        updateData.email = cleanEmail;
      }

      if (body.newPassword && body.newPassword.trim()) {
        // 🔒 Limit wrong current-password guesses (stolen-token scenario)
        const pwdKey = `pwdchange:user:${user.id}`;
        const pwdWait = retryAfterSeconds(pwdKey, RULES.passwordChangePerUser);
        if (pwdWait > 0) return tooManyRequests(set, pwdWait);

        // 🔒 Changing the password always requires the current password
        if (!body.currentPassword || !body.currentPassword.trim()) {
          set.status = 400;
          return { success: false, error: 'Masukkan password saat ini untuk mengganti password.' };
        }

        const isCurrentValid = await Bun.password.verify(body.currentPassword, dbUser.passwordHash).catch(() => false);
        if (!isCurrentValid) {
          const { verify } = await import('argon2');
          const isArgonValid = await verify(dbUser.passwordHash, body.currentPassword).catch(() => false);
          if (!isArgonValid) {
            hit(pwdKey, RULES.passwordChangePerUser);
            set.status = 400;
            return { success: false, error: 'Password saat ini salah.' };
          }
        }

        const newHash = await Bun.password.hash(body.newPassword.trim(), {
          algorithm: 'bcrypt',
          cost: 10,
        });
        updateData.passwordHash = newHash;
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(accountTable).set(updateData).where(eq(accountTable.id, user.id));
        invalidateAccountCache(user.id);
      }

      const finalEmail = updateData.email || dbUser.email;
      const newToken = await jwt.sign({
        id: dbUser.id,
        orgId: dbUser.organizationId || '',
        role: dbUser.role,
        email: finalEmail,
      });

      return {
        success: true,
        message: 'Profil dan data login Anda berhasil diperbarui!',
        token: newToken,
        user: {
          id: dbUser.id,
          email: finalEmail,
          fullName: updateData.fullName || dbUser.fullName,
          role: dbUser.role,
          organizationId: dbUser.organizationId || null,
        },
      };
    },
    {
      body: t.Object({
        fullName: t.Optional(t.String()),
        email: t.Optional(t.String({ format: 'email' })),
        currentPassword: t.Optional(t.String()),
        newPassword: t.Optional(t.String({ minLength: 6 })),
      }),
    }
  )

  // ─── GET /auth/org/:id — Validate Organization ID (for Join Org Registration) ──
  .get(
    '/org/:id',
    async ({ params, set, request, server }) => {
      // 🔒 Prevent organization ID enumeration
      const ipKey = `orglookup:ip:${getClientIp(request, server)}`;
      const wait = retryAfterSeconds(ipKey, RULES.orgLookupPerIp);
      if (wait > 0) return tooManyRequests(set, wait);
      hit(ipKey, RULES.orgLookupPerIp);

      try {
        const org = await AuthService.lookupOrganization(params.id);
        if (!org) {
          set.status = 404;
          return { success: false, error: 'Organisasi tidak ditemukan' };
        }
        return {
          success: true,
          organization: org,
        };
      } catch (error: any) {
        set.status = 400;
        return { success: false, error: error.message };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
