// ===========================================
// Webhook Event Processor (BullMQ Worker)
// ===========================================

import { Worker, Job } from 'bullmq';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { redis } from '../../config/redis';
import { db } from '../../config/database';
import {
  phoneNumbers,
  contacts,
  conversations,
  messages,
  users,
  activityLogs
} from '../../db/schema';
import type { MetaWebhookBody } from './webhook.types';

export class WebhookProcessor {
  /**
   * Process raw Meta webhook payload from BullMQ queue
   */
  static async handleJob(job: Job<MetaWebhookBody>) {
    const payload = job.data;
    if (!payload.entry) return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        if (!value || value.messaging_product !== 'whatsapp') continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // 1. Resolve Organization by Registered Phone Number ID
        const [phone] = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.phoneNumberId, phoneNumberId))
          .limit(1);

        if (!phone) {
          console.warn(`⚠️ Webhook received for unregistered phone_number_id: ${phoneNumberId}`);
          continue;
        }

        const orgId = phone.organizationId;

        // 2. Handle Inbound Customer Messages
        if (value.messages && value.messages.length > 0) {
          for (const msg of value.messages) {
            const customerWaId = msg.from;
            const customerName = value.contacts?.find((c) => c.wa_id === customerWaId)?.profile?.name || customerWaId;

            // 2a. Upsert Contact
            const [existingContact] = await db
              .select()
              .from(contacts)
              .where(
                and(
                  eq(contacts.organizationId, orgId),
                  eq(contacts.waId, customerWaId)
                )
              )
              .limit(1);

            let contactId = existingContact?.id;

            if (!existingContact) {
              contactId = nanoid();
              await db.insert(contacts).values({
                id: contactId,
                organizationId: orgId,
                waId: customerWaId,
                name: customerName,
              });
            } else if (existingContact.name !== customerName) {
              await db
                .update(contacts)
                .set({ name: customerName })
                .where(eq(contacts.id, existingContact.id));
            }

            // 2b. Find or Create Active Conversation
            const [activeConv] = await db
              .select()
              .from(conversations)
              .where(
                and(
                  eq(conversations.organizationId, orgId),
                  eq(conversations.contactId, contactId!),
                  eq(conversations.phoneNumberId, phone.id)
                )
              )
              .limit(1);

            let convId = activeConv?.id;
            const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hr care window

            let messageBody = '';
            if (msg.type === 'text' && msg.text) {
              messageBody = msg.text.body;
            } else if (msg.type === 'image') {
              messageBody = msg.image?.caption || '[Gambar]';
            } else {
              messageBody = `[${msg.type.toUpperCase()}]`;
            }

            if (!activeConv) {
              convId = nanoid();

              // Auto-assign: pick active agent with lowest active chat count
              const [availableAgent] = await db
                .select()
                .from(users)
                .where(
                  and(
                    eq(users.organizationId, orgId),
                    eq(users.role, 'AGENT'),
                    eq(users.status, 'ACTIVE'),
                    eq(users.isOnline, true)
                  )
                )
                .orderBy(users.createdAt)
                .limit(1);

              await db.insert(conversations).values({
                id: convId,
                organizationId: orgId,
                phoneNumberId: phone.id,
                contactId: contactId!,
                assignedUserId: availableAgent?.id || null,
                status: availableAgent ? 'OPEN' : 'UNASSIGNED',
                windowExpiresAt,
                lastMessagePreview: messageBody,
                lastMessageAt: new Date(),
              });
            } else {
              await db
                .update(conversations)
                .set({
                  windowExpiresAt,
                  lastMessagePreview: messageBody,
                  lastMessageAt: new Date(),
                  status: activeConv.status === 'RESOLVED' ? 'OPEN' : activeConv.status,
                })
                .where(eq(conversations.id, activeConv.id));
            }

            // 2c. Save Message (Deduplicate via Meta wamid)
            const [existingMsg] = await db
              .select({ id: messages.id })
              .from(messages)
              .where(eq(messages.wamId, msg.id))
              .limit(1);

            if (!existingMsg) {
              await db.insert(messages).values({
                id: nanoid(),
                conversationId: convId!,
                wamId: msg.id,
                direction: 'INBOUND',
                senderType: 'CONTACT',
                senderId: null,
                messageType: msg.type,
                body: messageBody,
                isInternalNote: false,
                status: 'DELIVERED',
              });

              console.log(`📩 Pesan WA masuk dari ${customerWaId}: "${messageBody.substring(0, 30)}"`);
            }
          }
        }

        // 3. Handle Message Status Updates (Delivered, Read, Failed)
        if (value.statuses && value.statuses.length > 0) {
          for (const st of value.statuses) {
            let statusEnum: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'SENT';
            if (st.status === 'delivered') statusEnum = 'DELIVERED';
            else if (st.status === 'read') statusEnum = 'READ';
            else if (st.status === 'failed') statusEnum = 'FAILED';

            await db
              .update(messages)
              .set({ status: statusEnum })
              .where(eq(messages.wamId, st.id));
          }
        }
      }
    }
  }
}

// Start BullMQ Worker
export const webhookWorker = new Worker(
  'whatsapp-webhook',
  async (job) => {
    await WebhookProcessor.handleJob(job);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

webhookWorker.on('completed', (job) => {
  // console.log(`✅ Webhook job ${job.id} selesai diproses`);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`❌ Webhook job ${job?.id} gagal:`, err.message);
});
