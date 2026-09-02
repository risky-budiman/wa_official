// ===========================================
// Super Admin Routes — Multi-Tenant SaaS Organization Management Hub
// ===========================================

import { Elysia, t } from 'elysia';
import { db, testConnection } from '../../config/database';
import { organizations, type OrgStatus, type OrgPlan } from '../../db/schema/organizations';
import { users, type UserRole, type UserStatus } from '../../db/schema/users';
import { conversations } from '../../db/schema/conversations';
import { messages } from '../../db/schema/messages';
import { contacts } from '../../db/schema/contacts';
import { phoneNumbers } from '../../db/schema/phone-numbers';
import { platformSettings } from '../../db/schema/settings';
import { authPlugin } from '../../middleware/auth';
import { eq, desc, sql, and, lt, gt, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { jwt } from '@elysiajs/jwt';
import { env } from '../../config/env';
import { BillingService } from '../billing/billing.service';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execAsync = promisify(exec);

function getGitCmd(): string {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Git\\cmd\\git.exe',
      'C:\\Program Files\\Git\\bin\\git.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\Git\\cmd\\git.exe'),
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        return `"${c}"`;
      }
    }
  }
  return 'git';
}

function getRepoDir(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, '.git'))) {
    return cwd;
  }
  const parent = path.resolve(cwd, '..');
  if (fs.existsSync(path.join(parent, '.git'))) {
    return parent;
  }
  return cwd;
}

async function checkIsPrimaryAdmin(userId?: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const [dbUser] = await db
      .select({ isPrimaryAdmin: users.isPrimaryAdmin, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!dbUser) return false;
    if (dbUser.isPrimaryAdmin) return true;
    if (dbUser.role === 'SUPER_ADMIN' && (dbUser.email === 'admin@perusahaan.com' || dbUser.email === 'admin@ids.net.id' || dbUser.email === 'riskybudiman1@gmail.com')) {
      return true;
    }
  } catch (_) {}
  return false;
}

export const superAdminRoutes = new Elysia({ prefix: '/super-admin' })
  .use(authPlugin)
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
    })
  )
  // Platform Authorization Guard (Super Admin & Platform Staff)
  .onBeforeHandle(async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Autentikasi diperlukan. Silakan login kembali.' };
    }

    let currentRole = user.role;
    const [dbUser] = await db
      .select({ role: users.role, organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (dbUser?.role) currentRole = dbUser.role;

    // Platform roles: SUPER_ADMIN, ADMIN_FINANCE, ADMIN_SUPPORT
    const isPlatformStaff =
      currentRole === 'SUPER_ADMIN' ||
      currentRole === 'ADMIN_FINANCE' ||
      currentRole === 'ADMIN_SUPPORT';

    if (!isPlatformStaff) {
      set.status = 403;
      return {
        success: false,
        error: 'Akses ditolak. Panel Kontrol ini hanya dapat diakses oleh Administrator & Staf Platform.',
      };
    }
  })

  // ─── GET /super-admin/overview ────────
  .get('/overview', async () => {
    const allOrgs = await db.select().from(organizations);
    const allUsers = await db.select({ id: users.id, role: users.role, status: users.status }).from(users);

    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let activeCount = 0;
    let trialCount = 0;
    let suspendedCount = 0;
    let expiredCount = 0;
    const expiringSoon: typeof allOrgs = [];

    for (const org of allOrgs) {
      const expDate = org.expiresAt ? new Date(org.expiresAt) : null;
      let effectiveStatus = org.status as OrgStatus;

      if (expDate && expDate < now && effectiveStatus === 'ACTIVE') {
        effectiveStatus = 'EXPIRED';
      }

      if (effectiveStatus === 'ACTIVE') activeCount++;
      else if (effectiveStatus === 'TRIAL') trialCount++;
      else if (effectiveStatus === 'SUSPENDED') suspendedCount++;
      else if (effectiveStatus === 'EXPIRED') expiredCount++;

      if (expDate && expDate >= now && expDate <= next7Days) {
        expiringSoon.push(org);
      }
    }

    // Platform message & conversation stats
    const [convStat] = await db.select({ count: sql<number>`count(*)` }).from(conversations);
    const [msgStat] = await db.select({ count: sql<number>`count(*)` }).from(messages);
    const [contactStat] = await db.select({ count: sql<number>`count(*)` }).from(contacts);

    return {
      success: true,
      data: {
        totalOrganizations: allOrgs.length,
        activeOrganizations: activeCount,
        trialOrganizations: trialCount,
        suspendedOrganizations: suspendedCount,
        expiredOrganizations: expiredCount,
        totalUsers: allUsers.length,
        totalAgents: allUsers.filter((u) => u.role === 'AGENT' || u.role === 'SUPERVISOR').length,
        totalConversations: Number(convStat?.count || 0),
        totalMessages: Number(msgStat?.count || 0),
        totalContacts: Number(contactStat?.count || 0),
        expiringSoonCount: expiringSoon.length,
        expiringSoonTenants: expiringSoon.map((o) => ({
          id: o.id,
          name: o.name,
          plan: o.plan,
          expiresAt: o.expiresAt,
          ownerPhone: o.ownerPhone,
          ownerEmail: o.ownerEmail,
        })),
      },
    };
  })

  // ─── GET /super-admin/organizations ────────
  .get('/organizations', async () => {
    const allOrgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    const now = new Date();

    const results = await Promise.all(
      allOrgs.map(async (org) => {
        const orgUsers = await db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
            status: users.status,
            isOnline: users.isOnline,
          })
          .from(users)
          .where(eq(users.organizationId, org.id));

        const [convCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(conversations)
          .where(eq(conversations.organizationId, org.id));

        const [contactCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(contacts)
          .where(eq(contacts.organizationId, org.id));

        const phones = await db
          .select({
            id: phoneNumbers.id,
            displayPhoneNumber: phoneNumbers.displayPhoneNumber,
            verifiedName: phoneNumbers.verifiedName,
            qualityRating: phoneNumbers.qualityRating,
          })
          .from(phoneNumbers)
          .where(eq(phoneNumbers.organizationId, org.id));

        const expDate = org.expiresAt ? new Date(org.expiresAt) : null;
        let isExpired = false;
        let daysRemaining: number | null = null;

        if (expDate) {
          const diffTime = expDate.getTime() - now.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysRemaining < 0) {
            isExpired = true;
          }
        }

        return {
          id: org.id,
          name: org.name,
          status: isExpired && org.status === 'ACTIVE' ? 'EXPIRED' : org.status,
          plan: org.plan || 'STARTER',
          maxAgents: org.maxAgents || 5,
          maxBroadcastPerMonth: org.maxBroadcastPerMonth || 10000,
          expiresAt: org.expiresAt,
          daysRemaining,
          isExpired,
          ownerName: org.ownerName,
          ownerPhone: org.ownerPhone,
          ownerEmail: org.ownerEmail,
          notes: org.notes,
          wabaId: org.wabaId,
          appId: org.appId,
          hasAccessToken: !!org.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO'),
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          stats: {
            userCount: orgUsers.length,
            agentCount: orgUsers.filter((u) => u.role === 'AGENT' || u.role === 'SUPERVISOR').length,
            conversationCount: Number(convCount?.count || 0),
            contactCount: Number(contactCount?.count || 0),
          },
          users: orgUsers,
          phoneNumbers: phones,
        };
      })
    );

    return {
      success: true,
      items: results,
      total: results.length,
    };
  })

  // ─── POST /super-admin/organizations (Onboard Tenant) ────────
  .post(
    '/organizations',
    async ({ body, set }) => {
      const orgId = nanoid();
      const adminUserId = nanoid();

      // Check if email already exists
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, body.adminEmail.toLowerCase().trim()))
        .limit(1);

      if (existingUser.length > 0) {
        set.status = 400;
        return {
          success: false,
          error: `Email "${body.adminEmail}" sudah terdaftar di sistem. Gunakan email lain untuk akun Admin organisasi ini.`,
        };
      }

      // Calculate expiresAt if duration in days provided
      let expiryDate: Date | null = null;
      if (body.durationDays === 0) {
        expiryDate = null; // Tanpa batas waktu / Gratis Selamanya
      } else if (body.expiresAt) {
        expiryDate = new Date(body.expiresAt);
      } else if (body.durationDays) {
        expiryDate = new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000);
      } else {
        // Default 30 days
        expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      const passwordHash = await Bun.password.hash(body.adminPassword || 'Admin12345!', {
        algorithm: 'bcrypt',
        cost: 10,
      });

      // 1. Create Organization Record
      await db.insert(organizations).values({
        id: orgId,
        name: body.name.trim(),
        status: (body.status as OrgStatus) || 'ACTIVE',
        plan: (body.plan as OrgPlan) || 'STARTER',
        maxAgents: body.maxAgents || 5,
        maxBroadcastPerMonth: body.maxBroadcastPerMonth || 10000,
        expiresAt: expiryDate,
        ownerName: body.ownerName?.trim() || body.adminName?.trim(),
        ownerPhone: body.ownerPhone?.trim(),
        ownerEmail: body.adminEmail.toLowerCase().trim(),
        notes: body.notes?.trim(),
        wabaId: body.wabaId?.trim() || null,
        appId: body.appId?.trim() || null,
        accessToken: body.accessToken?.trim() || null,
      });

      // 2. Create Initial Administrator User
      await db.insert(users).values({
        id: adminUserId,
        organizationId: orgId,
        fullName: body.adminName?.trim() || `${body.name} Admin`,
        email: body.adminEmail.toLowerCase().trim(),
        passwordHash,
        role: 'ADMINISTRATOR',
        status: 'ACTIVE',
        isOnline: false,
        maxActiveChats: 15,
      });

      // 3. Optional: Create Phone Number Record
      if (body.displayPhoneNumber || body.phoneNumberId) {
        await db.insert(phoneNumbers).values({
          id: nanoid(),
          organizationId: orgId,
          phoneNumberId: body.phoneNumberId?.trim() || `phone_${nanoid(8)}`,
          displayPhoneNumber: body.displayPhoneNumber?.trim() || 'WhatsApp Official',
          verifiedName: body.name.trim(),
          qualityRating: 'GREEN',
        });
      }

      return {
        success: true,
        message: `Organisasi "${body.name}" berhasil didaftarkan! Akun admin telah dibuat dengan email ${body.adminEmail}.`,
        data: {
          organizationId: orgId,
          organizationName: body.name,
          adminUserId,
          adminEmail: body.adminEmail,
          plan: body.plan || 'STARTER',
          expiresAt: expiryDate?.toISOString(),
        },
      };
    },
    {
      body: t.Object({
        name: t.String({ description: 'Nama Bisnis / Brand Organisasi' }),
        plan: t.Optional(t.String()),
        status: t.Optional(t.String()),
        maxAgents: t.Optional(t.Number()),
        maxBroadcastPerMonth: t.Optional(t.Number()),
        expiresAt: t.Optional(t.String()),
        durationDays: t.Optional(t.Number()),
        ownerName: t.Optional(t.String()),
        ownerPhone: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        adminName: t.String({ description: 'Nama Admin Utama Klien' }),
        adminEmail: t.String({ description: 'Email Login Admin Klien' }),
        adminPassword: t.String({ description: 'Password Login Admin Klien' }),
        wabaId: t.Optional(t.String()),
        appId: t.Optional(t.String()),
        accessToken: t.Optional(t.String()),
        displayPhoneNumber: t.Optional(t.String()),
        phoneNumberId: t.Optional(t.String()),
      }),
    }
  )

  // ─── GET /super-admin/organizations/:id ────────
  .get('/organizations/:id', async ({ params, set }) => {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, params.id)).limit(1);

    if (!org) {
      set.status = 404;
      return { success: false, error: 'Organisasi tidak ditemukan' };
    }

    const orgUsers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        status: users.status,
        isOnline: users.isOnline,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.organizationId, org.id));

    const phones = await db.select().from(phoneNumbers).where(eq(phoneNumbers.organizationId, org.id));

    return {
      success: true,
      data: {
        ...org,
        users: orgUsers,
        phoneNumbers: phones,
      },
    };
  })

  // ─── PUT /super-admin/organizations/:id ────────
  .put(
    '/organizations/:id',
    async ({ params, body, set }) => {
      const [existing] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, params.id))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { success: false, error: 'Organisasi tidak ditemukan' };
      }

      const updateData: Partial<typeof organizations.$inferInsert> = {};

      if (body.name) updateData.name = body.name.trim();
      if (body.status) updateData.status = body.status as OrgStatus;
      if (body.plan) updateData.plan = body.plan as OrgPlan;
      if (body.maxAgents !== undefined) updateData.maxAgents = body.maxAgents;
      if (body.maxBroadcastPerMonth !== undefined) updateData.maxBroadcastPerMonth = body.maxBroadcastPerMonth;
      if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if (body.ownerName !== undefined) updateData.ownerName = body.ownerName?.trim();
      if (body.ownerPhone !== undefined) updateData.ownerPhone = body.ownerPhone?.trim();
      if (body.ownerEmail !== undefined) updateData.ownerEmail = body.ownerEmail?.trim();
      if (body.notes !== undefined) updateData.notes = body.notes?.trim();
      if (body.wabaId !== undefined) updateData.wabaId = body.wabaId?.trim();
      if (body.appId !== undefined) updateData.appId = body.appId?.trim();
      if (body.accessToken !== undefined) updateData.accessToken = body.accessToken?.trim();

      await db.update(organizations).set(updateData).where(eq(organizations.id, params.id));

      return {
        success: true,
        message: `Data organisasi "${body.name || existing.name}" berhasil diperbarui!`,
      };
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        status: t.Optional(t.String()),
        plan: t.Optional(t.String()),
        maxAgents: t.Optional(t.Number()),
        maxBroadcastPerMonth: t.Optional(t.Number()),
        expiresAt: t.Optional(t.Nullable(t.String())),
        ownerName: t.Optional(t.String()),
        ownerPhone: t.Optional(t.String()),
        ownerEmail: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        wabaId: t.Optional(t.String()),
        appId: t.Optional(t.String()),
        accessToken: t.Optional(t.String()),
      }),
    }
  )

  // ─── PUT /super-admin/organizations/:id/status ────────
  .put(
    '/organizations/:id/status',
    async ({ params, body, set }) => {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, params.id)).limit(1);

      if (!org) {
        set.status = 404;
        return { success: false, error: 'Organisasi tidak ditemukan' };
      }

      await db
        .update(organizations)
        .set({ status: body.status as OrgStatus })
        .where(eq(organizations.id, params.id));

      const statusText =
        body.status === 'ACTIVE'
          ? 'Diaktifkan'
          : body.status === 'SUSPENDED'
            ? 'Ditangguhkan (Suspended)'
            : body.status;

      return {
        success: true,
        message: `Status organisasi "${org.name}" berhasil diubah menjadi ${statusText}.`,
      };
    },
    {
      body: t.Object({
        status: t.String(),
      }),
    }
  )

  // ─── POST /super-admin/organizations/:id/extend (Extend Subscription) ────────
  .post(
    '/organizations/:id/extend',
    async ({ params, body, set }) => {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, params.id)).limit(1);

      if (!org) {
        set.status = 404;
        return { success: false, error: 'Organisasi tidak ditemukan' };
      }

      const daysToAdd = body.days || 30;
      const now = new Date();
      let baseDate = now;

      if (org.expiresAt) {
        const currentExp = new Date(org.expiresAt);
        if (currentExp > now) {
          baseDate = currentExp;
        }
      }

      const newExpiry = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

      await db
        .update(organizations)
        .set({
          expiresAt: newExpiry,
          status: 'ACTIVE',
        })
        .where(eq(organizations.id, params.id));

      return {
        success: true,
        message: `Masa aktif sewa organisasi "${org.name}" berhasil diperpanjang +${daysToAdd} hari hingga ${newExpiry.toLocaleDateString('id-ID', { dateStyle: 'long' })}.`,
        data: {
          expiresAt: newExpiry.toISOString(),
          status: 'ACTIVE',
        },
      };
    },
    {
      body: t.Object({
        days: t.Number({ description: 'Jumlah hari perpanjangan (e.g. 30, 90, 365)' }),
      }),
    }
  )

  // ─── POST /super-admin/organizations/:id/impersonate (Login As Tenant Admin) ────────
  .post('/organizations/:id/impersonate', async ({ params, jwt, set }) => {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, params.id)).limit(1);

    if (!org) {
      set.status = 404;
      return { success: false, error: 'Organisasi tidak ditemukan' };
    }

    // Find administrator of target org
    let [targetUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, org.id), eq(users.role, 'ADMINISTRATOR')))
      .limit(1);

    if (!targetUser) {
      // Fallback: any user in this org
      [targetUser] = await db.select().from(users).where(eq(users.organizationId, org.id)).limit(1);
    }

    if (!targetUser) {
      set.status = 400;
      return { success: false, error: 'Tidak ada pengguna di dalam organisasi ini untuk di-impersonate.' };
    }

    // Generate JWT token for target tenant admin
    const token = await jwt.sign({
      id: targetUser.id,
      orgId: org.id,
      role: targetUser.role,
      email: targetUser.email,
    });

    return {
      success: true,
      message: `Berhasil masuk sebagai Admin organisasi "${org.name}"`,
      data: {
        token,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
          role: targetUser.role,
          organizationId: org.id,
          organizationName: org.name,
        },
        organization: org,
      },
    };
  })

  // ─── POST /super-admin/organizations/:id/reset-admin-password ────────
  .post(
    '/organizations/:id/reset-admin-password',
    async ({ params, body, set }) => {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, params.id)).limit(1);

      if (!org) {
        set.status = 404;
        return { success: false, error: 'Organisasi tidak ditemukan' };
      }

      let targetUser;
      if (body.userId) {
        [targetUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.organizationId, org.id), eq(users.id, body.userId)))
          .limit(1);
      } else {
        [targetUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.organizationId, org.id), eq(users.role, 'ADMINISTRATOR')))
          .limit(1);
      }

      if (!targetUser) {
        [targetUser] = await db
          .select()
          .from(users)
          .where(eq(users.organizationId, org.id))
          .limit(1);
      }

      if (!targetUser) {
        set.status = 400;
        return { success: false, error: 'Akun pengguna untuk organisasi ini tidak ditemukan.' };
      }

      const newHash = await Bun.password.hash(body.newPassword, {
        algorithm: 'bcrypt',
        cost: 10,
      });

      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, targetUser.id));

      return {
        success: true,
        message: `Password akun "${targetUser.email}" (${targetUser.fullName}) berhasil direset!`,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
          role: targetUser.role,
        },
      };
    },
    {
      body: t.Object({
        newPassword: t.String({ minLength: 6 }),
        userId: t.Optional(t.String()),
      }),
    }
  )

  // ─── DELETE /super-admin/organizations/:id ────────
  .delete('/organizations/:id', async ({ params, user, set }) => {
    if (user?.orgId && user.orgId === params.id) {
      set.status = 400;
      return { success: false, error: 'Anda tidak dapat menghapus organisasi utama tempat Anda sedang login.' };
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, params.id)).limit(1);

    if (!org) {
      set.status = 404;
      return { success: false, error: 'Organisasi tidak ditemukan' };
    }

    // Delete organization (Cascade will delete users, contacts, messages, etc.)
    await db.delete(organizations).where(eq(organizations.id, params.id));

    return {
      success: true,
      message: `Organisasi "${org.name}" beserta seluruh datanya telah berhasil dihapus.`,
    };
  })

  // ─── GET /super-admin/settings ────────
  .get('/settings', async ({ set }) => {
    try {
      const [plansSetting] = await db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'saas_plans'))
        .limit(1);

      const [paymentSetting] = await db
        .select()
        .from(platformSettings)
        .where(eq(platformSettings.key, 'midtrans_payment'))
        .limit(1);

      return {
        success: true,
        data: {
          plans: plansSetting?.value || [],
          paymentGateway: paymentSetting?.value || {
            isEnabled: false,
            environment: 'sandbox',
            serverKey: '',
            clientKey: '',
            merchantId: '',
          },
        },
      };
    } catch (e: any) {
      set.status = 500;
      return { success: false, error: e.message };
    }
  })

  // ─── PUT /super-admin/settings/plans ────────
  .put(
    '/settings/plans',
    async ({ body, set }) => {
      try {
        await db
          .insert(platformSettings)
          .values({
            key: 'saas_plans',
            value: body.plans,
            description: 'Daftar Paket & Harga Sewa SaaS',
          })
          .onDuplicateKeyUpdate({
            set: {
              value: body.plans,
            },
          });

        return {
          success: true,
          message: 'Pengaturan paket & harga sewa SaaS berhasil disimpan!',
        };
      } catch (e: any) {
        set.status = 400;
        return { success: false, error: e.message };
      }
    },
    {
      body: t.Object({
        plans: t.Array(t.Any()),
      }),
    }
  )

  // ─── PUT /super-admin/settings/payment ────────
  .put(
    '/settings/payment',
    async ({ body, set }) => {
      try {
        await db
          .insert(platformSettings)
          .values({
            key: 'midtrans_payment',
            value: body,
            description: 'Konfigurasi Channel Pembayaran Midtrans',
          })
          .onDuplicateKeyUpdate({
            set: {
              value: body,
            },
          });

        return {
          success: true,
          message: 'Pengaturan channel pembayaran Midtrans berhasil disimpan!',
        };
      } catch (e: any) {
        set.status = 400;
        return { success: false, error: e.message };
      }
    },
    {
      body: t.Object({
        isEnabled: t.Boolean(),
        environment: t.Union([t.Literal('sandbox'), t.Literal('production')]),
        serverKey: t.String(),
        clientKey: t.String(),
        merchantId: t.Optional(t.String()),
      }),
    }
  )

  // ─── POST /super-admin/organizations/:id/test-meta ────────
  .post(
    '/organizations/:id/test-meta',
    async ({ params, body, set }) => {
      try {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, params.id)).limit(1);
        if (!org) {
          set.status = 404;
          return { success: false, error: 'Organisasi tidak ditemukan' };
        }

        const [existingPhone] = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.organizationId, params.id))
          .limit(1);

        const targetToken = body.accessToken?.trim() || org.accessToken;
        const targetPhoneId = body.phoneNumberId?.trim() || existingPhone?.id;
        const targetWabaId = body.wabaId?.trim() || org.wabaId;

        if (!targetToken) {
          set.status = 400;
          return { success: false, error: 'Access Token belum diisi atau belum tersimpan' };
        }

        if (!targetPhoneId) {
          set.status = 400;
          return { success: false, error: 'Phone Number ID belum diisi atau belum tersimpan' };
        }

        // Test Phone Number ID with Meta Graph API
        const phoneRes = await fetch(
          `https://graph.facebook.com/v21.0/${targetPhoneId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput`,
          {
            headers: {
              Authorization: `Bearer ${targetToken}`,
            },
          }
        );

        const phoneData = await phoneRes.json();

        if (!phoneRes.ok || phoneData.error) {
          return {
            success: false,
            error: phoneData.error?.message || 'Koneksi ke Meta Cloud API gagal. Periksa kembali Token dan Phone ID.',
            metaError: phoneData.error,
          };
        }

        let wabaData = null;
        if (targetWabaId) {
          try {
            const wabaRes = await fetch(
              `https://graph.facebook.com/v21.0/${targetWabaId}?fields=id,name,currency,timezone_id,message_template_namespace`,
              {
                headers: {
                  Authorization: `Bearer ${targetToken}`,
                },
              }
            );
            wabaData = await wabaRes.json();
          } catch (_) {}
        }

        return {
          success: true,
          message: 'Koneksi ke Meta WhatsApp Cloud API Terverifikasi & Aktif!',
          data: {
            phoneNumber: phoneData,
            waba: wabaData && !wabaData.error ? wabaData : null,
          },
        };
      } catch (e: any) {
        set.status = 500;
        return { success: false, error: e.message };
      }
    },
    {
      body: t.Object({
        phoneNumberId: t.Optional(t.String()),
        accessToken: t.Optional(t.String()),
        wabaId: t.Optional(t.String()),
      }),
    }
  )

  // ─── PUT /super-admin/organizations/:id/meta-config ────────
  .put(
    '/organizations/:id/meta-config',
    async ({ params, body, set }) => {
      try {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, params.id)).limit(1);
        if (!org) {
          set.status = 404;
          return { success: false, error: 'Organisasi tidak ditemukan' };
        }

        // Update org token & WABA ID
        await db
          .update(organizations)
          .set({
            wabaId: body.wabaId?.trim() || org.wabaId,
            appId: body.appId?.trim() || org.appId,
            accessToken: body.accessToken?.trim() || org.accessToken,
          })
          .where(eq(organizations.id, params.id));

        // Update / Insert into phone_numbers table
        if (body.phoneNumberId?.trim()) {
          const [existingPhone] = await db
            .select()
            .from(phoneNumbers)
            .where(eq(phoneNumbers.organizationId, params.id))
            .limit(1);

          if (existingPhone) {
            await db
              .update(phoneNumbers)
              .set({
                phoneNumberId: body.phoneNumberId.trim(),
                displayPhoneNumber: body.displayPhoneNumber?.trim() || existingPhone.displayPhoneNumber,
                verifiedName: body.verifiedName?.trim() || existingPhone.verifiedName,
                qualityRating: body.qualityRating || existingPhone.qualityRating,
                status: 'CONNECTED',
              })
              .where(eq(phoneNumbers.organizationId, params.id));
          } else {
            await db.insert(phoneNumbers).values({
              id: nanoid(),
              organizationId: params.id,
              phoneNumberId: body.phoneNumberId.trim(),
              displayPhoneNumber: body.displayPhoneNumber?.trim() || 'WhatsApp Official',
              verifiedName: body.verifiedName?.trim() || org.name,
              qualityRating: body.qualityRating || 'UNKNOWN',
              status: 'CONNECTED',
            });
          }
        }

        return {
          success: true,
          message: `Konfigurasi Meta WhatsApp untuk "${org.name}" berhasil disimpan!`,
        };
      } catch (e: any) {
        set.status = 400;
        return { success: false, error: e.message };
      }
    },
    {
      body: t.Object({
        wabaId: t.Optional(t.String()),
        phoneNumberId: t.Optional(t.String()),
        displayPhoneNumber: t.Optional(t.String()),
        verifiedName: t.Optional(t.String()),
        appId: t.Optional(t.String()),
        accessToken: t.Optional(t.String()),
        qualityRating: t.Optional(t.String()),
      }),
    }
  )

  // ─── GET /super-admin/staff (List Standalone Platform Staff) ────────
  .get('/staff', async () => {
    const staffMembers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        status: users.status,
        isOnline: users.isOnline,
        isPrimaryAdmin: users.isPrimaryAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(isNull(users.organizationId))
      .orderBy(desc(users.createdAt));

    return {
      success: true,
      data: staffMembers,
    };
  })

  // ─── POST /super-admin/staff (Create Standalone Platform Staff) ────────
  .post(
    '/staff',
    async ({ user, body, set }) => {
      // Only SUPER_ADMIN can create staff
      if (user!.role !== 'SUPER_ADMIN') {
        const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, user!.id)).limit(1);
        if (dbUser?.role !== 'SUPER_ADMIN') {
          set.status = 403;
          return { success: false, error: 'Hanya Master Super Administrator yang berhak membuat akun staf platform.' };
        }
      }

      const cleanEmail = body.email.toLowerCase().trim();
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).limit(1);
      if (existing) {
        set.status = 400;
        return { success: false, error: `Email "${body.email}" sudah digunakan di sistem.` };
      }

      const passwordHash = await Bun.password.hash(body.password, {
        algorithm: 'bcrypt',
        cost: 10,
      });

      const staffId = `staff_${nanoid(12)}`;

      await db.insert(users).values({
        id: staffId,
        organizationId: null, // Standalone platform staff
        teamId: null,
        email: cleanEmail,
        passwordHash,
        fullName: body.fullName.trim(),
        role: body.role as UserRole,
        status: 'ACTIVE',
        isOnline: false,
        maxActiveChats: 0,
      });

      return {
        success: true,
        message: `Akun staf platform "${body.fullName}" (${body.role}) berhasil dibuat!`,
        data: {
          id: staffId,
          fullName: body.fullName.trim(),
          email: cleanEmail,
          role: body.role,
          status: 'ACTIVE',
        },
      };
    },
    {
      body: t.Object({
        fullName: t.String({ minLength: 2 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
        role: t.Union([
          t.Literal('SUPER_ADMIN'),
          t.Literal('CO_SUPER_ADMIN'),
          t.Literal('ADMIN_FINANCE'),
          t.Literal('ADMIN_SUPPORT'),
        ]),
      }),
    }
  )

  // ─── PUT /super-admin/staff/:id (Update Standalone Platform Staff) ────────
  .put(
    '/staff/:id',
    async ({ params, user, body, set }) => {
      // Only SUPER_ADMIN can update staff
      if (user!.role !== 'SUPER_ADMIN') {
        const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, user!.id)).limit(1);
        if (dbUser?.role !== 'SUPER_ADMIN') {
          set.status = 403;
          return { success: false, error: 'Hanya Master Super Administrator yang berhak mengubah data staf platform.' };
        }
      }

      const [target] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, params.id), isNull(users.organizationId)))
        .limit(1);

      if (!target) {
        set.status = 404;
        return { success: false, error: 'Akun staf platform tidak ditemukan atau bukan akun independen.' };
      }

      const updateData: Record<string, any> = {};
      if (body.fullName && body.fullName.trim()) updateData.fullName = body.fullName.trim();
      if (body.role) updateData.role = body.role as UserRole;
      if (body.status) updateData.status = body.status as UserStatus;

      if (body.email && body.email.toLowerCase().trim() !== target.email.toLowerCase()) {
        const cleanEmail = body.email.toLowerCase().trim();
        const [duplicate] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, cleanEmail), sql`${users.id} != ${params.id}`))
          .limit(1);
        if (duplicate) {
          set.status = 400;
          return { success: false, error: `Email "${body.email}" sudah digunakan oleh akun lain.` };
        }
        updateData.email = cleanEmail;
      }

      if (body.password && body.password.trim()) {
        updateData.passwordHash = await Bun.password.hash(body.password.trim(), {
          algorithm: 'bcrypt',
          cost: 10,
        });
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData).where(eq(users.id, params.id));
      }

      return {
        success: true,
        message: `Data staf platform "${updateData.fullName || target.fullName}" berhasil diperbarui!`,
      };
    },
    {
      body: t.Object({
        fullName: t.Optional(t.String()),
        email: t.Optional(t.String({ format: 'email' })),
        role: t.Optional(
          t.Union([
            t.Literal('SUPER_ADMIN'),
            t.Literal('CO_SUPER_ADMIN'),
            t.Literal('ADMIN_FINANCE'),
            t.Literal('ADMIN_SUPPORT'),
          ])
        ),
        status: t.Optional(
          t.Union([
            t.Literal('ACTIVE'),
            t.Literal('INACTIVE'),
            t.Literal('SUSPENDED'),
          ])
        ),
        password: t.Optional(t.String({ minLength: 6 })),
      }),
    }
  )

  // ─── DELETE /super-admin/staff/:id (Delete Standalone Platform Staff) ────────
  .delete('/staff/:id', async ({ params, user, set }) => {
    // Only SUPER_ADMIN can delete staff
    if (user!.role !== 'SUPER_ADMIN') {
      const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, user!.id)).limit(1);
      if (dbUser?.role !== 'SUPER_ADMIN') {
        set.status = 403;
        return { success: false, error: 'Hanya Master Super Administrator yang berhak menghapus staf platform.' };
      }
    }

    if (user!.id === params.id) {
      set.status = 400;
      return { success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang aktif login.' };
    }

    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, params.id), isNull(users.organizationId)))
      .limit(1);

    if (!target) {
      set.status = 404;
      return { success: false, error: 'Akun staf platform tidak ditemukan atau bukan akun independen.' };
    }

    // Clean up dependent foreign keys safely before deleting staff
    try {
      await db.execute(sql`UPDATE conversations SET assigned_user_id = NULL WHERE assigned_user_id = ${params.id}`);
    } catch (_) {}
    try {
      await db.execute(sql`DELETE FROM conversation_participants WHERE user_id = ${params.id}`);
    } catch (_) {}
    try {
      await db.execute(sql`UPDATE broadcast_campaigns SET created_by_id = NULL WHERE created_by_id = ${params.id}`);
    } catch (_) {}
    try {
      await db.execute(sql`UPDATE subscription_orders SET user_id = NULL WHERE user_id = ${params.id}`);
    } catch (_) {}
    try {
      await db.execute(sql`UPDATE activity_logs SET user_id = NULL WHERE user_id = ${params.id}`);
    } catch (_) {}

    await db.delete(users).where(eq(users.id, params.id));

    return {
      success: true,
      message: `Akun staf platform "${target.fullName}" (${target.email}) berhasil dihapus.`,
    };
  })

  // ─── POST /super-admin/staff/:id/reset-password (Reset Staff Password) ────────
  .post(
    '/staff/:id/reset-password',
    async ({ params, user, body, set }) => {
      if (user!.role !== 'SUPER_ADMIN') {
        const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, user!.id)).limit(1);
        if (dbUser?.role !== 'SUPER_ADMIN') {
          set.status = 403;
          return { success: false, error: 'Hanya Master Super Administrator yang berhak mereset password staf.' };
        }
      }

      const [target] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, params.id), isNull(users.organizationId)))
        .limit(1);

      if (!target) {
        set.status = 404;
        return { success: false, error: 'Akun staf platform tidak ditemukan.' };
      }

      const newHash = await Bun.password.hash(body.newPassword.trim(), {
        algorithm: 'bcrypt',
        cost: 10,
      });

      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, params.id));

      return {
        success: true,
        message: `Password akun staf "${target.fullName}" (${target.email}) berhasil direset!`,
      };
    },
    {
      body: t.Object({
        newPassword: t.String({ minLength: 6 }),
      }),
    }
  )

  // ─── GET /super-admin/transactions ────────────────────────
  .get(
    '/transactions',
    async ({ query, set }) => {
      try {
        const transactions = await BillingService.listAllOrders(query?.status);
        let totalRevenue = 0;
        let paidCount = 0;
        let pendingCount = 0;
        let failedCount = 0;

        for (const t of transactions) {
          if (t.paymentStatus === 'PAID') {
            totalRevenue += Number(t.amount) || 0;
            paidCount++;
          } else if (t.paymentStatus === 'PENDING') {
            pendingCount++;
          } else if (t.paymentStatus === 'FAILED' || t.paymentStatus === 'EXPIRED') {
            failedCount++;
          }
        }

        return {
          success: true,
          data: transactions,
          summary: {
            totalRevenue,
            paidCount,
            pendingCount,
            failedCount,
            totalOrders: transactions.length,
          },
        };
      } catch (err: any) {
        set.status = 500;
        return { success: false, error: err?.message || 'Gagal mengambil riwayat transaksi platform' };
      }
    },
    {
      query: t.Optional(
        t.Object({
          status: t.Optional(t.String()),
        })
      ),
    }
  )

  // ─── POST /super-admin/transactions/:id/confirm-manual ─────
  .post('/transactions/:id/confirm-manual', async ({ params, user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const updatedOrder = await BillingService.confirmManualPayment(params.id, user.email);
      return {
        success: true,
        message: `Pembayaran untuk order "${updatedOrder.orderNumber}" berhasil dikonfirmasi secara manual & paket langsung aktif!`,
        data: updatedOrder,
      };
    } catch (err: any) {
      set.status = 400;
      return { success: false, error: err?.message || 'Gagal mengonfirmasi pembayaran' };
    }
  })

  // ─── POST /super-admin/transactions/:id/cancel ──────────────
  .post('/transactions/:id/cancel', async ({ params, set }) => {
    try {
      await BillingService.cancelOrder(params.id);
      return { success: true, message: 'Transaksi berhasil dibatalkan.' };
    } catch (err: any) {
      set.status = 400;
      return { success: false, error: err?.message || 'Gagal membatalkan transaksi' };
    }
  })

  // ─── PUT /super-admin/organizations/:id/change-plan ─────────
  .put(
    '/organizations/:id/change-plan',
    async ({ params, body, set }) => {
      try {
        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, params.id))
          .limit(1);

        if (!org) {
          set.status = 404;
          return { success: false, error: 'Organisasi tidak ditemukan' };
        }

        // Ambil daftar paket SaaS dari settings
        const [plansSetting] = await db
          .select()
          .from(platformSettings)
          .where(eq(platformSettings.key, 'saas_plans'))
          .limit(1);

        let planList: any[] = [];
        if (plansSetting?.value) {
          planList =
            typeof plansSetting.value === 'string'
              ? JSON.parse(plansSetting.value)
              : plansSetting.value;
        }

        const selectedPlan = planList.find(
          (p: any) => p.code.toUpperCase() === body.planCode.toUpperCase()
        );

        let newExpiresAt: Date | null = null;
        if (body.isLifetime || body.durationDays === 0) {
          newExpiresAt = null;
        } else if (body.customExpiresAt) {
          newExpiresAt = new Date(body.customExpiresAt);
        } else if (typeof body.durationDays === 'number' && body.durationDays > 0) {
          const now = Date.now();
          const currentExp = org.expiresAt
            ? new Date(org.expiresAt).getTime()
            : 0;
          const baseTime = currentExp > now ? currentExp : now;
          newExpiresAt = new Date(baseTime + body.durationDays * 86400000);
        } else if (selectedPlan) {
          const days = selectedPlan.durationDays || 30;
          newExpiresAt = days === 0 ? null : new Date(Date.now() + days * 86400000);
        } else {
          newExpiresAt = new Date(Date.now() + 30 * 86400000);
        }

        // Terapkan batasan jumlah agen CS dan kuota broadcast sesuai paket aktif yang dipilih
        const maxAgents =
          body.customMaxAgents ??
          selectedPlan?.maxAgents ??
          selectedPlan?.maxCsUsers ??
          org.maxAgents ??
          5;

        const maxBroadcastPerMonth =
          body.customMaxBroadcast ??
          selectedPlan?.maxBroadcastPerMonth ??
          org.maxBroadcastPerMonth ??
          10000;

        await db
          .update(organizations)
          .set({
            plan: body.planCode.toUpperCase() as OrgPlan,
            status: 'ACTIVE',
            expiresAt: newExpiresAt,
            maxAgents,
            maxBroadcastPerMonth,
            notes: body.notes ? body.notes : org.notes,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, params.id));

        const [updatedOrg] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, params.id))
          .limit(1);

        return {
          success: true,
          message: `Paket organisasi "${org.name}" berhasil diubah ke ${body.planCode.toUpperCase()}! Masa aktif & kuota agen (${maxAgents} kursi) telah diperbarui.`,
          data: updatedOrg,
        };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err?.message || 'Gagal mengubah paket organisasi' };
      }
    },
    {
      body: t.Object({
        planCode: t.String(),
        durationDays: t.Optional(t.Number()),
        customExpiresAt: t.Optional(t.String()),
        isLifetime: t.Optional(t.Boolean()),
        customMaxAgents: t.Optional(t.Number()),
        customMaxBroadcast: t.Optional(t.Number()),
      }),
    }
  )

  // ─── GET /super-admin/system/git-status ──────────
  .get('/system/git-status', async ({ user, set }) => {
    const isPrimary = await checkIsPrimaryAdmin(user?.id);
    if (!isPrimary) {
      set.status = 403;
      return {
        success: false,
        error: 'Akses ditolak. Fitur Update Sistem hanya dapat diakses oleh Administrator Utama.',
      };
    }

    try {
      const git = getGitCmd();
      const repoDir = getRepoDir();

      const { stdout: branchOut } = await execAsync(`${git} rev-parse --abbrev-ref HEAD`, {
        cwd: repoDir,
      });
      const currentBranch = branchOut.trim();

      const { stdout: logOut } = await execAsync(
        `${git} log -1 --format="%H|%h|%s|%an|%ae|%ad"`,
        { cwd: repoDir }
      );
      const [fullHash, shortHash, subject, authorName, authorEmail, dateStr] = logOut
        .trim()
        .split('|');

      let remoteUrl = '';
      try {
        const { stdout: remoteOut } = await execAsync(`${git} remote get-url origin`, {
          cwd: repoDir,
        });
        remoteUrl = remoteOut.trim();
      } catch (_) {}

      let hasLocalChanges = false;
      try {
        const { stdout: statusOut } = await execAsync(`${git} status --porcelain`, {
          cwd: repoDir,
        });
        hasLocalChanges = statusOut.trim().length > 0;
      } catch (_) {}

      return {
        success: true,
        data: {
          currentBranch,
          commitHash: fullHash,
          shortHash,
          commitMessage: subject,
          author: authorName,
          authorEmail,
          commitDate: dateStr,
          remoteUrl,
          hasLocalChanges,
        },
      };
    } catch (err: any) {
      set.status = 500;
      return { success: false, error: err?.message || 'Gagal membaca status Git sistem' };
    }
  })

  // ─── POST /super-admin/system/git-check-update ────
  .post('/system/git-check-update', async ({ user, set }) => {
    const isPrimary = await checkIsPrimaryAdmin(user?.id);
    if (!isPrimary) {
      set.status = 403;
      return {
        success: false,
        error: 'Akses ditolak. Fitur Update Sistem hanya dapat diakses oleh Administrator Utama.',
      };
    }

    try {
      const git = getGitCmd();
      const repoDir = getRepoDir();

      const { stdout: branchOut } = await execAsync(`${git} rev-parse --abbrev-ref HEAD`, {
        cwd: repoDir,
      });
      const currentBranch = branchOut.trim();

      // Fetch latest commits from origin
      await execAsync(`${git} fetch origin ${currentBranch}`, {
        cwd: repoDir,
        timeout: 30000,
      });

      // Compare commits
      let behindCount = 0;
      try {
        const { stdout: revOut } = await execAsync(
          `${git} rev-list --count HEAD..origin/${currentBranch}`,
          { cwd: repoDir }
        );
        behindCount = parseInt(revOut.trim(), 10) || 0;
      } catch (_) {}

      let incomingCommits: any[] = [];
      if (behindCount > 0) {
        try {
          const { stdout: listOut } = await execAsync(
            `${git} log -n 10 --format="%h|%s|%an|%ad" HEAD..origin/${currentBranch}`,
            { cwd: repoDir }
          );
          incomingCommits = listOut
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const [hash, msg, author, date] = line.split('|');
              return { hash, message: msg, author, date };
            });
        } catch (_) {}
      }

      return {
        success: true,
        data: {
          currentBranch,
          behindCount,
          isUpToDate: behindCount === 0,
          incomingCommits,
        },
      };
    } catch (err: any) {
      set.status = 500;
      return { success: false, error: err?.message || 'Gagal memeriksa pembaruan di GitHub' };
    }
  })

  // ─── POST /super-admin/system/git-pull ────────────
  .post('/system/git-pull', async ({ user, set }) => {
    const isPrimary = await checkIsPrimaryAdmin(user?.id);
    if (!isPrimary) {
      set.status = 403;
      return {
        success: false,
        error: 'Akses ditolak. Fitur Update Sistem hanya dapat dieksekusi oleh Administrator Utama.',
      };
    }

    try {
      const git = getGitCmd();
      const repoDir = getRepoDir();

      const { stdout: branchOut } = await execAsync(`${git} rev-parse --abbrev-ref HEAD`, {
        cwd: repoDir,
      });
      const currentBranch = branchOut.trim();

      // 1. Tarik pembaruan kode terbaru dari origin
      const { stdout, stderr } = await execAsync(`${git} pull origin ${currentBranch}`, {
        cwd: repoDir,
        timeout: 60000,
      });

      const gitOutput = `${stdout || ''}\n${stderr || ''}`.trim();

      // 2. Sinkronkan skema database secara aman (Non-Destructive DDL)
      let dbSyncStatus = 'Struktur database & relasi berhasil disinkronkan aman tanpa menghapus data.';
      try {
        await testConnection();
      } catch (dbErr: any) {
        dbSyncStatus = `Catatan sinkronisasi database: ${dbErr?.message || dbErr}`;
      }

      return {
        success: true,
        message: 'Pembaruan dari GitHub dan skema database berhasil diterapkan tanpa menghapus data!',
        output: `${gitOutput}\n\n[Database Migration Sync]\n${dbSyncStatus}`,
      };
    } catch (err: any) {
      set.status = 500;
      return {
        success: false,
        error: err?.message || 'Gagal menjalankan git pull',
        output: `${err?.stdout || ''}\n${err?.stderr || ''}`.trim(),
      };
    }
  })

  // ─── POST /super-admin/system/db-sync ─────────────
  .post('/system/db-sync', async ({ user, set }) => {
    const isPrimary = await checkIsPrimaryAdmin(user?.id);
    if (!isPrimary) {
      set.status = 403;
      return {
        success: false,
        error: 'Akses ditolak. Fitur Sinkronisasi Database hanya dapat dieksekusi oleh Administrator Utama.',
      };
    }

    try {
      // Jalankan sinkronisasi non-destructive (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, index, dll.)
      await testConnection();

      return {
        success: true,
        message: 'Skema database terbaru berhasil disinkronkan secara aman! Seluruh data, relasi, dan tabel yang ada tetap terjaga 100%.',
        output: `[${new Date().toISOString()}] Database migration sync verified. Non-destructive alterations applied successfully.`,
      };
    } catch (err: any) {
      set.status = 500;
      return {
        success: false,
        error: err?.message || 'Gagal melakukan sinkronisasi database',
      };
    }
  });

