<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';
  import {
    CreditCard,
    Building2,
    Calendar,
    Clock,
    Users,
    Radio,
    CheckCircle2,
    AlertTriangle,
    Sparkles,
    Send,
    MessageCircle,
    ArrowRight,
    RefreshCw,
    Shield,
    Check,
    Copy,
    Gift,
    Wallet,
    ExternalLink,
    X,
    Receipt,
    RotateCw,
    XCircle,
    QrCode
  } from 'lucide-svelte';

  interface SubscriptionData {
    organizationId: string;
    organizationName: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'EXPIRED';
    plan: string;
    maxAgents: number;
    maxBroadcastPerMonth: number;
    expiresAt: string | null;
    daysRemaining: number | null;
    isExpired: boolean;
    usage: {
      currentUsers: number;
      currentConversations: number;
    };
  }

  interface SaaSPlan {
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
    isPopular?: boolean;
    isPublic?: boolean;
    isActive: boolean;
  }

  interface PaymentGatewayInfo {
    isEnabled: boolean;
    environment?: string;
    clientKey?: string;
  }

  interface SubscriptionOrder {
    id: string;
    orderNumber: string;
    organizationId: string;
    planCode: string;
    planName: string;
    amount: number;
    durationDays: number;
    paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
    paymentMethod: string | null;
    snapToken: string | null;
    snapRedirectUrl: string | null;
    paidAt: string | null;
    activatedAt: string | null;
    createdAt: string;
  }

  let subData = $state<SubscriptionData | null>(null);
  let availablePlans = $state<SaaSPlan[]>([]);
  let paymentGateway = $state<PaymentGatewayInfo>({ isEnabled: false });
  let orders = $state<SubscriptionOrder[]>([]);

  let isLoading = $state(true);
  let ordersLoading = $state(false);
  let isSubmitting = $state(false);
  let checkingOrderId = $state<string | null>(null);
  let feedbackMessage = $state<{ text: string; type: 'success' | 'error' } | null>(null);
  let copiedText = $state<string | null>(null);

  // Checkout Modal State
  let showCheckoutModal = $state(false);
  let selectedPlanForCheckout = $state<SaaSPlan | null>(null);
  let selectedDurationDays = $state<number>(30);
  let checkoutMode = $state<'midtrans' | 'manual'>('midtrans');

  // Manual WhatsApp Fallback Modal State
  let showManualModal = $state(false);
  let generatedWaUrl = $state<string | null>(null);
  let generatedWaText = $state<string | null>(null);

  onMount(async () => {
    await Promise.all([loadSubscription(), loadOrders()]);
    loadMidtransSnapScript();
  });

  async function loadSubscription() {
    isLoading = true;
    try {
      const res = await apiRequest<any>('/settings/subscription');
      if (res && res.success) {
        subData = res.subscription;
        availablePlans = res.availablePlans || [];
        paymentGateway = res.paymentGateway || { isEnabled: false };
      } else {
        feedbackMessage = { text: res?.error || 'Gagal memuat status langganan', type: 'error' };
      }
    } catch (e: any) {
      feedbackMessage = { text: e?.message || 'Terjadi kesalahan sistem', type: 'error' };
    } finally {
      isLoading = false;
    }
  }

  async function loadOrders() {
    ordersLoading = true;
    try {
      const res = await apiRequest<any>('/billing/orders');
      if (res && res.success) {
        orders = res.data || [];
      }
    } catch (_) {
    } finally {
      ordersLoading = false;
    }
  }

  function loadMidtransSnapScript() {
    if (typeof window === 'undefined') return;
    if (document.getElementById('midtrans-snap-js')) return;

    const script = document.createElement('script');
    script.id = 'midtrans-snap-js';
    script.src =
      paymentGateway.environment === 'production'
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';

    if (paymentGateway.clientKey) {
      script.setAttribute('data-client-key', paymentGateway.clientKey);
    }
    document.head.appendChild(script);
  }

  function openCheckout(plan?: SaaSPlan) {
    if (plan) {
      selectedPlanForCheckout = plan;
    } else {
      selectedPlanForCheckout = availablePlans.find((p) => p.code === subData?.plan) || availablePlans[0] || null;
    }

    if (selectedPlanForCheckout?.durationDays) {
      selectedDurationDays = selectedPlanForCheckout.durationDays;
    } else if (selectedPlanForCheckout?.durationType === 'PERMANENT') {
      selectedDurationDays = 0;
    } else {
      selectedDurationDays = 30;
    }

    checkoutMode = paymentGateway.isEnabled ? 'midtrans' : 'manual';
    showCheckoutModal = true;
  }

  async function handleConfirmCheckout(e: Event) {
    e.preventDefault();
    if (!selectedPlanForCheckout) return;

    isSubmitting = true;
    try {
      const res = await apiRequest<any>('/billing/orders', {
        method: 'POST',
        body: JSON.stringify({
          planCode: selectedPlanForCheckout.code,
          durationDays: selectedDurationDays,
        }),
      });

      if (res && res.success) {
        showCheckoutModal = false;
        const order: SubscriptionOrder = res.data.order;
        const snapToken = res.data.snapToken;

        if (order.paymentStatus === 'PAID') {
          feedbackMessage = { text: 'Paket berhasil diaktifkan secara instan!', type: 'success' };
          await Promise.all([loadSubscription(), loadOrders()]);
        } else {
          feedbackMessage = {
            text: `Pesanan ${order.orderNumber} berhasil dibuat! Silakan lakukan pembayaran.`,
            type: 'success',
          };
          await loadOrders();

          // Jika Midtrans Snap Token tersedia dan memilih mode online, buka Snap popup
          if (snapToken && checkoutMode === 'midtrans') {
            payWithSnap(order);
          } else if (checkoutMode === 'manual') {
            openManualWhatsApp(order);
          }
        }
      } else {
        feedbackMessage = { text: res?.error || 'Gagal membuat pesanan', type: 'error' };
      }
    } catch (err: any) {
      feedbackMessage = { text: err?.message || 'Terjadi kesalahan sistem saat membuat order', type: 'error' };
    } finally {
      isSubmitting = false;
    }
  }

  function payWithSnap(order: SubscriptionOrder) {
    if (!order.snapToken && order.snapRedirectUrl) {
      window.open(order.snapRedirectUrl, '_blank');
      return;
    }

    if (typeof window !== 'undefined' && (window as any).snap && order.snapToken) {
      (window as any).snap.pay(order.snapToken, {
        onSuccess: async () => {
          feedbackMessage = { text: 'Pembayaran berhasil! Memverifikasi aktivasi paket...', type: 'success' };
          await Promise.all([loadSubscription(), loadOrders()]);
        },
        onPending: async () => {
          feedbackMessage = { text: 'Transaksi tercatat menunggu pembayaran.', type: 'success' };
          await loadOrders();
        },
        onError: async () => {
          feedbackMessage = { text: 'Pembayaran belum diselesaikan atau dibatalkan.', type: 'error' };
          await loadOrders();
        },
        onClose: async () => {
          await loadOrders();
        },
      });
    } else if (order.snapRedirectUrl) {
      window.open(order.snapRedirectUrl, '_blank');
    }
  }

  async function handleCheckStatus(order: SubscriptionOrder) {
    checkingOrderId = order.id;
    try {
      const res = await apiRequest<any>(`/billing/orders/${order.id}/check-status`);
      if (res && res.success) {
        if (res.data?.activated) {
          feedbackMessage = {
            text: `Pembayaran ${order.orderNumber} LUNAS! Paket organisasi telah aktif otomatis.`,
            type: 'success',
          };
          await Promise.all([loadSubscription(), loadOrders()]);
        } else {
          feedbackMessage = {
            text: `Status order ${order.orderNumber}: ${res.data?.status}`,
            type: 'success',
          };
          await loadOrders();
        }
      } else {
        feedbackMessage = { text: res?.error || 'Gagal memeriksa status pembayaran', type: 'error' };
      }
    } catch (e: any) {
      feedbackMessage = { text: e?.message || 'Terjadi kesalahan saat memeriksa status', type: 'error' };
    } finally {
      checkingOrderId = null;
    }
  }

  async function handleCancelOrder(order: SubscriptionOrder) {
    if (!confirm(`Batalkan pesanan ${order.orderNumber}?`)) return;

    try {
      const res = await apiRequest<any>(`/billing/orders/${order.id}/cancel`, { method: 'POST' });
      if (res && res.success) {
        feedbackMessage = { text: `Pesanan ${order.orderNumber} berhasil dibatalkan.`, type: 'success' };
        await loadOrders();
      } else {
        feedbackMessage = { text: res?.error || 'Gagal membatalkan pesanan', type: 'error' };
      }
    } catch (e: any) {
      feedbackMessage = { text: e?.message || 'Terjadi kesalahan', type: 'error' };
    }
  }

  function openManualWhatsApp(order: SubscriptionOrder) {
    const msg =
      `Halo Super Admin / Finance Platform,\n\n` +
      `Kami telah membuat pesanan langganan WhatsApp CRM:\n` +
      `- No. Invoice: *${order.orderNumber}*\n` +
      `- Organisasi: *${subData?.organizationName}*\n` +
      `- Paket: *${order.planName} (${order.planCode})*\n` +
      `- Durasi: *${order.durationDays === 0 ? 'Permanen' : `${order.durationDays} Hari`}*\n` +
      `- Total Tagihan: *${formatRupiah(order.amount)}*\n\n` +
      `Mohon rekening pembayaran dan konfirmasi aktivasi manual setelah transfer. Terima kasih!`;

    generatedWaText = msg;
    generatedWaUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    showManualModal = true;
  }

  function copyToClipboard(text: string, label: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      copiedText = label;
      setTimeout(() => (copiedText = null), 2500);
    }
  }

  function formatRupiah(amount: number) {
    if (amount === 0) return 'Gratis (Rp 0)';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getPlanBadgeClass(plan: string) {
    const upper = (plan || '').toUpperCase();
    if (upper.includes('ENTERPRISE') || upper.includes('VIP') || upper.includes('PLATINUM')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
    if (upper.includes('BUSINESS') || upper.includes('PRO') || upper.includes('GOLD')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
    if (upper.includes('STARTER') || upper.includes('BASIC') || upper.includes('STANDARD')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (upper.includes('TRIAL') || upper.includes('PROMO') || upper.includes('GRATIS') || upper.includes('FREE')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
  }
</script>

<svelte:head>
  <title>Paket & Pembayaran Langganan — WhatsApp CRM</title>
</svelte:head>

<div class="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
  <!-- Top Title Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div class="space-y-1">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CreditCard class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white">Paket & Pembayaran Langganan CRM</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Monitoring masa aktif akun, pembayaran langsung via Midtrans/QRIS, dan aktivasi paket instan.
          </p>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        onclick={async () => {
          await Promise.all([loadSubscription(), loadOrders()]);
        }}
        disabled={isLoading || ordersLoading}
        class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
      >
        <RefreshCw class="w-4 h-4 {isLoading || ordersLoading ? 'animate-spin' : ''}" />
        <span>Perbarui Status</span>
      </button>

      <button
        onclick={() => openCheckout()}
        class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
      >
        <Sparkles class="w-4 h-4" />
        <span>Pilih & Bayar Paket</span>
      </button>
    </div>
  </div>

  <!-- Feedback Banner -->
  {#if feedbackMessage}
    <div
      class="p-4 rounded-2xl flex items-center gap-3 border text-xs font-semibold shadow-xs animate-in fade-in {feedbackMessage.type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
        : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'}"
    >
      {#if feedbackMessage.type === 'success'}
        <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
      {:else}
        <AlertTriangle class="w-4 h-4 text-rose-500 shrink-0" />
      {/if}
      <span class="flex-1">{feedbackMessage.text}</span>
      <button onclick={() => (feedbackMessage = null)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
        <X class="w-4 h-4" />
      </button>
    </div>
  {/if}

  {#if isLoading}
    <div class="py-20 text-center text-slate-400">
      <RefreshCw class="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
      <p class="text-sm font-semibold">Memuat status langganan organisasi Anda...</p>
    </div>
  {:else if subData}
    <!-- Active Subscription Status Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <!-- Card 1: Active Plan -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span class="text-xs font-bold uppercase tracking-wider">Paket Saat Ini</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border {getPlanBadgeClass(subData.plan)}">
            {subData.plan}
          </span>
        </div>
        <div>
          <div class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>{subData.organizationName}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Status Akun: <strong class="text-emerald-600 dark:text-emerald-400">{subData.status}</strong>
          </p>
        </div>
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
          <Building2 class="w-3.5 h-3.5" />
          <span>ID Organisasi: <span class="font-mono">{subData.organizationId}</span></span>
        </div>
      </div>

      <!-- Card 2: Expiry & Days Remaining -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span class="text-xs font-bold uppercase tracking-wider">Masa Aktif Sewa</span>
          <Clock class="w-4 h-4 text-slate-400" />
        </div>
        <div>
          {#if subData.expiresAt}
            <div class="text-xl font-bold text-slate-900 dark:text-white">
              {new Date(subData.expiresAt).toLocaleDateString('id-ID', { dateStyle: 'full' })}
            </div>
            <div class="mt-1">
              {#if subData.isExpired}
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Masa Sewa Telah Habis
                </span>
              {:else if subData.daysRemaining !== null && subData.daysRemaining <= 7}
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                  Sisa {subData.daysRemaining} Hari Lagi
                </span>
              {:else if subData.daysRemaining !== null}
                <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Aktif (Sisa {subData.daysRemaining} Hari)
                </span>
              {/if}
            </div>
          {:else}
            <div class="text-xl font-bold text-slate-900 dark:text-white">Tanpa Batas Waktu</div>
            <p class="text-xs text-slate-400 mt-1">Paket Unlimited Permanent</p>
          {/if}
        </div>
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
          <Calendar class="w-3.5 h-3.5" />
          <span>Sistem perpanjangan kumulatif otomatis</span>
        </div>
      </div>

      <!-- Card 3: Agent Seat Quota & Usage -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span class="text-xs font-bold uppercase tracking-wider">Kuota Kursi Agen CS</span>
          <Users class="w-4 h-4 text-slate-400" />
        </div>
        <div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-black text-slate-900 dark:text-white">{subData.usage.currentUsers}</span>
            <span class="text-sm font-bold text-slate-400">/ {subData.maxAgents} Akun Agen</span>
          </div>
          <!-- Progress bar -->
          <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2.5 overflow-hidden">
            <div
              class="bg-emerald-500 h-2 rounded-full transition-all"
              style="width: {Math.min(100, Math.round((subData.usage.currentUsers / subData.maxAgents) * 100))}%"
            ></div>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
          <Radio class="w-3.5 h-3.5" />
          <span>Batas Broadcast: {subData.maxBroadcastPerMonth.toLocaleString('id-ID')} pesan/bln</span>
        </div>
      </div>
    </div>

    <!-- Available Plans Section -->
    <div class="space-y-4 pt-2">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Pilihan Paket & Upgrade Fitur</span>
            <span class="text-xs font-normal text-slate-500">({availablePlans.length} Paket Tersedia)</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Pilih paket yang sesuai dengan kebutuhan Anda. Pembayaran langsung terverifikasi secara online.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {#each availablePlans as plan (plan.id)}
          {@const isCurrentPlan = subData.plan === plan.code}
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl border transition relative flex flex-col p-6 shadow-sm {plan.isPopular
              ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800'}"
          >
            {#if plan.isPopular}
              <span class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-md">
                Paling Populer
              </span>
            {/if}

            {#if plan.price === 0}
              <span class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 shadow-md flex items-center gap-1">
                <Gift class="w-3 h-3" />
                Promo / Gratis
              </span>
            {/if}

            <div class="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border {getPlanBadgeClass(plan.code)}">
                {plan.code}
              </span>
              <h3 class="text-lg font-black text-slate-900 dark:text-white">{plan.name}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 min-h-[36px] line-clamp-2">{plan.description || 'Pilihan paket sewa'}</p>
            </div>

            <div class="mb-4">
              <div class="flex items-baseline gap-1">
                <span class="text-2xl font-black text-slate-900 dark:text-white">{formatRupiah(plan.price)}</span>
                <span class="text-xs text-slate-400">/{plan.period}</span>
              </div>
            </div>

            <div class="space-y-2.5 flex-1 mb-6">
              <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                <Users class="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Maksimal {plan.maxAgents} Kursi Agen</span>
              </div>
              <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                <Radio class="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{plan.maxBroadcastPerMonth.toLocaleString('id-ID')} Broadcast/bln</span>
              </div>

              {#each plan.features || [] as feat}
                <div class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              {/each}
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
              {#if plan.price === 0}
                <button
                  onclick={() => openCheckout(plan)}
                  class="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Gift class="w-3.5 h-3.5" />
                  <span>Aktifkan Sekarang (Gratis)</span>
                </button>
              {:else if isCurrentPlan}
                <button
                  onclick={() => openCheckout(plan)}
                  class="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shadow-emerald-600/20"
                >
                  <Sparkles class="w-3.5 h-3.5" />
                  <span>Perpanjang / Bayar Sekarang</span>
                </button>
              {:else}
                <button
                  onclick={() => openCheckout(plan)}
                  class="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Pilih & Bayar Paket</span>
                  <ArrowRight class="w-3.5 h-3.5" />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- RIWAYAT TRANSAKSI & STATUS PESANAN (TENANT)               -->
    <!-- ========================================================= -->
    <div class="space-y-4 pt-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt class="w-5 h-5 text-indigo-500" />
            <span>Riwayat Transaksi & Tagihan Langganan</span>
            <span class="text-xs font-normal text-slate-500">({orders.length} Transaksi)</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Daftar order pesanan paket Anda, bukti pembayaran lunas, dan status tagihan yang masih tertunda.
          </p>
        </div>

        <button
          onclick={loadOrders}
          disabled={ordersLoading}
          class="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
        >
          <RotateCw class="w-3.5 h-3.5 {ordersLoading ? 'animate-spin' : ''}" />
          <span>Refresh Transaksi</span>
        </button>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {#if ordersLoading && orders.length === 0}
          <div class="p-12 text-center space-y-3">
            <div class="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Memuat riwayat transaksi...</p>
          </div>
        {:else if orders.length === 0}
          <div class="p-12 text-center space-y-3">
            <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt class="w-6 h-6" />
            </div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Belum Ada Riwayat Transaksi</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Saat Anda memesan atau memperpanjang paket, riwayat tagihan dan bukti pembayaran akan tercatat di sini.
            </p>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th class="px-5 py-3.5">Nomor Order / Invoice</th>
                  <th class="px-4 py-3.5">Paket & Durasi</th>
                  <th class="px-4 py-3.5">Total Tagihan</th>
                  <th class="px-4 py-3.5">Metode Bayar</th>
                  <th class="px-4 py-3.5">Status Pembayaran</th>
                  <th class="px-4 py-3.5">Tanggal Order</th>
                  <th class="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                {#each orders as ord (ord.id)}
                  <tr class="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition">
                    <td class="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      <div class="flex items-center gap-1.5">
                        <Receipt class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{ord.orderNumber}</span>
                      </div>
                    </td>

                    <td class="px-4 py-3.5">
                      <div class="font-bold text-slate-900 dark:text-white">{ord.planName}</div>
                      <div class="text-[11px] text-slate-500 dark:text-slate-400">
                        {ord.durationDays === 0 ? 'Permanen' : `${ord.durationDays} Hari`}
                      </div>
                    </td>

                    <td class="px-4 py-3.5 font-bold font-mono text-slate-900 dark:text-white">
                      {formatRupiah(ord.amount)}
                    </td>

                    <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 capitalize text-[11px]">
                      {ord.paymentMethod ? ord.paymentMethod.replace(/_/g, ' ') : 'Online / Midtrans'}
                    </td>

                    <td class="px-4 py-3.5">
                      {#if ord.paymentStatus === 'PAID'}
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 class="w-3.5 h-3.5" />
                          <span>LUNAS (Aktif)</span>
                        </span>
                      {:else if ord.paymentStatus === 'PENDING'}
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                          <Clock class="w-3.5 h-3.5" />
                          <span>Menunggu Pembayaran</span>
                        </span>
                      {:else if ord.paymentStatus === 'CANCELLED'}
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                          <span>Dibatalkan</span>
                        </span>
                      {:else}
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <XCircle class="w-3.5 h-3.5" />
                          <span>{ord.paymentStatus}</span>
                        </span>
                      {/if}
                    </td>

                    <td class="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(ord.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>

                    <td class="px-5 py-3.5 text-right">
                      <div class="flex items-center justify-end gap-1.5">
                        {#if ord.paymentStatus === 'PENDING'}
                          {#if ord.snapToken || ord.snapRedirectUrl}
                            <button
                              type="button"
                              onclick={() => payWithSnap(ord)}
                              class="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition cursor-pointer"
                              title="Lanjutkan Pembayaran Online"
                            >
                              <Wallet class="w-3 h-3" />
                              <span>Bayar</span>
                            </button>
                          {/if}

                          <button
                            type="button"
                            onclick={() => handleCheckStatus(ord)}
                            disabled={checkingOrderId === ord.id}
                            class="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition cursor-pointer"
                            title="Cek Status Pembayaran ke Gateway"
                          >
                            <RotateCw class="w-3.5 h-3.5 {checkingOrderId === ord.id ? 'animate-spin' : ''}" />
                          </button>

                          <button
                            type="button"
                            onclick={() => handleCancelOrder(ord)}
                            class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
                            title="Batalkan Pesanan"
                          >
                            <X class="w-3.5 h-3.5" />
                          </button>
                        {:else if ord.paymentStatus === 'PAID'}
                          <span class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check class="w-3.5 h-3.5 stroke-[3]" />
                            <span>Paket Aktif</span>
                          </span>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- ========================================================= -->
<!-- MODAL CHECKOUT & PEMBAYARAN LANGSUNG                      -->
<!-- ========================================================= -->
{#if showCheckoutModal && selectedPlanForCheckout}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => { if (e.target === e.currentTarget) showCheckoutModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Konfirmasi & Pembayaran Paket</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">{subData?.organizationName}</p>
          </div>
        </div>
        <button onclick={() => (showCheckoutModal = false)} class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleConfirmCheckout} class="flex flex-col flex-1 overflow-hidden">
        <div class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]">
          <!-- Summary Box -->
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-500">Paket yang Dipilih</span>
              <span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border {getPlanBadgeClass(selectedPlanForCheckout.code)}">
                {selectedPlanForCheckout.code}
              </span>
            </div>
            <div class="text-lg font-black text-slate-900 dark:text-white">
              {selectedPlanForCheckout.name}
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 text-xs">
              <div>
                <span class="text-slate-400 block text-[11px]">Batas Kursi Agen:</span>
                <strong class="text-slate-800 dark:text-slate-200">{selectedPlanForCheckout.maxAgents} Agen CS</strong>
              </div>
              <div>
                <span class="text-slate-400 block text-[11px]">Batas Broadcast:</span>
                <strong class="text-slate-800 dark:text-slate-200">{selectedPlanForCheckout.maxBroadcastPerMonth.toLocaleString('id-ID')} / bln</strong>
              </div>
            </div>
          </div>

          <!-- Pilihan Durasi -->
          <div>
            <label for="checkout_duration" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Durasi Masa Aktif
            </label>
            <select
              id="checkout_duration"
              bind:value={selectedDurationDays}
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            >
              {#if selectedPlanForCheckout.durationType === 'PERMANENT'}
                <option value={0}>Masa Aktif Permanen (Unlimited)</option>
              {:else}
                <option value={30}>1 Bulan (30 Hari)</option>
                <option value={90}>3 Bulan (90 Hari)</option>
                <option value={180}>6 Bulan (180 Hari)</option>
                <option value={365}>1 Tahun (365 Hari - Hemat)</option>
              {/if}
            </select>
          </div>

          <!-- Total Biaya -->
          <div class="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
            <div>
              <span class="text-xs text-emerald-800 dark:text-emerald-300 font-semibold block">Total Pembayaran:</span>
              <span class="text-xl font-black text-emerald-900 dark:text-emerald-200 font-mono">
                {formatRupiah(selectedPlanForCheckout.price)}
              </span>
            </div>
            <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-500/15 px-2.5 py-1 rounded-lg">
              {selectedPlanForCheckout.price === 0 ? 'Aktivasi Bebas Biaya' : 'Langsung Lunas'}
            </span>
          </div>

          {#if selectedPlanForCheckout.price > 0}
            <!-- Pilihan Metode Pembayaran -->
            <div>
              <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Pilih Jalur Pembayaran
              </span>
              <div class="space-y-2.5">
                {#if paymentGateway.isEnabled}
                  <label class="p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition {checkoutMode === 'midtrans' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'}">
                    <input type="radio" name="pay_mode" value="midtrans" bind:group={checkoutMode} class="mt-1 text-indigo-600" />
                    <div class="flex-1">
                      <div class="text-xs font-bold flex items-center gap-1.5">
                        <Wallet class="w-4 h-4 text-indigo-500" />
                        <span>Pembayaran Online Otomatis (Midtrans)</span>
                        <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">Instan</span>
                      </div>
                      <div class="text-[11px] opacity-75 mt-0.5">
                        Mendukung <strong>QRIS</strong>, Virtual Account (BCA, Mandiri, BRI, BNI), GoPay, ShopeePay, dan Kartu Kredit. Paket langsung aktif seketika setelah Anda bayar.
                      </div>
                    </div>
                  </label>
                {/if}

                <label class="p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition {checkoutMode === 'manual' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'}">
                  <input type="radio" name="pay_mode" value="manual" bind:group={checkoutMode} class="mt-1 text-emerald-600" />
                  <div class="flex-1">
                    <div class="text-xs font-bold flex items-center gap-1.5">
                      <CreditCard class="w-4 h-4 text-emerald-500" />
                      <span>Transfer Bank Manual / Hubungi Staf Admin</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5">
                      Transfer langsung ke rekening bank platform. Order akan tersimpan dan diaktifkan setelah konfirmasi bukti transfer.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          {/if}
        </div>

        <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onclick={() => (showCheckoutModal = false)}
            class="py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>
              {isSubmitting
                ? 'Memproses...'
                : selectedPlanForCheckout.price === 0
                  ? 'Aktifkan Paket Sekarang'
                  : 'Lanjutkan ke Pembayaran'}
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL BUKTI TRANSFER MANUAL & FORMAT WHATSAPP             -->
<!-- ========================================================= -->
{#if showManualModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => { if (e.target === e.currentTarget) showManualModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <MessageCircle class="w-6 h-6" />
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Instruksi Pembayaran Manual</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Kirimkan rincian pesanan ke admin</p>
        </div>
      </div>

      <div class="text-[11px] font-mono bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-line text-slate-700 dark:text-slate-300 max-h-48 overflow-y-auto">
        {generatedWaText}
      </div>

      <div class="space-y-2">
        <button
          type="button"
          onclick={() => copyToClipboard(generatedWaText || '', 'manual_wa')}
          class="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Copy class="w-3.5 h-3.5" />
          <span>{copiedText === 'manual_wa' ? 'Format Pesan Tersalin!' : 'Salin Teks Pesanan'}</span>
        </button>

        {#if generatedWaUrl}
          <a
            href={generatedWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition"
          >
            <MessageCircle class="w-4 h-4" />
            <span>Kirim via WhatsApp ke Admin</span>
          </a>
        {/if}
      </div>

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button
          type="button"
          onclick={() => (showManualModal = false)}
          class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
        >
          Selesai & Tutup
        </button>
      </div>
    </div>
  </div>
{/if}
