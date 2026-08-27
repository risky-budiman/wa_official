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
  activityLogs,
  organizations
} from '../../db/schema';
import type { MetaWebhookBody } from './webhook.types';

export class WebhookProcessor {
  /**
   * Auto-assign strategy: Pick active agent with the least number of active (OPEN/PENDING) conversations
   * Respects each organization's maxChatsPerAgent capacity limit.
   */
  static async getLeastBusyAgent(orgId: string): Promise<string | null> {
    try {
      // 0. Fetch Organization Workload & Capacity Configuration
      const [org] = await db
        .select({ maxChatsPerAgent: organizations.maxChatsPerAgent })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      const maxLimit = org?.maxChatsPerAgent ?? 5;

      // 1. Get all active agents in this organization
      const activeAgents = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          isOnline: users.isOnline,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            eq(users.organizationId, orgId),
            eq(users.status, 'ACTIVE'),
            sql`${users.role} IN ('AGENT', 'ADMINISTRATOR')`
          )
        );

      if (activeAgents.length === 0) return null;

      // Only assign to agents who are currently ONLINE (isOnline = true)
      const onlinePool = activeAgents.filter((a) => a.isOnline);
      if (onlinePool.length === 0) {
        // All agents are offline -> Return null so chat enters UNASSIGNED / PENDING queue for manual pickup
        return null;
      }

      const pureAgents = onlinePool.filter((a) => a.role === 'AGENT');
      const candidates = pureAgents.length > 0 ? pureAgents : onlinePool;

      // 2. Count active workload for each online candidate
      const workloads = await Promise.all(
        candidates.map(async (agent) => {
          const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(conversations)
            .where(
              and(
                eq(conversations.organizationId, orgId),
                eq(conversations.assignedUserId, agent.id),
                sql`${conversations.status} IN ('OPEN', 'PENDING')`
              )
            );
          return {
            agentId: agent.id,
            count: Number(result?.count || 0),
          };
        })
      );

      // 3. Filter out agents who have reached the Max Handle Capacity Limit (Cap)
      const availableWorkloads = workloads.filter((w) => w.count < maxLimit);
      if (availableWorkloads.length === 0) {
        // All online agents have reached maximum handle capacity -> queue in UNASSIGNED
        return null;
      }

      // 4. Sort ascending by workload count (least busy agent wins)
      availableWorkloads.sort((a, b) => a.count - b.count);

      return availableWorkloads[0]?.agentId || null;
    } catch (err) {
      console.warn('Least busy agent calculation notice:', err);
      return null;
    }
  }

  /**
   * Process raw Meta webhook payload from BullMQ queue
   */
  static async handleJob(job: Job<MetaWebhookBody>) {
    await WebhookProcessor.handlePayload(job.data);
  }

  /**
   * Process raw Meta webhook payload directly
   */
  static async handlePayload(payload: MetaWebhookBody) {
    if (!payload || !payload.entry) return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        if (!value || value.messaging_product !== 'whatsapp') continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // 1. Resolve Organization by Registered Phone Number ID (with Auto-Pair Fallback)
        let [phone] = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.phoneNumberId, phoneNumberId))
          .limit(1);

        if (!phone) {
          // Auto-pair fallback: find existing phone record or first organization
          const [firstPhone] = await db.select().from(phoneNumbers).limit(1);
          if (firstPhone) {
            await db
              .update(phoneNumbers)
              .set({ phoneNumberId: phoneNumberId, status: 'CONNECTED' })
              .where(eq(phoneNumbers.id, firstPhone.id));
            phone = { ...firstPhone, phoneNumberId: phoneNumberId, status: 'CONNECTED' };
            console.log(`✨ Auto-registered Phone Number ID ${phoneNumberId} to organization ${firstPhone.organizationId}`);
          } else {
            const [firstOrg] = await db.select().from(organizations).limit(1);
            if (firstOrg) {
              const newPhoneId = nanoid();
              await db.insert(phoneNumbers).values({
                id: newPhoneId,
                organizationId: firstOrg.id,
                phoneNumberId: phoneNumberId,
                displayPhoneNumber: '+62 812-3456-7890',
                verifiedName: firstOrg.name,
                qualityRating: 'GREEN',
                status: 'CONNECTED',
              });
              phone = {
                id: newPhoneId,
                organizationId: firstOrg.id,
                phoneNumberId: phoneNumberId,
                displayPhoneNumber: '+62 812-3456-7890',
                verifiedName: firstOrg.name,
                qualityRating: 'GREEN',
                status: 'CONNECTED',
                createdAt: new Date(),
              };
              console.log(`✨ Auto-created phone record for Phone Number ID ${phoneNumberId}`);
            } else {
              console.warn(`⚠️ Webhook received for unregistered phone_number_id: ${phoneNumberId}`);
              continue;
            }
          }
        }

        const orgId = phone.organizationId;

        // Fetch Organization Care Window Settings
        const [org] = await db
          .select({ careWindowHours: organizations.careWindowHours })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1);

        const careHours = org?.careWindowHours ?? 24;
        const windowExpiresAt = new Date(Date.now() + careHours * 60 * 60 * 1000); // Standard Meta 24-hr session window

        // 2. Handle Inbound Customer Messages
        if (value.messages && value.messages.length > 0) {
          for (const msg of value.messages) {
            const customerWaId = msg.from || value.contacts?.[0]?.wa_id || '628000000000';
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
              try {
                await db.insert(contacts).values({
                  id: contactId,
                  organizationId: orgId,
                  waId: customerWaId,
                  name: customerName,
                  email: null,
                  customAttributes: {},
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              } catch (insertErr: any) {
                // Handle concurrent insert duplicate key (uq_org_wa)
                const [reFetched] = await db
                  .select()
                  .from(contacts)
                  .where(
                    and(
                      eq(contacts.organizationId, orgId),
                      eq(contacts.waId, customerWaId)
                    )
                  )
                  .limit(1);
                if (reFetched) {
                  contactId = reFetched.id;
                }
              }
            } else if (existingContact.name !== customerName) {
              await db
                .update(contacts)
                .set({ name: customerName, updatedAt: new Date() })
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

              // Auto-assign: Least-Workload Routing (Agent with minimum active chats)
              const leastBusyAgentId = await WebhookProcessor.getLeastBusyAgent(orgId);

              await db.insert(conversations).values({
                id: convId,
                organizationId: orgId,
                phoneNumberId: phone.id,
                contactId: contactId!,
                assignedUserId: leastBusyAgentId,
                status: leastBusyAgentId ? 'OPEN' : 'UNASSIGNED',
                windowExpiresAt,
                lastMessagePreview: messageBody,
                lastMessageAt: new Date(),
                createdAt: new Date(),
              });
            } else {
              let assignedUser = activeConv.assignedUserId;
              if (!assignedUser || activeConv.status === 'RESOLVED') {
                assignedUser = await WebhookProcessor.getLeastBusyAgent(orgId);
              }

              await db
                .update(conversations)
                .set({
                  windowExpiresAt,
                  lastMessagePreview: messageBody,
                  lastMessageAt: new Date(),
                  assignedUserId: assignedUser || activeConv.assignedUserId,
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
                createdAt: new Date(),
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
