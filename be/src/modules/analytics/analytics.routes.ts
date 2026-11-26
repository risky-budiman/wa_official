// ===========================================
// Analytics & SLA Reporting Service & Routes
// ===========================================

import { Elysia } from 'elysia';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../config/database';
import { conversations, users, messages, activityLogs } from '../../db/schema';
import { authPlugin } from '../../middleware/auth';

export class AnalyticsService {
  static async getSlaMetrics(orgId: string) {
    // 1. Total resolved conversations
    const [resolvedStats] = await db
      .select({
        totalResolved: sql<number>`COUNT(*)`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, orgId),
          eq(conversations.status, 'RESOLVED')
        )
      );

    // 2. Total active conversations
    const [activeStats] = await db
      .select({
        totalActive: sql<number>`COUNT(*)`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, orgId),
          sql`${conversations.status} <> 'RESOLVED'`
        )
      );

    // 3. Agent Performance Leaderboard
    const agentStats = await db
      .select({
        id: users.id,
        name: users.fullName,
        email: users.email,
        role: users.role,
        resolvedCount: sql<number>`COUNT(${conversations.id})`,
      })
      .from(users)
      .leftJoin(
        conversations,
        and(
          eq(conversations.assignedUserId, users.id),
          eq(conversations.status, 'RESOLVED')
        )
      )
      .where(and(eq(users.organizationId, orgId), sql`${users.role} IN ('ADMINISTRATOR', 'SUPERVISOR', 'AGENT')`))
      .groupBy(users.id, users.fullName, users.email, users.role)
      .orderBy(desc(sql`COUNT(${conversations.id})`));

    // 4. Real SLA timings (previously hardcoded placeholder values)
    //    FRT = first non-internal OUTBOUND reply after the customer's first INBOUND message
    const [frtRows]: any = await db.execute(sql`
      SELECT c.assigned_user_id AS uid,
             TIMESTAMPDIFF(SECOND, fi.first_in, (
               SELECT MIN(o.created_at) FROM messages o
               WHERE o.conversation_id = fi.cid
                 AND o.direction = 'OUTBOUND'
                 AND COALESCE(o.is_internal_note, 0) = 0
                 AND o.sender_type NOT IN ('SYSTEM', 'BOT')
                 AND o.created_at >= fi.first_in
             )) AS secs
      FROM (
        SELECT m.conversation_id AS cid, MIN(m.created_at) AS first_in
        FROM messages m
        JOIN conversations c2 ON c2.id = m.conversation_id
        WHERE c2.organization_id = ${orgId} AND m.direction = 'INBOUND'
        GROUP BY m.conversation_id
      ) fi
      JOIN conversations c ON c.id = fi.cid
    `);

    //    Ticket duration = opened → last message, for RESOLVED tickets
    const [artRows]: any = await db.execute(sql`
      SELECT assigned_user_id AS uid,
             TIMESTAMPDIFF(SECOND, created_at, last_message_at) AS secs
      FROM conversations
      WHERE organization_id = ${orgId} AND status = 'RESOLVED' AND last_message_at IS NOT NULL
    `);

    const avg = (rows: any[], uid?: string): number | null => {
      const vals = rows
        .filter((r) => (uid === undefined || r.uid === uid) && r.secs !== null && Number(r.secs) >= 0)
        .map((r) => Number(r.secs));
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };

    return {
      overview: {
        totalResolved: Number(resolvedStats?.totalResolved || 0),
        totalActive: Number(activeStats?.totalActive || 0),
        avgFirstResponseTime: formatDuration(avg(frtRows)),
        avgResolutionTime: formatDuration(avg(artRows)),
        // No customer-satisfaction survey exists yet → null instead of a fake score
        csatScore: null as string | null,
      },
      agentPerformance: agentStats.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        resolved: Number(a.resolvedCount),
        frt: formatDuration(avg(frtRows, a.id)),
        art: formatDuration(avg(artRows, a.id)),
        csat: null as string | null,
      })),
    };
  }
}

/** 102 → "1 mnt 42 dtk", 7500 → "2 jam 5 mnt", null → null */
function formatDuration(totalSeconds: number | null): string | null {
  if (totalSeconds === null) return null;
  if (totalSeconds < 60) return `${totalSeconds} dtk`;
  const days = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  if (days > 0) return `${days} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} mnt`;
  return `${m} mnt ${sec} dtk`;
}

export const analyticsRoutes = new Elysia({ prefix: '/analytics' })
  .use(authPlugin)
  .get('/sla', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    // The report lists every agent (with e-mail) — leads only, like the menu
    if (!['ADMINISTRATOR', 'SUPERVISOR', 'SUPER_ADMIN'].includes(user.role)) {
      set.status = 403;
      return { success: false, error: 'Laporan hanya untuk Supervisor dan Administrator' };
    }

    const data = await AnalyticsService.getSlaMetrics(user.orgId);
    return { success: true, ...data };
  });
