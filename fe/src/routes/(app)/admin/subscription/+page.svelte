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
    Wallet
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
  }

  let subData = $state<SubscriptionData | null>(null);
  let availablePlans = $state<SaaSPlan[]>([]);
  let paymentGateway = $state<PaymentGatewayInfo>({ isEnabled: false });

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let feedbackMessage = $state<{ text: string; type: 'success' | 'error' } | null>(null);
  let copiedText = $state<string | null>(null);

  // Renewal Modal state
  let showRenewModal = $state(false);
  let selectedPlanToRenew = $state<SaaSPlan | null>(null);
  let selectedDuration = $state('1 Bulan (30 Hari)');
  let generatedWaUrl = $state<string | null>(null);
  let generatedWaText = $state<string | null>(null);

  onMount(async () => {
    await loadSubscription();
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

  function openRenewModal(plan?: SaaSPlan) {
    if (plan) {
      selectedPlanToRenew = plan;
    } else {
      selectedPlanToRenew = availablePlans.find((p) => p.code === subData?.plan) || availablePlans[0] || null;
    }
    selectedDuration = '1 Bulan (30 Hari)';
    generatedWaUrl = null;
    generatedWaText = null;
    showRenewModal = true;
  }

  async function handleRequestRenew(e: Event) {
    e.preventDefault();
    isSubmitting = true;

    const res = await apiRequest<any>('/settings/subscription/renew-request', {
      method: 'POST',
      body: JSON.stringify({
        planName: selectedPlanToRenew ? `${selectedPlanToRenew.name} (${selectedPlanToRenew.code})` : subData?.plan,
        duration: selectedDuration,
      }),
    });
    isSubmitting = false;

    if (res.success) {
      generatedWaUrl = res.whatsappUrl;
      generatedWaText = res.waMessage;
      feedbackMessage = { text: 'Permohonan berhasil disiapkan! Silakan kirimkan pesan ke WhatsApp Super Admin.', type: 'success' };
    } else {
      feedbackMessage = { text: res.error || 'Gagal membuat permohonan', type: 'error' };
    }
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
  <title>Paket & Langganan Sewa — WhatsApp CRM</title>
</svelte:head>

<div class="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
  <!-- Top Title Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div class="space-y-1">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CreditCard class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white">Paket & Masa Langganan Sewa CRM</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Monitoring masa aktif akun, kuota kursi agen CS, dan ajukan perpanjangan atau upgrade paket sewa ke Super Admin.
          </p>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        onclick={loadSubscription}
        disabled={isLoading}
        class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
      >
        <RefreshCw class="w-4 h-4 {isLoading ? 'animate-spin' : ''}" />
        <span>Perbarui Status</span>
      </button>

      <button
        onclick={() => openRenewModal()}
        class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
      >
        <Sparkles class="w-4 h-4" />
        <span>Perpanjang / Upgrade Paket</span>
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
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Status Akun: <strong class="text-emerald-600 dark:text-emerald-400">{subData.status}</strong></p>
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
          <span>Pengingat otomatis H-7 sebelum jatuh tempo</span>
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
    <div class="space-y-4 pt-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Pilihan Paket & Upgrade Fitur</span>
            <span class="text-xs font-normal text-slate-500">({availablePlans.length} Paket Tersedia)</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Pilih paket yang sesuai dengan pertumbuhan bisnis Anda. Klik "Pilih Paket" untuk menghubungi Super Admin.
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

            <div class="mb-5">
              <div class="flex items-baseline gap-1">
                <span class="text-2xl font-black text-slate-900 dark:text-white">{formatRupiah(plan.price)}</span>
                <span class="text-xs text-slate-400">/{plan.period || 'bulan'}</span>
              </div>
              <div class="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Users class="w-3.5 h-3.5" />
                <span>Hingga {plan.maxAgents} Kursi Agen CS</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Radio class="w-3.5 h-3.5" />
                <span>{plan.maxBroadcastPerMonth.toLocaleString('id-ID')} Broadcast / Bulan</span>
              </div>
            </div>

            <div class="space-y-2.5 flex-1 mb-6">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Benefit & Fitur:</span>
              {#each plan.features as feat}
                <div class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              {/each}
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-800">
              {#if isCurrentPlan}
                <button
                  onclick={() => openRenewModal(plan)}
                  class="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shadow-emerald-600/20"
                >
                  <Sparkles class="w-3.5 h-3.5" />
                  <span>Perpanjang Paket Ini</span>
                </button>
              {:else}
                <button
                  onclick={() => openRenewModal(plan)}
                  class="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Pilih & Upgrade</span>
                  <ArrowRight class="w-3.5 h-3.5" />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- ========================================================= -->
<!-- MODAL: PERPANJANG / UPGRADE PAKET VIA SUPER ADMIN         -->
<!-- ========================================================= -->
{#if showRenewModal && subData}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    onclick={(e) => { if (e.target === e.currentTarget) showRenewModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
      <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Pengajuan Perpanjangan Sewa</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">{subData.organizationName}</p>
          </div>
        </div>
        <button onclick={() => (showRenewModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1">
          ✕
        </button>
      </div>

      <form onsubmit={handleRequestRenew} class="p-6 space-y-4">
        <div>
          <label for="renew_plan_select" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Pilihan Paket yang Diinginkan
          </label>
          <select
            id="renew_plan_select"
            bind:value={selectedPlanToRenew}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          >
            {#each availablePlans as p}
              <option value={p}>
                {p.name} ({p.code}) — {formatRupiah(p.price)}/{p.period}
              </option>
            {/each}
          </select>
        </div>

        <div>
          <label for="renew_duration_select" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Pilih Durasi Perpanjangan
          </label>
          <select
            id="renew_duration_select"
            bind:value={selectedDuration}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="1 Bulan (30 Hari)">1 Bulan (30 Hari)</option>
            <option value="3 Bulan (90 Hari)">3 Bulan (90 Hari)</option>
            <option value="6 Bulan (180 Hari)">6 Bulan (180 Hari)</option>
            <option value="1 Tahun (365 Hari)">1 Tahun (365 Hari - Hemat)</option>
          </select>
        </div>

        <!-- If WhatsApp Link Generated -->
        {#if generatedWaUrl}
          <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3 animate-in fade-in">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 class="w-4 h-4 text-emerald-500" />
                Format Pesan Siap Dikirim
              </span>
              <button
                type="button"
                onclick={() => copyToClipboard(generatedWaText || '', 'wa_msg')}
                class="text-[10px] text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <Copy class="w-3 h-3" />
                <span>{copiedText === 'wa_msg' ? 'Tersalin!' : 'Salin Pesan'}</span>
              </button>
            </div>

            <div class="text-[11px] font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/60 whitespace-pre-line text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto">
              {generatedWaText}
            </div>

            <a
              href={generatedWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition"
            >
              <MessageCircle class="w-4 h-4" />
              <span>Buka WhatsApp & Kirim ke Super Admin</span>
            </a>
          </div>
        {/if}

        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onclick={() => (showRenewModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
          {#if !generatedWaUrl}
            <button
              type="submit"
              disabled={isSubmitting}
              class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
            >
              <Send class="w-4 h-4" />
              <span>{isSubmitting ? 'Menyiapkan...' : 'Buat Format WhatsApp'}</span>
            </button>
          {/if}
        </div>
      </form>
    </div>
  </div>
{/if}
