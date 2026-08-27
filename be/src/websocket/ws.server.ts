// ===========================================
// Bun Native WebSocket Server with Room RBAC
// ===========================================

import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';
import type { JwtPayload } from '../middleware/auth';

export const wsPlugin = new Elysia({ name: 'ws-server' })
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
    })
  )
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
        const user = (await ws.data.jwt.verify(token)) as unknown as JwtPayload;
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
    message(ws, data: any) {
      const user = (ws.data as any).user as JwtPayload | undefined;
      if (!user) return;

      // Handle subscription to specific conversation thread
      if (data.type === 'JOIN_CONVERSATION' && data.conversationId) {
        ws.subscribe(`conv:${data.conversationId}`);
        ws.send({ type: 'JOINED_CONVERSATION', conversationId: data.conversationId });
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
