import { hash } from 'argon2';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { users } from '../db/schema';

const email = process.argv[2] || 'admin@ids.net.id';
const newPassword = process.argv[3] || 'Admin123!';

async function resetPassword() {
  console.log(`🔄 Mereset password untuk: ${email}...`);
  const passwordHash = await hash(newPassword);

  const [existingUser] = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
    console.error(`❌ User dengan email "${email}" tidak ditemukan!`);
    process.exit(1);
  }

  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, existingUser.id));

  console.log(`✅ Sukses! Password untuk ${existingUser.fullName} (${existingUser.email}) berhasil diubah menjadi: ${newPassword}`);
  process.exit(0);
}

resetPassword().catch((err) => {
  console.error('❌ Error resetting password:', err);
  process.exit(1);
});
