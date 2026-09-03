// ===========================================
// Seeder Script: Sample Conversations for Mobile App Testing
// ===========================================

import { db } from '../config/database';
import {
  organizations,
  contacts,
  conversations,
  messages,
  users,
  phoneNumbers
} from './schema';
import { eq } from 'drizzle-orm';

async function seedSampleChats() {
  console.log('🌱 Memulai pembuatan sample percakapan (Antrean, Aktif, & Selesai)...');

  const orgId = 'org-demo-default';
  const phoneId = 'phone-main';

  // 1. Ensure Organization exists
  const [existingOrg] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!existingOrg) {
    console.error('❌ Organization default belum ada. Silakan jalankan `bun run src/db/seed.ts` terlebih dahulu.');
    process.exit(1);
  }

  // 2. Sample Contacts
  const sampleContacts = [
    {
      id: 'contact-budi',
      organizationId: orgId,
      waId: '6281299887766',
      name: 'Budi Santoso',
      email: 'budi.santoso@gmail.com',
      customAttributes: { memberLevel: 'Gold VIP', totalSpend: 2500000 },
    },
    {
      id: 'contact-dewi',
      organizationId: orgId,
      waId: '6285711223344',
      name: 'Dewi Kusuma',
      email: 'dewi.kusuma@yahoo.com',
      customAttributes: { memberLevel: 'Silver', totalSpend: 850000 },
    },
    {
      id: 'contact-hendra',
      organizationId: orgId,
      waId: '6281344556677',
      name: 'Hendra Wijaya',
      email: 'hendra.w@gmail.com',
      customAttributes: { memberLevel: 'Platinum VIP', totalSpend: 12400000 },
    },
    {
      id: 'contact-lani',
      organizationId: orgId,
      waId: '6281800998877',
      name: 'Lani Marlina',
      email: 'lani.m@gmail.com',
      customAttributes: { memberLevel: 'Regular', totalSpend: 150000 },
    },
  ];

  for (const c of sampleContacts) {
    const [existing] = await db.select().from(contacts).where(eq(contacts.id, c.id)).limit(1);
    if (!existing) {
      await db.insert(contacts).values(c);
    }
  }

  const now = new Date();
  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 120 * 60 * 1000);

  // 3. Sample Conversations
  const sampleConversations = [
    // 🟡 1. ANTREAN MASUK (UNASSIGNED) — Budi Santoso
    {
      id: 'conv-queue-budi',
      organizationId: orgId,
      phoneNumberId: phoneId,
      contactId: 'contact-budi',
      assignedUserId: null,
      teamId: null,
      status: 'UNASSIGNED' as const,
      windowExpiresAt: new Date(now.getTime() + 23 * 60 * 60 * 1000),
      lastMessagePreview: 'Halo kak, pesanan saya #INV-88902 belum dikirim ya?',
      lastMessageAt: tenMinsAgo,
    },
    // 🟡 2. ANTREAN MASUK (UNASSIGNED) — Dewi Kusuma
    {
      id: 'conv-queue-dewi',
      organizationId: orgId,
      phoneNumberId: phoneId,
      contactId: 'contact-dewi',
      assignedUserId: null,
      teamId: null,
      status: 'UNASSIGNED' as const,
      windowExpiresAt: new Date(now.getTime() + 21 * 60 * 60 * 1000),
      lastMessagePreview: 'Bisa minta nomor resi pengiriman untuk paket kemarin?',
      lastMessageAt: oneHourAgo,
    },
    // 🟢 3. AKTIF / OPEN (Assigned to Agent) — Hendra Wijaya
    {
      id: 'conv-open-hendra',
      organizationId: orgId,
      phoneNumberId: phoneId,
      contactId: 'contact-hendra',
      assignedUserId: 'usr-agent',
      teamId: 'team-support',
      status: 'OPEN' as const,
      windowExpiresAt: new Date(now.getTime() + 18 * 60 * 60 * 1000),
      lastMessagePreview: 'Baik kak, terima kasih informasinya sangat membantu!',
      lastMessageAt: now,
    },
    // 🟣 4. RESOLVED / SELESAI (Assigned to Agent) — Lani Marlina
    {
      id: 'conv-resolved-lani',
      organizationId: orgId,
      phoneNumberId: phoneId,
      contactId: 'contact-lani',
      assignedUserId: 'usr-agent',
      teamId: 'team-support',
      status: 'RESOLVED' as const,
      windowExpiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
      lastMessagePreview: 'Kendala pembayaran sudah teratasi. Tiket diselesaikan.',
      lastMessageAt: twoHoursAgo,
    },
  ];

  for (const conv of sampleConversations) {
    const [existing] = await db.select().from(conversations).where(eq(conversations.id, conv.id)).limit(1);
    if (!existing) {
      await db.insert(conversations).values(conv);
    } else {
      await db.update(conversations).set(conv).where(eq(conversations.id, conv.id));
    }
  }

  // 4. Sample Messages for each Thread
  const sampleMessages = [
    // Messages for Queue Budi (UNASSIGNED)
    {
      id: 'msg-budi-1',
      conversationId: 'conv-queue-budi',
      direction: 'INBOUND' as const,
      senderType: 'CONTACT' as const,
      senderId: null,
      messageType: 'text',
      body: 'Halo kak, pesanan saya #INV-88902 belum dikirim ya?',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: tenMinsAgo,
    },

    // Messages for Queue Dewi (UNASSIGNED)
    {
      id: 'msg-dewi-1',
      conversationId: 'conv-queue-dewi',
      direction: 'INBOUND' as const,
      senderType: 'CONTACT' as const,
      senderId: null,
      messageType: 'text',
      body: 'Bisa minta nomor resi pengiriman untuk paket kemarin?',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: oneHourAgo,
    },

    // Messages for Active Hendra (OPEN)
    {
      id: 'msg-hendra-1',
      conversationId: 'conv-open-hendra',
      direction: 'INBOUND' as const,
      senderType: 'CONTACT' as const,
      senderId: null,
      messageType: 'text',
      body: 'Selamat siang, saya mau tanya promo diskon 25% masih berlaku?',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: twoHoursAgo,
    },
    {
      id: 'msg-hendra-2',
      conversationId: 'conv-open-hendra',
      direction: 'OUTBOUND' as const,
      senderType: 'BOT' as const,
      senderId: null,
      messageType: 'text',
      body: 'Halo Bpk Hendra! Promo diskon 25% masih berlaku untuk member Platinum VIP menggunakan kode PROMOVIP25.',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: new Date(twoHoursAgo.getTime() + 10000),
    },
    {
      id: 'msg-hendra-3',
      conversationId: 'conv-open-hendra',
      direction: 'OUTBOUND' as const,
      senderType: 'AGENT' as const,
      senderId: 'usr-agent',
      messageType: 'text',
      body: 'Selamat siang Pak Hendra! Saya Andi dari Customer Care. Kode voucher promo bisa langsung dimasukkan saat checkout ya Pak.',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: new Date(twoHoursAgo.getTime() + 60000),
    },
    {
      id: 'msg-hendra-4',
      conversationId: 'conv-open-hendra',
      direction: 'OUTBOUND' as const,
      senderType: 'SUPERVISOR' as const,
      senderId: 'usr-spv',
      messageType: 'text',
      body: 'Catatan Tim: Pelanggan Platinum VIP, berikan prioritas pengiriman ekspres.',
      isInternalNote: true,
      status: 'SENT' as const,
      createdAt: new Date(twoHoursAgo.getTime() + 120000),
    },
    {
      id: 'msg-hendra-5',
      conversationId: 'conv-open-hendra',
      direction: 'INBOUND' as const,
      senderType: 'CONTACT' as const,
      senderId: null,
      messageType: 'text',
      body: 'Baik kak, terima kasih informasinya sangat membantu!',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: now,
    },

    // Messages for Resolved Lani (RESOLVED)
    {
      id: 'msg-lani-1',
      conversationId: 'conv-resolved-lani',
      direction: 'INBOUND' as const,
      senderType: 'CONTACT' as const,
      senderId: null,
      messageType: 'text',
      body: 'Halo kak, tadi pembayaran via QRIS sempat gagal, bagaimana ya?',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: new Date(twoHoursAgo.getTime() - 30 * 60 * 1000),
    },
    {
      id: 'msg-lani-2',
      conversationId: 'conv-resolved-lani',
      direction: 'OUTBOUND' as const,
      senderType: 'AGENT' as const,
      senderId: 'usr-agent',
      messageType: 'text',
      body: 'Halo Kak Lani, sistem pembayaran QRIS sudah kembali normal. Silakan dicoba scan ulang kak.',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: new Date(twoHoursAgo.getTime() - 20 * 60 * 1000),
    },
    {
      id: 'msg-lani-3',
      conversationId: 'conv-resolved-lani',
      direction: 'INBOUND' as const,
      senderType: 'CONTACT' as const,
      senderId: null,
      messageType: 'text',
      body: 'Sudah berhasil kak, terimakasih!',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: new Date(twoHoursAgo.getTime() - 10 * 60 * 1000),
    },
    {
      id: 'msg-lani-4',
      conversationId: 'conv-resolved-lani',
      direction: 'OUTBOUND' as const,
      senderType: 'AGENT' as const,
      senderId: 'usr-agent',
      messageType: 'text',
      body: 'Sama-sama Kak Lani! Tiket percakapan ini saya tandai selesai ya. Selamat berbelanja!',
      isInternalNote: false,
      status: 'READ' as const,
      createdAt: twoHoursAgo,
    },
  ];

  for (const m of sampleMessages) {
    const [existing] = await db.select().from(messages).where(eq(messages.id, m.id)).limit(1);
    if (!existing) {
      await db.insert(messages).values(m);
    } else {
      await db.update(messages).set(m).where(eq(messages.id, m.id));
    }
  }

  console.log('✅ Sample percakapan (Antrean, Aktif, & Selesai) berhasil ditambahkan ke database!');
  process.exit(0);
}

seedSampleChats().catch((err) => {
  console.error('❌ Gagal membuat sample chats:', err);
  process.exit(1);
});
