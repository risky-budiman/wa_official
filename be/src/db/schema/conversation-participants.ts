// ===========================================
// Schema: Conversation Participants (Multi-Agent Support)
// ===========================================

import { mysqlTable, varchar, timestamp, mysqlEnum } from 'drizzle-orm/mysql-core';
import { conversations } from './conversations';
import { users } from './users';

export const participantRoleEnum = mysqlEnum('participant_role', ['PRIMARY', 'COLLABORATOR']);

export const conversationParticipants = mysqlTable('conversation_participants', {
  id: varchar('id', { length: 36 }).primaryKey(),
  conversationId: varchar('conversation_id', { length: 36 })
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  roleInChat: participantRoleEnum.notNull().default('COLLABORATOR'),
  addedByUserId: varchar('added_by_user_id', { length: 36 }),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type NewConversationParticipant = typeof conversationParticipants.$inferInsert;
