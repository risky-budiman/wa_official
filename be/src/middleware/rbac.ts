// ===========================================
// RBAC Middleware — Role-Based Access Control Guard
// ===========================================

import { Elysia } from 'elysia';
import type { UserRole } from '../db/schema/users';
import type { JwtPayload } from './auth';

/**
 * RBAC plugin — provides `requireRoles()` macro
 * Usage: `.guard({ requireRoles: ['ADMINISTRATOR', 'SUPERVISOR'] })`
 */
export const rbacPlugin = new Elysia({ name: 'rbac' })
  .macro(({ onBeforeHandle }) => ({
    /**
     * Guard route to specific roles
     * If user is not authenticated → 401
     * If user role is not in allowed list → 403
     */
    requireRoles(roles: UserRole[]) {
      onBeforeHandle(({ user, set }: { user: JwtPayload | null; set: any }) => {
        if (!user) {
          set.status = 401;
          return {
            success: false,
            error: 'Unauthorized: Harap login terlebih dahulu',
          };
        }

        if (!roles.includes(user.role)) {
          set.status = 403;
          return {
            success: false,
            error: `Forbidden: Hak akses ${user.role} tidak mencukupi. Diperlukan: ${roles.join(' / ')}`,
          };
        }
      });
    },
  }));
