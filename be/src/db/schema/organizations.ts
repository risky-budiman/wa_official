// ===========================================
// Schema: organizations (Multi-Tenancy)
// ===========================================

import { mysqlTable, varchar, text, datetime, int } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const organizations = mysqlTable('organizations', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
  name: varchar('name', { length: 255 }).notNull(),
  wabaId: varchar('waba_id', { length: 100 }),
  appId: varchar('app_id', { length: 100 }),
  accessToken: text('access_token'), // Encrypted System User Token
  maxChatsPerAgent: int('max_chats_per_agent').default(5), // Workload Capacity per Agent
  autoResolveHours: int('auto_resolve_hours').default(3), // Auto-Resolve Inactivity Threshold in Hours
  careWindowHours: int('care_window_hours').default(24), // Customer Care Window in Hours
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
