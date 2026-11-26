// ===========================================
// Broadcast Campaign Service & Routes (Real Meta Dispatcher)
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../config/database';
import { env } from '../../config/env';
import {
  broadcastCampaigns,
  messageTemplates,
  contacts,
  phoneNumbers,
  organizations,
  conversations,
  messages,
} from '../../db/schema';
import { authPlugin } from '../../middleware/auth';
import { MetaApiService } from '../../services/meta-api.service';
import { analyzeTemplate, missingVariables, buildComponents, type BroadcastVariables } from '../../services/template-params';
import { getActivePhone } from '../../services/phone-number.service';
import { orgMetaToken, platformPhoneNumberId } from '../../services/meta-credentials';

export class BroadcastService {
  static async list(orgId: string) {
    return await db
      .select({
        id: broadcastCampaigns.id,
        name: broadcastCampaigns.name,
        status: broadcastCampaigns.status,
        totalRecipients: broadcastCampaigns.totalRecipients,
        sentCount: broadcastCampaigns.sentCount,
        deliveredCount: broadcastCampaigns.deliveredCount,
        readCount: broadcastCampaigns.readCount,
        failedCount: broadcastCampaigns.failedCount,
        scheduledAt: broadcastCampaigns.scheduledAt,
        createdAt: broadcastCampaigns.createdAt,
        template: {
          id: broadcastCampaigns.templateId,
          name: sql<string>`COALESCE(${messageTemplates.name}, ${broadcastCampaigns.templateName}, '(template dihapus)')`,
          category: sql<string>`COALESCE(${messageTemplates.category}, '-')`,
        },
      })
      .from(broadcastCampaigns)
      .leftJoin(messageTemplates, eq(broadcastCampaigns.templateId, messageTemplates.id))
      .where(eq(broadcastCampaigns.organizationId, orgId))
      .orderBy(desc(broadcastCampaigns.createdAt));
  }

  static async create(
    orgId: string,
    userId: string,
    body: {
      name: string;
      templateId: string;
      scheduledAt?: string;
      /** How each template variable is filled (contact name or fixed text) */
      variables?: BroadcastVariables;
      /** Only contacts with this tag (empty = all contacts) */
      tag?: string;
    }
  ) {
    // 1. Get Template
    const [tmpl] = await db
      .select()
      .from(messageTemplates)
      .where(and(eq(messageTemplates.id, body.templateId), eq(messageTemplates.organizationId, orgId)))
      .limit(1);

    if (!tmpl) {
      throw new Error('Template WhatsApp tidak ditemukan');
    }

    if (tmpl.status !== 'APPROVED') {
      throw new Error(
        `Template "${tmpl.name}" saat ini berstatus "${tmpl.status}". Meta WhatsApp API hanya mengizinkan pengiriman pesan broadcast untuk template yang sudah disetujui (APPROVED). Silakan buka menu Template WA untuk menyinkronkan status atau pilih template yang sudah Disetujui.`
      );
    }

    // 1b. Every variable must have a real value — never "Spesial Hari Ini" / "promo" / "PROMO2026"
    const needs = analyzeTemplate(tmpl.components);
    const missing = missingVariables(needs, body.variables);
    if (missing.length) {
      throw new Error(`Lengkapi isian template "${tmpl.name}": ${missing.join(', ')}.`);
    }

    // 2. Get Organization & Phone
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const phone = await getActivePhone(orgId);

    const activeToken = orgMetaToken(org?.accessToken);
    const activePhoneNumberId = phone?.phoneNumberId || platformPhoneNumberId() || '';
    const dbPhoneId = phone?.id || phone?.phoneNumberId || platformPhoneNumberId() || 'default';

    if (!activePhoneNumberId) {
      throw new Error('Phone Number ID Meta tidak ditemukan. Pastikan akun WhatsApp Business sudah terhubung di menu Pengaturan.');
    }

    // 3. Get Target Contacts
    const tag = (body.tag || '').trim();
    const contactList = await db
      .select({ id: contacts.id, waId: contacts.waId, name: contacts.name })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          tag ? sql`JSON_UNQUOTE(JSON_EXTRACT(${contacts.customAttributes}, '$.tag')) = ${tag}` : sql`1 = 1`
        )
      );

    if (contactList.length === 0) {
      throw new Error(tag ? `Tidak ada kontak dengan tag "${tag}".` : 'Tidak ada kontak pelanggan di database untuk dikirimi broadcast.');
    }

    // 3b. Monthly broadcast quota of the organization's plan (0 / empty = unlimited)
    const monthlyLimit = Number(org?.maxBroadcastPerMonth || 0);
    if (monthlyLimit > 0) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const [usage] = await db
        .select({
          used: sql<number>`COALESCE(SUM(CASE WHEN ${broadcastCampaigns.status} = 'PROCESSING' THEN ${broadcastCampaigns.totalRecipients} ELSE ${broadcastCampaigns.sentCount} END), 0)`,
        })
        .from(broadcastCampaigns)
        .where(and(eq(broadcastCampaigns.organizationId, orgId), gte(broadcastCampaigns.createdAt, monthStart)));
      const used = Number(usage?.used || 0);
      const remaining = Math.max(0, monthlyLimit - used);
      if (contactList.length > remaining) {
        throw new Error(
          `Kuota broadcast bulan ini tidak cukup: tersisa ${remaining.toLocaleString('id-ID')} dari ${monthlyLimit.toLocaleString('id-ID')} pesan, ` +
            `sedangkan broadcast ini akan dikirim ke ${contactList.length.toLocaleString('id-ID')} kontak. Upgrade paket atau tunggu bulan depan.`
        );
      }
    }

    const campaignId = nanoid();
    const totalRecipients = contactList.length;

    // 4. Insert Initial Campaign Record (Starts with 0 counts)
    await db.insert(broadcastCampaigns).values({
      id: campaignId,
      organizationId: orgId,
      createdById: userId,
      templateId: body.templateId,
      templateName: tmpl.name,
      name: body.name,
      status: 'PROCESSING',
      totalRecipients,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    });

    // 5. Asynchronously execute real dispatch loop
    (async () => {
      let sentSuccess = 0;
      let failed = 0;

      for (const contact of contactList) {
        if (!contact.waId) {
          failed++;
          continue;
        }

        try {
          // A contact saved without a name has its number as name — greet generically instead
          const displayName = contact.name && contact.name !== contact.waId ? contact.name : '';
          const componentsPayload = buildComponents(needs, body.variables, displayName);

          console.log(`🚀 Mengirim broadcast "${body.name}" template "${tmpl.name}" ke ${contact.waId}...`);

          // Send template message to WhatsApp Cloud API
          const metaRes = await MetaApiService.sendTemplateMessage(
            {
              phoneNumberId: activePhoneNumberId,
              recipientWaId: contact.waId,
              templateName: tmpl.name,
              languageCode: tmpl.language || 'id',
              components: componentsPayload.length > 0 ? componentsPayload : undefined,
            },
            activeToken
          );

          const wamid = metaRes?.messages?.[0]?.id || `wamid.BCAST_${nanoid()}`;
          const dbPhoneId = phone?.id || phone?.phoneNumberId || platformPhoneNumberId();

          // Find or create conversation for this contact
          let [conv] = await db
            .select()
            .from(conversations)
            .where(and(eq(conversations.organizationId, orgId), eq(conversations.contactId, contact.id)))
            .limit(1);

          if (!conv) {
            const convId = nanoid();
            await db.insert(conversations).values({
              id: convId,
              organizationId: orgId,
              contactId: contact.id,
              phoneNumberId: dbPhoneId,
              status: 'OPEN',
              lastMessagePreview: `[Broadcast] ${tmpl.name}`,
              lastMessageAt: new Date(),
            });
            conv = { id: convId } as any;
          } else {
            await db
              .update(conversations)
              .set({
                lastMessagePreview: `[Broadcast] ${tmpl.name}`,
                lastMessageAt: new Date(),
              })
              .where(eq(conversations.id, conv.id));
          }

          // Record outbound template message in database
          await db.insert(messages).values({
            id: nanoid(),
            conversationId: conv.id,
            wamId: wamid,
            direction: 'OUTBOUND',
            senderType: 'SYSTEM',
            senderId: userId,
            messageType: 'template',
            body: `[Broadcast: ${body.name}] Template: ${tmpl.name}`,
            status: 'SENT',
            campaignId,
          });

          sentSuccess++;
        } catch (err: any) {
          console.error(`⚠️ Broadcast dispatch gagal ke ${contact.waId}:`, err?.message || err);
          failed++;
        }

        // Update progress in database
        await db
          .update(broadcastCampaigns)
          .set({
            sentCount: sentSuccess,
            failedCount: failed,
          })
          .where(eq(broadcastCampaigns.id, campaignId));

        // Throttle 100ms per contact
        await new Promise((r) => setTimeout(r, 100));
      }

      // Mark final status
      await db
        .update(broadcastCampaigns)
        .set({
          status: sentSuccess > 0 ? 'COMPLETED' : 'FAILED',
          sentCount: sentSuccess,
          failedCount: failed,
        })
        .where(eq(broadcastCampaigns.id, campaignId));
    })();

    return { id: campaignId, name: body.name, totalRecipients, status: 'PROCESSING' };
  }

  static async delete(orgId: string, campaignId: string) {
    await db
      .delete(broadcastCampaigns)
      .where(and(eq(broadcastCampaigns.id, campaignId), eq(broadcastCampaigns.organizationId, orgId)));
    return { success: true };
  }
}

export const broadcastRoutes = new Elysia({ prefix: '/broadcast' })
  .use(authPlugin)

  // ─── GET /broadcast ────────────────────────
  .get('/', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role === 'AGENT') {
      set.status = 403;
      return { success: false, error: 'Akses dibatasi untuk Admin dan Supervisor' };
    }

    const items = await BroadcastService.list(user.orgId);
    return { success: true, items };
  })

  // ─── POST /broadcast ───────────────────────
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (user.role === 'AGENT') {
        set.status = 403;
        return { success: false, error: 'Akses dibatasi untuk Admin dan Supervisor' };
      }

      try {
        const item = await BroadcastService.create(user.orgId, user.id, body);
        return { success: true, item };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 3 }),
        templateId: t.String(),
        scheduledAt: t.Optional(t.String()),
        tag: t.Optional(t.String()),
        variables: t.Optional(
          t.Object({
            header: t.Optional(t.Array(t.Any())),
            body: t.Optional(t.Array(t.Any())),
            buttons: t.Optional(t.Record(t.String(), t.String())),
            headerMediaUrl: t.Optional(t.String()),
          })
        ),
      }),
    }
  )

  // ─── DELETE /broadcast/:id ─────────────────
  .delete('/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role === 'AGENT') {
      set.status = 403;
      return { success: false, error: 'Akses dibatasi untuk Admin dan Supervisor' };
    }

    try {
      await BroadcastService.delete(user.orgId, params.id);
      return { success: true };
    } catch (err: any) {
      set.status = 400;
      return { success: false, error: err.message };
    }
  });
