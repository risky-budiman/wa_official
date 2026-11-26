// ===========================================
// External Developer REST API Routes
// Protected by X-API-Key or Bearer API Key
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../config/database';
import { env } from '../../config/env';
import {
  organizations,
  phoneNumbers,
  contacts,
  conversations,
  messages,
  messageTemplates,
  broadcastCampaigns,
} from '../../db/schema';
import { apiKeyAuthPlugin } from '../../middleware/api-key-auth';
import { MetaApiService } from '../../services/meta-api.service';
import { getActivePhone } from '../../services/phone-number.service';
import { orgMetaToken, platformPhoneNumberId } from '../../services/meta-credentials';

/**
 * Map an external endpoint to the permission(s) it needs (any one of them is enough).
 * Returns null for endpoints that only need a valid key (e.g. /quota).
 */
function requiredPermissionsFor(method: string, pathname: string): string[] | null {
  if (method === 'POST' && pathname.endsWith('/external/messages/send-text')) return ['messages:send'];
  if (method === 'POST' && pathname.endsWith('/external/messages/send-template')) return ['templates:send'];
  if (method === 'POST' && pathname.endsWith('/external/contacts')) return ['contacts:write'];
  if (method === 'GET' && pathname.endsWith('/external/templates')) return ['templates:send', 'messages:send'];
  return null;
}

export const externalRoutes = new Elysia({ prefix: '/external' })
  .use(apiKeyAuthPlugin)

  // ─── Guard Middleware for External API ────────
  .onBeforeHandle(({ externalApp, set, request }) => {
    if (!externalApp) {
      set.status = 401;
      return {
        success: false,
        error: 'Unauthorized: Header X-API-Key atau Authorization Bearer tidak valid atau telah kedaluwarsa.',
        docs: '/admin/api-keys',
      };
    }

    // 🔒 Enforce the permissions granted to this API key
    const pathname = new URL(request.url).pathname;
    const required = requiredPermissionsFor(request.method, pathname);
    if (required && !required.some((p) => externalApp.permissions.includes(p))) {
      set.status = 403;
      return {
        success: false,
        error: `Forbidden: API Key ini tidak memiliki izin ${required.join(' / ')}.`,
        docs: '/admin/api-keys',
      };
    }
  })

  // ─── POST /external/messages/send-template ────
  .post(
    '/messages/send-template',
    async ({ externalApp, body, set }) => {
      const orgId = externalApp!.orgId;

      // 1. Normalize Phone Number
      let targetNumber = (body.to || '').replace(/[^0-9]/g, '');
      if (targetNumber.startsWith('08')) {
        targetNumber = '62' + targetNumber.slice(1);
      } else if (targetNumber.startsWith('8')) {
        targetNumber = '62' + targetNumber;
      }

      if (targetNumber.length < 9) {
        set.status = 400;
        return { success: false, error: 'Nomor WhatsApp tujuan tidak valid' };
      }

      // 2. Fetch Template Definition
      const [tmpl] = await db
        .select()
        .from(messageTemplates)
        .where(
          and(
            eq(messageTemplates.organizationId, orgId),
            eq(messageTemplates.name, body.templateName)
          )
        )
        .limit(1);

      if (!tmpl) {
        set.status = 404;
        return {
          success: false,
          error: `Template WhatsApp "${body.templateName}" tidak ditemukan dalam organisasi Anda.`,
        };
      }

      if (tmpl.status !== 'APPROVED') {
        set.status = 400;
        return {
          success: false,
          error: `Template "${tmpl.name}" berstatus "${tmpl.status}". Meta hanya mengizinkan pengiriman untuk template yang sudah disetujui (APPROVED).`,
        };
      }

      // 3. Resolve Organization Credentials & Phone
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      const phone = await getActivePhone(orgId);

      const activeToken = orgMetaToken(org?.accessToken);
      const activePhoneNumberId = phone?.phoneNumberId || platformPhoneNumberId() || '';
      const dbPhoneId = phone?.id || phone?.phoneNumberId || platformPhoneNumberId() || 'default';

      if (!activePhoneNumberId) {
        set.status = 400;
        return { success: false, error: 'Phone Number ID Meta belum dikonfigurasi di CRM.' };
      }

      // 4. Find or Create Contact
      let [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.organizationId, orgId), eq(contacts.waId, targetNumber)))
        .limit(1);

      if (!contact) {
        const contactId = nanoid();
        await db.insert(contacts).values({
          id: contactId,
          organizationId: orgId,
          waId: targetNumber,
          name: body.recipientName || targetNumber,
        });
        contact = { id: contactId, waId: targetNumber, name: body.recipientName || targetNumber } as any;
      }

      // 5. Build Component Parameters
      const componentsPayload: any[] = [];

      // Body Parameters
      if (body.bodyParameters && Array.isArray(body.bodyParameters) && body.bodyParameters.length > 0) {
        componentsPayload.push({
          type: 'body',
          parameters: body.bodyParameters.map((val) => ({
            type: 'text',
            text: String(val),
          })),
        });
      }

      // 🔒 Never invent values for template variables — a customer would receive "Spesial"/"order"
      const tmplComps: any[] = Array.isArray(tmpl.components) ? (tmpl.components as any[]) : [];
      const bodyText = String(tmplComps.find((c) => (c.type || '').toUpperCase() === 'BODY')?.text || '');
      const bodyVars = new Set(bodyText.match(/\{\{\s*[\w.]+\s*\}\}/g) || []).size;
      const givenBody = body.bodyParameters?.length || 0;
      if (bodyVars !== givenBody) {
        set.status = 400;
        return {
          success: false,
          error: `Template "${tmpl.name}" membutuhkan ${bodyVars} bodyParameters, diterima ${givenBody}.`,
        };
      }

      // Header Parameters
      if (body.headerParameters && Array.isArray(body.headerParameters) && body.headerParameters.length > 0) {
        componentsPayload.push({
          type: 'header',
          parameters: body.headerParameters.map((val) => ({
            type: 'text',
            text: String(val),
          })),
        });
      }

      // Button Parameters (Dynamic URL Button)
      if (body.buttonParameters && Array.isArray(body.buttonParameters) && body.buttonParameters.length > 0) {
        for (const btn of body.buttonParameters as any[]) {
          const paramValue = btn.parameter || btn.text || btn.value || '';
          if (paramValue) {
            componentsPayload.push({
              type: 'button',
              sub_type: 'url',
              index: String(btn.index !== undefined ? btn.index : '0'),
              parameters: [{ type: 'text', text: String(paramValue) }],
            });
          }
        }
      } else {
        const dynamicButtons = (tmplComps.find((c) => (c.type || '').toUpperCase() === 'BUTTONS')?.buttons || []).filter(
          (btn: any) => (btn.type || '').toUpperCase() === 'URL' && String(btn.url || '').includes('{{')
        );
        if (dynamicButtons.length > 0) {
          set.status = 400;
          return {
            success: false,
            error: `Template "${tmpl.name}" punya tombol URL dinamis — kirim buttonParameters (index & parameter).`,
          };
        }
      }

      try {
        // 6. Send to Meta WhatsApp API
        const metaRes = await MetaApiService.sendTemplateMessage(
          {
            phoneNumberId: activePhoneNumberId,
            recipientWaId: targetNumber,
            templateName: tmpl.name,
            languageCode: body.language || tmpl.language || 'id',
            components: componentsPayload.length > 0 ? componentsPayload : undefined,
          },
          activeToken
        );

        const wamid = metaRes?.messages?.[0]?.id || `wamid.EXT_${nanoid()}`;

        // 7. Upsert Conversation
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
            lastMessagePreview: `[Template] ${tmpl.name}`,
            lastMessageAt: new Date(),
          });
          conv = { id: convId } as any;
        } else {
          await db
            .update(conversations)
            .set({
              lastMessagePreview: `[Template] ${tmpl.name}`,
              lastMessageAt: new Date(),
            })
            .where(eq(conversations.id, conv.id));
        }

        // 8. Record Message
        const messageId = nanoid();
        await db.insert(messages).values({
          id: messageId,
          conversationId: conv.id,
          wamId: wamid,
          direction: 'OUTBOUND',
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'template',
          body: `[API: ${externalApp!.keyName}] Template: ${tmpl.name}`,
          status: 'SENT',
        });

        return {
          success: true,
          message: 'Template WhatsApp berhasil dikirim ke penerima',
          data: {
            messageId,
            wamId: wamid,
            recipient: targetNumber,
            templateName: tmpl.name,
            sentAt: new Date().toISOString(),
          },
        };
      } catch (err: any) {
        set.status = 400;
        return {
          success: false,
          error: err.message || 'Gagal mengirim pesan template via Meta API',
        };
      }
    },
    {
      body: t.Object({
        to: t.String({ description: 'Nomor WhatsApp tujuan (e.g. 628123456789)' }),
        templateName: t.String({ description: 'Nama template resmi yang sudah APPROVED' }),
        recipientName: t.Optional(t.String()),
        language: t.Optional(t.String()),
        bodyParameters: t.Optional(t.Array(t.String())),
        headerParameters: t.Optional(t.Array(t.String())),
        buttonParameters: t.Optional(
          t.Array(
            t.Object({
              index: t.Optional(t.Union([t.String(), t.Number()])),
              parameter: t.Optional(t.String()),
              text: t.Optional(t.String()),
              value: t.Optional(t.String()),
            })
          )
        ),
      }),
    }
  )

  // ─── POST /external/messages/send-text ────────
  .post(
    '/messages/send-text',
    async ({ externalApp, body, set }) => {
      const orgId = externalApp!.orgId;

      let targetNumber = (body.to || '').replace(/[^0-9]/g, '');
      if (targetNumber.startsWith('08')) {
        targetNumber = '62' + targetNumber.slice(1);
      } else if (targetNumber.startsWith('8')) {
        targetNumber = '62' + targetNumber;
      }

      if (targetNumber.length < 9) {
        set.status = 400;
        return { success: false, error: 'Nomor WhatsApp tujuan tidak valid' };
      }

      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
      const phone = await getActivePhone(orgId);

      const activeToken = orgMetaToken(org?.accessToken);
      const activePhoneNumberId = phone?.phoneNumberId || platformPhoneNumberId() || '';
      const dbPhoneId = phone?.id || phone?.phoneNumberId || platformPhoneNumberId() || 'default';

      if (!activePhoneNumberId) {
        set.status = 400;
        return { success: false, error: 'Phone Number ID Meta belum dikonfigurasi di CRM.' };
      }

      // Find or Create Contact
      let [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.organizationId, orgId), eq(contacts.waId, targetNumber)))
        .limit(1);

      if (!contact) {
        const contactId = nanoid();
        await db.insert(contacts).values({
          id: contactId,
          organizationId: orgId,
          waId: targetNumber,
          name: targetNumber,
        });
        contact = { id: contactId, waId: targetNumber, name: targetNumber } as any;
      }

      // Free text is only delivered inside the 24-hour window that opens when the customer writes.
      // Outside it Meta accepts the call and drops the message later — refuse up front instead.
      const [openConv] = await db
        .select({ windowExpiresAt: conversations.windowExpiresAt })
        .from(conversations)
        .where(and(eq(conversations.organizationId, orgId), eq(conversations.contactId, contact.id)))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(1);
      if (!openConv?.windowExpiresAt || new Date(openConv.windowExpiresAt).getTime() <= Date.now()) {
        set.status = 409;
        return {
          success: false,
          error: 'Di luar jendela 24 jam (pelanggan belum mengirim pesan dalam 24 jam terakhir). Gunakan /external/messages/send-template.',
          code: 'OUTSIDE_24H_WINDOW',
        };
      }

      try {
        const metaRes = await MetaApiService.sendTextMessage(
          {
            phoneNumberId: activePhoneNumberId,
            recipientWaId: targetNumber,
            text: body.message,
          },
          activeToken
        );

        const wamid = metaRes?.messages?.[0]?.id || `wamid.EXT_${nanoid()}`;

        // Upsert Conversation
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
            lastMessagePreview: body.message,
            lastMessageAt: new Date(),
          });
          conv = { id: convId } as any;
        } else {
          await db
            .update(conversations)
            .set({
              lastMessagePreview: body.message,
              lastMessageAt: new Date(),
            })
            .where(eq(conversations.id, conv.id));
        }

        const messageId = nanoid();
        await db.insert(messages).values({
          id: messageId,
          conversationId: conv.id,
          wamId: wamid,
          direction: 'OUTBOUND',
          senderType: 'SYSTEM',
          senderId: null,
          messageType: 'text',
          body: body.message,
          status: 'SENT',
        });

        return {
          success: true,
          message: 'Pesan teks berhasil dikirim ke WhatsApp',
          data: {
            messageId,
            wamId: wamid,
            recipient: targetNumber,
            text: body.message,
            sentAt: new Date().toISOString(),
          },
        };
      } catch (err: any) {
        set.status = 400;
        return {
          success: false,
          error: err.message || 'Gagal mengirim pesan teks via Meta API',
        };
      }
    },
    {
      body: t.Object({
        to: t.String({ description: 'Nomor WhatsApp tujuan (e.g. 628123456789)' }),
        message: t.String({ minLength: 1, description: 'Isi teks pesan' }),
      }),
    }
  )

  // ─── POST /external/contacts (Upsert Contact) ─
  .post(
    '/contacts',
    async ({ externalApp, body, set }) => {
      const orgId = externalApp!.orgId;

      let cleanNumber = (body.phone || '').replace(/[^0-9]/g, '');
      if (cleanNumber.startsWith('08')) {
        cleanNumber = '62' + cleanNumber.slice(1);
      } else if (cleanNumber.startsWith('8')) {
        cleanNumber = '62' + cleanNumber;
      }

      if (cleanNumber.length < 9) {
        set.status = 400;
        return { success: false, error: 'Nomor WhatsApp tidak valid' };
      }

      let [existing] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.organizationId, orgId), eq(contacts.waId, cleanNumber)))
        .limit(1);

      if (existing) {
        await db
          .update(contacts)
          .set({
            name: body.name || existing.name,
            email: body.email !== undefined ? body.email : existing.email,
            customAttributes: body.customAttributes
              ? { ...((existing.customAttributes as Record<string, unknown>) || {}), ...body.customAttributes }
              : existing.customAttributes,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, existing.id));

        return {
          success: true,
          message: 'Kontak berhasil diperbarui',
          data: { id: existing.id, waId: cleanNumber, name: body.name || existing.name },
        };
      } else {
        const newId = nanoid();
        await db.insert(contacts).values({
          id: newId,
          organizationId: orgId,
          waId: cleanNumber,
          name: body.name || cleanNumber,
          email: body.email || null,
          customAttributes: body.customAttributes || null,
        });

        return {
          success: true,
          message: 'Kontak baru berhasil didaftarkan',
          data: { id: newId, waId: cleanNumber, name: body.name || cleanNumber },
        };
      }
    },
    {
      body: t.Object({
        phone: t.String(),
        name: t.String(),
        email: t.Optional(t.String()),
        customAttributes: t.Optional(t.Record(t.String(), t.Any())),
      }),
    }
  )

  // ─── GET /external/templates (List Approved) ──
  .get('/templates', async ({ externalApp }) => {
    const orgId = externalApp!.orgId;
    const items = await db
      .select({
        id: messageTemplates.id,
        name: messageTemplates.name,
        category: messageTemplates.category,
        language: messageTemplates.language,
        status: messageTemplates.status,
        components: messageTemplates.components,
      })
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.organizationId, orgId),
          eq(messageTemplates.status, 'APPROVED')
        )
      );

    return {
      success: true,
      count: items.length,
      templates: items,
    };
  })

  // ─── GET /external/quota (Live Meta Quota) ────
  .get('/quota', async ({ externalApp }) => {
    const orgId = externalApp!.orgId;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [stats] = await db
      .select({
        totalTemplatesSent: sql<number>`COALESCE(COUNT(*), 0)`,
        uniqueContactsReached: sql<number>`COALESCE(COUNT(DISTINCT ${conversations.contactId}), 0)`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.organizationId, orgId),
          eq(messages.direction, 'OUTBOUND'),
          eq(messages.messageType, 'template'),
          eq(messages.isInternalNote, false),
          gte(messages.createdAt, twentyFourHoursAgo)
        )
      );

    const totalUsed = Number(stats?.uniqueContactsReached || 0);
    const dailyLimit = 1000;

    return {
      success: true,
      quota: {
        dailyLimit,
        used24h: totalUsed,
        remaining24h: Math.max(0, dailyLimit - totalUsed),
        tier: 'TIER_1K (1.000 Chat / 24 Jam)',
        resetWindow: 'Rolling 24 Hours',
      },
    };
  });
