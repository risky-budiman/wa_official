// ===========================================
// Template Service & Backend Routes
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { env } from '../../config/env';
import { db } from '../../config/database';
import { messageTemplates, organizations } from '../../db/schema';
import { authPlugin } from '../../middleware/auth';
import { rbacPlugin } from '../../middleware/rbac';
import { MetaApiService } from '../../services/meta-api.service';
import type { TemplateCategory, TemplateStatus } from '../../db/schema/message-templates';

export class TemplateService {
  static async list(orgId: string) {
    return await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.organizationId, orgId))
      .orderBy(desc(messageTemplates.createdAt));
  }

  static async syncFromMeta(orgId: string) {
    const [org] = await db
      .select({
        wabaId: organizations.wabaId,
        accessToken: organizations.accessToken,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const activeToken = org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
      ? org.accessToken
      : env.META_ACCESS_TOKEN;

    let activeWabaId = org?.wabaId && org.wabaId.length > 8
      ? org.wabaId
      : env.META_WABA_ID;

    // Fallback: Resolve WABA ID from Phone Number ID if token is available
    if (activeToken && (!activeWabaId || activeWabaId === '1386698372551547') && env.META_PHONE_NUMBER_ID) {
      try {
        const resolvedWaba = await MetaApiService.fetchWabaIdFromPhoneNumberId(env.META_PHONE_NUMBER_ID, activeToken);
        if (resolvedWaba) {
          activeWabaId = resolvedWaba;
          if (orgId) {
            await db
              .update(organizations)
              .set({ wabaId: resolvedWaba })
              .where(eq(organizations.id, orgId));
          }
        }
      } catch (_) {}
    }

    if (!activeWabaId || !activeToken) {
      return { success: false, error: 'WABA ID atau Access Token belum terpasang di Pengaturan / .env' };
    }

    try {
      const apiVersion = env.META_API_VERSION || 'v20.0';
      const url = `https://graph.facebook.com/${apiVersion}/${activeWabaId}/message_templates?limit=100&access_token=${activeToken}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data?.error) {
        console.error('Meta Template Sync Error:', data.error);
        return {
          success: false,
          error: `Meta API Error: ${data.error.message} (${data.error.type || 'Error'})`,
        };
      }

      if (data?.data && Array.isArray(data.data)) {
        for (const metaTpl of data.data) {
          const existing = await db
            .select()
            .from(messageTemplates)
            .where(
              and(
                eq(messageTemplates.organizationId, orgId),
                eq(messageTemplates.name, metaTpl.name)
              )
            )
            .limit(1);

          const statusMap: Record<string, TemplateStatus> = {
            APPROVED: 'APPROVED',
            PENDING: 'PENDING',
            REJECTED: 'REJECTED',
            PAUSED: 'PAUSED',
          };

          if (existing.length > 0) {
            await db
              .update(messageTemplates)
              .set({
                metaTemplateId: metaTpl.id,
                category: (metaTpl.category as TemplateCategory) || existing[0].category,
                language: metaTpl.language || existing[0].language,
                status: statusMap[metaTpl.status] || existing[0].status,
                components: metaTpl.components || existing[0].components,
              })
              .where(eq(messageTemplates.id, existing[0].id));
          } else {
            await db.insert(messageTemplates).values({
              id: nanoid(),
              organizationId: orgId,
              name: metaTpl.name,
              category: (metaTpl.category as TemplateCategory) || 'UTILITY',
              language: metaTpl.language || 'id',
              status: statusMap[metaTpl.status] || 'APPROVED',
              components: metaTpl.components || [],
              metaTemplateId: metaTpl.id,
            });
          }
        }
      }
      return { success: true, count: data?.data?.length || 0 };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static async create(orgId: string, body: {
    name: string;
    category: TemplateCategory;
    language?: string;
    components: Record<string, unknown>[];
  }) {
    const id = nanoid();
    const formattedName = body.name.toLowerCase().replace(/\s+/g, '_');

    const [org] = await db
      .select({
        wabaId: organizations.wabaId,
        accessToken: organizations.accessToken,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    let metaTemplateId: string | null = null;
    let templateStatus: TemplateStatus = 'APPROVED';

    // Submit live to Meta Graph API if authentic token exists
    if (org?.wabaId && org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')) {
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v20.0/${org.wabaId}/message_templates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${org.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formattedName,
            category: body.category,
            language: body.language || 'id',
            components: body.components,
          }),
        });
        const metaData = await metaRes.json();
        if (metaData?.id) {
          metaTemplateId = metaData.id;
          templateStatus = metaData.status || 'PENDING';
        }
      } catch (err) {
        console.warn('Meta template submit notice:', err);
      }
    }

    await db.insert(messageTemplates).values({
      id,
      organizationId: orgId,
      name: formattedName,
      category: body.category,
      language: body.language || 'id',
      status: templateStatus,
      components: body.components,
      metaTemplateId: metaTemplateId || `meta_${nanoid(8)}`,
    });

    return { id, name: formattedName, status: templateStatus, metaTemplateId };
  }

  static async delete(orgId: string, id: string) {
    const [existing] = await db
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, id),
          eq(messageTemplates.organizationId, orgId)
        )
      )
      .limit(1);

    if (existing) {
      const [org] = await db
        .select({
          wabaId: organizations.wabaId,
          accessToken: organizations.accessToken,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      if (org?.wabaId && org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')) {
        try {
          await fetch(`https://graph.facebook.com/v20.0/${org.wabaId}/message_templates?name=${existing.name}&access_token=${org.accessToken}`, {
            method: 'DELETE',
          });
        } catch (_) {}
      }

      await db
        .delete(messageTemplates)
        .where(
          and(
            eq(messageTemplates.id, id),
            eq(messageTemplates.organizationId, orgId)
          )
        );
    }
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

  // ─── POST /templates/sync (Sync Live Meta Templates) ──
  .post('/sync', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    const result = await TemplateService.syncFromMeta(user.orgId);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const items = await TemplateService.list(user.orgId);
    return {
      success: true,
      message: `Berhasil menyinkronkan ${result.count} template dari Meta Graph API!`,
      count: result.count,
      items,
    };
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
