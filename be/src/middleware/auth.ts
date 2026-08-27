// ===========================================
// Auth Middleware — JWT Verification & User Context
// ===========================================

import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';
import type { UserRole } from '../db/schema/users';

/** JWT payload shape after verification */
export interface JwtPayload {
  id: string;
  orgId: string;
  role: UserRole;
  email: string;
}

/**
 * Auth plugin — verifies JWT from Authorization header
 * and injects `user` into the request context via `.derive()`
 */
export const authPlugin = new Elysia({ name: 'auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
    })
  )
  .derive({ as: 'scoped' }, async ({ jwt, headers }) => {
    const authHeader = headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null };
    }

    const token = authHeader.substring(7);

    try {
      const payload = await jwt.verify(token);

      if (!payload || typeof payload !== 'object') {
        return { user: null };
      }

      return {
        user: payload as unknown as JwtPayload,
      };
    } catch {
      return { user: null };
    }
  });
