// ===========================================
// Message Service — Sending & Internal Whispering
// ===========================================

import { eq, and, desc, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../config/database';
import { messages, conversations, contacts, phoneNumbers, organizations, users } from '../../db/schema';
import { ConversationService } from '../conversations/conversation.service';
import { MetaApiService } from '../../services/meta-api.service';
import { env } from '../../config/env';
import type { JwtPayload } from '../../middleware/auth';
import type { SendMessageBody, InternalNoteBody, GetMessagesQuery } from './message.types';

export class MessageService {
  /**
   * List messages in a conversation (with RBAC verification)
   */
  static async list(user: JwtPayload, conversationId: string, query: GetMessagesQuery = {}) {
    // 🔒 Enforce access verification: Agent only has access to their assigned chats!
    await ConversationService.getById(user, conversationId);

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const items = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        wamId: messages.wamId,
        direction: messages.direction,
        senderType: messages.senderType,
        senderId: messages.senderId,
        senderName: users.fullName,
        messageType: messages.messageType,
        body: messages.body,
        mediaUrl: messages.mediaUrl,
        mediaMimeType: messages.mediaMimeType,
        isInternalNote: messages.isInternalNote,
        status: messages.status,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      count: items.length,
    };
  }

  /**
   * Send WhatsApp message (Outbound to Meta API + Saved in DB)
   */
  static async send(user: JwtPayload, body: SendMessageBody) {
    // 🔒 Verify user has rights to conversation (if agent, must be assigned)
    const conv = await ConversationService.getById(user, body.conversationId);

    // Get phone channel details
    const [phone] = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.id, conv.phoneNumberId))
      .limit(1);

    if (!phone) {
      throw new Error('Nomor telepon channel tidak ditemukan');
    }

    // Check 24-Hour window (if expired, require template)
    const isWindowExpired = conv.windowExpiresAt ? new Date() > new Date(conv.windowExpiresAt) : false;

    let wamId: string | null = null;
    let messageType = body.messageType || 'text';

    if (isWindowExpired && messageType !== 'template') {
      throw new Error('Jendela 24-jam Meta telah berakhir. Anda harus mengirim pesan menggunakan WhatsApp Template.');
    }

    // Get organization access token for sending message
    const [org] = await db
      .select({ accessToken: organizations.accessToken })
      .from(organizations)
      .where(eq(organizations.id, conv.organizationId))
      .limit(1);

    const activeToken = org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
      ? org.accessToken
      : env.META_ACCESS_TOKEN;

    // Send via Meta API
    if (messageType === 'template' && body.templateName) {
      const metaRes = await MetaApiService.sendTemplateMessage({
        phoneNumberId: phone.phoneNumberId,
        recipientWaId: conv.contact.waId,
        templateName: body.templateName,
        languageCode: 'id',
        components: body.templateComponents,
      }, activeToken);
      wamId = metaRes.messages?.[0]?.id || null;
    } else {
      const metaRes = await MetaApiService.sendTextMessage({
        phoneNumberId: phone.phoneNumberId,
        recipientWaId: conv.contact.waId,
        text: body.body,
      }, activeToken);
      wamId = metaRes.messages?.[0]?.id || null;
    }

    // Save message to MySQL
    const messageId = nanoid();
    await db.insert(messages).values({
      id: messageId,
      conversationId: conv.id,
      wamId,
      direction: 'OUTBOUND',
      senderType: user.role,
      senderId: user.id,
      messageType,
      body: body.body,
      mediaUrl: body.mediaUrl,
      mediaMimeType: body.mediaMimeType,
      isInternalNote: false,
      status: 'SENT',
      createdAt: new Date(),
    });

    // Update conversation preview and last activity
    await db
      .update(conversations)
      .set({
        lastMessagePreview: body.body,
        lastMessageAt: new Date(),
        status: 'OPEN',
      })
      .where(eq(conversations.id, conv.id));

    return {
      id: messageId,
      wamId,
      conversationId: conv.id,
      direction: 'OUTBOUND',
      senderType: user.role,
      senderId: user.id,
      messageType,
      body: body.body,
      mediaUrl: body.mediaUrl,
      mediaMimeType: body.mediaMimeType,
      isInternalNote: false,
      status: 'SENT',
      createdAt: new Date(),
    };
  }

  /**
   * Create Internal Note (Whispering note)
   * Stored with isInternalNote: true, NEVER sent to Meta WhatsApp API!
   */
  static async addInternalNote(user: JwtPayload, body: InternalNoteBody) {
    // 🔒 Verify access
    const conv = await ConversationService.getById(user, body.conversationId);

    const messageId = nanoid();
    await db.insert(messages).values({
      id: messageId,
      conversationId: conv.id,
      wamId: null,
      direction: 'OUTBOUND',
      senderType: user.role,
      senderId: user.id,
      messageType: 'text',
      body: body.body,
      isInternalNote: true,
      status: 'SENT',
    });

    return {
      id: messageId,
      conversationId: conv.id,
      body: body.body,
      senderType: user.role,
      isInternalNote: true,
      createdAt: new Date(),
    };
  }
}
