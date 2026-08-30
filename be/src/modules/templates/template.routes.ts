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
        const activeMetaNames = new Set(data.data.map((t: any) => t.name));

        // 1. Upsert templates from Meta
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

        // 2. Prune / Delete local templates that were removed on Meta
        const currentLocal = await db
          .select({ id: messageTemplates.id, name: messageTemplates.name })
          .from(messageTemplates)
          .where(eq(messageTemplates.organizationId, orgId));

        for (const localTpl of currentLocal) {
          if (!activeMetaNames.has(localTpl.name)) {
            console.log(`🗑️ Menghapus template lokal "${localTpl.name}" karena sudah dihapus di Meta.`);
            await db
              .delete(messageTemplates)
              .where(
                and(
                  eq(messageTemplates.id, localTpl.id),
                  eq(messageTemplates.organizationId, orgId)
                )
              );
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
        }
      } catch (_) {}
    }

    let metaTemplateId: string | null = null;
    let templateStatus: TemplateStatus = 'APPROVED';

    // Submit live to Meta Graph API if authentic token exists
    if (activeWabaId && activeToken && !activeToken.startsWith('EAAGm0PX4ZCBO')) {
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v20.0/${activeWabaId}/message_templates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
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
        console.log('📡 Meta template create response:', metaData);
        if (metaData?.id) {
          metaTemplateId = metaData.id;
          templateStatus = metaData.status || 'PENDING';
        } else if (metaData?.error) {
          throw new Error(`Meta API Error: ${metaData.error.message}`);
        }
      } catch (err: any) {
        console.warn('Meta template submit notice:', err.message);
        if (err.message?.startsWith('Meta API Error:')) {
          throw err;
        }
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

  static async update(orgId: string, id: string, body: {
    category?: TemplateCategory;
    language?: string;
    components: Record<string, unknown>[];
  }) {
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

    if (!existing) {
      throw new Error('Template tidak ditemukan');
    }

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

    let templateStatus: TemplateStatus = existing.status || 'APPROVED';

    // If connected to live Meta Graph API and has valid metaTemplateId
    if (activeToken && !activeToken.startsWith('EAAGm0PX4ZCBO') && existing.metaTemplateId && !existing.metaTemplateId.startsWith('meta_')) {
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v20.0/${existing.metaTemplateId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            components: body.components,
          }),
        });
        const metaData = await metaRes.json();
        if (metaData?.success) {
          templateStatus = 'PENDING';
        } else if (metaData?.error) {
          console.warn('Meta template update warning:', metaData.error);
        }
      } catch (err) {
        console.warn('Meta template update notice:', err);
      }
    }

    await db
      .update(messageTemplates)
      .set({
        category: body.category || existing.category,
        language: body.language || existing.language,
        components: body.components,
        status: templateStatus,
      })
      .where(
        and(
          eq(messageTemplates.id, id),
          eq(messageTemplates.organizationId, orgId)
        )
      );

    return { id, success: true, status: templateStatus };
  }

  static async seedSamples(orgId: string) {
    const samples: Array<{
      name: string;
      category: TemplateCategory;
      language: string;
      components: Record<string, unknown>[];
    }> = [
      {
        name: 'konfirmasi_pesanan_v1',
        category: 'UTILITY',
        language: 'id',
        components: [
          { type: 'HEADER', format: 'TEXT', text: 'Konfirmasi Pesanan' },
          {
            type: 'BODY',
            text: 'Halo {{1}}, terima kasih telah berbelanja. Pesanan Anda #{{2}} telah kami konfirmasi dengan total Rp {{3}}. Paket akan segera diproses pengirimannya.',
          },
          { type: 'FOOTER', text: 'Layanan WhatsApp Resmi' },
        ],
      },
      {
        name: 'pengingat_jadwal_v1',
        category: 'UTILITY',
        language: 'id',
        components: [
          { type: 'HEADER', format: 'TEXT', text: 'Pengingat Janji Temu' },
          {
            type: 'BODY',
            text: 'Halo Bapak/Ibu {{1}}, kami mengingatkan jadwal janji temu Anda pada hari {{2}} pukul {{3}} WIB di {{4}}. Mohon konfirmasi jika ada perubahan jadwal.',
          },
          { type: 'FOOTER', text: 'Customer Service' },
        ],
      },
      {
        name: 'notifikasi_tagihan_v1',
        category: 'UTILITY',
        language: 'id',
        components: [
          { type: 'HEADER', format: 'TEXT', text: 'Pemberitahuan Tagihan' },
          {
            type: 'BODY',
            text: 'Yth. {{1}}, tagihan layanan Anda untuk periode {{2}} sebesar Rp {{3}} telah terbit dan jatuh tempo pada {{4}}. Segera lakukan pembayaran untuk menjaga kelancaran layanan.',
          },
          { type: 'FOOTER', text: 'Divisi Billing & Keuangan' },
        ],
      },
      {
        name: 'promo_spesial_member_v1',
        category: 'MARKETING',
        language: 'id',
        components: [
          { type: 'HEADER', format: 'TEXT', text: '🎉 Promo Spesial Eksklusif!' },
          {
            type: 'BODY',
            text: 'Hai {{1}}! Dapatkan penawaran istimewa diskon {{2}}% untuk semua produk pilihan kami dengan kode promo {{3}}. Promo berlaku s/d {{4}}. Klaim sekarang!',
          },
          { type: 'FOOTER', text: 'Syarat & Ketentuan berlaku' },
        ],
      },
      {
        name: 'verifikasi_otp_v1',
        category: 'AUTHENTICATION',
        language: 'id',
        components: [
          {
            type: 'BODY',
            text: 'Kode verifikasi (OTP) keamanan Anda adalah: {{1}}. Jangan bagikan kode ini kepada siapa pun termasuk pihak kami demi keamanan akun Anda. Berlaku {{2}} menit.',
          },
          { type: 'FOOTER', text: 'Keamanan Akun' },
        ],
      },
    ];

    let createdCount = 0;
    for (const sample of samples) {
      const [existing] = await db
        .select()
        .from(messageTemplates)
        .where(
          and(
            eq(messageTemplates.organizationId, orgId),
            eq(messageTemplates.name, sample.name)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(messageTemplates).values({
          id: nanoid(),
          organizationId: orgId,
          name: sample.name,
          category: sample.category,
          language: sample.language,
          status: 'APPROVED',
          components: sample.components,
          metaTemplateId: `meta_sample_${nanoid(6)}`,
        });
        createdCount++;
      }
    }

    return { success: true, count: createdCount };
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
          }
        } catch (_) {}
      }

      if (activeWabaId && activeToken && !activeToken.startsWith('EAAGm0PX4ZCBO')) {
        try {
          const apiVersion = env.META_API_VERSION || 'v20.0';
          let deleteUrl = `https://graph.facebook.com/${apiVersion}/${activeWabaId}/message_templates?name=${encodeURIComponent(existing.name)}`;
          if (existing.metaTemplateId && /^\d+$/.test(existing.metaTemplateId)) {
            deleteUrl += `&hsm_id=${existing.metaTemplateId}`;
          }

          console.log(`🌐 Mengirim DELETE template ke Meta: ${deleteUrl}`);
          const res = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${activeToken}`,
            },
          });
          const metaRes = await res.json();
          console.log(`📡 Respon hapus template Meta:`, metaRes);
        } catch (err: any) {
          console.warn('⚠️ Gagal menghapus template di Meta:', err.message);
        }
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

  // ─── POST /templates/samples (Seed Standard Samples) ──
  .post('/samples', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    if (user.role === 'AGENT') {
      set.status = 403;
      return { success: false, error: 'Akses ditolak' };
    }

    const result = await TemplateService.seedSamples(user.orgId);
    const items = await TemplateService.list(user.orgId);
    return {
      success: true,
      message: `Berhasil menambahkan ${result.count} contoh template WhatsApp siap pakai!`,
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

  // ─── PUT /templates/:id (Admin & Supervisor Only) ─
  .put(
    '/:id',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      if (user.role === 'AGENT') {
        set.status = 403;
        return { success: false, error: 'Agen tidak memiliki hak untuk mengubah template' };
      }

      try {
        const item = await TemplateService.update(user.orgId, params.id, body as any);
        return { success: true, item };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        category: t.Optional(
          t.Union([
            t.Literal('MARKETING'),
            t.Literal('UTILITY'),
            t.Literal('AUTHENTICATION'),
          ])
        ),
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
