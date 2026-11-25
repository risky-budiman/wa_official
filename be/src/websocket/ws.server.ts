// ===========================================
// Bun Native WebSocket Server with Room RBAC
// ===========================================

import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { and, eq } from 'drizzle-orm';
import { db } from '../config/database';
import { conversations } from '../db/schema/conversations';
import { jwtConfig, resolveUserFromToken, type JwtPayload } from '../middleware/auth';

export const wsPlugin = new Elysia({ name: 'ws-server' })
  .use(jwt(jwtConfig))
  .ws('/ws', {
    query: t.Object({
      token: t.Optional(t.String()),
    }),
    async open(ws) {
      const token = ws.data.query.token;

      if (!token) {
        ws.send({ type: 'ERROR', message: 'Token otentikasi diperlukan' });
        ws.close();
        return;
      }

      try {
        const user = await resolveUserFromToken((t) => ws.data.jwt.verify(t), token);
        if (!user) {
          ws.send({ type: 'ERROR', message: 'Token tidak valid' });
          ws.close();
          return;
        }

        // Store user in socket data
        (ws.data as any).user = user;

        // Auto-join Organization Room
        ws.subscribe(`org:${user.orgId}`);

        // Auto-join User Private Room
        ws.subscribe(`user:${user.id}`);

        // Supervisors and Admins join Monitoring Room
        if (user.role === 'ADMINISTRATOR' || user.role === 'SUPERVISOR') {
          ws.subscribe(`monitoring:${user.orgId}`);
        }

        ws.send({
          type: 'CONNECTED',
          message: `WebSocket terhubung sebagai [${user.role}] ${user.email}`,
          userId: user.id,
          role: user.role,
        });

        console.log(`🔌 WS Connected: [${user.role}] ${user.email}`);
      } catch (err: any) {
        ws.send({ type: 'ERROR', message: 'Verifikasi token gagal' });
        ws.close();
      }
    },
    async message(ws, data: any) {
      const user = (ws.data as any).user as JwtPayload | undefined;
      if (!user) return;

      // Handle subscription to specific conversation thread
      if (data.type === 'JOIN_CONVERSATION' && data.conversationId) {
        // 🔒 Only allow joining conversations that belong to the user's organization
        const conversationId = String(data.conversationId);
        const [conv] = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, user.orgId)))
          .limit(1);

        if (!conv) {
          ws.send({ type: 'ERROR', message: 'Percakapan tidak ditemukan atau tidak dapat diakses' });
          return;
        }

        ws.subscribe(`conv:${conversationId}`);
        ws.send({ type: 'JOINED_CONVERSATION', conversationId });
      } else if (data.type === 'LEAVE_CONVERSATION' && data.conversationId) {
        ws.unsubscribe(`conv:${data.conversationId}`);
      }
    },
    close(ws) {
      const user = (ws.data as any).user as JwtPayload | undefined;
      if (user) {
        console.log(`🔌 WS Disconnected: ${user.email}`);
      }
    },
  });
