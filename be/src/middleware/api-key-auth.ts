// ===========================================
// Middleware: API Key Authentication for Developers
// ===========================================

import { Elysia } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/database';
import { apiKeys } from '../db/schema';

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
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.key, token))
        .limit(1);

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
