// ===========================================
// Routes: Billing & Subscription Orders
// ===========================================

import { Elysia, t } from 'elysia';
import { authPlugin } from '../../middleware/auth';
import { BillingService } from './billing.service';

export const billingRoutes = new Elysia({ prefix: '/billing' })
  // ─── PUBLIC ENDPOINT: Midtrans Webhook Callback ───
  .post(
    '/midtrans-webhook',
    async ({ body, set }) => {
      try {
        const result = await BillingService.handleMidtransWebhook(body);
        return result;
      } catch (err: any) {
        console.error('Midtrans Webhook Error:', err?.message || err);
        set.status = 500;
        return { success: false, error: err?.message || 'Webhook processing failed' };
      }
    }
  )

  // ─── AUTHENTICATED TENANT BILLING ENDPOINTS ───
  .use(authPlugin)

  // GET /billing/orders — Ambil riwayat order transaksi tenant
  .get('/orders', async ({ user, set }) => {
    if (!user || !user.orgId) {
      set.status = 400;
      return { success: false, error: 'User tidak terikat dengan organisasi' };
    }

    try {
      const orders = await BillingService.listOrdersByOrg(user.orgId);
      return { success: true, data: orders };
    } catch (err: any) {
      set.status = 500;
      return { success: false, error: err?.message || 'Gagal mengambil riwayat transaksi' };
    }
  })

  // POST /billing/orders — Buat order transaksi baru
  .post(
    '/orders',
    async ({ user, body, set }) => {
      if (!user || !user.orgId) {
        set.status = 400;
        return { success: false, error: 'User tidak terikat dengan organisasi' };
      }

      try {
        const result = await BillingService.createOrder(
          user.orgId,
          user.id,
          body.planCode,
          body.durationDays
        );
        return {
          success: true,
          message:
            result.order.paymentStatus === 'PAID'
              ? 'Paket berhasil diaktifkan seketika!'
              : 'Pesanan berhasil dibuat. Silakan lanjutkan pembayaran.',
          data: result,
        };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err?.message || 'Gagal membuat pesanan' };
      }
    },
    {
      body: t.Object({
        planCode: t.String(),
        durationDays: t.Optional(t.Number()),
      }),
    }
  )

  // GET /billing/orders/:id/check-status — Cek status pembayaran ke Midtrans
  .get('/orders/:id/check-status', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    try {
      const result = await BillingService.checkMidtransStatus(params.id);
      return { success: true, data: result };
    } catch (err: any) {
      set.status = 400;
      return { success: false, error: err?.message || 'Gagal memeriksa status pembayaran' };
    }
  })

  // POST /billing/orders/:id/cancel — Batalkan pesanan pending
  .post('/orders/:id/cancel', async ({ user, params, set }) => {
    if (!user || !user.orgId) {
      set.status = 400;
      return { success: false, error: 'User tidak terikat dengan organisasi' };
    }

    try {
      await BillingService.cancelOrder(params.id, user.orgId);
      return { success: true, message: 'Pesanan berhasil dibatalkan' };
    } catch (err: any) {
      set.status = 400;
      return { success: false, error: err?.message || 'Gagal membatalkan pesanan' };
    }
  });
