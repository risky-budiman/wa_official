// ===========================================
// Schema: conversations (Sesi Obrolan)
// ===========================================

import { mysqlTable, varchar, datetime, text, mysqlEnum, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { phoneNumbers } from './phone-numbers';
import { contacts } from './contacts';
import { users } from './users';
import { teams } from './teams';

export const conversationStatusEnum = ['UNASSIGNED', 'OPEN', 'PENDING', 'RESOLVED', 'EXPIRED'] as const;
export type ConversationStatus = (typeof conversationStatusEnum)[number];

export const conversations = mysqlTable('conversations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  phoneNumberId: varchar('phone_number_id', { length: 36 })
    .notNull()
    .references(() => phoneNumbers.id),
  contactId: varchar('contact_id', { length: 36 })
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  assignedUserId: varchar('assigned_user_id', { length: 36 })
    .references(() => users.id, { onDelete: 'set null' }),
  teamId: varchar('team_id', { length: 36 })
    .references(() => teams.id, { onDelete: 'set null' }),
  status: mysqlEnum('status', conversationStatusEnum).notNull().default('UNASSIGNED'),
  windowExpiresAt: datetime('window_expires_at'), // Meta 24-Hour Window
  lastMessagePreview: text('last_message_preview'),
  lastMessageAt: datetime('last_message_at').default(sql`CURRENT_TIMESTAMP`),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('idx_conv_status').on(table.status),
  index('idx_conv_user').on(table.assignedUserId),
  index('idx_conv_last_msg').on(table.lastMessageAt),
]);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
