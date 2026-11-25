// ===========================================
// CLI: Reset password akun (Super Admin / staf platform / user tenant)
// Pemakaian:
//   bun run src/scripts/reset-password.ts <email> <password-baru>
// ===========================================

import { hash } from 'argon2';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { users, superAdmins } from '../db/schema';

const email = (process.argv[2] || '').trim().toLowerCase();
const newPassword = process.argv[3] || '';

async function resetPassword() {
  if (!email || !newPassword) {
    console.error('❌ Pemakaian: bun run src/scripts/reset-password.ts <email> <password-baru>');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('❌ Password baru minimal 8 karakter.');
    process.exit(1);
  }
  if (newPassword === 'admin12345') {
    console.error('❌ Jangan memakai password default "admin12345".');
    process.exit(1);
  }

  console.log(`🔄 Mereset password untuk: ${email}...`);
  const passwordHash = await hash(newPassword);
  let updated = 0;

  // 1. Platform staff (portal /administrator)
  const [platformUser] = await db
    .select({ id: superAdmins.id, fullName: superAdmins.fullName })
    .from(superAdmins)
    .where(eq(superAdmins.email, email))
    .limit(1);
  if (platformUser) {
    await db.update(superAdmins).set({ passwordHash }).where(eq(superAdmins.id, platformUser.id));
    console.log(`✅ Password staf platform "${platformUser.fullName}" berhasil diubah.`);
    updated++;
  }

  // 2. Tenant user (also covers legacy platform admins that still exist in `users`)
  const [tenantUser] = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (tenantUser) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, tenantUser.id));
    console.log(`✅ Password user "${tenantUser.fullName}" berhasil diubah.`);
    updated++;
  }

  if (updated === 0) {
    console.error(`❌ Akun dengan email "${email}" tidak ditemukan.`);
    process.exit(1);
  }

  process.exit(0);
}

resetPassword().catch((err) => {
  console.error('❌ Gagal mereset password:', err?.message || err);
  process.exit(1);
});
