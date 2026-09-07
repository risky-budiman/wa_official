// ===========================================
// Schema: super_admins (SaaS Platform Admins)
// ===========================================

import { mysqlTable, varchar, datetime, mysqlEnum, boolean } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const superAdminRoleEnum = [
  'SUPER_ADMIN',
  'CO_SUPER_ADMIN',
  'ADMIN_FINANCE',
  'ADMIN_SUPPORT',
] as const;

export const superAdminStatusEnum = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

export type SuperAdminRole = (typeof superAdminRoleEnum)[number];
export type SuperAdminStatus = (typeof superAdminStatusEnum)[number];

export const superAdmins = mysqlTable('super_admins', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: mysqlEnum('role', superAdminRoleEnum).notNull().default('SUPER_ADMIN'),
  status: mysqlEnum('status', superAdminStatusEnum).notNull().default('ACTIVE'),
  isPrimaryAdmin: boolean('is_primary_admin').default(false),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export type SuperAdmin = typeof superAdmins.$inferSelect;
export type NewSuperAdmin = typeof superAdmins.$inferInsert;
