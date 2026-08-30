// ===========================================
// MySQL Database Connection (Drizzle + mysql2)
// ===========================================

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { env } from './env';
import * as schema from '../db/schema';

// Create MySQL connection pool
const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  timezone: 'Z',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Create Drizzle ORM instance with schema
export const db = drizzle(pool, {
  schema,
  mode: 'default',
});

/**
 * Test database connection at startup
 */
export async function testConnection(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ MySQL connected → ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
    
    // Auto-migration: Ensure new JSON columns exist in organizations table
    try {
      await connection.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS operating_hours JSON NULL;`);
    } catch (_) {
      try { await connection.query(`ALTER TABLE organizations ADD COLUMN operating_hours JSON NULL;`); } catch (_) {}
    }

    try {
      await connection.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ai_agent_config JSON NULL;`);
    } catch (_) {
      try { await connection.query(`ALTER TABLE organizations ADD COLUMN ai_agent_config JSON NULL;`); } catch (_) {}
    }

    // Auto-create api_keys table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id VARCHAR(36) PRIMARY KEY,
          organization_id VARCHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          \`key\` VARCHAR(128) NOT NULL UNIQUE,
          key_prefix VARCHAR(24) NOT NULL,
          permissions JSON NOT NULL,
          last_used_at DATETIME NULL,
          expires_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (err: any) {
      console.warn('api_keys table check notice:', err?.message || err);
    }

    connection.release();
  } catch (error: any) {
    console.warn(`⚠️  MySQL not available (${error.code || error.message}). Server running without DB.`);
    console.warn(`   Pastikan MySQL sudah jalan di ${env.DB_HOST}:${env.DB_PORT}`);
  }
}

export { pool };
