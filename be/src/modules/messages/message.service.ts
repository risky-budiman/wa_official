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
   * Generate Smart AI Reply Suggestions for CS Agent based on real ongoing conversation
   */
  static async generateAiSuggestions(user: JwtPayload, conversationId: string, currentDraft?: string) {
    const conv = await ConversationService.getById(user, conversationId);

    // Fetch latest 10 messages for context, ordered chronologically
    const recentMessages = await db
      .select({
        direction: messages.direction,
        body: messages.body,
        isInternalNote: messages.isInternalNote,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.isInternalNote, false)))
      .orderBy(desc(messages.createdAt))
      .limit(10);

    // Sort chronologically (oldest to newest)
    recentMessages.reverse();

    const contactName = conv.contact.name || 'Kak';
    const inboundMessages = recentMessages.filter((m) => m.direction === 'INBOUND');
    const lastCustomerMsgObj = inboundMessages[inboundMessages.length - 1];
    const lastCustomerMsg = lastCustomerMsgObj?.body?.trim() || '';
    const lastMsgLower = lastCustomerMsg.toLowerCase();

    // Build context snippet from customer's latest message
    const msgSnippet = lastCustomerMsg.length > 50 ? `"${lastCustomerMsg.slice(0, 50)}..."` : `"${lastCustomerMsg}"`;

    let options = [];

    // Contextual Category Detection (Strict Multi-Word Matching)
    if (
      lastMsgLower.includes('alamat toko') ||
      lastMsgLower.includes('lokasi toko') ||
      lastMsgLower.includes('lokasi kantor') ||
      lastMsgLower.includes('cabang mana') ||
      lastMsgLower.includes('dimana alamat') ||
      lastMsgLower.includes('dimana lokasi') ||
      (lastMsgLower.includes('alamat') && lastMsgLower.includes('mana'))
    ) {
      options = [
        {
          title: '📍 Info Alamat & Lokasi Toko',
          text: `Halo Kak ${contactName}! 😊 Terkait lokasi toko/cabang kami, alamat resmi kami berlokasi di: Jakarta Pusat (Jl. Sudirman No. 123). Silakan berkunjung ya kak!`,
        },
        {
          title: '🗺️ Panduan Rute & Titik Maps',
          text: `Siap Kak ${contactName}, lokasi toko kami sangat strategis dan mudah dijangkau. Boleh kami kirimkan titik lokasi Google Maps untuk panduan rute Kakak?`,
        },
        {
          title: '🏢 Jam Operasional Toko',
          text: `Halo Kak ${contactName}, toko fisik kami buka setiap hari Senin - Sabtu pukul 09.00 - 20.00 WIB. Ditunggu kedatangannya ya Kak!`,
        },
      ];
    } else if (
      lastMsgLower.includes('stok ready') ||
      lastMsgLower.includes('ready stok') ||
      lastMsgLower.includes('apakah ready') ||
      lastMsgLower.includes('stoknya') ||
      lastMsgLower.includes('ada stok') ||
      lastMsgLower.includes('masih ada stok')
    ) {
      options = [
        {
          title: '📦 Konfirmasi Stok Ready',
          text: `Halo Kak ${contactName}! 😊 Produk tersebut saat ini *READY STOK* dan siap kami kemas hari ini. Boleh diinfokan varian/warna yang Kakak inginkan?`,
        },
        {
          title: '⚡ Pengecekan Gudang Fast-Track',
          text: `Siap Kak ${contactName}, tim gudang kami sedang memverifikasi sisa stok fisiknya. Mohon tunggu sebentar ya Kak!`,
        },
        {
          title: '🛒 Booking & Pemesanan Instan',
          text: `Halo Kak ${contactName}, produk tersebut tergolong cepat habis (*fast-moving*). Sebaiknya kami amankan stoknya untuk Kakak sekarang?`,
        },
      ];
    } else if (
      lastMsgLower.includes('berapa harganya') ||
      lastMsgLower.includes('harganya berapa') ||
      lastMsgLower.includes('daftar harga') ||
      lastMsgLower.includes('pricelist') ||
      lastMsgLower.includes('minta brosur') ||
      lastMsgLower.includes('rincian biaya') ||
      lastMsgLower.includes('biaya paket')
    ) {
      options = [
        {
          title: '🏷️ Info Harga & Brosur Produk',
          text: `Halo Kak ${contactName}! 😊 Terima kasih sudah berminat. Mengenai daftar harga dan rincian paket unggulan kami, boleh infokan kebutuhan mana yang Kakak cari agar kami rekomendasikan yang terbaik?`,
        },
        {
          title: '📦 Solusi Paket & Pricelist',
          text: `Siap Kak ${contactName}, kami memiliki pilihan paket paling hemat dan terjangkau. Boleh kami bantu hitungkan estimasi total biayanya?`,
        },
        {
          title: '💬 Diskon & Penawaran Spesial',
          text: `Halo Kak ${contactName}, untuk pembelian hari ini kami sedang ada penawaran potongan khusus. Boleh diinfokan kuantitas atau tipe yang dibutuhkan Kakak?`,
        },
      ];
    } else if (
      lastMsgLower.includes('nomor resi') ||
      lastMsgLower.includes('status resi') ||
      lastMsgLower.includes('lacak resi') ||
      lastMsgLower.includes('kapan dikirim') ||
      lastMsgLower.includes('sudah dikirim') ||
      lastMsgLower.includes('lacak paket')
    ) {
      options = [
        {
          title: '🚚 Cek Status Resi Pengiriman',
          text: `Halo Kak ${contactName}, terkait pengiriman pesanan Kakak, mohon bantu infokan Nomor Pesanan/Invoice ya Kak. Tim kami siap bantu cek lacak lokasinya sekarang! 📦`,
        },
        {
          title: '⏳ Estimasi Pengiriman Kurir',
          text: `Siap Kak ${contactName}, pesanan Kakak sudah masuk tahap ekspedisi. Boleh infokan nomor resinya agar kami pastikan posisi terbarunya.`,
        },
        {
          title: '📞 Layanan Bantuan Logistik',
          text: `Baik Kak ${contactName}, tim kami terus memantau pengiriman produk Anda. Jika ada keterlambatan dari pihak ekspedisi, kami akan bantu koordinasikan langsung.`,
        },
      ];
    } else if (
      lastMsgLower.includes('nomor rekening') ||
      lastMsgLower.includes('rekening bca') ||
      lastMsgLower.includes('rekening mandiri') ||
      lastMsgLower.includes('transfer ke mana') ||
      lastMsgLower.includes('bukti transfer') ||
      lastMsgLower.includes('konfirmasi bayar')
    ) {
      options = [
        {
          title: '💳 Rincian Rekening Pembayaran Resmi',
          text: `Halo Kak ${contactName}, pembayaran dapat ditransfer melalui rekening resmi kami:\n• BCA: 1234567890 a.n. PT Official WA CRM\n• Mandiri: 0987654321 a.n. PT Official WA CRM\n\nJika sudah transfer, mohon sertakan foto bukti struknya ya Kak! 🙏`,
        },
        {
          title: '✅ Konfirmasi Penerimaan Pembayaran',
          text: `Terima kasih Kak ${contactName}! Bukti pembayaran Kakak sudah kami terima dan saat ini sedang dalam proses verifikasi oleh tim keuangan kami.`,
        },
        {
          title: '⚡ Batas Waktu Pembayaran',
          text: `Baik Kak ${contactName}, mohon selesaikan pembayaran sebelum batas waktu berakhir agar pesanan Kakak dapat segera diproses pengirimannya.`,
        },
      ];
    } else if (
      lastMsgLower.includes('barang rusak') ||
      lastMsgLower.includes('salah kirim') ||
      lastMsgLower.includes('klaim garansi') ||
      lastMsgLower.includes('retur barang') ||
      lastMsgLower.includes('kecewa sekali')
    ) {
      options = [
        {
          title: '🙏 Permohonan Maaf & Penanganan Fast-Track',
          text: `Mohon maaf yang sebesar-besarnya atas ketidaknyamanan ini ya Kak ${contactName}. 🙏 Boleh bantu kirimkan foto/video kendalanya? Tim kami siap membantu memberikan penanganan penggantian secepatnya!`,
        },
        {
          title: '🛠️ Layanan Klaim Garansi & Retur',
          text: `Halo Kak ${contactName}, kepuasan Anda adalah prioritas kami. Semua transaksi dijamin garansi resmi. Kami bantu proses klaim atau penukaran barang baru ya Kak.`,
        },
        {
          title: '📞 Penanganan Khusus Tim Supervisor',
          text: `Baik Kak ${contactName}, laporan kendala ini telah kami eskalasi ke tim penanggung jawab. Kami akan mengabarkan perkembangannya secara berkala.`,
        },
      ];
    } else if (lastCustomerMsg.length > 0) {
      // Dynamic Contextual Responses referencing actual customer's message!
      options = [
        {
          title: '🌟 Balasan Ramah & Kontekstual',
          text: `Halo Kak ${contactName}! 😊 Terkait pesan Kakak mengenai ${msgSnippet}, baik kak, tim Customer Service kami dengan senang hati siap memberikan bantuan. Boleh diinfokan lebih lanjut?`,
        },
        {
          title: '⚡ Balasan Langsung & Solutif',
          text: `Baik Kak ${contactName}, mengenai ${msgSnippet}, pesan Kakak sudah kami terima dan sedang diproses oleh tim kami.`,
        },
        {
          title: '💼 Balasan Formal & Profesional',
          text: `Selamat hari ini Kak ${contactName}. Terima kasih telah menghubungi kami perihal ${msgSnippet}. Tim kami akan menindaklanjuti pesan Anda secepatnya.`,
        },
      ];
    } else {
      options = [
        {
          title: '👋 Salam Ramah & Bantuan CS',
          text: `Halo Kak ${contactName}! 😊 Ada yang bisa tim Customer Service kami bantu hari ini? Silakan infokan pertanyaan atau kendala Kakak ya!`,
        },
        {
          title: '⚡ Tanggapan Cepat CS',
          text: `Baik Kak ${contactName}, tim CS kami siap melayani. Boleh infokan pesan atau kebutuhan Kakak?`,
        },
        {
          title: '💼 Konfirmasi Layanan Resmi',
          text: `Selamat hari ini Kak ${contactName}. Terima kasih telah menghubungi layanan resmi kami. Mohon sampaikan perihal yang ingin ditanyakan.`,
        },
      ];
    }

    return {
      mode: 'SMART_REPLY',
      suggestions: options,
    };
  }
}
