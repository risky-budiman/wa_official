// ===========================================
// Schema: users (Agen, Supervisor, Admin)
// ===========================================

import { mysqlTable, varchar, datetime, mysqlEnum, boolean, int, uniqueIndex } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { teams } from './teams';

export const userRoleEnum = ['ADMINISTRATOR', 'SUPERVISOR', 'AGENT'] as const;
export const userStatusEnum = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

export type UserRole = (typeof userRoleEnum)[number];
export type UserStatus = (typeof userStatusEnum)[number];

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  teamId: varchar('team_id', { length: 36 })
    .references(() => teams.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: mysqlEnum('role', userRoleEnum).notNull().default('AGENT'),
  status: mysqlEnum('status', userStatusEnum).notNull().default('ACTIVE'),
  isOnline: boolean('is_online').default(false),
  maxActiveChats: int('max_active_chats').default(10),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex('uq_org_email').on(table.organizationId, table.email),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
