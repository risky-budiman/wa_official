import { db } from '../config/database';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('🔄 Adding chatbot_config column to organizations table...');
    await db.execute(sql`ALTER TABLE organizations ADD COLUMN chatbot_config JSON NULL;`);
    console.log('✅ Column chatbot_config added successfully!');
  } catch (err: any) {
    if (err.message?.includes('Duplicate column name')) {
      console.log('ℹ️ Column chatbot_config already exists.');
    } else {
      console.error('❌ Error adding column:', err.message);
    }
  }
  process.exit(0);
}

main();
