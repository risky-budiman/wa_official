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
  if (!env.META_APP_SECRET) {
    // 🔒 Production: never accept unsigned webhooks (anyone could inject fake messages)
    if (env.NODE_ENV === 'production') {
      console.error('❌ META_APP_SECRET belum diset di .env — webhook Meta DITOLAK (mode production).');
      return false;
    }
    // Development only: allow, but warn loudly
    console.warn('⚠️ META_APP_SECRET kosong — signature webhook TIDAK diverifikasi (hanya diizinkan di development).');
    return true;
  }

  if (!signatureHeader) {
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

  // Constant-time comparison to avoid timing attacks
  const a = encoder.encode(signatureHex);
  const b = encoder.encode(expectedSignature.trim().toLowerCase());
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Elysia plugin that validates X-Hub-Signature-256 on webhook routes
 */
export const webhookVerifyPlugin = new Elysia({ name: 'webhook-verify' })
  // NOTE: not used by /webhook anymore (a local hook never ran for parent routes and the body
  // was already consumed). Signature is verified on the raw body inside webhook.routes.ts.
  .onBeforeHandle(async ({ request, set }) => {
    // Skip verification for GET requests (Meta handshake)
    if (request.method === 'GET') return;

    const signatureHeader = request.headers.get('x-hub-signature-256');
    const rawBody = await request.clone().text();

    const isValid = await verifyWebhookSignature(rawBody, signatureHeader ?? undefined);

    if (!isValid) {
      console.warn('⚠️ Meta Webhook signature validation failed (META_APP_SECRET mismatch). Rejecting.');
      set.status = 401;
      return { error: 'Invalid webhook signature' };
    }
  });
