// ===========================================
// User Management Service & Routes (Admin)
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hash } from 'argon2';
import { db } from '../../config/database';
import { users, teams, conversations } from '../../db/schema';
import { authPlugin } from '../../middleware/auth';
import type { UserRole, UserStatus } from '../../db/schema/users';

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
    if (['SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT'].includes(body.role as string)) {
      throw new Error('Role staf platform tidak dapat dibuat melalui menu staf tenant.');
    }

    const cleanEmail = body.email.toLowerCase().trim();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, cleanEmail)).limit(1);
    if (existing) {
      throw new Error(`Email "${body.email}" sudah digunakan oleh akun lain di sistem.`);
    }

    const passwordHash = await hash(body.password || 'admin12345');
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

    return { id, email: cleanEmail, fullName: body.fullName, role: body.role };
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
    if (['SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT'].includes(body.role as string)) {
      throw new Error('Role staf platform tidak dapat ditetapkan melalui menu staf tenant.');
    }

    const updatePayload: Record<string, any> = {};
    if (body.fullName !== undefined) updatePayload.fullName = body.fullName.trim();
    if (body.email !== undefined) updatePayload.email = body.email.trim();
    if (body.role !== undefined) updatePayload.role = body.role;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.isOnline !== undefined) updatePayload.isOnline = body.isOnline;
    if (body.maxActiveChats !== undefined) updatePayload.maxActiveChats = body.maxActiveChats;
    if (body.teamId !== undefined) updatePayload.teamId = body.teamId;
    if (body.password) {
      updatePayload.passwordHash = await hash(body.password);
    }

    await db
      .update(users)
      .set(updatePayload)
      .where(
        and(
          eq(users.id, userId),
          eq(users.organizationId, orgId),
          sql`${users.role} NOT IN ('SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT')`
        )
      );

    return { success: true };
  }

  static async delete(orgId: string, userId: string) {
    // 1. Clean up dependent foreign keys safely before deleting user
    try {
      await db.execute(sql`UPDATE conversations SET assigned_agent_id = NULL WHERE assigned_agent_id = ${userId}`);
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
          sql`${users.role} NOT IN ('SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT')`
        )
      );

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

    await UserService.update(user.orgId, params.id, body as any);
    return { success: true, message: 'Data pengguna berhasil diperbarui' };
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

    await UserService.delete(user.orgId, params.id);
    return { success: true };
  });
