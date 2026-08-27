// ===========================================
// Template Service & Backend Routes
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../config/database';
import { messageTemplates } from '../../db/schema';
import { authPlugin } from '../../middleware/auth';
import { rbacPlugin } from '../../middleware/rbac';
import type { TemplateCategory } from '../../db/schema/message-templates';

export class TemplateService {
  static async list(orgId: string) {
    return await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.organizationId, orgId))
      .orderBy(desc(messageTemplates.createdAt));
  }

  static async create(orgId: string, body: {
    name: string;
    category: TemplateCategory;
    language: string;
    components: any[];
  }) {
    const id = nanoid();
    await db.insert(messageTemplates).values({
      id,
      organizationId: orgId,
      name: body.name.toLowerCase().replace(/\s+/g, '_'),
      category: body.category,
      language: body.language || 'id',
      status: 'APPROVED', // Simulated auto-approval in sandbox, Meta approval in prod
      components: body.components,
    });

    return { id, name: body.name, status: 'APPROVED' };
  }

  static async delete(orgId: string, id: string) {
    await db
      .delete(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, id),
          eq(messageTemplates.organizationId, orgId)
        )
      );
    return { success: true };
  }
}

export const templateRoutes = new Elysia({ prefix: '/templates' })
  .use(authPlugin)
  .use(rbacPlugin)

  // ─── GET /templates ────────────────────────
  .get('/', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    const items = await TemplateService.list(user.orgId);
    return { success: true, items };
  })

  // ─── POST /templates (Admin & Supervisor Only) ─
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      if (user.role === 'AGENT') {
        set.status = 403;
        return { success: false, error: 'Agen tidak memiliki hak untuk membuat template' };
      }

      try {
        const item = await TemplateService.create(user.orgId, body as any);
        return { success: true, item };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        category: t.Union([
          t.Literal('MARKETING'),
          t.Literal('UTILITY'),
          t.Literal('AUTHENTICATION'),
        ]),
        language: t.Optional(t.String()),
        components: t.Array(t.Any()),
      }),
    }
  )

  // ─── DELETE /templates/:id ─────────────────
  .delete('/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    if (user.role === 'AGENT') {
      set.status = 403;
      return { success: false, error: 'Akses ditolak' };
    }

    await TemplateService.delete(user.orgId, params.id);
    return { success: true };
  });
