// ===========================================
// Schema: subscription_orders (Billing & Transaksi SaaS)
// ===========================================

import { mysqlTable, varchar, datetime, int, json, uniqueIndex, index, text } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';
import { users } from './users';

export const paymentStatusEnum = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED'] as const;
export type PaymentStatus = (typeof paymentStatusEnum)[number];

export const subscriptionOrders = mysqlTable(
  'subscription_orders',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    organizationId: varchar('organization_id', { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
    orderNumber: varchar('order_number', { length: 64 }).notNull(),
    planCode: varchar('plan_code', { length: 50 }).notNull(),
    planName: varchar('plan_name', { length: 100 }).notNull(),
    amount: int('amount').notNull().default(0),
    durationDays: int('duration_days').notNull().default(30),
    paymentStatus: varchar('payment_status', { length: 30 }).notNull().default('PENDING'),
    paymentMethod: varchar('payment_method', { length: 50 }),
    snapToken: varchar('snap_token', { length: 255 }),
    snapRedirectUrl: text('snap_redirect_url'),
    paymentDetails: json('payment_details').$type<Record<string, unknown>>(),
    paidAt: datetime('paid_at'),
    activatedAt: datetime('activated_at'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    uniqueIndex('uq_order_number').on(table.orderNumber),
    index('idx_order_org').on(table.organizationId, table.createdAt),
    index('idx_order_status').on(table.paymentStatus),
  ]
);

export type SubscriptionOrder = typeof subscriptionOrders.$inferSelect;
export type NewSubscriptionOrder = typeof subscriptionOrders.$inferInsert;
