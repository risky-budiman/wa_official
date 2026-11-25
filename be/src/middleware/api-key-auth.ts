// ===========================================
// Middleware: API Key Authentication for Developers
// ===========================================

import { Elysia } from 'elysia';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../config/database';
import { apiKeys } from '../db/schema';

const HASH_PREFIX = 'sha256:';

/**
 * API keys are stored as a SHA-256 hash (never in plaintext), so a database leak
 * does not expose usable keys. Keys are long random strings, so a fast hash is sufficient.
 */
export function hashApiKey(rawKey: string): string {
  return HASH_PREFIX + createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

/** One-time migration: hash every API key that is still stored in plaintext. */
export async function migratePlaintextApiKeys(): Promise<number> {
  const legacy = await db
    .select({ id: apiKeys.id, key: apiKeys.key })
    .from(apiKeys)
    .where(sql`${apiKeys.key} NOT LIKE 'sha256:%'`);

  for (const row of legacy) {
    await db.update(apiKeys).set({ key: hashApiKey(row.key) }).where(eq(apiKeys.id, row.id));
  }
  return legacy.length;
}

export interface ApiKeyContext {
  apiKeyId: string;
  orgId: string;
  keyName: string;
  permissions: string[];
}

export const apiKeyAuthPlugin = new Elysia({ name: 'api-key-auth' })
  .derive({ as: 'scoped' }, async ({ headers }): Promise<{ externalApp: ApiKeyContext | null }> => {
    // 1. Extract API Key from X-API-Key header or Authorization: Bearer
    const xApiKey = headers['x-api-key'] || headers['X-API-Key'];
    const authHeader = headers['authorization'] || headers['Authorization'];

    let token = xApiKey;
    if (!token && authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token || !token.startsWith('wacrm_live_')) {
      return { externalApp: null };
    }

    try {
      const hashed = hashApiKey(token);
      let [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.key, hashed))
        .limit(1);

      // Legacy fallback: key created before hashing was introduced → upgrade it in place
      if (!keyRecord) {
        [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.key, token)).limit(1);
        if (keyRecord) {
          await db.update(apiKeys).set({ key: hashed }).where(eq(apiKeys.id, keyRecord.id)).catch(() => {});
        }
      }

      if (!keyRecord) {
        return { externalApp: null };
      }

      // Check expiration if set
      if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
        return { externalApp: null };
      }

      // Update lastUsedAt in background without blocking
      db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, keyRecord.id))
        .catch(() => {});

      return {
        externalApp: {
          apiKeyId: keyRecord.id,
          orgId: keyRecord.organizationId,
          keyName: keyRecord.name,
          permissions: keyRecord.permissions || [],
        },
      };
    } catch (err) {
      console.error('Error validating API Key:', err);
      return { externalApp: null };
    }
  });
