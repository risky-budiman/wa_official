// ===========================================
// Meta WhatsApp Webhook Routes
// ===========================================

import { Elysia } from 'elysia';
import { env } from '../../config/env';
import { pushWebhookJob } from '../../services/queue.service';
import { verifyWebhookSignature } from '../../middleware/webhook-verify';
import { WebhookProcessor } from './webhook.processor';

export const webhookRoutes = new Elysia({ prefix: '/webhook' })
  // ─── GET /webhook — Meta Handshake Verification ──
  .get('/', ({ query, set }) => {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === env.META_WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ Meta Webhook handshake verifikasi berhasil!');
      return challenge;
    }

    set.status = 403;
    return 'Forbidden: Verify token tidak cocok';
  })

  // ─── POST /webhook — Meta Inbound Events Ingestion ──
  // Body is read as RAW text so the X-Hub-Signature-256 HMAC can be verified on the exact bytes Meta sent.
  .post('/', async ({ body, request, set }) => {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    const isValid = await verifyWebhookSignature(rawBody, request.headers.get('x-hub-signature-256') ?? undefined);
    if (!isValid) {
      console.warn('⚠️ Meta Webhook signature tidak valid / tidak ada (cek META_APP_SECRET). Ditolak.');
      set.status = 401;
      return { error: 'Invalid webhook signature' };
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      set.status = 400;
      return { error: 'Invalid JSON payload' };
    }

    try {
      console.log('📩 Webhook POST diterima dari Meta');

      // Process payload exactly once
      await WebhookProcessor.handlePayload(payload);

      set.status = 200;
      return 'EVENT_RECEIVED';
    } catch (err: any) {
      console.error('❌ Webhook processing error:', err.message);
      set.status = 200;
      return 'EVENT_RECEIVED';
    }
  }, { parse: 'text' });
