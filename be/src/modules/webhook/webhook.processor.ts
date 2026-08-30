// ===========================================
// Webhook Event Processor (BullMQ Worker)
// ===========================================

import { Worker, Job } from 'bullmq';
import { eq, and, or, sql, desc, ne } from 'drizzle-orm';
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
  organizations,
  messageTemplates
} from '../../db/schema';
import { AiAgentService } from '../../services/ai-agent.service';
import { MetaApiService } from '../../services/meta-api.service';
import { env } from '../../config/env';
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
      for (const change of (entry.changes || [])) {
        const value = change.value;
        if (!value) continue;

        console.log(`📩 Webhook Event: field="${change.field}", msgs=${value.messages?.length || 0}, statuses=${value.statuses?.length || 0}, phoneId=${value.metadata?.phone_number_id || 'none'}`);

        // Handle Meta Template Status Update Webhook Event (e.g. APPROVED, REJECTED, DELETED, PAUSED, DISABLED)
        if (change.field === 'message_template_status_update') {
          const tplEvent = ((value as any).event || '').toUpperCase();
          const tplName = (value as any).message_template_name;
          const tplMetaId = (value as any).message_template_id ? String((value as any).message_template_id) : null;

          console.log(`📋 Meta Template Webhook: event=${tplEvent}, name=${tplName}, metaId=${tplMetaId}, reason=${(value as any).reason || 'none'}`);

          if (tplName || tplMetaId) {
            if (tplEvent === 'DELETED') {
              const deleteCondition = tplMetaId
                ? or(eq(messageTemplates.metaTemplateId, tplMetaId), eq(messageTemplates.name, tplName))
                : eq(messageTemplates.name, tplName);

              await db.delete(messageTemplates).where(deleteCondition);
              console.log(`🗑️ Webhook: Template "${tplName || tplMetaId}" berhasil dihapus dari database karena dihapus di Meta.`);
            } else {
              const statusMap: Record<string, 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED'> = {
                APPROVED: 'APPROVED',
                PENDING: 'PENDING',
                REJECTED: 'REJECTED',
                PAUSED: 'PAUSED',
                DISABLED: 'REJECTED',
              };

              const newStatus = statusMap[tplEvent] || 'PENDING';
              const updateCondition = tplMetaId
                ? or(eq(messageTemplates.metaTemplateId, tplMetaId), eq(messageTemplates.name, tplName))
                : eq(messageTemplates.name, tplName);

              await db
                .update(messageTemplates)
                .set({ status: newStatus })
                .where(updateCondition);

              console.log(`✨ Webhook: Template "${tplName}" status diperbarui menjadi ${newStatus}.`);
            }
          }
          continue;
        }

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // 1. Resolve Organization by Registered Phone Number ID (with Auto-Pair Fallback)
        let [phone] = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.phoneNumberId, phoneNumberId))
          .limit(1);

        // Get active user organization (excluding seed org-demo-default)
        const [activeOrg] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(sql`${organizations.id} != 'org-demo-default'`)
          .orderBy(desc(organizations.createdAt))
          .limit(1);

        const targetOrgId = activeOrg?.id || phone?.organizationId || 'org-demo-default';

        if (!phone) {
          // Auto-pair fallback: find existing phone record or first organization
          const [firstPhone] = await db.select().from(phoneNumbers).limit(1);
          if (firstPhone) {
            await db
              .update(phoneNumbers)
              .set({
                phoneNumberId: phoneNumberId,
                organizationId: targetOrgId,
                status: 'CONNECTED',
              })
              .where(eq(phoneNumbers.id, firstPhone.id));

            phone = {
              ...firstPhone,
              phoneNumberId: phoneNumberId,
              organizationId: targetOrgId,
              status: 'CONNECTED',
            };
            console.log(`✨ Auto-registered Phone Number ID ${phoneNumberId} to organization ${targetOrgId}`);
          } else {
            const newPhoneId = nanoid();
            await db.insert(phoneNumbers).values({
              id: newPhoneId,
              organizationId: targetOrgId,
              phoneNumberId: phoneNumberId,
              displayPhoneNumber: '+62 821-6075-0067',
              verifiedName: 'IDS Payment',
              qualityRating: 'GREEN',
              status: 'CONNECTED',
              createdAt: new Date(),
            });
            phone = {
              id: newPhoneId,
              organizationId: targetOrgId,
              phoneNumberId: phoneNumberId,
              displayPhoneNumber: '+62 821-6075-0067',
              verifiedName: 'IDS Payment',
              qualityRating: 'GREEN',
              status: 'CONNECTED',
              createdAt: new Date(),
            };
            console.log(`✨ Auto-created phone record for Phone Number ID ${phoneNumberId}`);
          }
        } else if (phone.organizationId !== targetOrgId && targetOrgId !== 'org-demo-default') {
          // Ensure phone is linked to user's real active organization
          await db
            .update(phoneNumbers)
            .set({ organizationId: targetOrgId })
            .where(eq(phoneNumbers.id, phone.id));
          phone.organizationId = targetOrgId;
        }

        const orgId = targetOrgId;

        // Auto-migrate any orphan conversations/contacts from demo org to active user org
        if (targetOrgId !== 'org-demo-default') {
          await db
            .update(conversations)
            .set({ organizationId: targetOrgId })
            .where(eq(conversations.organizationId, 'org-demo-default'));

          await db
            .update(contacts)
            .set({ organizationId: targetOrgId })
            .where(eq(contacts.organizationId, 'org-demo-default'));
        }

        // Fetch Organization Settings (Care Window, Access Token, Operating Hours)
        const [orgFull] = await db
          .select({
            careWindowHours: organizations.careWindowHours,
            accessToken: organizations.accessToken,
            operatingHours: organizations.operatingHours,
            aiAgentConfig: organizations.aiAgentConfig,
          })
          .from(organizations)
          .where(eq(organizations.id, orgId))
          .limit(1);

        const careHours = orgFull?.careWindowHours ?? 24;
        const activeAccessToken = orgFull?.accessToken || env.META_ACCESS_TOKEN;
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

            // 2b. Process Inbound Media & Text
            let messageBody = '';
            let mediaUrl: string | null = null;
            let mediaMimeType: string | null = null;

            if (msg.type === 'text' && msg.text) {
              messageBody = msg.text.body;
            } else if (msg.type === 'image' && msg.image) {
              messageBody = msg.image.caption || '[Foto/Gambar]';
              mediaMimeType = msg.image.mime_type || 'image/jpeg';
              if (msg.image.id) {
                const downloaded = await MetaApiService.downloadMedia(msg.image.id, activeAccessToken);
                if (downloaded) {
                  mediaUrl = downloaded.localUrl;
                  mediaMimeType = downloaded.mimeType;
                }
              }
            } else if (msg.type === 'document' && msg.document) {
              const filename = msg.document.filename || 'dokumen.pdf';
              messageBody = msg.document.caption ? `${msg.document.caption} (${filename})` : `[Dokumen: ${filename}]`;
              mediaMimeType = msg.document.mime_type || 'application/pdf';
              if (msg.document.id) {
                const downloaded = await MetaApiService.downloadMedia(msg.document.id, activeAccessToken);
                if (downloaded) {
                  mediaUrl = downloaded.localUrl;
                  mediaMimeType = downloaded.mimeType;
                }
              }
            } else if (msg.type === 'audio' && msg.audio) {
              messageBody = '[Pesan Suara / Audio]';
              mediaMimeType = msg.audio.mime_type || 'audio/ogg';
              if (msg.audio.id) {
                const downloaded = await MetaApiService.downloadMedia(msg.audio.id, activeAccessToken);
                if (downloaded) {
                  mediaUrl = downloaded.localUrl;
                  mediaMimeType = downloaded.mimeType;
                }
              }
            } else if (msg.type === 'video' && msg.video) {
              messageBody = msg.video.caption || '[Video]';
              mediaMimeType = msg.video.mime_type || 'video/mp4';
              if (msg.video.id) {
                const downloaded = await MetaApiService.downloadMedia(msg.video.id, activeAccessToken);
                if (downloaded) {
                  mediaUrl = downloaded.localUrl;
                  mediaMimeType = downloaded.mimeType;
                }
              }
            } else if (msg.type === 'sticker' && msg.sticker) {
              messageBody = '[Stiker]';
              mediaMimeType = msg.sticker.mime_type || 'image/webp';
              if (msg.sticker.id) {
                const downloaded = await MetaApiService.downloadMedia(msg.sticker.id, activeAccessToken);
                if (downloaded) {
                  mediaUrl = downloaded.localUrl;
                  mediaMimeType = downloaded.mimeType;
                }
              }
            } else {
              messageBody = `[${msg.type.toUpperCase()}]`;
            }

            // 2c. Find Active Conversation (Exclude RESOLVED tickets so new customer messages start a fresh session)
            const [activeConv] = await db
              .select()
              .from(conversations)
              .where(
                and(
                  eq(conversations.organizationId, orgId),
                  eq(conversations.contactId, contactId!),
                  ne(conversations.status, 'RESOLVED')
                )
              )
              .orderBy(desc(conversations.createdAt))
              .limit(1);

            let convId = activeConv?.id;
            let currentAssignedAgentId: string | null = null;

            if (!activeConv) {
              // 🆕 Start a NEW Conversation Session / Ticket
              convId = nanoid();

              // Auto-assign: Least-Workload Routing (Agent with minimum active chats)
              const leastBusyAgentId = await WebhookProcessor.getLeastBusyAgent(orgId);
              currentAssignedAgentId = leastBusyAgentId;

              try {
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
                console.log(`✨ Sesi percakapan baru (${convId}) berhasil dibuat untuk kontak ${customerWaId} (Status: ${leastBusyAgentId ? 'OPEN' : 'UNASSIGNED'})`);
              } catch (convErr) {
                // Concurrent webhook insert fallback
                const [reConv] = await db
                  .select()
                  .from(conversations)
                  .where(
                    and(
                      eq(conversations.organizationId, orgId),
                      eq(conversations.contactId, contactId!),
                      ne(conversations.status, 'RESOLVED')
                    )
                  )
                  .orderBy(desc(conversations.createdAt))
                  .limit(1);
                if (reConv) {
                  convId = reConv.id;
                  currentAssignedAgentId = reConv.assignedUserId;
                }
              }
            } else {
              convId = activeConv.id;
              let targetAssignedUser = activeConv.assignedUserId;
              let targetStatus = activeConv.status;

              // If conversation was unassigned, route to least busy online agent or UNASSIGNED queue
              if (!targetAssignedUser) {
                const onlineAgentId = await WebhookProcessor.getLeastBusyAgent(orgId);
                targetAssignedUser = onlineAgentId; // null if all agents offline
                targetStatus = onlineAgentId ? 'OPEN' : 'UNASSIGNED';
              }

              currentAssignedAgentId = targetAssignedUser;

              await db
                .update(conversations)
                .set({
                  windowExpiresAt,
                  lastMessagePreview: messageBody,
                  lastMessageAt: new Date(),
                  assignedUserId: targetAssignedUser,
                  status: targetStatus,
                })
                .where(eq(conversations.id, activeConv.id));
            }

            // 2d. Save Message (Deduplicate via Meta wamid)
            const wamId = msg.id || ('wamid.inbound_' + nanoid());
            const [existingMsg] = await db
              .select({ id: messages.id })
              .from(messages)
              .where(eq(messages.wamId, wamId))
              .limit(1);

            if (!existingMsg) {
              try {
                await db.insert(messages).values({
                  id: nanoid(),
                  conversationId: convId!,
                  wamId: wamId,
                  direction: 'INBOUND',
                  senderType: 'CONTACT',
                  senderId: null,
                  messageType: msg.type,
                  body: messageBody,
                  mediaUrl: mediaUrl,
                  mediaMimeType: mediaMimeType,
                  isInternalNote: false,
                  status: 'DELIVERED',
                  errorDetails: null,
                  createdAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
                });

                console.log(`✅ Pesan WA masuk dari ${customerWaId} ("${messageBody.substring(0, 30)}") berhasil disimpan!`);

                // 2d. AI Agent Auto-Responder Trigger Check
                const [orgFull] = await db
                  .select({
                    operatingHours: organizations.operatingHours,
                    aiAgentConfig: organizations.aiAgentConfig,
                  })
                  .from(organizations)
                  .where(eq(organizations.id, orgId))
                  .limit(1);

                const aiCfg = orgFull?.aiAgentConfig;
                if (aiCfg && aiCfg.enabled) {
                  const isScheduleEnabled = orgFull.operatingHours && orgFull.operatingHours.enabled;
                  const isOutOfHours = isScheduleEnabled
                    ? AiAgentService.isOutOfOperatingHours(orgFull.operatingHours)
                    : true; // Jika jadwal jam kerja nonaktif, perlakukan sebagai 24/7

                  const isAlwaysOn = aiCfg.triggerMode === 'ALWAYS' || !isScheduleEnabled;
                  const shouldRespond = isAlwaysOn || isOutOfHours;

                  if (shouldRespond) {
                    if (!currentAssignedAgentId) {
                      console.log(`🤖 Memicu AI Agent Auto-Responder untuk ${customerWaId} (Mode: ${isAlwaysOn ? '24/7 Selalu Aktif' : 'Luar Jam Kerja'})...`);
                      AiAgentService.handleOutOfHoursInbound({
                        orgId,
                        convId: convId!,
                        contactWaId: customerWaId,
                        contactName: customerName,
                        incomingText: messageBody,
                        phoneRecordId: phone.id,
                      }).catch((aiErr) =>
                        console.error('❌ AI Agent background handler error:', aiErr.message)
                      );
                    } else {
                      console.log(`ℹ️ Percakapan ${convId} sudah diambil oleh agen manusia (${currentAssignedAgentId}). AI Agent standby.`);
                    }
                  } else {
                    console.log(`ℹ️ Pesan masuk pada JAM OPERASIONAL AKTIF. Menunggu respon agen manusia.`);
                  }
                }
              } catch (msgErr: any) {
                console.log(`ℹ️ Pesan WA ${wamId} sudah tersimpan sebelumnya.`);
              }
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
