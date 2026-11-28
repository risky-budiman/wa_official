// ===========================================
// Message Service — Sending & Internal Whispering
// ===========================================

import { eq, and, desc, asc, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../../config/database';
import { messages, conversations, contacts, phoneNumbers, organizations, users, messageTemplates } from '../../db/schema';
import { ConversationService } from '../conversations/conversation.service';
import { MetaApiService } from '../../services/meta-api.service';
import { env } from '../../config/env';
import type { JwtPayload } from '../../middleware/auth';
import type { SendMessageBody, InternalNoteBody, GetMessagesQuery } from './message.types';
import { getActivePhone, PHONE_STATUS_ARCHIVED } from '../../services/phone-number.service';
import { orgMetaToken } from '../../services/meta-credentials';
import { AiAgentService } from '../../services/ai-agent.service';
import type { AiAgentConfig } from '../../db/schema/organizations';
import {
  buildSuggestSystemPrompt,
  buildSuggestUserPrompt,
  formatTranscript,
  parseSuggestions,
  type SuggestMode,
} from '../../services/reply-suggest';

export class MessageService {
  /**
   * List messages in a conversation (with RBAC verification)
   */
  static async list(user: JwtPayload, conversationId: string, query: GetMessagesQuery = {}) {
    // 🔒 Enforce access verification: Agent only has access to their assigned chats!
    await ConversationService.getById(user, conversationId);

    // Auto-mark inbound messages as READ when viewed
    await db
      .update(messages)
      .set({ status: 'READ' })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.direction, 'INBOUND'),
          ne(messages.status, 'READ')
        )
      );

    const items = await this.fetchThread(conversationId, query);
    return {
      items,
      count: items.length,
    };
  }

  /**
   * Messages of one conversation, oldest → newest. No access check and no read receipts:
   * callers verify access first (list() above, or the contact's chat history).
   */
  static async fetchThread(conversationId: string, query: GetMessagesQuery = {}) {
    const limit = Math.min(query.limit || 200, 500);
    const offset = query.offset || 0;

    // Fetch the NEWEST messages first (so long chats show the latest messages), then return them oldest → newest
    const newestFirst = await db
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
        // Meta's reason when status is FAILED (shown to the agent)
        errorDetails: messages.errorDetails,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    return newestFirst.reverse();
  }

  /**
   * Send WhatsApp message (Outbound to Meta API + Saved in DB)
   */
  static async send(user: JwtPayload, body: SendMessageBody) {
    // 🔒 Verify user has rights to conversation (if agent, must be assigned)
    const conv = await ConversationService.getById(user, body.conversationId);

    if (conv.status === 'RESOLVED') {
      throw new Error('Tiket percakapan ini telah Diselesaikan (RESOLVED) & Terkunci permanen.');
    }

    // Replying to a queued chat takes it — only when agents may take chats themselves
    if (user.role === 'AGENT' && !conv.assignedUserId && !(await ConversationService.rules(user.orgId)).agentCanTakeUnassigned) {
      throw new Error('Chat ini belum ditugaskan ke Anda. Minta supervisor untuk menugaskan sebelum membalas.');
    }

    // Get phone channel details
    let [phone] = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.id, conv.phoneNumberId))
      .limit(1);

    // The organization switched numbers: continue this conversation on the active number
    if (!phone || phone.status === PHONE_STATUS_ARCHIVED) {
      const active = await getActivePhone(conv.organizationId);
      if (active) {
        phone = active;
        await db.update(conversations).set({ phoneNumberId: active.id }).where(eq(conversations.id, conv.id));
      }
    }

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

    const activeToken = orgMetaToken(org?.accessToken);

    // Media: the client sends "[DOCUMENT] file.pdf" when there is no caption. That label is
    // internal — never send it to the customer as a caption.
    const mediaKind = (messageType || '').toLowerCase();
    const isMedia = !!body.mediaUrl && ['image', 'document', 'video', 'audio'].includes(mediaKind);
    const placeholder = /^\[(DOCUMENT|VIDEO|AUDIO|IMAGE)\]\s*/i;
    const rawText = (body.body || '').trim();
    const caption = isMedia && !placeholder.test(rawText) ? rawText : '';
    const fileLabel = body.filename || rawText.replace(placeholder, '') || '';
    // Stored body: the caption, or for documents the file name (shown on the file card)
    const storedBody = isMedia ? caption || (mediaKind === 'document' ? fileLabel : '') : body.body;
    const preview = !isMedia
      ? body.body
      : caption ||
        (mediaKind === 'image' ? '📷 Foto' : mediaKind === 'video' ? '🎬 Video' : mediaKind === 'audio' ? '🎵 Audio' : `📄 ${fileLabel || 'Dokumen'}`);

    // Send via Meta API
    if (messageType === 'template' && body.templateName) {
      // Use the template's registered language (Meta rejects a language that doesn't match)
      const [tmpl] = await db
        .select({ language: messageTemplates.language })
        .from(messageTemplates)
        .where(and(eq(messageTemplates.organizationId, conv.organizationId), eq(messageTemplates.name, body.templateName)))
        .limit(1);

      const metaRes = await MetaApiService.sendTemplateMessage({
        phoneNumberId: phone.phoneNumberId,
        recipientWaId: conv.contact.waId,
        templateName: body.templateName,
        languageCode: tmpl?.language || 'id',
        components: body.templateComponents,
      }, activeToken);
      wamId = metaRes.messages?.[0]?.id || null;
    } else if (isMedia) {
      const metaRes = await MetaApiService.sendMediaMessage({
        phoneNumberId: phone.phoneNumberId,
        recipientWaId: conv.contact.waId,
        type: (messageType || 'document').toLowerCase() as 'image' | 'document' | 'video' | 'audio',
        mediaUrl: body.mediaUrl as string,
        caption: caption || undefined,
        filename: mediaKind === 'document' ? fileLabel || undefined : undefined,
      }, activeToken);
      wamId = metaRes.messages?.[0]?.id || null;
    } else {
      const metaRes = await MetaApiService.sendTextMessage({
        phoneNumberId: phone.phoneNumberId,
        recipientWaId: conv.contact.waId,
        text: body.body || '',
      }, activeToken);
      wamId = metaRes.messages?.[0]?.id || null;
    }

    // Save message to MySQL
    const messageId = nanoid();
    const senderType = (user.role === 'SUPER_ADMIN' || user.role === 'CO_SUPER_ADMIN' || user.role === 'ADMIN_FINANCE' || user.role === 'ADMIN_SUPPORT')
      ? 'ADMINISTRATOR'
      : (user.role as 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT');

    await db.insert(messages).values({
      id: messageId,
      conversationId: conv.id,
      wamId,
      direction: 'OUTBOUND',
      senderType,
      senderId: user.id,
      messageType,
      body: storedBody,
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
        lastMessagePreview: preview,
        lastMessageAt: new Date(),
        status: 'OPEN',
        // The customer got an answer: the idle rule starts over
        idleReassignCount: 0,
      })
      .where(eq(conversations.id, conv.id));

    // Whoever replies takes the chat (or joins it as collaborator) — no manual "Ambil" needed.
    // A failure here must not turn an already-delivered message into an error.
    let ownership: Awaited<ReturnType<typeof ConversationService.claimOnReply>> = {};
    try {
      ownership = await ConversationService.claimOnReply(user, conv);
    } catch (err: any) {
      console.warn('⚠️ Auto-assign on reply failed:', err?.message || err);
    }

    return {
      ownership,
      id: messageId,
      wamId,
      conversationId: conv.id,
      direction: 'OUTBOUND',
      senderType: user.role,
      senderId: user.id,
      messageType,
      body: storedBody,
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

    if (conv.status === 'RESOLVED') {
      throw new Error('Tiket percakapan ini telah Diselesaikan (RESOLVED) & Terkunci permanen.');
    }

    const messageId = nanoid();
    const senderType = (user.role === 'SUPER_ADMIN' || user.role === 'CO_SUPER_ADMIN' || user.role === 'ADMIN_FINANCE' || user.role === 'ADMIN_SUPPORT')
      ? 'ADMINISTRATOR'
      : (user.role as 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT');

    await db.insert(messages).values({
      id: messageId,
      conversationId: conv.id,
      wamId: null,
      direction: 'OUTBOUND',
      senderType,
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

  /**
   * Reply suggestions for the agent, written by the organization's AI (Pengaturan AI) from the real
   * conversation and the company guide. With a draft, the AI polishes the draft instead.
   */
  static async generateAiSuggestions(user: JwtPayload, conversationId: string, currentDraft?: string) {
    const conv = await ConversationService.getById(user, conversationId);

    const [org] = await db
      .select({ name: organizations.name, aiAgentConfig: organizations.aiAgentConfig })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);
    const rawAi = org?.aiAgentConfig;
    let ai: AiAgentConfig | null = null;
    try {
      ai = (typeof rawAi === 'string' ? JSON.parse(rawAi) : rawAi) as AiAgentConfig | null;
    } catch {
      ai = null;
    }

    const recent = await db
      .select({ direction: messages.direction, messageType: messages.messageType, body: messages.body })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.isInternalNote, false)))
      .orderBy(desc(messages.createdAt))
      .limit(20);
    recent.reverse();

    const draft = currentDraft?.trim() || '';
    const mode: SuggestMode = draft ? 'POLISH_DRAFT' : 'SMART_REPLY';
    if (mode === 'SMART_REPLY' && !recent.some((m) => m.direction === 'INBOUND')) {
      throw new Error('Belum ada pesan dari pelanggan untuk dibalas.');
    }

    let raw: string;
    try {
      raw = await AiAgentService.generateAiResponse({
        provider: ai?.provider || 'gemini',
        systemPrompt: buildSuggestSystemPrompt(org?.name || 'perusahaan kami', ai?.systemPrompt),
        userMessage: buildSuggestUserPrompt({
          transcript: formatTranscript(recent),
          contactName: conv.contact?.name ?? undefined,
          draft,
        }),
        apiKey: ai?.apiKey,
        model: ai?.model,
        baseUrl: ai?.baseUrl,
        maxTokens: 2000,
      });
    } catch (err: any) {
      throw new Error(`Asisten AI belum bisa dipakai: ${err?.message || err}. Periksa Pengaturan AI.`);
    }

    const suggestions = parseSuggestions(raw);
    if (!suggestions.length) {
      throw new Error('AI tidak memberikan saran yang bisa dibaca. Silakan coba lagi.');
    }
    return { mode, suggestions };
  }
}
