// ===========================================
// Schema: phone_numbers (WhatsApp Channel)
// ===========================================

import { mysqlTable, varchar, datetime, uniqueIndex } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

export const phoneNumbers = mysqlTable('phone_numbers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  phoneNumberId: varchar('phone_number_id', { length: 100 }).notNull(),
  displayPhoneNumber: varchar('display_phone_number', { length: 50 }).notNull(),
  verifiedName: varchar('verified_name', { length: 255 }),
  qualityRating: varchar('quality_rating', { length: 50 }).default('UNKNOWN'),
  status: varchar('status', { length: 50 }).default('CONNECTED'),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex('uq_phone_id').on(table.phoneNumberId),
]);

export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type NewPhoneNumber = typeof phoneNumbers.$inferInsert;
