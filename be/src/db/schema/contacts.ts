// ===========================================
// Schema: contacts (CRM Pelanggan)
// ===========================================

import { mysqlTable, varchar, datetime, json, uniqueIndex, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

export const contacts = mysqlTable('contacts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  waId: varchar('wa_id', { length: 50 }).notNull(), // Format: 628123456789
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  customAttributes: json('custom_attributes').$type<Record<string, unknown>>(),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex('uq_org_wa').on(table.organizationId, table.waId),
  index('idx_contact_wa').on(table.waId),
]);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
