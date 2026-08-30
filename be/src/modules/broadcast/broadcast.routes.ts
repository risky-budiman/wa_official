// ===========================================
// Broadcast Campaign Service & Routes (Real Meta Dispatcher)
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and, desc } from 'drizzle-orm';
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
          id: messageTemplates.id,
          name: messageTemplates.name,
          category: messageTemplates.category,
        },
      })
      .from(broadcastCampaigns)
      .innerJoin(messageTemplates, eq(broadcastCampaigns.templateId, messageTemplates.id))
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

    // 2. Get Organization & Phone
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    const phones = await db.select().from(phoneNumbers).where(eq(phoneNumbers.organizationId, orgId));
    const phone = phones.length > 0 ? phones[0] : null;

    const activeToken =
      org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
        ? org.accessToken
        : env.META_ACCESS_TOKEN;
    const activePhoneNumberId = env.META_PHONE_NUMBER_ID || phone?.phoneNumberId || '';
    const dbPhoneId = phone?.id || phone?.phoneNumberId || env.META_PHONE_NUMBER_ID || 'default';

    // 3. Get Target Contacts
    const contactList = await db
      .select({ id: contacts.id, waId: contacts.waId, name: contacts.name })
      .from(contacts)
      .where(eq(contacts.organizationId, orgId));

    if (contactList.length === 0) {
      throw new Error('Tidak ada kontak pelanggan di database untuk dikirimi broadcast.');
    }

    const campaignId = nanoid();
    const totalRecipients = contactList.length;

    // Inspect variables in template body
    let bodyVarsCount = 0;
    if (Array.isArray(tmpl.components)) {
      const bodyComp = tmpl.components.find((c: any) => (c.type || '').toUpperCase() === 'BODY');
      if (bodyComp && typeof (bodyComp as any).text === 'string') {
        const matches = (bodyComp as any).text.match(/\{\{\d+\}\}/g);
        if (matches) {
          bodyVarsCount = matches.length;
        }
      }
    }

    // 4. Insert Initial Campaign Record (Starts with 0 counts)
    await db.insert(broadcastCampaigns).values({
      id: campaignId,
      organizationId: orgId,
      createdById: userId,
      templateId: body.templateId,
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
          // Build component parameters if template has variables
          const componentsPayload: any[] = [];
          if (bodyVarsCount > 0) {
            const parameters: any[] = [];
            for (let i = 1; i <= bodyVarsCount; i++) {
              if (i === 1) {
                parameters.push({ type: 'text', text: contact.name || 'Pelanggan' });
              } else if (i === 2) {
                parameters.push({ type: 'text', text: 'Spesial Hari Ini' });
              } else {
                parameters.push({ type: 'text', text: '-' });
              }
            }
            componentsPayload.push({
              type: 'body',
              parameters,
            });
          }

          console.log(`🚀 Mengirim broadcast "${body.name}" template "${tmpl.name}" ke ${contact.waId}...`);

          // Send template message to WhatsApp Cloud API
          const metaRes = await MetaApiService.sendTemplateMessage(
            {
              phoneNumberId: activePhoneNumberId,
              recipientWaId: contact.waId,
              templateName: tmpl.name,
              languageCode: (tmpl.language || 'id').toLowerCase().replace('_id', ''),
              components: componentsPayload.length > 0 ? componentsPayload : undefined,
            },
            activeToken
          );

          const wamid = metaRes?.messages?.[0]?.id || `wamid.BCAST_${nanoid()}`;
          const dbPhoneId = phone?.id || phone?.phoneNumberId || env.META_PHONE_NUMBER_ID;

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
