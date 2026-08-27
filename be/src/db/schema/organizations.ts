// ===========================================
// Schema: organizations (Multi-Tenancy)
// ===========================================

import { mysqlTable, varchar, text, datetime } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const organizations = mysqlTable('organizations', {
  id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
  name: varchar('name', { length: 255 }).notNull(),
  wabaId: varchar('waba_id', { length: 100 }),
  appId: varchar('app_id', { length: 100 }),
  accessToken: text('access_token'), // Encrypted System User Token
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
