// ===========================================
// Database Seeder — Default Demo Accounts
// ===========================================

import { nanoid } from 'nanoid';
import { hash } from 'argon2';
import { db } from '../config/database';
import {
  organizations,
  teams,
  users,
  phoneNumbers,
  contacts,
  conversations,
  messageTemplates,
  broadcastCampaigns
} from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Memulai seeding akun default...');

  const orgId = 'org-demo-default';
  const teamId1 = 'team-sales';
  const teamId2 = 'team-support';

  // 1. Create Demo Organization
  const [existingOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!existingOrg) {
    await db.insert(organizations).values({
      id: orgId,
      name: 'PT WhatsApp CRM Indonesia',
      wabaId: '109823471092834',
      appId: '102938475610293',
    });
    console.log('✅ Organisasi default dibuat: PT WhatsApp CRM Indonesia');
  }

  // 2. Create Teams
  const [existingTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId1))
    .limit(1);

  if (!existingTeam) {
    await db.insert(teams).values([
      { id: teamId1, organizationId: orgId, name: 'Sales & Marketing' },
      { id: teamId2, organizationId: orgId, name: 'Customer Care' },
    ]);
    console.log('✅ Tim default dibuat (Sales & Customer Care)');
  }

  // 3. Seed Users for 3 RBAC Roles
  const passwordHash = await hash('admin12345');

  const defaultUsers = [
    // Standalone Platform Administrator & Staff (organizationId = null)
    {
      id: 'usr-admin',
      organizationId: null,
      teamId: null,
      email: 'admin@perusahaan.com',
      passwordHash,
      fullName: 'Budi (Master Super Administrator)',
      role: 'SUPER_ADMIN' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'usr-staff-finance',
      organizationId: null,
      teamId: null,
      email: 'finance@perusahaan.com',
      passwordHash,
      fullName: 'Dewi Sartika (Finance Staff)',
      role: 'ADMIN_FINANCE' as const,
      status: 'ACTIVE' as const,
    },
    // Tenant Demo Users (tied to orgId)
    {
      id: 'usr-spv',
      organizationId: orgId,
      teamId: teamId1,
      email: 'spv@perusahaan.com',
      passwordHash,
      fullName: 'Rina (Supervisor)',
      role: 'SUPERVISOR' as const,
      status: 'ACTIVE' as const,
    },
    {
      id: 'usr-agent',
      organizationId: orgId,
      teamId: teamId2,
      email: 'agent@perusahaan.com',
      passwordHash,
      fullName: 'Andi (Customer Agent)',
      role: 'AGENT' as const,
      status: 'ACTIVE' as const,
    },
  ];

  for (const u of defaultUsers) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, u.email))
      .limit(1);

    if (!existing) {
      await db.insert(users).values(u);
      console.log(`✅ Akun default dibuat: [${u.role}] ${u.email}`);
    }
  }

  // 4. Seed Channel Phone Number
  const phoneId = 'phone-main';
  const [existingPhone] = await db
    .select()
    .from(phoneNumbers)
    .where(eq(phoneNumbers.id, phoneId))
    .limit(1);

  if (!existingPhone) {
    await db.insert(phoneNumbers).values({
      id: phoneId,
      organizationId: orgId,
      phoneNumberId: '102938475610293',
      displayPhoneNumber: '+62 812-3456-7890',
      verifiedName: 'PT WhatsApp CRM Indonesia',
      qualityRating: 'GREEN',
      status: 'CONNECTED',
    });
    console.log('✅ Channel nomor WA dibuat (+62 812-3456-7890)');
  }

  // 5. Seed Contacts & Conversations
  const contact1Id = 'contact-rian';
  const contact2Id = 'contact-siti';
  const [existingC1] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contact1Id))
    .limit(1);

  if (!existingC1) {
    await db.insert(contacts).values([
      {
        id: contact1Id,
        organizationId: orgId,
        waId: '6281234567890',
        name: 'Rian Pratama',
        email: 'rian@gmail.com',
        customAttributes: { memberLevel: 'Gold VIP', totalSpend: 3450000 },
      },
      {
        id: contact2Id,
        organizationId: orgId,
        waId: '6285712345678',
        name: 'Siti Aminah',
        email: 'siti@gmail.com',
        customAttributes: { memberLevel: 'Silver', totalSpend: 850000 },
      },
    ]);

    // Conversation 1: Assigned to Agent (usr-agent)
    await db.insert(conversations).values({
      id: 'conv-agent-1',
      organizationId: orgId,
      phoneNumberId: phoneId,
      contactId: contact1Id,
      assignedUserId: 'usr-agent',
      teamId: teamId2,
      status: 'OPEN',
      windowExpiresAt: new Date(Date.now() + 22 * 60 * 60 * 1000),
      lastMessagePreview: 'Apakah produk varian hitam masih tersedia stoknya?',
      lastMessageAt: new Date(),
    });

    // Conversation 2: Assigned to Supervisor (usr-spv)
    await db.insert(conversations).values({
      id: 'conv-spv-1',
      organizationId: orgId,
      phoneNumberId: phoneId,
      contactId: contact2Id,
      assignedUserId: 'usr-spv',
      teamId: teamId1,
      status: 'OPEN',
      windowExpiresAt: new Date(Date.now() + 14 * 60 * 60 * 1000),
      lastMessagePreview: 'Baik, bukti transfer sudah saya kirim ya',
      lastMessageAt: new Date(),
    });

    console.log('✅ Kontak & Percakapan contoh berhasil dibuat');
  }

  // 6. Seed Message Templates
  const template1Id = 'tpl-konfirmasi';
  const template2Id = 'tpl-promo';
  const [existingTpl] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.id, template1Id))
    .limit(1);

  if (!existingTpl) {
    await db.insert(messageTemplates).values([
      {
        id: template1Id,
        organizationId: orgId,
        metaTemplateId: 'meta_tpl_101',
        name: 'konfirmasi_pembayaran_v1',
        category: 'UTILITY',
        language: 'id',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: 'Halo {{1}}, pembayaran pesanan #{{2}} telah kami terima sebesar Rp {{3}}.',
          },
        ],
      },
      {
        id: template2Id,
        organizationId: orgId,
        metaTemplateId: 'meta_tpl_102',
        name: 'promo_gajian_agustus',
        category: 'MARKETING',
        language: 'id',
        status: 'APPROVED',
        components: [
          {
            type: 'BODY',
            text: 'Spesial hari ini! Dapatkan diskon 25% untuk layanan kami dengan kode {{1}}.',
          },
        ],
      },
    ]);

    // 7. Seed Broadcast Campaign
    await db.insert(broadcastCampaigns).values({
      id: 'bc-promo-1',
      organizationId: orgId,
      createdById: 'usr-admin',
      templateId: template2Id,
      name: 'Promo Akhir Bulan - VIP Member',
      status: 'COMPLETED',
      totalRecipients: 1500,
      sentCount: 1500,
      deliveredCount: 1482,
      readCount: 1290,
      failedCount: 0,
      createdAt: new Date(),
    });

    console.log('✅ Template WA & Kampanye Broadcast contoh berhasil dibuat');
  }

  console.log(`
🎉 Seeding selesai! Berikut akun yang dapat langsung digunakan untuk login:

┌───────────────┬──────────────────────┬────────────┐
│ Role          │ Email                │ Password   │
├───────────────┼──────────────────────┼────────────┤
│ ADMINISTRATOR │ admin@perusahaan.com │ admin12345 │
│ SUPERVISOR    │ spv@perusahaan.com   │ admin12345 │
│ AGENT         │ agent@perusahaan.com │ admin12345 │
└───────────────┴──────────────────────┴────────────┘
`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Gagal menjalankan seeder:', err);
  process.exit(1);
});
