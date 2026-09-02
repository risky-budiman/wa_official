// ===========================================
// Service: BillingService
// Pemesanan Paket SaaS, Integrasi Midtrans, & Aktivasi Otomatis
// ===========================================

import { db } from '../../config/database';
import { organizations, users, platformSettings, subscriptionOrders, SubscriptionOrder } from '../../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

interface MidtransConfig {
  isEnabled: boolean;
  environment: 'sandbox' | 'production';
  serverKey: string;
  clientKey: string;
  merchantId?: string;
}

interface SaaSPlanConfig {
  id: string;
  name: string;
  code: string;
  price: number;
  period: string;
  durationType?: 'PERMANENT' | 'MONTHLY' | 'DAYS';
  durationDays?: number;
  maxAgents: number;
  maxBroadcastPerMonth: number;
  description: string;
  features: string[];
  isActive?: boolean;
}

export class BillingService {
  /**
   * Ambil Konfigurasi Midtrans dari database platform_settings
   */
  static async getMidtransConfig(): Promise<MidtransConfig> {
    const [setting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'midtrans_payment'))
      .limit(1);

    const val = (setting?.value as any) || {};
    return {
      isEnabled: Boolean(val.isEnabled),
      environment: val.environment === 'production' ? 'production' : 'sandbox',
      serverKey: val.serverKey || '',
      clientKey: val.clientKey || '',
      merchantId: val.merchantId || '',
    };
  }

  /**
   * Ambil Daftar Paket SaaS aktif dari platform_settings
   */
  static async getActivePlans(): Promise<SaaSPlanConfig[]> {
    const [setting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'saas_plans'))
      .limit(1);

    const plans = (setting?.value as SaaSPlanConfig[]) || [];
    return plans.filter((p) => p.isActive !== false);
  }

  /**
   * Buat Pesanan / Order Baru (Tenant Order)
   */
  static async createOrder(
    orgId: string,
    userId: string,
    planCode: string,
    customDurationDays?: number
  ): Promise<{ order: SubscriptionOrder; snapToken: string | null; snapRedirectUrl: string | null }> {
    // 1. Validasi Organisasi
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) {
      throw new Error('Organisasi penyewa tidak ditemukan.');
    }

    // 2. Ambil User Pemesan
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    // 3. Ambil Detail Paket
    const plans = await this.getActivePlans();
    const plan = plans.find((p) => p.code.toUpperCase() === planCode.toUpperCase());
    if (!plan) {
      throw new Error(`Paket dengan kode "${planCode}" tidak ditemukan atau sedang nonaktif.`);
    }

    // Tentukan durasi hari
    let durationDays = 30;
    if (customDurationDays && customDurationDays > 0) {
      durationDays = customDurationDays;
    } else if (plan.durationDays && plan.durationDays > 0) {
      durationDays = plan.durationDays;
    } else if (plan.durationType === 'PERMANENT') {
      durationDays = 0; // 0 = permanent
    }

    // Generate Order Number: INV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `INV-${dateStr}-${nanoid(6).toUpperCase()}`;
    const orderId = nanoid();
    const amount = Number(plan.price) || 0;

    let snapToken: string | null = null;
    let snapRedirectUrl: string | null = null;

    // 4. Jika berbayar & Midtrans aktif, request Snap Token
    const midtrans = await this.getMidtransConfig();
    if (amount > 0 && midtrans.isEnabled && midtrans.serverKey) {
      const snapApiUrl =
        midtrans.environment === 'production'
          ? 'https://app.midtrans.com/snap/v1/transactions'
          : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

      try {
        const authHeader = 'Basic ' + Buffer.from(midtrans.serverKey + ':').toString('base64');
        const snapPayload = {
          transaction_details: {
            order_id: orderNumber,
            gross_amount: amount,
          },
          item_details: [
            {
              id: plan.code,
              price: amount,
              quantity: 1,
              name: `Paket ${plan.name}`.slice(0, 50),
            },
          ],
          customer_details: {
            first_name: user?.fullName || org.name,
            email: user?.email || org.ownerEmail || 'tenant@perusahaan.com',
            phone: org.ownerPhone || '08123456789',
          },
        };

        const res = await fetch(snapApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify(snapPayload),
        });

        if (res.ok) {
          const snapData: any = await res.json();
          snapToken = snapData.token || null;
          snapRedirectUrl = snapData.redirect_url || null;
        } else {
          const errText = await res.text();
          console.warn('Midtrans Snap request failed:', errText);
        }
      } catch (e: any) {
        console.warn('Midtrans request error:', e?.message || e);
      }
    }

    // 5. Simpan Order ke Database
    await db.insert(subscriptionOrders).values({
      id: orderId,
      organizationId: org.id,
      userId: user?.id || null,
      orderNumber,
      planCode: plan.code,
      planName: plan.name,
      amount,
      durationDays,
      paymentStatus: amount === 0 ? 'PAID' : 'PENDING',
      paymentMethod: amount === 0 ? 'FREE_TRIAL' : snapToken ? 'midtrans' : 'manual_transfer',
      snapToken,
      snapRedirectUrl,
      paidAt: amount === 0 ? new Date() : null,
      activatedAt: amount === 0 ? new Date() : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [savedOrder] = await db
      .select()
      .from(subscriptionOrders)
      .where(eq(subscriptionOrders.id, orderId))
      .limit(1);

    // 6. Jika Paket Gratis / Trial (amount = 0), langsung aktifkan paket
    if (amount === 0) {
      await this.activateSubscription(savedOrder);
    }

    return {
      order: savedOrder,
      snapToken,
      snapRedirectUrl,
    };
  }

  /**
   * Aktivasi Paket Langganan untuk Organisasi
   */
  static async activateSubscription(order: SubscriptionOrder): Promise<void> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, order.organizationId))
      .limit(1);

    if (!org) {
      throw new Error(`Organisasi ${order.organizationId} tidak ditemukan.`);
    }

    const plans = await this.getActivePlans();
    const plan = plans.find((p) => p.code.toUpperCase() === order.planCode.toUpperCase());

    const maxAgents = plan?.maxAgents || org.maxAgents || 5;
    const maxBroadcastPerMonth = plan?.maxBroadcastPerMonth || org.maxBroadcastPerMonth || 10000;

    let newExpiresAt: Date | null = null;

    if (order.durationDays === 0 || plan?.durationType === 'PERMANENT') {
      newExpiresAt = null; // Permanen / Unlimited
    } else {
      const now = new Date();
      // Jika organisasi saat ini masih aktif dan belum expired, tambahkan secara kumulatif
      if (org.expiresAt && new Date(org.expiresAt) > now) {
        newExpiresAt = new Date(new Date(org.expiresAt).getTime() + order.durationDays * 24 * 60 * 60 * 1000);
      } else {
        newExpiresAt = new Date(now.getTime() + order.durationDays * 24 * 60 * 60 * 1000);
      }
    }

    // Update Organisasi
    await db
      .update(organizations)
      .set({
        plan: order.planCode,
        status: 'ACTIVE',
        expiresAt: newExpiresAt,
        maxAgents,
        maxBroadcastPerMonth,
      })
      .where(eq(organizations.id, org.id));

    // Update Order Status
    await db
      .update(subscriptionOrders)
      .set({
        paymentStatus: 'PAID',
        paidAt: order.paidAt || new Date(),
        activatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionOrders.id, order.id));

    console.log(
      `🎉 [BILLING] Organisasi "${org.name}" (${org.id}) berhasil diaktifkan dengan paket "${order.planCode}" hingga ${newExpiresAt ? newExpiresAt.toISOString() : 'PERMANEN'}.`
    );
  }

  /**
   * Handle Webhook Notifikasi dari Midtrans
   */
  static async handleMidtransWebhook(payload: any): Promise<{ success: boolean; message: string }> {
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, payment_type } =
      payload || {};

    if (!order_id) {
      return { success: false, message: 'Payload tidak memiliki order_id' };
    }

    // 1. Verifikasi Signature Key Midtrans
    const midtrans = await this.getMidtransConfig();
    if (midtrans.serverKey && signature_key) {
      const stringToHash = `${order_id}${status_code}${gross_amount}${midtrans.serverKey}`;
      const calculatedSignature = createHash('sha512').update(stringToHash).digest('hex');

      if (calculatedSignature !== signature_key) {
        console.warn('⚠️ [MIDTRANS WEBHOOK] Signature Key Mismatch! Ditolak demi keamanan.');
        return { success: false, message: 'Invalid signature key' };
      }
    }

    // 2. Cari Order di database
    const [order] = await db
      .select()
      .from(subscriptionOrders)
      .where(eq(subscriptionOrders.orderNumber, order_id))
      .limit(1);

    if (!order) {
      console.warn(`[MIDTRANS WEBHOOK] Order number "${order_id}" tidak ditemukan di database.`);
      return { success: false, message: 'Order not found' };
    }

    // Jika sudah PAID, tidak perlu diproses ulang
    if (order.paymentStatus === 'PAID') {
      return { success: true, message: 'Order sudah berstatus PAID sebelumnya.' };
    }

    // 3. Proses Status Transaksi
    if (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept')) {
      // Pembayaran Berhasil (Lunas)
      await db
        .update(subscriptionOrders)
        .set({
          paymentStatus: 'PAID',
          paymentMethod: payment_type || order.paymentMethod,
          paymentDetails: payload,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptionOrders.id, order.id));

      const [updatedOrder] = await db
        .select()
        .from(subscriptionOrders)
        .where(eq(subscriptionOrders.id, order.id))
        .limit(1);

      await this.activateSubscription(updatedOrder);

      return { success: true, message: 'Pembayaran sukses diverifikasi & paket berhasil diaktifkan.' };
    } else if (transaction_status === 'expire') {
      await db
        .update(subscriptionOrders)
        .set({
          paymentStatus: 'EXPIRED',
          paymentDetails: payload,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionOrders.id, order.id));

      return { success: true, message: 'Status transaksi: Kadaluarsa (EXPIRED).' };
    } else if (transaction_status === 'cancel' || transaction_status === 'deny') {
      await db
        .update(subscriptionOrders)
        .set({
          paymentStatus: 'FAILED',
          paymentDetails: payload,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionOrders.id, order.id));

      return { success: true, message: 'Status transaksi: Gagal / Dibatalkan.' };
    } else if (transaction_status === 'pending') {
      await db
        .update(subscriptionOrders)
        .set({
          paymentMethod: payment_type || order.paymentMethod,
          paymentDetails: payload,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionOrders.id, order.id));

      return { success: true, message: 'Transaksi sedang menunggu pembayaran (PENDING).' };
    }

    return { success: true, message: `Status transaksi: ${transaction_status}` };
  }

  /**
   * Cek Status Transaksi On-Demand langsung ke Midtrans API
   * (Berguna jika webhook belum sampai atau pengujian lokal sandbox)
   */
  static async checkMidtransStatus(orderId: string): Promise<{ success: boolean; status: string; activated: boolean }> {
    const [order] = await db
      .select()
      .from(subscriptionOrders)
      .where(eq(subscriptionOrders.id, orderId))
      .limit(1);

    if (!order) {
      throw new Error('Transaksi order tidak ditemukan.');
    }

    if (order.paymentStatus === 'PAID') {
      return { success: true, status: 'PAID', activated: true };
    }

    const midtrans = await this.getMidtransConfig();
    if (!midtrans.serverKey) {
      return { success: false, status: order.paymentStatus, activated: false };
    }

    const statusUrl =
      midtrans.environment === 'production'
        ? `https://api.midtrans.com/v2/${order.orderNumber}/status`
        : `https://api.sandbox.midtrans.com/v2/${order.orderNumber}/status`;

    const authHeader = 'Basic ' + Buffer.from(midtrans.serverKey + ':').toString('base64');
    const res = await fetch(statusUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
      },
    });

    if (!res.ok) {
      return { success: false, status: order.paymentStatus, activated: false };
    }

    const data: any = await res.json();
    const txStatus = data.transaction_status;
    const fraudStatus = data.fraud_status;

    if (txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept')) {
      await db
        .update(subscriptionOrders)
        .set({
          paymentStatus: 'PAID',
          paymentMethod: data.payment_type || order.paymentMethod,
          paymentDetails: data,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptionOrders.id, order.id));

      const [updatedOrder] = await db
        .select()
        .from(subscriptionOrders)
        .where(eq(subscriptionOrders.id, order.id))
        .limit(1);

      await this.activateSubscription(updatedOrder);
      return { success: true, status: 'PAID', activated: true };
    } else if (txStatus === 'expire') {
      await db
        .update(subscriptionOrders)
        .set({ paymentStatus: 'EXPIRED', paymentDetails: data, updatedAt: new Date() })
        .where(eq(subscriptionOrders.id, order.id));
      return { success: true, status: 'EXPIRED', activated: false };
    }

    return { success: true, status: order.paymentStatus, activated: false };
  }

  /**
   * Konfirmasi Manual Pembayaran oleh Super Admin atau Staf Finance
   */
  static async confirmManualPayment(orderId: string, adminEmail: string): Promise<SubscriptionOrder> {
    const [order] = await db
      .select()
      .from(subscriptionOrders)
      .where(eq(subscriptionOrders.id, orderId))
      .limit(1);

    if (!order) {
      throw new Error('Transaksi order tidak ditemukan.');
    }

    if (order.paymentStatus === 'PAID') {
      throw new Error('Transaksi ini sudah berstatus LUNAS (PAID).');
    }

    // Update order menjadi PAID
    await db
      .update(subscriptionOrders)
      .set({
        paymentStatus: 'PAID',
        paymentMethod: order.paymentMethod || 'manual_transfer',
        paymentDetails: {
          manualApproval: true,
          approvedBy: adminEmail,
          approvedAt: new Date().toISOString(),
        },
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionOrders.id, order.id));

    const [updatedOrder] = await db
      .select()
      .from(subscriptionOrders)
      .where(eq(subscriptionOrders.id, order.id))
      .limit(1);

    // Otomatis aktifkan paket organisasi klien
    await this.activateSubscription(updatedOrder);

    return updatedOrder;
  }

  /**
   * Batalkan Pesanan
   */
  static async cancelOrder(orderId: string, orgId?: string): Promise<void> {
    const conditions = [eq(subscriptionOrders.id, orderId)];
    if (orgId) {
      conditions.push(eq(subscriptionOrders.organizationId, orgId));
    }

    const [order] = await db
      .select()
      .from(subscriptionOrders)
      .where(and(...conditions))
      .limit(1);

    if (!order) {
      throw new Error('Order tidak ditemukan.');
    }

    if (order.paymentStatus === 'PAID') {
      throw new Error('Order yang sudah dibayar tidak dapat dibatalkan.');
    }

    await db
      .update(subscriptionOrders)
      .set({
        paymentStatus: 'CANCELLED',
        updatedAt: new Date(),
      })
      .where(eq(subscriptionOrders.id, order.id));
  }

  /**
   * Daftar Riwayat Transaksi untuk Tenant yang Sedang Login
   */
  static async listOrdersByOrg(orgId: string): Promise<SubscriptionOrder[]> {
    return await db
      .select()
      .from(subscriptionOrders)
      .where(eq(subscriptionOrders.organizationId, orgId))
      .orderBy(desc(subscriptionOrders.createdAt))
      .limit(100);
  }

  /**
   * Daftar Seluruh Transaksi Platform (Untuk Super Admin & Finance Staff)
   */
  static async listAllOrders(statusFilter?: string): Promise<any[]> {
    const conditions = [];
    if (statusFilter && statusFilter !== 'ALL') {
      conditions.push(eq(subscriptionOrders.paymentStatus, statusFilter));
    }

    const query = db
      .select({
        id: subscriptionOrders.id,
        orderNumber: subscriptionOrders.orderNumber,
        organizationId: subscriptionOrders.organizationId,
        organizationName: organizations.name,
        userId: subscriptionOrders.userId,
        userName: users.fullName,
        userEmail: users.email,
        planCode: subscriptionOrders.planCode,
        planName: subscriptionOrders.planName,
        amount: subscriptionOrders.amount,
        durationDays: subscriptionOrders.durationDays,
        paymentStatus: subscriptionOrders.paymentStatus,
        paymentMethod: subscriptionOrders.paymentMethod,
        snapToken: subscriptionOrders.snapToken,
        snapRedirectUrl: subscriptionOrders.snapRedirectUrl,
        paidAt: subscriptionOrders.paidAt,
        activatedAt: subscriptionOrders.activatedAt,
        createdAt: subscriptionOrders.createdAt,
      })
      .from(subscriptionOrders)
      .leftJoin(organizations, eq(subscriptionOrders.organizationId, organizations.id))
      .leftJoin(users, eq(subscriptionOrders.userId, users.id));

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(subscriptionOrders.createdAt)).limit(200);
    }

    return await query.orderBy(desc(subscriptionOrders.createdAt)).limit(200);
  }
}
