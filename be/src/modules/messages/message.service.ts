// ===========================================
// Message Service — Sending & Internal Whispering
// ===========================================

import { eq, and, desc, asc, ne } from 'drizzle-orm';
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

    if (conv.status === 'RESOLVED') {
      throw new Error('Tiket percakapan ini telah Diselesaikan (RESOLVED) & Terkunci permanen.');
    }

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
   * Generate Smart AI Reply Suggestions for CS Agent
   */
  static async generateAiSuggestions(user: JwtPayload, conversationId: string, currentDraft?: string) {
    const conv = await ConversationService.getById(user, conversationId);

    // Fetch latest 5 messages for context
    const recentMessages = await db
      .select({
        direction: messages.direction,
        body: messages.body,
        isInternalNote: messages.isInternalNote,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.isInternalNote, false)))
      .orderBy(desc(messages.createdAt))
      .limit(5);

    const contactName = conv.contact.name || 'Kak';
    const lastCustomerMsg = recentMessages.find((m) => m.direction === 'INBOUND')?.body || '';
    const lastMsgLower = lastCustomerMsg.toLowerCase();

    // If agent has typed a draft, polish variations of draft
    if (currentDraft && currentDraft.trim().length > 3) {
      const draft = currentDraft.trim();
      return {
        mode: 'POLISH_DRAFT',
        suggestions: [
          {
            title: '🌟 Versi Ramah & Empatis',
            text: `Halo Kak ${contactName}, ${draft.charAt(0).toLowerCase() + draft.slice(1)} Semoga membantu ya kak! 😊`,
          },
          {
            title: '⚡ Versi Ringkas & Solutif',
            text: `Baik Kak ${contactName}. ${draft}`,
          },
          {
            title: '💼 Versi Formal & Resmi',
            text: `Selamat hari ini, Kak ${contactName}. Mengenai perihal tersebut, ${draft.charAt(0).toLowerCase() + draft.slice(1)} Terima kasih telah menghubungi layanan kami.`,
          },
        ],
      };
    }

    // Contextual intelligent suggestions based on customer query
    let options = [];

    if (lastMsgLower.includes('harga') || lastMsgLower.includes('berapa') || lastMsgLower.includes('biaya') || lastMsgLower.includes('katalog') || lastMsgLower.includes('pricelist')) {
      options = [
        {
          title: '🏷️ Info Harga & Brosur',
          text: `Halo Kak ${contactName}! 😊 Terima kasih sudah tertarik. Untuk rincian paket dan daftar harga terbaru dapat kami infokan langsung. Boleh tau layanan/produk mana yang paling sesuai kebutuhan Kakak?`,
        },
        {
          title: '📦 Solusi Produk & Katalog',
          text: `Siap Kak ${contactName}, kami memiliki beberapa pilihan paket unggulan. Boleh kami bantu rekomenkan paket terbaik sesuai budget & kebutuhan Kakak?`,
        },
        {
          title: '💬 Tanya Kebutuhan Detail',
          text: `Halo Kak ${contactName}, untuk penawaran harga terbaik & potongan diskon spesial, boleh diinfokan estimasi jumlah/spesifikasi yang Kakak butuhkan?`,
        },
      ];
    } else if (lastMsgLower.includes('resi') || lastMsgLower.includes('kirim') || lastMsgLower.includes('sampai') || lastMsgLower.includes('lacak') || lastMsgLower.includes('pos')) {
      options = [
        {
          title: '🚚 Cek Status Pengiriman',
          text: `Halo Kak ${contactName}, baik mohon dibantu kirimkan Nomor Resi atau Nomor Pesanannya ya kak. Tim kami akan bantu melacak posisi pesanan Kakak sekarang juga! 📦`,
        },
        {
          title: '⏳ Estimasi Pengiriman',
          text: `Siap Kak ${contactName}, tim ekspedisi kami sedang memproses pengiriman. Boleh infokan nomor invoice agar dapat kami pastikan koordinat terbarunya.`,
        },
        {
          title: '📞 Layanan Bantuan Logistik',
          text: `Baik Kak ${contactName}, pesanan Kakak dalam perjalanan. Jika ada keterlambatan dari kurir, kami akan langsung bantu eskalasi ke pihak ekspedisi terkait.`,
        },
      ];
    } else if (lastMsgLower.includes('rekening') || lastMsgLower.includes('bayar') || lastMsgLower.includes('tf') || lastMsgLower.includes('transfer') || lastMsgLower.includes('pembayaran')) {
      options = [
        {
          title: '💳 Info Rekening Pembayaran',
          text: `Halo Kak ${contactName}, pembayaran dapat ditransfer melalui rekening resmi kami:\n• BCA: 1234567890 a.n. PT Official WA CRM\n• Mandiri: 0987654321 a.n. PT Official WA CRM\n\nJika sudah transfer, mohon lampirkan bukti struk/screenshot ya Kak! 🙏`,
        },
        {
          title: '✅ Konfirmasi Pembayaran Selesai',
          text: `Terima kasih Kak ${contactName}! Bukti pembayaran Kakak sudah kami terima dan sedang diverifikasi oleh tim finance kami.`,
        },
        {
          title: '⚡ Instruksi Pembayaran',
          text: `Baik Kak ${contactName}, mohon selesaikan pembayaran sebelum batas waktu berakhir agar pesanan Kakak dapat segera kami kemas dan kirimkan.`,
        },
      ];
    } else if (lastMsgLower.includes('komplain') || lastMsgLower.includes('rusak') || lastMsgLower.includes('salah') || lastMsgLower.includes('kecewa') || lastMsgLower.includes('batal')) {
      options = [
        {
          title: '🙏 Permohonan Maaf & Penanganan Fast-Track',
          text: `Mohon maaf yang sebesar-besarnya atas ketidaknyamanan ini ya Kak ${contactName}. 🙏 Boleh bantu kirimkan foto/video kendalanya? Tim kami siap membantu mencarikan solusi penggantian secepatnya!`,
        },
        {
          title: '🛠️ Garansi & Penggantian Produk',
          text: `Halo Kak ${contactName}, kenyamanan Kakak adalah prioritas kami. Semua transaksi dilindungi garansi resmi. Kami bantu proses klaim atau penukaran unit baru ya Kak.`,
        },
        {
          title: '📞 Investigasi Tim Teknis',
          text: `Baik Kak ${contactName}, laporan kendala ini sudah kami teruskan ke tim penanggung jawab. Kami akan update perkembangannya dalam waktu singkat.`,
        },
      ];
    } else {
      options = [
        {
          title: '👋 Salam Ramah & Bantuan CS',
          text: `Halo Kak ${contactName}! 😊 Ada yang bisa tim Customer Service kami bantu hari ini? Bicarakan saja kendala atau pertanyaan Kakak ya!`,
        },
        {
          title: '⚡ Tanggapan Cepat & Solutif',
          text: `Baik Kak ${contactName}, pesan Kakak sudah kami terima. Boleh infokan lebih detail agar kami berikan informasi yang akurat?`,
        },
        {
          title: '💼 Format Konfirmasi Tim CS',
          text: `Selamat hari ini Kak ${contactName}. Terima kasih telah menghubungi layanan resmi kami. Mohon tunggu sebentar, tim kami sedang memeriksa data Anda.`,
        },
      ];
    }

    return {
      mode: 'SMART_REPLY',
      suggestions: options,
    };
  }
}
