// ===========================================
// Chatbot Service — automatic replies for inbound WhatsApp messages
// ===========================================
//
// Flow for every inbound customer message (called from the webhook):
//   1. Skip when a human owns the conversation, it is resolved, or the customer
//      already asked for a human (status PENDING).
//   2. Respect the master switch and "only outside working hours".
//   3. bot-engine decides: keyword rule / greeting menu / AI / fixed message / silent.
//   4. Send through the organization's own WhatsApp channel and store the message.

import { nanoid } from 'nanoid';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../config/database';
import { messages, conversations, phoneNumbers, organizations } from '../db/schema';
import type { AiAgentConfig, ChatbotConfig, OperatingHoursConfig } from '../db/schema/organizations';
import { MetaApiService } from './meta-api.service';
import { AiAgentService } from './ai-agent.service';
import { decideBotReply, normalizeBotSettings, fillTemplate, DEFAULT_STATIC_MESSAGE } from './bot-engine';
import { getActivePhone, PHONE_STATUS_ARCHIVED } from './phone-number.service';
import { env } from '../config/env';

export type BotHandledBy = 'GREETING' | 'RULE' | 'AI' | 'STATIC' | 'HUMAN_HANDOFF' | 'NONE';

const parseJson = <T>(v: unknown): T | null => {
  if (!v) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
};

/** Don't repeat the same fixed auto-reply to one customer more often than this. */
const STATIC_REPEAT_WINDOW_MS = 6 * 60 * 60 * 1000;

export function buildAiSystemPrompt(orgName: string, customPrompt?: string) {
  const base = `Anda adalah asisten customer service WhatsApp resmi dari ${orgName}.
- Jawab dalam Bahasa Indonesia yang ramah, sopan, dan ringkas (maksimal 2-3 paragraf pendek).
- Gunakan format WhatsApp sederhana (*tebal*, daftar bernomor) bila membantu; jangan gunakan Markdown lain.
- Jangan mengarang harga, stok, status pesanan, atau kebijakan yang tidak ada di panduan perusahaan.
- Jika tidak tahu jawabannya, atau pelanggan meminta berbicara dengan manusia, sampaikan bahwa pesan akan diteruskan ke tim customer service.`;
  const custom = customPrompt?.trim();
  return custom ? `${base}\n\n[PANDUAN PERUSAHAAN]\n${custom}` : base;
}

export class ChatbotService {
  static async processInbound(params: {
    orgId: string;
    convId: string;
    contactWaId: string;
    contactName: string;
    incomingText: string;
    phoneRecordId: string;
    isNewConversation?: boolean;
  }): Promise<{ handledBy: BotHandledBy; replyText?: string }> {
    const { orgId, convId, contactWaId, contactName, incomingText } = params;

    // 1. A human owns it / closed / customer is waiting for a human → stay quiet
    const [conv] = await db
      .select({ assignedUserId: conversations.assignedUserId, status: conversations.status })
      .from(conversations)
      .where(eq(conversations.id, convId))
      .limit(1);
    if (!conv || conv.assignedUserId || conv.status === 'RESOLVED' || conv.status === 'PENDING') {
      return { handledBy: 'NONE' };
    }

    const [org] = await db
      .select({
        name: organizations.name,
        accessToken: organizations.accessToken,
        operatingHours: organizations.operatingHours,
        aiAgentConfig: organizations.aiAgentConfig,
        chatbotConfig: organizations.chatbotConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    if (!org) return { handledBy: 'NONE' };

    const ai = parseJson<AiAgentConfig>(org.aiAgentConfig);
    const chatbot = parseJson<ChatbotConfig>(org.chatbotConfig);
    const hours = parseJson<OperatingHoursConfig>(org.operatingHours);
    const settings = normalizeBotSettings(ai, chatbot);

    // 2. Master switch + "only outside working hours"
    if (!settings.enabled) return { handledBy: 'NONE' };
    if (ai?.triggerMode === 'OUT_OF_HOURS' && hours?.enabled && !AiAgentService.isOutOfOperatingHours(hours)) {
      return { handledBy: 'NONE' };
    }

    // 3. Decide
    const decision = decideBotReply({
      message: incomingText,
      settings,
      contactName,
      businessName: org.name,
      isNewConversation: params.isNewConversation,
    });

    const channel = await this.resolveChannel(params.phoneRecordId, orgId, org.accessToken);

    if (decision.kind === 'SILENT') return { handledBy: 'NONE' };

    if (decision.kind === 'GREETING' || decision.kind === 'RULE') {
      if (decision.reply) {
        await this.sendBotMessage({ convId, contactWaId, text: decision.reply, channel, label: 'Chatbot' });
      }
      if (decision.kind === 'RULE' && decision.handoff) {
        // Customer asked for a human: keep the bot quiet until an agent takes the chat
        await db.update(conversations).set({ status: 'PENDING' }).where(eq(conversations.id, convId));
        return { handledBy: 'HUMAN_HANDOFF', replyText: decision.reply };
      }
      if (decision.kind === 'RULE' && decision.thenAi) {
        return this.answerWithAi({ convId, contactWaId, contactName, incomingText, orgName: org.name, ai, settings, channel });
      }
      return { handledBy: decision.kind, replyText: decision.reply };
    }

    if (decision.kind === 'STATIC') {
      return this.sendStatic({ convId, contactWaId, text: decision.reply, channel });
    }

    return this.answerWithAi({ convId, contactWaId, contactName, incomingText, orgName: org.name, ai, settings, channel });
  }

  // ───────── helpers ─────────

  private static async answerWithAi(p: {
    convId: string;
    contactWaId: string;
    contactName: string;
    incomingText: string;
    orgName: string;
    ai: AiAgentConfig | null;
    settings: ReturnType<typeof normalizeBotSettings>;
    channel: Channel;
  }): Promise<{ handledBy: BotHandledBy; replyText?: string }> {
    try {
      const recent = await db
        .select({ direction: messages.direction, body: messages.body, isInternalNote: messages.isInternalNote })
        .from(messages)
        .where(eq(messages.conversationId, p.convId))
        .orderBy(desc(messages.createdAt))
        .limit(10);
      // Drop internal notes and the message we are answering (it is sent as the user turn)
      const history = recent
        .reverse()
        .filter((m) => !m.isInternalNote && m.body)
        .map((m) => ({ role: (m.direction === 'INBOUND' ? 'user' : 'model') as 'user' | 'model', text: m.body || '' }));
      if (history.length && history[history.length - 1].role === 'user' && history[history.length - 1].text === p.incomingText) {
        history.pop();
      }

      const reply = await AiAgentService.generateAiResponse({
        provider: p.ai?.provider || 'gemini',
        systemPrompt: buildAiSystemPrompt(p.orgName, p.ai?.systemPrompt),
        userMessage: p.incomingText,
        conversationHistory: history,
        apiKey: p.ai?.apiKey,
        model: p.ai?.model,
        baseUrl: p.ai?.baseUrl,
      });
      if (!reply.trim()) return { handledBy: 'NONE' };
      await this.sendBotMessage({ convId: p.convId, contactWaId: p.contactWaId, text: reply, channel: p.channel, label: 'AI' });
      return { handledBy: 'AI', replyText: reply };
    } catch (err: any) {
      console.error('❌ AI auto-reply gagal:', err?.message || err);
      // Fall back to the fixed message so the customer is not left without an answer
      const text = fillTemplate(p.settings.staticMessage || DEFAULT_STATIC_MESSAGE, {
        contactName: p.contactName,
        businessName: p.orgName,
      });
      return this.sendStatic({ convId: p.convId, contactWaId: p.contactWaId, text, channel: p.channel });
    }
  }

  /** Fixed auto-reply, but never the same text twice within STATIC_REPEAT_WINDOW_MS. */
  private static async sendStatic(p: { convId: string; contactWaId: string; text: string; channel: Channel }) {
    const since = new Date(Date.now() - STATIC_REPEAT_WINDOW_MS);
    const [recentSame] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, p.convId),
          eq(messages.senderType, 'BOT'),
          eq(messages.body, p.text),
          gte(messages.createdAt, since)
        )
      )
      .limit(1);
    if (recentSame) return { handledBy: 'NONE' as BotHandledBy };
    await this.sendBotMessage({ ...p, label: 'Auto-reply' });
    return { handledBy: 'STATIC' as BotHandledBy, replyText: p.text };
  }

  private static async resolveChannel(phoneRecordId: string, orgId: string, orgToken?: string | null): Promise<Channel> {
    let [phone] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, phoneRecordId)).limit(1);
    if (!phone || phone.status === PHONE_STATUS_ARCHIVED) {
      phone = (await getActivePhone(orgId)) || phone;
    }
    const token = orgToken && !orgToken.startsWith('EAAGm0PX4ZCBO') ? orgToken : env.META_ACCESS_TOKEN;
    return { phoneNumberId: phone?.phoneNumberId || '', token: token || '' };
  }

  private static async sendBotMessage(p: { convId: string; contactWaId: string; text: string; channel: Channel; label: string }) {
    let wamId: string | null = null;
    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorDetails: string | null = null;
    if (p.channel.phoneNumberId && p.channel.token) {
      try {
        const metaRes = await MetaApiService.sendTextMessage(
          { phoneNumberId: p.channel.phoneNumberId, recipientWaId: p.contactWaId, text: p.text },
          p.channel.token
        );
        wamId = metaRes.messages?.[0]?.id || null;
      } catch (err: any) {
        status = 'FAILED';
        errorDetails = err?.message || 'Gagal mengirim ke WhatsApp';
        console.warn(`⚠️ Balasan otomatis (${p.label}) gagal dikirim:`, errorDetails);
      }
    } else {
      status = 'FAILED';
      errorDetails = 'Nomor WhatsApp belum terhubung';
    }

    await db.insert(messages).values({
      id: nanoid(),
      conversationId: p.convId,
      wamId,
      direction: 'OUTBOUND',
      senderType: 'BOT',
      senderId: null,
      messageType: 'text',
      body: p.text,
      isInternalNote: false,
      status,
      errorDetails,
      createdAt: new Date(),
    } as any);

    await db
      .update(conversations)
      .set({ lastMessagePreview: `[${p.label}]: ${p.text.slice(0, 80)}`, lastMessageAt: new Date() })
      .where(eq(conversations.id, p.convId));
  }
}

interface Channel {
  phoneNumberId: string;
  token: string;
}
