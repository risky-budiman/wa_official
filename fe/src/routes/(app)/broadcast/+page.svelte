<script lang="ts">
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
import { apiRequest } from '$lib/api/client';
import { onMount, onDestroy } from 'svelte';
import { Radio, Plus, CheckCircle, Clock, Users, Send, X, Flame, AlertCircle, Sparkles, Trash2, RefreshCw } from 'lucide-svelte';

interface CampaignItem {
  id: string;
  name: string;
  status: 'COMPLETED' | 'PROCESSING' | 'DRAFT' | 'FAILED';
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  template: {
    id: string;
    name: string;
    category: string;
  };
}

interface TemplateOption {
  id: string;
  name: string;
  status: string;
  category?: string;
  language?: string;
}

interface MetaQuotaData {
  dailyLimit: number;
  tier: string;
  tierDisplay: string;
  totalUsed: number;
  remainingQuota: number;
  usedPercentage: number;
  uniqueContactsReached: number;
  csReplies24h: number;
  broadcastSent24h: number;
  templateSent24h: number;
  qualityRating: string;
  status: string;
  verifiedName: string;
  displayPhoneNumber: string;
  resetWindow: string;
}

let campaignList = $state<CampaignItem[]>([]);
let templateOptions = $state<TemplateOption[]>([]);
let metaQuota = $state<MetaQuotaData | null>(null);
let isLoading = $state(true);
let isRefreshing = $state(false);
let showModal = $state(false);
let selectedCampaign = $state<CampaignItem | null>(null);
let pollTimer: any = null;

let newName = $state('');
let selectedTemplateId = $state('');
let isSubmitting = $state(false);
let errorMessage = $state<string | null>(null);

// Dynamic Stats Computed from Real Data
let totalSentSum = $derived(campaignList.reduce((acc, c) => acc + (c.sentCount || 0), 0));
let totalDeliveredSum = $derived(campaignList.reduce((acc, c) => acc + (c.deliveredCount || 0), 0));
let totalReadSum = $derived(campaignList.reduce((acc, c) => acc + (c.readCount || 0), 0));

let avgDeliveryRate = $derived(
  totalSentSum > 0 ? ((totalDeliveredSum / totalSentSum) * 100).toFixed(1) + '%' : '0.0%'
);
let avgReadRate = $derived(
  totalSentSum > 0 ? ((totalReadSum / totalSentSum) * 100).toFixed(1) + '%' : '0.0%'
);

async function loadData(showLoader = true) {
  if (showLoader) isLoading = true;
  isRefreshing = true;
  const [cRes, tRes, qRes] = await Promise.all([
    apiRequest<{ items: CampaignItem[] }>('/broadcast'),
    apiRequest<{ items: TemplateOption[] }>('/templates'),
    apiRequest<{ quota: MetaQuotaData }>('/settings/waba/quota'),
  ]);
  isLoading = false;
  isRefreshing = false;

  if (cRes.success && cRes.items) {
    campaignList = cRes.items;
    if (selectedCampaign) {
      const updated = campaignList.find((c) => c.id === selectedCampaign?.id);
      if (updated) selectedCampaign = updated;
    }
  }
  if (tRes.success && tRes.items) {
    templateOptions = tRes.items;
    if (templateOptions.length > 0 && !selectedTemplateId) {
      selectedTemplateId = templateOptions[0].id;
    }
  }
  if (qRes.success && qRes.quota) {
    metaQuota = qRes.quota;
  }
}

async function createCampaign(e: Event) {
  e.preventDefault();
  if (!newName.trim() || !selectedTemplateId) return;

  errorMessage = null;
  isSubmitting = true;
  const res = await apiRequest('/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      name: newName.trim(),
      templateId: selectedTemplateId,
    }),
  });
  isSubmitting = false;

  if (res.success) {
    showModal = false;
    newName = '';
    loadData(false);
  } else {
    errorMessage = res.error || 'Gagal membuat kampanye broadcast';
  }
}

async function deleteCampaign(id: string) {
  if (!confirm('Apakah Anda yakin ingin menghapus data kampanye ini?')) return;
  const res = await apiRequest(`/broadcast/${id}`, { method: 'DELETE' });
  if (res.success) {
    if (selectedCampaign?.id === id) selectedCampaign = null;
    loadData(false);
  }
}

onMount(() => {
  loadData();
  // Auto poll every 2.5 seconds to track real-time broadcast progress
  pollTimer = setInterval(() => {
    const hasProcessing = campaignList.some((c) => c.status === 'PROCESSING');
    if (hasProcessing) {
      loadData(false);
    }
  }, 2500);
});

onDestroy(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<div class="ui-page">
  <PageHeader
    title="Broadcast"
    description="Kirim pesan massal resmi ke segmen pelanggan, dengan pembatasan kecepatan otomatis sesuai aturan Meta."
    icon={Radio}
  >
    {#snippet actions()}
      <button onclick={() => loadData(false)} disabled={isRefreshing} class="ui-btn-secondary">
        <RefreshCw class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
        Segarkan
      </button>
      <button onclick={() => (showModal = true)} class="ui-btn-primary">
        <Plus class="h-4 w-4" />
        Buat Kampanye
      </button>
    {/snippet}
  </PageHeader>

  <!-- Meta 24-Hour Messaging Quota -->
  {#if metaQuota}
    {@const pct = metaQuota.usedPercentage}
    <div class="ui-card space-y-3 p-5">
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20">
            <Flame class="h-5 w-5" />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-sm font-semibold text-slate-900 dark:text-white">Kuota Pesan Meta (24 jam)</p>
              <span class="ui-pill border-indigo-200 bg-indigo-50 py-0.5 font-mono text-[11px] text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                {metaQuota.tierDisplay}
              </span>
            </div>
            <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Sisa kuota: <strong class="font-semibold text-emerald-600 dark:text-emerald-400">{metaQuota.remainingQuota.toLocaleString('id-ID')} penerima</strong>
            </p>
          </div>
        </div>
        <p class="font-mono text-sm font-semibold {pct >= 90 ? 'text-rose-600 dark:text-rose-400' : pct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}">
          {metaQuota.totalUsed.toLocaleString('id-ID')} / {metaQuota.dailyLimit.toLocaleString('id-ID')} ({pct}%)
        </p>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          class="h-full rounded-full transition-all duration-700 {pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}"
          style="width: {Math.max(pct, 2)}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- Campaign Stats -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <StatCard label="Total Kampanye" value={campaignList.length} icon={Radio} tone="emerald" hint="{totalSentSum} pesan terkirim" />
    <StatCard label="Rata-rata Terkirim" value={avgDeliveryRate} icon={CheckCircle} tone="blue" hint="{totalDeliveredSum} pesan sampai ke pelanggan" />
    <StatCard label="Rata-rata Dibaca" value={avgReadRate} icon={Users} tone="violet" hint="{totalReadSum} pesan dibaca pelanggan" />
  </div>

  <!-- Campaign List Table -->
  <div class="ui-card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Riwayat Kampanye</h2>
    </div>

    {#if isLoading}
      <div class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Memuat kampanye...</div>
    {:else if campaignList.length === 0}
      <div class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Belum ada kampanye broadcast.</div>
    {:else}
      <div class="overflow-x-auto">
        <table class="ui-table w-full text-left text-slate-700 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="py-3 px-4">Nama Kampanye</th>
              <th class="py-3 px-4">Template</th>
              <th class="py-3 px-4">Status & Progres</th>
              <th class="py-3 px-4">Penerima</th>
              <th class="py-3 px-4">Terkirim</th>
              <th class="py-3 px-4">Delivered</th>
              <th class="py-3 px-4">Read</th>
              <th class="py-3 px-4">Tanggal</th>
              <th class="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {#each campaignList as c}
              <tr
                onclick={() => (selectedCampaign = c)}
                class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer {selectedCampaign?.id === c.id ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}"
              >
                <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                  <div class="flex items-center gap-1.5">
                    <span>{c.name}</span>
                  </div>
                </td>
                <td class="py-3.5 px-4 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">{c.template.name}</td>
                <td class="py-3.5 px-4">
                  {#if c.status === 'COMPLETED'}
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      ✓ Selesai ({c.sentCount}/{c.totalRecipients})
                    </span>
                  {:else if c.status === 'FAILED'}
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      ✕ Gagal
                    </span>
                  {:else}
                    <div class="space-y-1">
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
                        Diproses ({c.sentCount}/{c.totalRecipients} - {Math.round((c.sentCount / (c.totalRecipients || 1)) * 100)}%)
                      </span>
                      <div class="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full bg-amber-500 transition-all duration-300" style="width: {Math.round((c.sentCount / (c.totalRecipients || 1)) * 100)}%"></div>
                      </div>
                    </div>
                  {/if}
                </td>
                <td class="py-3.5 px-4 font-semibold">{c.totalRecipients} kontak</td>
                <td class="py-3.5 px-4 text-slate-900 dark:text-white font-bold">{c.sentCount}</td>
                <td class="py-3.5 px-4 text-emerald-700 dark:text-emerald-400 font-bold">{c.deliveredCount}</td>
                <td class="py-3.5 px-4 text-indigo-700 dark:text-indigo-400 font-bold">{c.readCount}</td>
                <td class="py-3.5 px-4 text-slate-500 dark:text-slate-400">{new Date(c.createdAt).toLocaleDateString('id-ID')}</td>
                <td class="py-3.5 px-4 text-center">
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      deleteCampaign(c.id);
                    }}
                    class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Hapus riwayat kampanye ini"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Modal Detail & Log Progress Kampanye -->
{#if selectedCampaign}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">{selectedCampaign.name}</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">Template: {selectedCampaign.template.name}</p>
        </div>
        <button onclick={() => (selectedCampaign = null)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Live Step Progress Tracker -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-700 dark:text-slate-300">Status Pengiriman:</span>
          <span class="font-mono font-bold {selectedCampaign.status === 'COMPLETED' ? 'text-emerald-600' : selectedCampaign.status === 'FAILED' ? 'text-rose-600' : 'text-amber-500'}">
            {selectedCampaign.status === 'COMPLETED' ? '✓ SELESAI' : selectedCampaign.status === 'FAILED' ? '✕ GAGAL' : '⏳ SEDANG DIPROSES'}
          </span>
        </div>

        <div class="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700">
          <div
            class="h-full rounded-full transition-all duration-500 bg-gradient-to-r {selectedCampaign.status === 'FAILED'
              ? 'from-rose-500 to-rose-600'
              : 'from-emerald-500 to-teal-400'}"
            style="width: {Math.max(Math.round(((selectedCampaign.sentCount + (selectedCampaign.failedCount || 0)) / (selectedCampaign.totalRecipients || 1)) * 100), 4)}%"
          ></div>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Progres: {selectedCampaign.sentCount + (selectedCampaign.failedCount || 0)} / {selectedCampaign.totalRecipients} Kontak</span>
          <span>{Math.round(((selectedCampaign.sentCount + (selectedCampaign.failedCount || 0)) / (selectedCampaign.totalRecipients || 1)) * 100)}% Selesai</span>
        </div>
      </div>

      <!-- 4 Stats Cards -->
      <div class="grid grid-cols-4 gap-2 text-center">
        <div class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <span class="text-[10px] text-slate-500 dark:text-slate-400 block">Total Target</span>
          <span class="text-sm font-black text-slate-900 dark:text-white">{selectedCampaign.totalRecipients}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
          <span class="text-[10px] text-emerald-700 dark:text-emerald-400 block">Terkirim</span>
          <span class="text-sm font-black text-emerald-600 dark:text-emerald-400">{selectedCampaign.sentCount}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800">
          <span class="text-[10px] text-teal-700 dark:text-teal-400 block">Delivered</span>
          <span class="text-sm font-black text-teal-600 dark:text-teal-400">{selectedCampaign.deliveredCount}</span>
        </div>
        <div class="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
          <span class="text-[10px] text-indigo-700 dark:text-indigo-400 block">Dibaca</span>
          <span class="text-sm font-black text-indigo-600 dark:text-indigo-400">{selectedCampaign.readCount}</span>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          onclick={() => (selectedCampaign = null)}
          class="py-2 px-5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal Create Campaign -->
{#if showModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Buat Kampanye Broadcast</h3>
        <button onclick={() => (showModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={createCampaign} class="space-y-4">
        <div>
          <label for="campaign_name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Kampanye</label>
          <input
            id="campaign_name"
            type="text"
            bind:value={newName}
            placeholder="e.g. Promo Flash Sale Weekend"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <label for="template_select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pilih WhatsApp Template (Wajib Berstatus APPROVED)</label>
          <select
            id="template_select"
            bind:value={selectedTemplateId}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
            required
          >
            {#each templateOptions as t}
              <option value={t.id}>
                {t.name} {t.status === 'APPROVED' ? '✓ [APPROVED / Disetujui Meta]' : `⚠️ [${t.status || 'PENDING'}]`}
              </option>
            {/each}
          </select>
        </div>

        {#if errorMessage}
          <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        {/if}

        <div class="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
          💡 Pesan akan dikirim ke seluruh kontak menggunakan sliding-window rate limit resmi Meta WhatsApp API.
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onclick={() => (showModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
          >
            {isSubmitting ? 'Mengirim...' : 'Mulai Broadcast'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
