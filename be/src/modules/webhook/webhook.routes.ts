// ===========================================
// Meta WhatsApp Webhook Routes
// ===========================================

import { Elysia } from 'elysia';
import { env } from '../../config/env';
import { pushWebhookJob } from '../../services/queue.service';
import { webhookVerifyPlugin } from '../../middleware/webhook-verify';
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
  .use(webhookVerifyPlugin)
  .post('/', async ({ body, set }) => {
    try {
      console.log('📩 Webhook POST diterima dari Meta');

      // Direct execution: guarantees message processing even if Redis queue stalls
      WebhookProcessor.handlePayload(body as any).catch((err) =>
        console.error('❌ Webhook direct processing error:', err.message)
      );

      // Async queue push
      pushWebhookJob(body).catch(() => {});

      set.status = 200;
      return 'EVENT_RECEIVED';
    } catch (err: any) {
      console.error('❌ Webhook route error:', err.message);
      set.status = 200;
      return 'EVENT_RECEIVED';
    }
  });
