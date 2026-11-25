// ===========================================
// Auth Middleware — JWT Verification & User Context
// ===========================================

import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { db } from '../config/database';
import { users } from '../db/schema/users';
import { superAdmins } from '../db/schema/super-admins';
import type { UserRole } from '../db/schema/users';

/** JWT payload shape after verification */
export interface JwtPayload {
  id: string;
  orgId: string;
  role: UserRole;
  email: string;
}

/**
 * Shared JWT configuration. Every token signed through this config
 * automatically gets an `exp` claim (JWT_EXPIRES_IN, default 7d).
 */
export const jwtConfig = {
  name: 'jwt' as const,
  secret: env.JWT_SECRET,
  exp: env.JWT_EXPIRES_IN || '7d',
};

// ─── Account status cache (avoid a DB hit on every request) ─────────
type AccountInfo = { active: boolean; role: UserRole; orgId: string; email: string } | null;
const ACCOUNT_CACHE_TTL_MS = 30_000;
const accountCache = new Map<string, { value: AccountInfo; expiresAt: number }>();

/** Clear cached account state (call after changing a user's role/status). */
export function invalidateAccountCache(userId?: string) {
  if (userId) accountCache.delete(userId);
  else accountCache.clear();
}

async function loadAccount(userId: string): Promise<AccountInfo> {
  const cached = accountCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: AccountInfo = null;

  const [tenantUser] = await db
    .select({ role: users.role, status: users.status, organizationId: users.organizationId, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // 🔒 Legacy platform-staff rows in `users` are not valid logins anymore
  // (platform staff authenticate against `super_admins`). Fall through to super_admins lookup.
  const isLegacyPlatformRow =
    !!tenantUser && ['SUPER_ADMIN', 'CO_SUPER_ADMIN', 'ADMIN_FINANCE', 'ADMIN_SUPPORT'].includes(tenantUser.role as string);

  if (tenantUser && !isLegacyPlatformRow) {
    value = {
      active: tenantUser.status === 'ACTIVE',
      role: tenantUser.role,
      orgId: tenantUser.organizationId || '',
      email: tenantUser.email,
    };
  } else if (!tenantUser || isLegacyPlatformRow) {
    const [platformUser] = await db
      .select({ role: superAdmins.role, status: superAdmins.status, email: superAdmins.email })
      .from(superAdmins)
      .where(eq(superAdmins.id, userId))
      .limit(1);

    if (platformUser) {
      value = {
        active: platformUser.status === 'ACTIVE',
        role: platformUser.role as UserRole,
        orgId: '',
        email: platformUser.email,
      };
    }
  }

  accountCache.set(userId, { value, expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS });
  return value;
}

/**
 * Verify a raw JWT and resolve the current (DB-fresh) user.
 * Returns null when the token is invalid/expired or the account is gone / not ACTIVE.
 */
export async function resolveUserFromToken(
  verify: (token: string) => Promise<any>,
  token: string
): Promise<JwtPayload | null> {
  let payload: any;
  try {
    payload = await verify(token);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object' || !payload.id) return null;

  try {
    const account = await loadAccount(String(payload.id));
    if (!account || !account.active) return null;

    // Role & organization always come from the database, not from the (possibly stale) token
    return {
      id: String(payload.id),
      orgId: account.orgId,
      role: account.role,
      email: account.email,
    };
  } catch (err: any) {
    // Database temporarily unavailable → fall back to the (signature-verified, non-expired) token
    // so users are not logged out because of a short DB hiccup.
    console.warn('⚠️ Auth: gagal memeriksa status akun di database, memakai data token.', err?.message || err);
    return payload as JwtPayload;
  }
}

/**
 * Auth plugin — verifies JWT from Authorization header
 * and injects `user` into the request context via `.derive()`
 */
export const authPlugin = new Elysia({ name: 'auth' })
  .use(jwt(jwtConfig))
  .derive({ as: 'scoped' }, async ({ jwt, headers }) => {
    const authHeader = headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null as JwtPayload | null };
    }

    const token = authHeader.substring(7);
    const user = await resolveUserFromToken((t) => jwt.verify(t), token);
    return { user };
  });
