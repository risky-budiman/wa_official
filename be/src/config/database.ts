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

    // Auto-migration: Ensure new SaaS columns exist in organizations table
    const orgNewCols = [
      "ALTER TABLE organizations ADD COLUMN status VARCHAR(30) DEFAULT 'ACTIVE' NOT NULL;",
      "ALTER TABLE organizations ADD COLUMN plan VARCHAR(30) DEFAULT 'STARTER' NOT NULL;",
      "ALTER TABLE organizations ADD COLUMN max_agents INT DEFAULT 5;",
      "ALTER TABLE organizations ADD COLUMN max_broadcast_per_month INT DEFAULT 10000;",
      "ALTER TABLE organizations ADD COLUMN expires_at DATETIME NULL;",
      "ALTER TABLE organizations ADD COLUMN owner_name VARCHAR(255) NULL;",
      "ALTER TABLE organizations ADD COLUMN owner_phone VARCHAR(50) NULL;",
      "ALTER TABLE organizations ADD COLUMN owner_email VARCHAR(255) NULL;",
      "ALTER TABLE organizations ADD COLUMN notes TEXT NULL;",
    ];

    for (const sqlQuery of orgNewCols) {
      try {
        await connection.query(sqlQuery);
      } catch (_) {}
    }

    // Auto-migration: Ensure users table supports standalone platform staff (organization_id NULL) and new roles
    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN organization_id VARCHAR(36) NULL;`);
    } catch (_) {}

    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'AGENT';`);
    } catch (_) {}

    try {
      await connection.query(`ALTER TABLE broadcast_campaigns MODIFY COLUMN created_by_id VARCHAR(36) NULL;`);
    } catch (_) {}

    // Auto-detach platform admin accounts from any tenant/organization
    try {
      // Ensure admin@perusahaan.com is set as standalone SUPER_ADMIN
      await connection.query(`
        UPDATE users 
        SET organization_id = NULL, role = 'SUPER_ADMIN' 
        WHERE email = 'admin@perusahaan.com' OR email = 'admin@ids.net.id';
      `);
      // Ensure all other SUPER_ADMIN, ADMIN_FINANCE, ADMIN_SUPPORT have organization_id = NULL
      await connection.query(`
        UPDATE users 
        SET organization_id = NULL 
        WHERE role IN ('SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT');
      `);
    } catch (_) {}

    // Auto-seed default Finance Staff (finance@perusahaan.com) if not exists
    try {
      const [finRows]: any = await connection.query(`SELECT id FROM users WHERE email = 'finance@perusahaan.com' LIMIT 1;`);
      if (!finRows || finRows.length === 0) {
        const { hash } = await import('argon2');
        const defaultHash = await hash('admin12345');
        await connection.query(
          `INSERT INTO users (id, organization_id, team_id, email, password_hash, full_name, role, status, is_online, max_active_chats, created_at, updated_at)
           VALUES ('usr-staff-finance', NULL, NULL, 'finance@perusahaan.com', ?, 'Dewi Sartika (Finance Staff)', 'ADMIN_FINANCE', 'ACTIVE', 0, 0, NOW(), NOW());`,
          [defaultHash]
        );
        console.log('✅ Akun Staf Keuangan Platform Berdiri Sendiri dibuat: finance@perusahaan.com');
      }
    } catch (err: any) {
      console.warn('Finance staff seed notice:', err?.message || err);
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
          INDEX idx_api_keys_org (organization_id)
        ) ENGINE=InnoDB;
      `);
    } catch (err: any) {
      console.warn('api_keys table check notice:', err?.message || err);
    }

    // Auto-create subscription_orders table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS subscription_orders (
          id VARCHAR(36) PRIMARY KEY,
          organization_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NULL,
          order_number VARCHAR(64) NOT NULL UNIQUE,
          plan_code VARCHAR(50) NOT NULL,
          plan_name VARCHAR(100) NOT NULL,
          amount INT NOT NULL DEFAULT 0,
          duration_days INT NOT NULL DEFAULT 30,
          payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
          payment_method VARCHAR(50) NULL,
          snap_token VARCHAR(255) NULL,
          snap_redirect_url TEXT NULL,
          payment_details JSON NULL,
          paid_at DATETIME NULL,
          activated_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_order_org (organization_id, created_at),
          INDEX idx_order_status (payment_status)
        ) ENGINE=InnoDB;
      `);
      // Try add FK if compatible
      try {
        await connection.query(`ALTER TABLE subscription_orders ADD CONSTRAINT fk_orders_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;`);
      } catch (_) {}
      try {
        await connection.query(`ALTER TABLE subscription_orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;`);
      } catch (_) {}
    } catch (err: any) {
      console.warn('subscription_orders table check notice:', err?.message || err);
    }

    // Auto-create platform_settings table if not exists & seed defaults
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS platform_settings (
          \`key\` VARCHAR(100) PRIMARY KEY,
          \`value\` JSON NOT NULL,
          \`description\` VARCHAR(255) NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
        ) ENGINE=InnoDB;
      `);

      const defaultPlans = [
        {
          id: 'plan_trial',
          name: 'Uji Coba (Trial)',
          code: 'TRIAL',
          price: 0,
          period: '14 hari',
          maxAgents: 2,
          maxBroadcastPerMonth: 500,
          description: 'Cocok untuk mencoba seluruh fitur WhatsApp CRM sebelum berlangganan.',
          features: [
            '2 Kursi Agen CS',
            '500 Kuota Broadcast Pesan',
            'Live Chat & Inbox Terpadu',
            'Manajemen Kontak Pelanggan',
            'Template Pesan WhatsApp',
            'Masa Aktif 14 Hari'
          ],
          isActive: true,
        },
        {
          id: 'plan_starter',
          name: 'Starter Bisnis',
          code: 'STARTER',
          price: 199000,
          period: 'bulan',
          maxAgents: 5,
          maxBroadcastPerMonth: 5000,
          description: 'Solusi ideal untuk UMKM dan bisnis berkembang dengan tim kecil.',
          features: [
            '5 Kursi Agen CS',
            '5.000 Kuota Broadcast / Bulan',
            'Live Chat & Auto Assignment',
            'Quick Reply & Tagging Kontak',
            'Monitoring Tim & Laporan SLA',
            'Integrasi Resmi Meta Cloud API'
          ],
          isPopular: true,
          isActive: true,
        },
        {
          id: 'plan_business',
          name: 'Business Pro',
          code: 'BUSINESS',
          price: 499000,
          period: 'bulan',
          maxAgents: 15,
          maxBroadcastPerMonth: 25000,
          description: 'Untuk perusahaan dengan volume chat tinggi dan tim customer support aktif.',
          features: [
            '15 Kursi Agen CS',
            '25.000 Kuota Broadcast / Bulan',
            'Semua Fitur Starter',
            'Supervisor Multi-Agent Monitoring',
            'Akses API Key Developer & Webhook',
            'Prioritas Support WhatsApp 24/7'
          ],
          isActive: true,
        },
        {
          id: 'plan_enterprise',
          name: 'Enterprise Scale',
          code: 'ENTERPRISE',
          price: 999000,
          period: 'bulan',
          maxAgents: 50,
          maxBroadcastPerMonth: 100000,
          description: 'Kapasitas maksimal tanpa kompromi untuk korporasi dan platform skala besar.',
          features: [
            '50 Kursi Agen CS (Bisa Ditambah)',
            '100.000 Kuota Broadcast / Bulan',
            'Semua Fitur Business Pro',
            'Dedicated Account Manager',
            'Custom SLA & Backup Server',
            'Bimbingan Centang Hijau Resmi Meta'
          ],
          isActive: true,
        },
      ];

      const defaultMidtrans = {
        isEnabled: false,
        environment: 'sandbox',
        serverKey: '',
        clientKey: '',
        merchantId: '',
      };

      await connection.query(
        `INSERT IGNORE INTO platform_settings (\`key\`, \`value\`, \`description\`) VALUES (?, ?, ?);`,
        ['saas_plans', JSON.stringify(defaultPlans), 'Daftar Paket & Harga Sewa SaaS']
      );

      await connection.query(
        `INSERT IGNORE INTO platform_settings (\`key\`, \`value\`, \`description\`) VALUES (?, ?, ?);`,
        ['midtrans_payment', JSON.stringify(defaultMidtrans), 'Konfigurasi Channel Pembayaran Midtrans']
      );
    } catch (err: any) {
      console.warn('platform_settings table check notice:', err?.message || err);
    }

    connection.release();
  } catch (error: any) {
    console.warn(`⚠️  MySQL not available (${error.code || error.message}). Server running without DB.`);
    console.warn(`   Pastikan MySQL sudah jalan di ${env.DB_HOST}:${env.DB_PORT}`);
  }
}

export { pool };
