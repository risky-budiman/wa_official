// ===========================================
// Schema: platform_settings (Global SaaS Config & Midtrans)
// ===========================================

import { mysqlTable, varchar, text, datetime, json } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export interface SaaSPlanConfig {
  id: string;
  name: string;
  code: string; // Bebas / custom, e.g. "PROMO_14_HARI", "STARTER", "GOLD_UMKM"
  price: number; // in IDR
  period: string; // e.g. "bulan", "14 hari", "selamanya"
  durationType?: 'PERMANENT' | 'MONTHLY' | 'DAYS'; // Mode masa berlaku paket
  durationDays?: number; // Jumlah hari sewa default (0 jika PERMANENT)
  maxAgents: number;
  maxBroadcastPerMonth: number;
  description: string;
  features: string[];
  isPopular?: boolean;
  isPublic?: boolean; // true: Tampil di tenant, false: Khusus/Spesial Administrator
  isActive: boolean;
}

export interface MidtransConfig {
  isEnabled: boolean;
  environment: 'sandbox' | 'production';
  serverKey: string;
  clientKey: string;
  merchantId?: string;
}

export const platformSettings = mysqlTable('platform_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: json('value').notNull(),
  description: varchar('description', { length: 255 }),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
