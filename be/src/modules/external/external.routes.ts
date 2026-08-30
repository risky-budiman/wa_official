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

export const externalRoutes = new Elysia({ prefix: '/external' })
  .use(apiKeyAuthPlugin)

  // ─── Guard Middleware for External API ────────
  .onBeforeHandle(({ externalApp, set }) => {
    if (!externalApp) {
      set.status = 401;
      return {
        success: false,
        error: 'Unauthorized: Header X-API-Key atau Authorization Bearer tidak valid atau telah kedaluwarsa.',
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
      const phones = await db.select().from(phoneNumbers).where(eq(phoneNumbers.organizationId, orgId));
      const phone = phones.length > 0 ? phones[0] : null;

      const activeToken =
        org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
          ? org.accessToken
          : env.META_ACCESS_TOKEN;
      const activePhoneNumberId = phone?.phoneNumberId || env.META_PHONE_NUMBER_ID || '';
      const dbPhoneId = phone?.id || phone?.phoneNumberId || env.META_PHONE_NUMBER_ID || 'default';

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
      } else if (Array.isArray(tmpl.components)) {
        // Fallback auto-inject if body has variables
        const bodyComp = tmpl.components.find((c: any) => (c.type || '').toUpperCase() === 'BODY');
        if (bodyComp && typeof (bodyComp as any).text === 'string') {
          const matches = (bodyComp as any).text.match(/\{\{\d+\}\}/g);
          if (matches && matches.length > 0) {
            componentsPayload.push({
              type: 'body',
              parameters: matches.map((_: any, idx: number) => ({
                type: 'text',
                text: idx === 0 ? (contact.name || 'Pelanggan') : 'Spesial',
              })),
            });
          }
        }
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
      } else if (Array.isArray(tmpl.components)) {
        // Auto-inject dynamic URL buttons only if the template URL has {{1}} variable
        const btnComp = tmpl.components.find((c: any) => (c.type || '').toUpperCase() === 'BUTTONS');
        if (btnComp && Array.isArray(btnComp.buttons)) {
          btnComp.buttons.forEach((btn: any, btnIndex: number) => {
            if ((btn.type || '').toUpperCase() === 'URL' && btn.url && btn.url.includes('{{1}}')) {
              componentsPayload.push({
                type: 'button',
                sub_type: 'url',
                index: String(btnIndex),
                parameters: [{ type: 'text', text: 'order' }],
              });
            }
          });
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
      const phones = await db.select().from(phoneNumbers).where(eq(phoneNumbers.organizationId, orgId));
      const phone = phones.length > 0 ? phones[0] : null;

      const activeToken =
        org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
          ? org.accessToken
          : env.META_ACCESS_TOKEN;
      const activePhoneNumberId = phone?.phoneNumberId || env.META_PHONE_NUMBER_ID || '';
      const dbPhoneId = phone?.id || phone?.phoneNumberId || env.META_PHONE_NUMBER_ID || 'default';

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
            customAttributes: body.customAttributes || existing.customAttributes,
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
