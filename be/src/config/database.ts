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

    connection.release();
  } catch (error: any) {
    console.warn(`⚠️  MySQL not available (${error.code || error.message}). Server running without DB.`);
    console.warn(`   Pastikan MySQL sudah jalan di ${env.DB_HOST}:${env.DB_PORT}`);
  }
}

export { pool };
