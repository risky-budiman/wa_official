// ===========================================
// Idle rule — move a chat when the customer waits too long for an answer
// ===========================================
//
// Pengaturan → Distribusi Chat → "Pindahkan chat jika tidak dibalas". Every minute: for chats whose
// customer has been waiting longer than the limit, AUTO mode hands the chat to the least-busy other
// online agent; MANUAL mode puts it back in the queue. A chat is moved at most MAX_IDLE_REASSIGNS
// times until someone replies.

import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../config/database';
import { activityLogs, conversations, messages, organizations, users } from '../db/schema';
import { WebhookProcessor } from '../modules/webhook/webhook.processor';
import { isIdleTooLong, MAX_IDLE_REASSIGNS, normalizeAssignmentRules } from './assignment-rules';

export class IdleReassignService {
  static async runCycle(now = Date.now()) {
    const orgs = await db
      .select({ id: organizations.id, assignmentConfig: organizations.assignmentConfig })
      .from(organizations);

    for (const org of orgs) {
      const rules = normalizeAssignmentRules(org.assignmentConfig);
      if (!rules.idleReassignMinutes) continue;
      try {
        await this.runForOrg(org.id, rules.mode, rules.idleReassignMinutes, now);
      } catch (err: any) {
        console.warn(`⚠️ Idle rule (${org.id}):`, err?.message || err);
      }
    }
  }

  private static async runForOrg(orgId: string, mode: 'AUTO' | 'MANUAL', minutes: number, now: number) {
    // Owned, active chats where the customer spoke last; firstUnansweredAt = their first message since our last reply
    const candidates = await db
      .select({
        id: conversations.id,
        assignedUserId: conversations.assignedUserId,
        assignedAt: conversations.assignedAt,
        idleReassignCount: conversations.idleReassignCount,
        firstUnansweredAt: sql<string | null>`(
          SELECT MIN(m.created_at) FROM messages m
          WHERE m.conversation_id = ${conversations.id} AND m.direction = 'INBOUND'
            AND m.created_at > COALESCE((
              SELECT MAX(o.created_at) FROM messages o
              WHERE o.conversation_id = ${conversations.id} AND o.direction = 'OUTBOUND'
                AND COALESCE(o.is_internal_note, 0) = 0
            ), '1970-01-01')
        )`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, orgId),
          inArray(conversations.status, ['OPEN', 'PENDING']),
          isNotNull(conversations.assignedUserId),
          lt(conversations.idleReassignCount, MAX_IDLE_REASSIGNS)
        )
      );

    for (const c of candidates) {
      if (
        !c.assignedUserId ||
        !isIdleTooLong({
          minutes,
          firstUnansweredAt: c.firstUnansweredAt,
          assignedAt: c.assignedAt,
          reassignCount: c.idleReassignCount ?? 0,
          now,
        })
      ) {
        continue;
      }

      const nextAgentId = mode === 'AUTO' ? await WebhookProcessor.getLeastBusyAgent(orgId, { excludeUserId: c.assignedUserId }) : null;
      // AUTO with nobody else online/available: leave it with the current agent and try again next minute
      if (mode === 'AUTO' && !nextAgentId) continue;

      // Only move it if nobody took or answered it in the meantime
      const res: any = await db
        .update(conversations)
        .set({
          assignedUserId: nextAgentId,
          assignedAt: nextAgentId ? new Date(now) : null,
          status: nextAgentId ? 'OPEN' : 'UNASSIGNED',
          idleReassignCount: sql`${conversations.idleReassignCount} + 1`,
        })
        .where(and(eq(conversations.id, c.id), eq(conversations.assignedUserId, c.assignedUserId)));
      if (Number((Array.isArray(res) ? res[0] : res)?.affectedRows ?? 0) === 0) continue;

      const names = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(inArray(users.id, [c.assignedUserId, ...(nextAgentId ? [nextAgentId] : [])]));
      const nameOf = (id: string) => names.find((n) => n.id === id)?.fullName || 'agen';
      const target = nextAgentId ? `dipindahkan ke ${nameOf(nextAgentId)}` : 'dikembalikan ke antrean';

      await db.insert(messages).values({
        id: nanoid(),
        conversationId: c.id,
        senderType: 'SYSTEM',
        senderId: null,
        direction: 'OUTBOUND',
        messageType: 'text',
        body: `⏰ Pelanggan menunggu lebih dari ${minutes} menit tanpa balasan dari ${nameOf(c.assignedUserId)}. Chat ${target}.`,
        isInternalNote: true,
        status: 'SENT',
      });
      await db.insert(activityLogs).values({
        id: nanoid(),
        organizationId: orgId,
        userId: null,
        action: 'ASSIGN_CHAT',
        details: {
          conversationId: c.id,
          type: 'IDLE_REASSIGN',
          from: c.assignedUserId,
          to: nextAgentId,
          thresholdMinutes: minutes,
        },
      });
      console.log(`⏰ Idle rule: chat ${c.id} ${target}`);
    }
  }

  static startWorker(intervalMs = 60000) {
    setInterval(() => {
      this.runCycle().catch((err) => console.warn('Idle rule cycle notice:', err?.message || err));
    }, intervalMs);
    console.log('⏰ Idle-reassign worker active (Every 60s)');
  }
}
