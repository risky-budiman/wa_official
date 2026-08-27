// ===========================================
// Schema: activity_logs (Audit Trail & SLA)
// ===========================================

import { mysqlTable, varchar, datetime, json, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { users } from './users';

export const activityLogs = mysqlTable('activity_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 })
    .references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), // ASSIGN_CHAT, RESOLVE_CHAT, SEND_TEMPLATE, ROLE_CHANGE
  details: json('details').$type<Record<string, unknown>>(),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('idx_audit_org').on(table.organizationId, table.createdAt),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
