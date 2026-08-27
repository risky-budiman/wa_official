// ===========================================
// Schema: messages (Riwayat Pesan)
// ===========================================

import { mysqlTable, varchar, datetime, text, mysqlEnum, boolean, json, uniqueIndex, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { conversations } from './conversations';

export const messageDirectionEnum = ['INBOUND', 'OUTBOUND'] as const;
export const messageSenderTypeEnum = ['CONTACT', 'AGENT', 'SUPERVISOR', 'SYSTEM', 'BOT'] as const;
export const messageStatusEnum = ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'] as const;

export type MessageDirection = (typeof messageDirectionEnum)[number];
export type MessageSenderType = (typeof messageSenderTypeEnum)[number];
export type MessageStatus = (typeof messageStatusEnum)[number];

export const messages = mysqlTable('messages', {
  id: varchar('id', { length: 36 }).primaryKey(),
  conversationId: varchar('conversation_id', { length: 36 })
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  wamId: varchar('wam_id', { length: 255 }), // Meta Message ID (wamid.HBgL...)
  direction: mysqlEnum('direction', messageDirectionEnum).notNull(),
  senderType: mysqlEnum('sender_type', messageSenderTypeEnum).notNull(),
  senderId: varchar('sender_id', { length: 36 }), // NULL = contact, users.id = agent/spv
  messageType: varchar('message_type', { length: 50 }).notNull(), // text, image, document, audio, template, interactive
  body: text('body'),
  mediaUrl: text('media_url'),
  mediaMimeType: varchar('media_mime_type', { length: 100 }),
  isInternalNote: boolean('is_internal_note').default(false), // Whispering
  status: mysqlEnum('status', messageStatusEnum).default('SENT'),
  errorDetails: json('error_details').$type<Record<string, unknown>>(),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex('uq_wamid').on(table.wamId),
  index('idx_msg_conv').on(table.conversationId, table.createdAt),
]);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
