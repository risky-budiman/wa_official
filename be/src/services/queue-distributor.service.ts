// ===========================================
// Queue distributor — hand queued chats to agents who are online and have room
// ===========================================
//
// Before this, a chat that entered the queue while nobody was online only got an agent when the
// customer wrote again. Now (mode Otomatis only) every minute — and right away when an agent goes
// Online — queued chats are handed out, oldest first, to the least-busy online agent below the
// "Maksimal Chat per Agen" limit. Chats whose 24-hour window has expired stay in the queue for a
// person to take: they can only get a template, so they should not fill an agent's capacity.

import { and, eq, isNull, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../config/database';
import { activityLogs, conversations, messages, organizations, users } from '../db/schema';
import { WebhookProcessor } from '../modules/webhook/webhook.processor';
import { windowStillOpen } from '../modules/conversations/conversation.service';
import { normalizeAssignmentRules } from './assignment-rules';

const running = new Set<string>();

export class QueueDistributorService {
  /** Hand out this organization's queue. Safe to call often; one run per organization at a time. */
  static async distribute(orgId: string): Promise<number> {
    if (running.has(orgId)) return 0;
    running.add(orgId);
    try {
      const [org] = await db
        .select({ assignmentConfig: organizations.assignmentConfig })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      if (!org || normalizeAssignmentRules(org.assignmentConfig).mode !== 'AUTO') return 0;

      const queued = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, orgId),
            ne(conversations.status, 'RESOLVED'),
            isNull(conversations.assignedUserId),
            windowStillOpen()
          )
        )
        .orderBy(conversations.createdAt)
        .limit(200);

      let assigned = 0;
      for (const conv of queued) {
        // Re-evaluated per chat: workloads change as we hand chats out; null = nobody online with room
        const agentId = await WebhookProcessor.getLeastBusyAgent(orgId);
        if (!agentId) break;

        const res: any = await db
          .update(conversations)
          .set({ assignedUserId: agentId, assignedAt: new Date(), idleReassignCount: 0, status: 'OPEN' })
          .where(and(eq(conversations.id, conv.id), isNull(conversations.assignedUserId)));
        if (Number((Array.isArray(res) ? res[0] : res)?.affectedRows ?? 0) === 0) continue; // taken meanwhile

        const [agent] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, agentId)).limit(1);
        await db.insert(messages).values({
          id: nanoid(),
          conversationId: conv.id,
          senderType: 'SYSTEM',
          senderId: null,
          direction: 'OUTBOUND',
          messageType: 'text',
          body: `📥 Chat dari antrean otomatis diberikan ke ${agent?.fullName || 'agen'} (agen online)`,
          isInternalNote: true,
          status: 'SENT',
        });
        await db.insert(activityLogs).values({
          id: nanoid(),
          organizationId: orgId,
          userId: null,
          action: 'ASSIGN_CHAT',
          details: { conversationId: conv.id, type: 'QUEUE_AUTO_ASSIGN', assignedTo: agentId },
        });
        assigned++;
      }
      if (assigned) console.log(`📥 Antrean: ${assigned} chat dibagikan ke agen online (${orgId})`);
      return assigned;
    } finally {
      running.delete(orgId);
    }
  }

  static async runCycle() {
    const orgs = await db.select({ id: organizations.id }).from(organizations);
    for (const org of orgs) {
      try {
        await this.distribute(org.id);
      } catch (err: any) {
        console.warn(`⚠️ Queue distributor (${org.id}):`, err?.message || err);
      }
    }
  }

  static startWorker(intervalMs = 60000) {
    setInterval(() => {
      this.runCycle().catch((err) => console.warn('Queue distributor cycle notice:', err?.message || err));
    }, intervalMs);
    console.log('📥 Queue distributor active (Every 60s)');
  }
}
