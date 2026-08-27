// ===========================================
// Conversation Routes — Multi-Agent & Status
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../config/database';
import { phoneNumbers, contacts, conversations, messages } from '../../db/schema';
import { authPlugin } from '../../middleware/auth';
import { ConversationService } from './conversation.service';
import type { ConversationStatus } from '../../db/schema/conversations';

export const conversationRoutes = new Elysia({ prefix: '/conversations' })
  .use(authPlugin)

  // ─── GET /conversations — List Conversations ──
  .get(
    '/',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const data = await ConversationService.list(user, {
          status: query.status as ConversationStatus,
          limit: query.limit ? Number(query.limit) : undefined,
          offset: query.offset ? Number(query.offset) : undefined,
          search: query.search,
        });

        return {
          success: true,
          ...data,
        };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    }
  )

  // ─── GET /conversations/:id — Get Single Detail ──
  .get('/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const data = await ConversationService.getById(user, params.id);
      return { success: true, data };
    } catch (err: any) {
      set.status = 403;
      return { success: false, error: err.message };
    }
  })

  // ─── POST /conversations/:id/participants — Add Multi-Agent Participant ──
  .post(
    '/:id/participants',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const res = await ConversationService.addParticipant(
          user,
          params.id,
          body.userId,
          (body.roleInChat as any) || 'COLLABORATOR'
        );
        return res;
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        userId: t.String(),
        roleInChat: t.Optional(
          t.Union([t.Literal('PRIMARY_AGENT'), t.Literal('COLLABORATOR'), t.Literal('SUPERVISOR')])
        ),
      }),
    }
  )

  // ─── DELETE /conversations/:id/participants/:userId — Remove Participant ──
  .delete('/:id/participants/:userId', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const res = await ConversationService.removeParticipant(
        user,
        params.id,
        params.userId
      );
      return res;
    } catch (err: any) {
      set.status = 400;
      return { success: false, error: err.message };
    }
  })

  // ─── POST /conversations/:id/messages — Send Outbound / Internal Note ──
  .post(
    '/:id/messages',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const res = await ConversationService.sendMessage(
          user,
          params.id,
          body.body,
          body.isInternalNote || false
        );
        return res;
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        body: t.String(),
        isInternalNote: t.Optional(t.Boolean()),
      }),
    }
  )

  // ─── POST /conversations/:id/assign — Re-assign Conversation ──
  .post(
    '/:id/assign',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const res = await ConversationService.assign(
          user,
          params.id,
          body.assignedUserId,
          body.teamId
        );
        return res;
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        assignedUserId: t.String(),
        teamId: t.Optional(t.String()),
      }),
    }
  )

  // ─── PATCH /conversations/:id/status — Resolve / Reopen ──
  .patch(
    '/:id/status',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const res = await ConversationService.updateStatus(
          user,
          params.id,
          body.status as ConversationStatus
        );
        return res;
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        status: t.Union([
          t.Literal('UNASSIGNED'),
          t.Literal('OPEN'),
          t.Literal('PENDING'),
          t.Literal('RESOLVED'),
          t.Literal('EXPIRED'),
        ]),
      }),
    }
  )

  // ─── POST /conversations/simulate-inbound — Webhook Simulator ──
  .post(
    '/simulate-inbound',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const { senderWaId, senderName, messageText } = body;
        const orgId = user.orgId;

        // 1. Get Phone Number
        const [phone] = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.organizationId, orgId))
          .limit(1);

        const phoneId = phone?.id || 'phone_default';

        // 2. Upsert Contact
        const cleanWaId = senderWaId.replace(/\D/g, '') || '6281299990000';
        const [existingContact] = await db
          .select()
          .from(contacts)
          .where(and(eq(contacts.organizationId, orgId), eq(contacts.waId, cleanWaId)))
          .limit(1);

        let contactId = existingContact?.id;
        if (!existingContact) {
          contactId = nanoid();
          await db.insert(contacts).values({
            id: contactId,
            organizationId: orgId,
            waId: cleanWaId,
            name: senderName?.trim() || 'Pelanggan +' + cleanWaId,
          });
        }

        // 3. Find or Create Conversation
        const [activeConv] = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.organizationId, orgId),
              eq(conversations.contactId, contactId!)
            )
          )
          .limit(1);

        let convId = activeConv?.id;
        const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        if (!activeConv) {
          convId = nanoid();
          await db.insert(conversations).values({
            id: convId,
            organizationId: orgId,
            phoneNumberId: phoneId,
            contactId: contactId!,
            assignedUserId: user.id,
            status: 'OPEN',
            windowExpiresAt,
            lastMessagePreview: messageText,
            lastMessageAt: new Date(),
          });
        } else {
          await db
            .update(conversations)
            .set({
              windowExpiresAt,
              lastMessagePreview: messageText,
              lastMessageAt: new Date(),
              status: 'OPEN',
            })
            .where(eq(conversations.id, activeConv.id));
        }

        // 4. Save Inbound Message
        const msgId = nanoid();
        await db.insert(messages).values({
          id: msgId,
          conversationId: convId!,
          direction: 'INBOUND',
          senderType: 'CONTACT',
          senderId: null,
          messageType: 'text',
          body: messageText,
          isInternalNote: false,
          status: 'DELIVERED',
        });

        return {
          success: true,
          message: 'Pesan WhatsApp masuk berhasil disimulasikan!',
          conversationId: convId,
        };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        senderWaId: t.String(),
        senderName: t.Optional(t.String()),
        messageText: t.String(),
      }),
    }
  );
