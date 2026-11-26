// ===========================================
// Database Schema Auto-Migrator & Sync Helper
// ===========================================

import { db } from '../config/database';
import { sql } from 'drizzle-orm';

const rowsOf = (res: any): any[] => (Array.isArray(res) && Array.isArray(res[0]) ? res[0] : Array.isArray(res) ? res : []);

/**
 * broadcast_campaigns.template_id used to be NOT NULL with a RESTRICT foreign key, so a template
 * that had ever been broadcast could not be deleted ("Failed query: delete from message_templates").
 * Make it nullable + ON DELETE SET NULL and store a template_name snapshot for history.
 */
async function migrateCampaignTemplateLink() {
  const cols = rowsOf(
    await db.execute(sql`
      SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaigns'
        AND COLUMN_NAME IN ('template_id', 'template_name')
    `)
  );
  if (!cols.some((c) => c.COLUMN_NAME === 'template_id')) return; // table not created yet

  if (!cols.some((c) => c.COLUMN_NAME === 'template_name')) {
    await db.execute(sql`ALTER TABLE broadcast_campaigns ADD COLUMN template_name VARCHAR(255) NULL`);
    console.log('🧩 broadcast_campaigns.template_name ditambahkan.');
  }
  await db.execute(sql`
    UPDATE broadcast_campaigns bc JOIN message_templates mt ON mt.id = bc.template_id
    SET bc.template_name = mt.name
    WHERE bc.template_name IS NULL
  `);

  const fks = rowsOf(
    await db.execute(sql`
      SELECT CONSTRAINT_NAME, DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'broadcast_campaigns'
        AND REFERENCED_TABLE_NAME = 'message_templates'
    `)
  );
  const templateIdCol = cols.find((c) => c.COLUMN_NAME === 'template_id');
  const fk = fks[0];
  if (fk && fk.DELETE_RULE === 'SET NULL' && templateIdCol?.IS_NULLABLE === 'YES') return;

  const fkName = fk && /^[A-Za-z0-9_]+$/.test(fk.CONSTRAINT_NAME) ? fk.CONSTRAINT_NAME : 'broadcast_campaigns_template_id_message_templates_id_fk';
  if (fk) await db.execute(sql.raw(`ALTER TABLE broadcast_campaigns DROP FOREIGN KEY \`${fkName}\``));
  await db.execute(sql`ALTER TABLE broadcast_campaigns MODIFY template_id VARCHAR(36) NULL`);
  await db.execute(
    sql.raw(
      `ALTER TABLE broadcast_campaigns ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL`
    )
  );
  console.log('🧩 broadcast_campaigns.template_id kini ON DELETE SET NULL (template bisa dihapus, riwayat broadcast tetap ada).');
}

/**
 * Make an existing foreign key use ON DELETE SET NULL (databases created before the schema said so).
 * Idempotent; the column is made nullable first.
 */
async function ensureFkSetNull(table: string, column: string, refTable: string, columnType: string) {
  const fks = rowsOf(
    await db.execute(sql`
      SELECT rc.CONSTRAINT_NAME AS name, rc.DELETE_RULE AS rule
      FROM information_schema.REFERENTIAL_CONSTRAINTS rc
      JOIN information_schema.KEY_COLUMN_USAGE k
        ON k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND k.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND k.TABLE_NAME = ${table} AND k.COLUMN_NAME = ${column}
        AND k.REFERENCED_TABLE_NAME = ${refTable}
    `)
  );
  const fk = fks[0];
  if (!fk || fk.rule === 'SET NULL' || !/^[A-Za-z0-9_]+$/.test(fk.name)) return;
  await db.execute(sql.raw(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk.name}\``));
  await db.execute(sql.raw(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ${columnType} NULL`));
  await db.execute(
    sql.raw(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${refTable}\`(id) ON DELETE SET NULL`)
  );
  console.log(`🧩 ${table}.${column} kini ON DELETE SET NULL.`);
}

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

    // 2. Hash any API key still stored in plaintext (security hardening, idempotent)
    try {
      const { migratePlaintextApiKeys } = await import('../middleware/api-key-auth');
      const migrated = await migratePlaintextApiKeys();
      if (migrated > 0) console.log(`🔐 ${migrated} API key lama dienkripsi (hash SHA-256).`);
    } catch (err: any) {
      console.warn('⚠️ API key hashing migration notice:', err?.message || err);
    }

    // 4. messages.campaign_id (broadcast delivery / read statistics)
    try {
      const cols = rowsOf(
        await db.execute(sql`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'campaign_id'
        `)
      );
      if (cols.length === 0) {
        await db.execute(sql`ALTER TABLE messages ADD COLUMN campaign_id VARCHAR(36) NULL, ADD INDEX idx_msg_campaign (campaign_id)`);
        console.log('🧩 messages.campaign_id ditambahkan (statistik broadcast).');
      }
    } catch (err: any) {
      console.warn('⚠️ messages.campaign_id migration notice:', err?.message || err);
    }

    // 5. A broadcast is sent by an in-process loop: one still PROCESSING at startup was cut off by a restart
    try {
      const res: any = await db.execute(sql`
        UPDATE broadcast_campaigns
        SET status = IF(sent_count > 0, 'COMPLETED', 'FAILED')
        WHERE status = 'PROCESSING'
      `);
      const affected = Number((Array.isArray(res) ? res[0] : res)?.affectedRows || 0);
      if (affected > 0) console.log(`🧹 ${affected} kampanye broadcast yang terputus oleh restart ditandai selesai.`);
    } catch (err: any) {
      console.warn('⚠️ Broadcast recovery notice:', err?.message || err);
    }

    // 7. organizations.quick_replies (team-wide quick replies; were only in each browser)
    try {
      const cols = rowsOf(
        await db.execute(sql`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'organizations' AND COLUMN_NAME = 'quick_replies'
        `)
      );
      if (cols.length === 0) {
        await db.execute(sql`ALTER TABLE organizations ADD COLUMN quick_replies JSON NULL`);
        console.log('🧩 organizations.quick_replies ditambahkan.');
      }
    } catch (err: any) {
      console.warn('⚠️ organizations.quick_replies migration notice:', err?.message || err);
    }

    // 6. Deleting a user who created a broadcast failed (FK was NO ACTION in older databases)
    try {
      await ensureFkSetNull('broadcast_campaigns', 'created_by_id', 'users', 'VARCHAR(36)');
    } catch (err: any) {
      console.warn('⚠️ broadcast_campaigns.created_by_id migration notice:', err?.message || err);
    }

    // 3. broadcast_campaigns: keep campaign history when a template is deleted
    try {
      await migrateCampaignTemplateLink();
    } catch (err: any) {
      console.warn('⚠️ Broadcast template-link migration notice:', err?.message || err);
    }

    console.log('✅ Database schema auto-migration check complete!');
  } catch (err: any) {
    console.warn('⚠️ Auto-migration check notice:', err?.message || err);
  }
}
