// ===========================================
// Message Routes
// ===========================================

import { Elysia, t } from 'elysia';
import { authPlugin } from '../../middleware/auth';
import { MessageService } from './message.service';

export const messageRoutes = new Elysia({ prefix: '/messages' })
  .use(authPlugin)

  // ─── GET /messages/:conversationId ─────────
  .get(
    '/:conversationId',
    async ({ user, params, query, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const data = await MessageService.list(user, params.conversationId, {
          limit: query.limit ? Number(query.limit) : undefined,
          offset: query.offset ? Number(query.offset) : undefined,
        });

        return {
          success: true,
          ...data,
        };
      } catch (err: any) {
        set.status = 403;
        return { success: false, error: err.message };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  )

  // ─── POST /messages/send — Send to WhatsApp ─
  .post(
    '/send',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const message = await MessageService.send(user, body as any);
        return {
          success: true,
          message,
        };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        conversationId: t.String(),
        messageType: t.Optional(t.String()),
        body: t.String({ minLength: 1 }),
        mediaUrl: t.Optional(t.String()),
        mediaMimeType: t.Optional(t.String()),
        templateName: t.Optional(t.String()),
        templateComponents: t.Optional(t.Array(t.Any())),
      }),
    }
  )

  // ─── POST /messages/internal-note (Whisper) 
  .post(
    '/internal-note',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const note = await MessageService.addInternalNote(user, body);
        return {
          success: true,
          note,
        };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        conversationId: t.String(),
        body: t.String({ minLength: 1 }),
      }),
    }
  )

  // ─── POST /messages/ai-suggest — Generate AI Reply Suggestions
  .post(
    '/ai-suggest',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const result = await MessageService.generateAiSuggestions(user, body.conversationId, body.currentDraft);
        return {
          success: true,
          ...result,
        };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        conversationId: t.String(),
        currentDraft: t.Optional(t.String()),
      }),
    }
  );
