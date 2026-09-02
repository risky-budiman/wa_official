// ===========================================
// Schema: broadcast_campaigns (Kampanye Broadcast)
// ===========================================

import { mysqlTable, varchar, datetime, mysqlEnum, int } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { users } from './users';
import { messageTemplates } from './message-templates';

export const campaignStatusEnum = ['DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type CampaignStatus = (typeof campaignStatusEnum)[number];

export const broadcastCampaigns = mysqlTable('broadcast_campaigns', {
  id: varchar('id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  createdById: varchar('created_by_id', { length: 36 })
    .references(() => users.id, { onDelete: 'set null' }),
  templateId: varchar('template_id', { length: 36 })
    .notNull()
    .references(() => messageTemplates.id),
  name: varchar('name', { length: 255 }).notNull(),
  status: mysqlEnum('status', campaignStatusEnum).default('DRAFT'),
  totalRecipients: int('total_recipients').default(0),
  sentCount: int('sent_count').default(0),
  deliveredCount: int('delivered_count').default(0),
  readCount: int('read_count').default(0),
  failedCount: int('failed_count').default(0),
  scheduledAt: datetime('scheduled_at'),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type BroadcastCampaign = typeof broadcastCampaigns.$inferSelect;
export type NewBroadcastCampaign = typeof broadcastCampaigns.$inferInsert;
