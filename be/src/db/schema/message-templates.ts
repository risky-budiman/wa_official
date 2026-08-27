// ===========================================
// Schema: message_templates (Template WA)
// ===========================================

import { mysqlTable, varchar, datetime, mysqlEnum, json } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

export const templateCategoryEnum = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;
export const templateStatusEnum = ['APPROVED', 'REJECTED', 'PENDING', 'PAUSED'] as const;

export type TemplateCategory = (typeof templateCategoryEnum)[number];
export type TemplateStatus = (typeof templateStatusEnum)[number];

export const messageTemplates = mysqlTable('message_templates', {
  id: varchar('id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  metaTemplateId: varchar('meta_template_id', { length: 100 }),
  name: varchar('name', { length: 255 }).notNull(),
  category: mysqlEnum('category', templateCategoryEnum).notNull(),
  language: varchar('language', { length: 20 }).notNull(), // 'id', 'en_US'
  status: mysqlEnum('status', templateStatusEnum).default('PENDING'),
  components: json('components').notNull().$type<Record<string, unknown>[]>(),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
