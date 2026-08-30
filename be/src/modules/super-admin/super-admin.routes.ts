// ===========================================
// Super Admin Routes — Multi-Tenant SaaS Organization Management Hub
// ===========================================

import { Elysia, t } from 'elysia';
import { db } from '../../config/database';
import { organizations, type OrgStatus, type OrgPlan } from '../../db/schema/organizations';
import { users } from '../../db/schema/users';
import { conversations } from '../../db/schema/conversations';
import { messages } from '../../db/schema/messages';
import { contacts } from '../../db/schema/contacts';
import { phoneNumbers } from '../../db/schema/phone-numbers';
import { platformSettings } from '../../db/schema/settings';
import { authPlugin } from '../../middleware/auth';
import { eq, desc, sql, and, lt, gt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { jwt } from '@elysiajs/jwt';
import { env } from '../../config/env';

export const superAdminRoutes = new Elysia({ prefix: '/super-admin' })
  .use(authPlugin)
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
    })
  )
  // Super Admin Authorization Guard (Strictly Isolated for Platform Owner)
  .onBeforeHandle(async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Autentikasi diperlukan. Silakan login kembali.' };
    }

    let currentRole = user.role;
    if (currentRole !== 'SUPER_ADMIN') {
      const [dbUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);
      if (dbUser?.role) currentRole = dbUser.role;
    }

    // Strict Isolation: ONLY SUPER_ADMIN is permitted
    if (currentRole !== 'SUPER_ADMIN') {
      set.status = 403;
      return {
        success: false,
        error: 'Akses ditolak. Panel Kontrol Organisasi ini hanya dapat diakses oleh Master Super Admin (Pemilik Platform).',
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
    if (user!.orgId === params.id) {
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
  );
