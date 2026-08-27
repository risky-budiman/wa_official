// ===========================================
// Webhook Verification Middleware — HMAC SHA-256
// ===========================================

import { Elysia } from 'elysia';
import { env } from '../config/env';

/**
 * Verify Meta webhook signature (X-Hub-Signature-256)
 * Prevents fake webhook injection attacks
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined
): Promise<boolean> {
  if (!signatureHeader || !env.META_APP_SECRET) {
    return false;
  }

  const expectedSignature = signatureHeader.replace('sha256=', '');

  // Use Web Crypto API (available in Bun)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.META_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatureHex === expectedSignature;
}

/**
 * Elysia plugin that validates X-Hub-Signature-256 on webhook routes
 */
export const webhookVerifyPlugin = new Elysia({ name: 'webhook-verify' })
  .onBeforeHandle(async ({ request, set }) => {
    // Skip verification for GET requests (Meta handshake)
    if (request.method === 'GET') return;

    const signatureHeader = request.headers.get('x-hub-signature-256');
    const rawBody = await request.clone().text();

    const isValid = await verifyWebhookSignature(rawBody, signatureHeader ?? undefined);

    if (!isValid) {
      set.status = 401;
      return { error: 'Invalid webhook signature' };
    }
  });
