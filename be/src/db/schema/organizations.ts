// ===========================================
// Schema: organizations (Multi-Tenancy)
// ===========================================

import { mysqlTable, varchar, text, datetime, int, json } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export interface OperatingHoursConfig {
  enabled: boolean;
  timezone: string; // 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura'
  days: number[]; // [1, 2, 3, 4, 5] (1=Monday ... 7=Sunday)
  startTime: string; // '08:00'
  endTime: string; // '17:00'
}

export interface AiAgentConfig {
  enabled: boolean;
  mode: 'AI_ASSISTANT' | 'STATIC_MESSAGE';
  provider: 'gemini' | 'openai';
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  staticMessage?: string;
}

export const orgStatusEnum = ['ACTIVE', 'SUSPENDED', 'TRIAL', 'EXPIRED'] as const;

export type OrgStatus = (typeof orgStatusEnum)[number];
export type OrgPlan = string;

export const organizations = mysqlTable('organizations', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 30 }).default('ACTIVE').notNull(), // 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'EXPIRED'
  plan: varchar('plan', { length: 100 }).default('STARTER').notNull(), // Bebas / custom string nama paket
  maxAgents: int('max_agents').default(5), // Agent seat limit
  maxBroadcastPerMonth: int('max_broadcast_per_month').default(10000), // Monthly broadcast quota
  expiresAt: datetime('expires_at'), // Subscription expiry date
  ownerName: varchar('owner_name', { length: 255 }), // PIC Name
  ownerPhone: varchar('owner_phone', { length: 50 }), // PIC WhatsApp Phone
  ownerEmail: varchar('owner_email', { length: 255 }), // PIC Email
  notes: text('notes'), // Internal admin notes / billing info
  wabaId: varchar('waba_id', { length: 100 }),
  appId: varchar('app_id', { length: 100 }),
  accessToken: text('access_token'), // Encrypted System User Token
  maxChatsPerAgent: int('max_chats_per_agent').default(5), // Workload Capacity per Agent
  autoResolveHours: int('auto_resolve_hours').default(3), // Auto-Resolve Inactivity Threshold in Hours
  careWindowHours: int('care_window_hours').default(24), // Customer Care Window in Hours
  operatingHours: json('operating_hours').$type<OperatingHoursConfig>(),
  aiAgentConfig: json('ai_agent_config').$type<AiAgentConfig>(),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
