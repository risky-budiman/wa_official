// ===========================================
// Entry Point — Elysia App Bootstrap
// ===========================================

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { env, validateEnv } from './config/env';
import { testConnection } from './config/database';
import { authRoutes } from './modules/auth/auth.routes';
import { conversationRoutes } from './modules/conversations/conversation.routes';
import { messageRoutes } from './modules/messages/message.routes';
import { templateRoutes } from './modules/templates/template.routes';
import { broadcastRoutes } from './modules/broadcast/broadcast.routes';
import { userRoutes } from './modules/users/user.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { settingsRoutes } from './modules/settings/settings.routes';
import { contactRoutes } from './modules/contacts/contact.routes';
import { webhookRoutes } from './modules/webhook/webhook.routes';
import { mediaRoutes } from './modules/media/media.routes';
import { externalRoutes } from './modules/external/external.routes';
import { superAdminRoutes } from './modules/super-admin/super-admin.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { wsPlugin } from './websocket/ws.server';
import './modules/webhook/webhook.processor'; // Initialize BullMQ worker
import { AutoResolveService } from './services/auto-resolve.service';

// Validate environment and initialize database on startup
validateEnv();
await testConnection();

// Start Inactivity Auto-Resolve Background Worker
AutoResolveService.startWorker(60000);

const app = new Elysia()
  // ─── Global Plugins ────────────────────────
  .use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map(s => s.trim()),
      credentials: true,
    })
  )
  .use(wsPlugin)

  // ─── Health Check ──────────────────────────
  .get('/', () => ({
    name: 'WhatsApp CRM API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  }))

  .get('/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
  }))

  // ─── API Routes ────────────────────────────
  .group('/api/v1', (app) =>
    app
      .use(authRoutes)
      .use(conversationRoutes)
      .use(contactRoutes)
      .use(messageRoutes)
      .use(templateRoutes)
      .use(broadcastRoutes)
      .use(userRoutes)
      .use(analyticsRoutes)
      .use(settingsRoutes)
      .use(webhookRoutes)
      .use(mediaRoutes)
      .use(externalRoutes)
      .use(superAdminRoutes)
      .use(billingRoutes)
  )

  // ─── Global Error Handler ──────────────────
  .onError(({ code, error, set }) => {
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        success: false,
        error: 'Endpoint tidak ditemukan (404)',
      };
    }

    if (code === 'VALIDATION') {
      set.status = 422;
      return {
        success: false,
        error: 'Validasi input gagal',
        details: error.message,
      };
    }

    console.error(`[${code}]`, error);

    set.status = 500;
    return {
      success: false,
      error: 'Internal Server Error',
    };
  })

  // ─── Start Server ──────────────────────────
  .listen(env.PORT);

// Test DB connection after server starts
testConnection();

console.log(`
╔════════════════════════════════════════════╗
║     🟢 WhatsApp CRM API Server            ║
║     📍 http://localhost:${env.PORT}             ║
║     🔧 Environment: ${env.NODE_ENV.padEnd(18)}║
╚════════════════════════════════════════════╝
`);

export type App = typeof app;
