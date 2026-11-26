// ===========================================
// Auto-Resolve Service: Automatically resolves inactive conversations
// ===========================================

import { db } from '../config/database';
import { organizations, conversations, messages, activityLogs } from '../db/schema';
import { eq, and, sql, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class AutoResolveService {
  /**
   * Scan and resolve open conversations where the customer has been inactive past the configured threshold.
   */
  static async runAutoResolveCycle(onlyOrgId?: string) {
    try {
      const orgList = onlyOrgId
        ? await db.select().from(organizations).where(eq(organizations.id, onlyOrgId))
        : await db.select().from(organizations);

      for (const org of orgList) {
        const hours = org.autoResolveHours ?? 3;
        if (hours <= 0) continue; // 0 means auto-resolve disabled

        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

        // Find active conversations that are waiting on the CUSTOMER (our side spoke last) and have been
        // quiet past the threshold. Never close a chat where the customer is the one waiting for an answer,
        // nor one the chatbot handed to a human (PENDING without an agent).
        const inactiveConversations = await db
          .select({
            id: conversations.id,
            assignedUserId: conversations.assignedUserId,
            contactId: conversations.contactId,
            lastMessageAt: conversations.lastMessageAt,
          })
          .from(conversations)
          .where(
            and(
              eq(conversations.organizationId, org.id),
              sql`${conversations.status} IN ('OPEN', 'PENDING')`,
              lt(conversations.lastMessageAt, cutoffTime),
              sql`NOT (${conversations.status} = 'PENDING' AND ${conversations.assignedUserId} IS NULL)`,
              sql`(SELECT m.direction FROM messages m
                   WHERE m.conversation_id = ${conversations.id} AND m.is_internal_note = 0
                   ORDER BY m.created_at DESC LIMIT 1) = 'OUTBOUND'`
            )
          );

        for (const conv of inactiveConversations) {
          // 1. Mark status as RESOLVED
          await db
            .update(conversations)
            .set({ status: 'RESOLVED' })
            .where(eq(conversations.id, conv.id));

          // 2. Insert internal system note
          await db.insert(messages).values({
            id: nanoid(),
            conversationId: conv.id,
            senderType: 'SYSTEM',
            senderId: null,
            direction: 'OUTBOUND',
            messageType: 'text',
            body: `⏱️ Obrolan otomatis diselesaikan (Auto-Resolved) karena pelanggan tidak membalas selama ${hours} jam.`,
            isInternalNote: true,
            status: 'SENT',
          });

          // 3. Insert audit log
          await db.insert(activityLogs).values({
            id: nanoid(),
            organizationId: org.id,
            userId: null,
            action: 'RESOLVE_CHAT',
            details: {
              conversationId: conv.id,
              type: 'AUTO_RESOLVE_INACTIVITY',
              thresholdHours: hours,
            },
          });
        }
      }
    } catch (err) {
      console.warn('Auto-resolve background cycle notice:', err);
    }
  }

  /**
   * Start recurring background worker (checks every 60 seconds)
   */
  static startWorker(intervalMs = 60000) {
    // Initial run
    this.runAutoResolveCycle();

    // Recurring interval
    setInterval(() => {
      this.runAutoResolveCycle();
    }, intervalMs);

    console.log('⏱️ Auto-Resolve Inactivity Worker active (Every 60s)');
  }
}
