// ===========================================
// Schema: api_keys (External Developer API Keys)
// ===========================================

import { mysqlTable, varchar, datetime, json } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

export const apiKeys = mysqlTable('api_keys', {
  id: varchar('id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 128 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 24 }).notNull(),
  permissions: json('permissions').notNull().$type<string[]>(),
  lastUsedAt: datetime('last_used_at'),
  expiresAt: datetime('expires_at'),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
