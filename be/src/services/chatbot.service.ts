// ===========================================
// Chatbot Service — Rule-Based & Interactive Menu Engine
// ===========================================

import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { messages, conversations, phoneNumbers, organizations } from '../db/schema';
import { MetaApiService } from './meta-api.service';
import { AiAgentService } from './ai-agent.service';
import { env } from '../config/env';

export class ChatbotService {
  /**
   * Process incoming customer message through Rule-Based Chatbot first,
   * then fallback to AI Agent if no rule matches.
   */
  static async processInbound(params: {
    orgId: string;
    convId: string;
    contactWaId: string;
    contactName: string;
    incomingText: string;
    phoneRecordId: string;
  }): Promise<{ handledBy: 'CHATBOT' | 'AI_AGENT' | 'HUMAN_HANDOFF' | 'NONE'; replyText?: string }> {
    const { orgId, convId, contactWaId, contactName, incomingText, phoneRecordId } = params;
    const cleanText = incomingText.trim().toLowerCase();

    // 1. Check if conversation is already claimed by a human agent
    const [conv] = await db
      .select({
        id: conversations.id,
        assignedUserId: conversations.assignedUserId,
        status: conversations.status,
      })
      .from(conversations)
      .where(eq(conversations.id, convId))
      .limit(1);

    if (conv && (conv.assignedUserId || conv.status === 'RESOLVED')) {
      return { handledBy: 'NONE' };
    }

    // 2. Fetch Phone details
    const [phone] = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.id, phoneRecordId))
      .limit(1);

    const phoneNumberId = phone?.phoneNumberId || 'phone_default';

    // Fetch Organization Chatbot Config
    const [org] = await db
      .select({
        name: organizations.name,
        chatbotConfig: organizations.chatbotConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    let customConfig = org?.chatbotConfig;
    if (typeof customConfig === 'string') {
      try { customConfig = JSON.parse(customConfig); } catch (_) {}
    }

    // ─── RULE-BASED CHATBOT KEYWORD EVALUATION ──────────────────────────

    let chatbotReply = '';
    let isHandoffToHuman = false;
    let isPassToAi = false;

    // A. Check Custom Configured Rules (if available)
    if (customConfig && Array.isArray(customConfig.rules) && customConfig.rules.length > 0) {
      for (const rule of customConfig.rules) {
        if (Array.isArray(rule.keywords) && rule.keywords.some((k: string) => cleanText.includes(k.trim().toLowerCase()))) {
          chatbotReply = rule.replyText.replace(/{{contactName}}/g, contactName);
          if (rule.action === 'HANDOFF_HUMAN') {
            isHandoffToHuman = true;
          }
          break;
        }
      }
    }

    // B. Default Fallback Preset Rules (if no custom rule matched)
    if (!chatbotReply) {
      if (['halo', 'hi', 'hallo', 'p', 'ping', 'menu', 'bantuan', 'start', '0'].includes(cleanText)) {
        chatbotReply = customConfig?.greetingText
          ? customConfig.greetingText.replace(/{{contactName}}/g, contactName)
          : `Halo Kak ${contactName}! 👋 Selamat datang di Layanan Pelanggan ${org?.name || 'Kami'}.

Silakan pilih menu bantuan di bawah ini dengan mengetikkan angkanya:

1️⃣ Informasi Produk & Katalog
2️⃣ Cek Status Pesanan / Resi
3️⃣ Hubungi Customer Care (Agen Manusia)
4️⃣ Tanya Jawab Otomatis (Asisten AI)

Ketik angka 1-4 untuk melanjutkan. 🙏`;
      } else if (['1', 'produk', 'katalog', 'price', 'harga'].includes(cleanText)) {
        chatbotReply = `📦 *Informasi Produk & Katalog*

Terima kasih atas minat Kak ${contactName}! 
Anda dapat melihat katalog lengkap produk terbaru kami melalui tautan resmi berikut:
🌐 https://katalog.perusahaan.com

Ketik *MENU* untuk kembali ke menu utama.`;
      } else if (['2', 'resi', 'pesanan', 'pos', 'lacak'].includes(cleanText)) {
        chatbotReply = `🚚 *Cek Status Pengiriman Pesanan*

Untuk melacak pesanan Anda, silakan kirimkan Nomor Invoice atau Nomor Resi Anda (contoh: *#INV-88902*).

Ketik *MENU* untuk kembali ke menu utama.`;
      } else if (['3', 'cs', 'agen', 'human', 'operator'].includes(cleanText)) {
        chatbotReply = `👤 *Menghubungkan ke Customer Care...*

Pesan Kak ${contactName} telah kami masukkan ke antrean prioritas. Agen Customer Service kami akan segera melayani Anda saat giliran tiba. Mohon tunggu sebentar ya! 🙏`;
        isHandoffToHuman = true;
      }
    }
    // Option 2: Status Pesanan / Resi
    else if (['2', 'resi', 'pesanan', 'pos', 'lacak'].includes(cleanText)) {
      chatbotReply = `🚚 *Cek Status Pengiriman Pesanan*

Untuk melacak pesanan Anda, silakan kirimkan Nomor Invoice atau Nomor Resi Anda (contoh: *#INV-88902*).

Ketik *MENU* untuk kembali ke menu utama.`;
    }
    // Option 3: Handoff ke Agen Manusia
    else if (['3', 'cs', 'agen', 'human', 'operator'].includes(cleanText)) {
      chatbotReply = `👤 *Menghubungkan ke Customer Care...*

Pesan Kak ${contactName} telah kami masukkan ke antrean prioritas. Agen Customer Service kami akan segera melayani Anda saat giliran tiba. Mohon tunggu sebentar ya! 🙏`;
      isHandoffToHuman = true;
    }
    // Option 4: AI Agent Handover
    else if (['4', 'ai', 'tanya', 'bot'].includes(cleanText)) {
      isPassToAi = true;
    }

    // ─── EXECUTE CHATBOT RESPONSE ─────────────────────────────
    if (chatbotReply) {
      // Send WhatsApp Outbound Message via Meta API if token exists
      let wamId: string | null = null;
      try {
        const metaRes = await MetaApiService.sendTextMessage(
          {
            phoneNumberId,
            recipientWaId: contactWaId,
            text: chatbotReply,
          },
          env.META_ACCESS_TOKEN
        );
        wamId = metaRes.messages?.[0]?.id || null;
      } catch (err: any) {
        console.warn('Chatbot Meta Send error:', err.message);
      }

      // Save Chatbot message to Database (senderType: 'BOT')
      const messageId = nanoid();
      await db.insert(messages).values({
        id: messageId,
        conversationId: convId,
        wamId,
        direction: 'OUTBOUND',
        senderType: 'BOT',
        senderId: null,
        messageType: 'text',
        body: chatbotReply,
        isInternalNote: false,
        status: 'SENT',
        createdAt: new Date(),
      });

      // Update Conversation preview
      await db
        .update(conversations)
        .set({
          lastMessagePreview: `[Chatbot]: ${chatbotReply.slice(0, 80)}`,
          lastMessageAt: new Date(),
          status: isHandoffToHuman ? 'UNASSIGNED' : 'OPEN',
        })
        .where(eq(conversations.id, convId));

      return {
        handledBy: isHandoffToHuman ? 'HUMAN_HANDOFF' : 'CHATBOT',
        replyText: chatbotReply,
      };
    }

    // ─── FALLBACK TO AI AGENT (If free-text input or option 4) ────────────────
    try {
      await AiAgentService.handleOutOfHoursInbound(params);
      return { handledBy: 'AI_AGENT' };
    } catch (aiErr: any) {
      console.warn('AI Agent fallback error:', aiErr.message);
      return { handledBy: 'NONE' };
    }
  }
}
