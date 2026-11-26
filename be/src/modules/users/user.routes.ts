// ===========================================
// User Management Service & Routes (Admin)
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hash } from 'argon2';
import { db } from '../../config/database';
import { users, teams, conversations, organizations } from '../../db/schema';
import { authPlugin, invalidateAccountCache } from '../../middleware/auth';
import type { UserRole, UserStatus } from '../../db/schema/users';

/** Roles that a tenant Administrator is allowed to assign */
const TENANT_ROLES: string[] = ['ADMINISTRATOR', 'SUPERVISOR', 'AGENT'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Active administrators of the org other than `exceptUserId`. */
async function otherActiveAdmins(orgId: string, exceptUserId: string) {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(users)
    .where(and(eq(users.organizationId, orgId), eq(users.role, 'ADMINISTRATOR'), eq(users.status, 'ACTIVE'), sql`${users.id} <> ${exceptUserId}`));
  return Number(row?.n || 0);
}

/** Give the chats a removed / deactivated agent was handling back to the queue. */
async function releaseConversations(userId: string) {
  await db.execute(sql`UPDATE conversations SET status = 'UNASSIGNED', assigned_user_id = NULL WHERE assigned_user_id = ${userId} AND status = 'OPEN'`);
  await db.execute(sql`UPDATE conversations SET assigned_user_id = NULL WHERE assigned_user_id = ${userId}`);
}

/** Seats of the plan (maxAgents) are used by active Supervisors and Agents. */
async function assertSeatAvailable(orgId: string, exceptUserId?: string) {
  const [org] = await db.select({ maxAgents: organizations.maxAgents }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const limit = Number(org?.maxAgents || 0);
  if (!limit) return;
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(users)
    .where(
      and(
        eq(users.organizationId, orgId),
        eq(users.status, 'ACTIVE'),
        sql`${users.role} IN ('SUPERVISOR', 'AGENT')`,
        exceptUserId ? sql`${users.id} <> ${exceptUserId}` : sql`1 = 1`
      )
    );
  if (Number(row?.n || 0) >= limit) {
    throw new Error(`Batas paket tercapai: maksimal ${limit} agen/supervisor aktif. Nonaktifkan agen lain atau upgrade paket.`);
  }
}

async function assertTeamInOrg(orgId: string, teamId?: string | null) {
  if (!teamId) return;
  const [team] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, teamId), eq(teams.organizationId, orgId))).limit(1);
  if (!team) throw new Error('Tim tidak ditemukan di organisasi ini.');
}

export class UserService {
  static async list(orgId: string) {
    return await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        isOnline: users.isOnline,
        maxActiveChats: users.maxActiveChats,
        createdAt: users.createdAt,
        team: {
          id: teams.id,
          name: teams.name,
        },
      })
      .from(users)
      .leftJoin(teams, eq(users.teamId, teams.id))
      .where(
        and(
          eq(users.organizationId, orgId),
          sql`${users.role} NOT IN ('SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT')`
        )
      )
      .orderBy(desc(users.createdAt));
  }

  static async create(orgId: string, body: {
    email: string;
    password?: string;
    fullName: string;
    role: UserRole;
    teamId?: string;
  }) {
    if (!TENANT_ROLES.includes(body.role as string)) {
      throw new Error('Role staf platform tidak dapat dibuat melalui menu staf tenant.');
    }

    const cleanEmail = body.email.toLowerCase().trim();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing) {
      throw new Error(`Email "${body.email}" sudah digunakan oleh akun lain di sistem.`);
    }

    // 🔒 Never fall back to a well-known default password
    const generatedPassword = body.password && body.password.trim() ? null : nanoid(12);
    if (body.password && body.password.trim().length < 6) {
      throw new Error('Password minimal 6 karakter.');
    }
    await assertTeamInOrg(orgId, body.teamId);
    if (body.role !== 'ADMINISTRATOR') await assertSeatAvailable(orgId);
    const passwordHash = await hash(generatedPassword || body.password!.trim());
    const id = nanoid();

    await db.insert(users).values({
      id,
      organizationId: orgId,
      teamId: body.teamId || null,
      email: cleanEmail,
      passwordHash,
      fullName: body.fullName,
      role: body.role || 'AGENT',
      status: 'ACTIVE',
    });

    return {
      id,
      email: cleanEmail,
      fullName: body.fullName,
      role: body.role,
      // Returned only once, so the admin can hand it over to the new user
      ...(generatedPassword ? { generatedPassword } : {}),
    };
  }

  static async update(orgId: string, userId: string, body: {
    fullName?: string;
    email?: string;
    role?: UserRole;
    status?: UserStatus;
    isOnline?: boolean;
    maxActiveChats?: number;
    teamId?: string | null;
    password?: string;
  }) {
    if (body.role !== undefined && !TENANT_ROLES.includes(body.role as string)) {
      throw new Error('Role staf platform tidak dapat ditetapkan melalui menu staf tenant.');
    }

    const [target] = await db
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, orgId),
          sql`${users.role} NOT IN ('SUPER_ADMIN', 'CO_SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT')`
        )
      )
      .limit(1);
    if (!target) throw new Error('Pengguna tidak ditemukan di organisasi ini');

    // 🔒 Never leave the organisation without an active administrator
    const losesAdmin =
      target.role === 'ADMINISTRATOR' &&
      target.status === 'ACTIVE' &&
      ((body.role !== undefined && body.role !== 'ADMINISTRATOR') || (body.status !== undefined && body.status !== 'ACTIVE'));
    if (losesAdmin && (await otherActiveAdmins(orgId, userId)) === 0) {
      throw new Error('Ini Administrator aktif terakhir. Jadikan pengguna lain Administrator terlebih dahulu.');
    }

    const updatePayload: Record<string, any> = {};
    if (body.fullName !== undefined) {
      if (body.fullName.trim().length < 2) throw new Error('Nama minimal 2 karakter.');
      updatePayload.fullName = body.fullName.trim();
    }
    if (body.email !== undefined) {
      const email = body.email.toLowerCase().trim();
      if (!EMAIL_RE.test(email)) throw new Error('Format email tidak valid.');
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), sql`${users.id} <> ${userId}`))
        .limit(1);
      if (taken) throw new Error(`Email "${email}" sudah digunakan oleh akun lain.`);
      updatePayload.email = email;
    }
    if (body.teamId !== undefined) await assertTeamInOrg(orgId, body.teamId);

    // Activating someone, or turning an admin into an agent, takes a seat
    const finalRole = body.role ?? target.role;
    const finalStatus = body.status ?? target.status;
    const takesNewSeat =
      finalStatus === 'ACTIVE' &&
      (finalRole === 'AGENT' || finalRole === 'SUPERVISOR') &&
      !(target.status === 'ACTIVE' && (target.role === 'AGENT' || target.role === 'SUPERVISOR'));
    if (takesNewSeat) await assertSeatAvailable(orgId, userId);
    if (body.role !== undefined) updatePayload.role = body.role;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.isOnline !== undefined) updatePayload.isOnline = body.isOnline;
    if (body.maxActiveChats !== undefined) updatePayload.maxActiveChats = body.maxActiveChats;
    if (body.teamId !== undefined) updatePayload.teamId = body.teamId;
    if (body.password) {
      if (body.password.trim().length < 6) throw new Error('Password minimal 6 karakter.');
      updatePayload.passwordHash = await hash(body.password.trim());
    }

    // Nothing to update (e.g. non-admin sent only ignored fields)
    if (Object.keys(updatePayload).length === 0) {
      return { success: true };
    }

    await db
      .update(users)
      .set(updatePayload)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, orgId),
          sql`${users.role} NOT IN ('SUPER_ADMIN', 'CO_SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT')`
        )
      );

    if (body.status !== undefined && body.status !== 'ACTIVE') {
      await releaseConversations(userId);
    }

    invalidateAccountCache(userId);
    return { success: true };
  }

  static async delete(orgId: string, userId: string) {
    // 🔒 Make sure the target user belongs to this organization BEFORE touching related data
    const [target] = await db
      .select({ id: users.id, role: users.role, status: users.status })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, orgId),
          sql`${users.role} NOT IN ('SUPER_ADMIN', 'CO_SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT')`
        )
      )
      .limit(1);

    if (!target) {
      throw new Error('Pengguna tidak ditemukan di organisasi ini');
    }
    if (target.role === 'ADMINISTRATOR' && target.status === 'ACTIVE' && (await otherActiveAdmins(orgId, userId)) === 0) {
      throw new Error('Ini Administrator aktif terakhir dan tidak dapat dihapus.');
    }

    // 1. Clean up dependent foreign keys safely before deleting user (open chats go back to the queue)
    try {
      await releaseConversations(userId);
    } catch (_) {}
    try {
      await db.execute(sql`DELETE FROM conversation_participants WHERE user_id = ${userId}`);
    } catch (_) {}
    try {
      await db.execute(sql`UPDATE broadcast_campaigns SET created_by_id = NULL WHERE created_by_id = ${userId}`);
    } catch (_) {}
    try {
      await db.execute(sql`UPDATE subscription_orders SET user_id = NULL WHERE user_id = ${userId}`);
    } catch (_) {}
    try {
      await db.execute(sql`UPDATE activity_logs SET user_id = NULL WHERE user_id = ${userId}`);
    } catch (_) {}

    await db
      .delete(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, orgId),
          sql`${users.role} NOT IN ('SUPER_ADMIN', 'CO_SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT')`
        )
      );

    invalidateAccountCache(userId);
    return { success: true };
  }
}

export const userRoutes = new Elysia({ prefix: '/users' })
  .use(authPlugin)

  // ─── GET /users ────────────────────────────
  .get('/', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role !== 'ADMINISTRATOR' && user.role !== 'SUPER_ADMIN' && user.role !== 'SUPERVISOR') {
      set.status = 403;
      return { success: false, error: 'Akses dibatasi' };
    }

    const items = await UserService.list(user.orgId);
    return { success: true, items };
  })

  // ─── POST /users (Admin Only) ──────────────
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (user.role !== 'ADMINISTRATOR' && user.role !== 'SUPER_ADMIN') {
        set.status = 403;
        return { success: false, error: 'Hanya Administrator yang dapat menambah anggota baru' };
      }

      try {
        const item = await UserService.create(user.orgId, body as any);
        return { success: true, item };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        fullName: t.String({ minLength: 2 }),
        password: t.Optional(t.String()),
        role: t.Union([
          t.Literal('ADMINISTRATOR'),
          t.Literal('SUPERVISOR'),
          t.Literal('AGENT'),
        ]),
        teamId: t.Optional(t.String()),
      }),
    }
  )

  // ─── PATCH /users/:id ──────────────────────
  .patch('/:id', async ({ user, params, body, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    // Allow admin to update any user, or any user to update their own online status
    const isSelf = params.id === user.id;
    const isAdmin = user.role === 'ADMINISTRATOR' || user.role === 'SUPER_ADMIN';
    if (!isSelf && !isAdmin) {
      set.status = 403;
      return { success: false, error: 'Hanya Administrator yang dapat mengubah data pengguna lain' };
    }

    // 🔒 Non-admin users may only change their own availability (online/offline).
    // Fields like role, status, email, password are silently ignored to prevent privilege escalation.
    const payload = isAdmin
      ? body
      : { ...(body.isOnline !== undefined ? { isOnline: body.isOnline } : {}) };

    try {
      await UserService.update(user.orgId, params.id, payload as any);
    } catch (err: any) {
      set.status = 400;
      return { success: false, error: err.message };
    }
    return { success: true, message: 'Data pengguna berhasil diperbarui' };
  }, {
    body: t.Object({
      fullName: t.Optional(t.String()),
      email: t.Optional(t.String()),
      role: t.Optional(
        t.Union([
          t.Literal('ADMINISTRATOR'),
          t.Literal('SUPERVISOR'),
          t.Literal('AGENT'),
        ])
      ),
      status: t.Optional(
        t.Union([
          t.Literal('ACTIVE'),
          t.Literal('INACTIVE'),
          t.Literal('SUSPENDED'),
        ])
      ),
      isOnline: t.Optional(t.Boolean()),
      maxActiveChats: t.Optional(t.Union([t.Number(), t.Null()])),
      teamId: t.Optional(t.Union([t.String(), t.Null()])),
      password: t.Optional(t.String()),
    }),
  })

  // ─── DELETE /users/:id ─────────────────────
  .delete('/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role !== 'ADMINISTRATOR' && user.role !== 'SUPER_ADMIN') {
      set.status = 403;
      return { success: false, error: 'Hanya Administrator yang dapat menghapus pengguna' };
    }

    if (params.id === user.id) {
      set.status = 400;
      return { success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri.' };
    }
    try {
      await UserService.delete(user.orgId, params.id);
    } catch (err: any) {
      set.status = /tidak ditemukan/.test(err.message) ? 404 : 400;
      return { success: false, error: err.message };
    }
    return { success: true };
  });
