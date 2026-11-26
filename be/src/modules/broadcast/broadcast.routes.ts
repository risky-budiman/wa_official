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
        audienceTag: broadcastCampaigns.audienceTag,
        lastError: broadcastCampaigns.lastError,
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
          used: sql<number>`COALESCE(SUM(CASE WHEN ${broadcastCampaigns.status} IN ('PROCESSING', 'SCHEDULED') THEN ${broadcastCampaigns.totalRecipients} ELSE ${broadcastCampaigns.sentCount} END), 0)`,
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

    // 4. When: now, or at a scheduled time (1 minute … 30 days ahead)
    let scheduledAt: Date | null = null;
    if (body.scheduledAt) {
      const at = new Date(body.scheduledAt);
      if (Number.isNaN(at.getTime())) throw new Error('Waktu jadwal tidak valid.');
      const ahead = at.getTime() - Date.now();
      if (ahead > 30 * 24 * 60 * 60 * 1000) throw new Error('Jadwal maksimal 30 hari ke depan.');
      if (ahead < -60 * 1000) throw new Error('Waktu jadwal sudah lewat.');
      if (ahead > 60 * 1000) scheduledAt = at;
    }

    await db.insert(broadcastCampaigns).values({
      id: campaignId,
      organizationId: orgId,
      createdById: userId,
      templateId: body.templateId,
      templateName: tmpl.name,
      name: body.name,
      status: scheduledAt ? 'SCHEDULED' : 'PROCESSING',
      totalRecipients,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      scheduledAt,
      audienceTag: tag || null,
      variables: (body.variables || {}) as any,
    } as any);

    if (!scheduledAt) {
      BroadcastService.dispatch(campaignId).catch((err) => console.error('Broadcast dispatch error:', err?.message || err));
    }
    return { id: campaignId, name: body.name, totalRecipients, status: scheduledAt ? 'SCHEDULED' : 'PROCESSING', scheduledAt };
  }

  /** Mark a campaign that could not start as FAILED, with the reason. */
  private static async failCampaign(campaignId: string, reason: string) {
    await db
      .update(broadcastCampaigns)
      .set({ status: 'FAILED', lastError: reason.slice(0, 500) } as any)
      .where(eq(broadcastCampaigns.id, campaignId));
    console.warn(`⚠️ Broadcast ${campaignId} gagal dimulai: ${reason}`);
  }

  /**
   * Send a campaign (status PROCESSING). Everything is re-read at send time, so a scheduled
   * campaign uses the template, credentials and contacts as they are when it fires.
   */
  static async dispatch(campaignId: string) {
    const [camp] = await db.select().from(broadcastCampaigns).where(eq(broadcastCampaigns.id, campaignId)).limit(1);
    if (!camp || camp.status !== 'PROCESSING') return;
    const orgId = camp.organizationId;

    const [tmpl] = camp.templateId
      ? await db.select().from(messageTemplates).where(eq(messageTemplates.id, camp.templateId)).limit(1)
      : [];
    if (!tmpl) return this.failCampaign(campaignId, 'Template sudah dihapus.');
    if (tmpl.status !== 'APPROVED') return this.failCampaign(campaignId, `Template berstatus ${tmpl.status}.`);

    const variables = (camp as any).variables as BroadcastVariables | undefined;
    const needs = analyzeTemplate(tmpl.components);
    const missing = missingVariables(needs, variables);
    if (missing.length) return this.failCampaign(campaignId, `Template berubah; isian kurang: ${missing.join(', ')}.`);

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const phone = await getActivePhone(orgId);
    const activeToken = orgMetaToken(org?.accessToken);
    const activePhoneNumberId = phone?.phoneNumberId || platformPhoneNumberId() || '';
    if (!activePhoneNumberId || !phone?.id) return this.failCampaign(campaignId, 'Nomor WhatsApp organisasi belum terhubung.');

    const tag = ((camp as any).audienceTag || '').trim();
    const contactList = await db
      .select({ id: contacts.id, waId: contacts.waId, name: contacts.name })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, orgId),
          tag ? sql`JSON_UNQUOTE(JSON_EXTRACT(${contacts.customAttributes}, '$.tag')) = ${tag}` : sql`1 = 1`
        )
      );
    if (contactList.length === 0) return this.failCampaign(campaignId, tag ? `Tidak ada kontak dengan tag "${tag}".` : 'Tidak ada kontak.');
    await db.update(broadcastCampaigns).set({ totalRecipients: contactList.length }).where(eq(broadcastCampaigns.id, campaignId));

    let sentSuccess = 0;
    let failed = 0;
    let index = 0;
    for (const contact of contactList) {
      // Deleting a running campaign stops it (checked every 20 recipients)
      if (index++ % 20 === 0 && index > 1) {
        const [still] = await db.select({ status: broadcastCampaigns.status }).from(broadcastCampaigns).where(eq(broadcastCampaigns.id, campaignId)).limit(1);
        if (!still || still.status !== 'PROCESSING') {
          console.log(`⏹️ Broadcast ${campaignId} dihentikan (${sentSuccess} terkirim).`);
          return;
        }
      }
      if (!contact.waId) {
        failed++;
        continue;
      }
      try {
        // A contact saved without a name has its number as name — greet generically instead
        const displayName = contact.name && contact.name !== contact.waId ? contact.name : '';
        const componentsPayload = buildComponents(needs, variables, displayName);

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
            phoneNumberId: phone.id,
            status: 'OPEN',
            lastMessagePreview: `[Broadcast] ${tmpl.name}`,
            lastMessageAt: new Date(),
          });
          conv = { id: convId } as any;
        } else {
          await db
            .update(conversations)
            .set({ lastMessagePreview: `[Broadcast] ${tmpl.name}`, lastMessageAt: new Date() })
            .where(eq(conversations.id, conv.id));
        }

        await db.insert(messages).values({
          id: nanoid(),
          conversationId: conv.id,
          wamId: wamid,
          direction: 'OUTBOUND',
          senderType: 'SYSTEM',
          senderId: camp.createdById,
          messageType: 'template',
          body: `[Broadcast: ${camp.name}] Template: ${tmpl.name}`,
          status: 'SENT',
          campaignId,
        });
        sentSuccess++;
      } catch (err: any) {
        console.error(`⚠️ Broadcast dispatch gagal ke ${contact.waId}:`, err?.message || err);
        failed++;
        if (failed === 1 && sentSuccess === 0) {
          await db.update(broadcastCampaigns).set({ lastError: String(err?.message || err).slice(0, 500) } as any).where(eq(broadcastCampaigns.id, campaignId));
        }
      }

      await db.update(broadcastCampaigns).set({ sentCount: sentSuccess, failedCount: failed }).where(eq(broadcastCampaigns.id, campaignId));
      // Throttle 100ms per contact
      await new Promise((r) => setTimeout(r, 100));
    }

    await db
      .update(broadcastCampaigns)
      .set({ status: sentSuccess > 0 ? 'COMPLETED' : 'FAILED', sentCount: sentSuccess, failedCount: failed })
      .where(eq(broadcastCampaigns.id, campaignId));
  }

  /** Start scheduled campaigns that are due. Each one is claimed atomically (safe with several workers). */
  static async runScheduled() {
    const due = await db
      .select({ id: broadcastCampaigns.id })
      .from(broadcastCampaigns)
      .where(and(eq(broadcastCampaigns.status, 'SCHEDULED'), sql`${broadcastCampaigns.scheduledAt} <= NOW()`))
      .limit(20);
    for (const { id } of due) {
      const res: any = await db
        .update(broadcastCampaigns)
        .set({ status: 'PROCESSING' })
        .where(and(eq(broadcastCampaigns.id, id), eq(broadcastCampaigns.status, 'SCHEDULED')));
      if (Number((Array.isArray(res) ? res[0] : res)?.affectedRows ?? 0) > 0) {
        console.log(`⏰ Broadcast terjadwal ${id} dimulai.`);
        this.dispatch(id).catch((err) => console.error('Scheduled broadcast error:', err?.message || err));
      }
    }
  }

  static startScheduler(intervalMs = 30000) {
    const tick = () => this.runScheduled().catch((err) => console.warn('Broadcast scheduler:', err?.message || err));
    tick();
    setInterval(tick, intervalMs);
    console.log('⏰ Broadcast Scheduler active (Every 30s)');
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
