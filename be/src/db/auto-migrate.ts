// ===========================================
// Database Schema Auto-Migrator & Sync Helper
// ===========================================

import { db } from '../config/database';
import { sql } from 'drizzle-orm';

export async function autoMigrateSchema(): Promise<void> {
  try {
    console.log('🔄 Checking & Auto-Syncing database schema migrations...');

    // 1. Ensure chatbot_config JSON column exists in organizations table
    await db.execute(sql`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS chatbot_config JSON NULL;
    `).catch(async () => {
      // Fallback for MySQL versions where IF NOT EXISTS syntax for ADD COLUMN is not enabled
      try {
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN chatbot_config JSON NULL;`);
      } catch (_) {}
    });

    console.log('✅ Database schema auto-migration check complete!');
  } catch (err: any) {
    console.warn('⚠️ Auto-migration check notice:', err?.message || err);
  }
}
