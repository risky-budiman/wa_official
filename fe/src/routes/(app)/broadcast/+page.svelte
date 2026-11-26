<script lang="ts">
  import MetaQuotaCard from '$lib/components/ui/MetaQuotaCard.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
import { apiRequest } from '$lib/api/client';
import { onMount, onDestroy } from 'svelte';
import { Radio, Plus, CheckCircle, Clock, Users, Send, X, AlertCircle, Sparkles, Trash2, RefreshCw } from 'lucide-svelte';

interface CampaignItem {
  id: string;
  name: string;
  status: 'COMPLETED' | 'PROCESSING' | 'DRAFT' | 'FAILED' | 'SCHEDULED';
  scheduledAt?: string | null;
  audienceTag?: string | null;
  lastError?: string | null;
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
  components?: any[];
}

type VarChoice = { source: 'contact_name' | 'text'; value: string };

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

// ─── Template variables & audience ───
let headerChoices = $state<VarChoice[]>([]);
let bodyChoices = $state<VarChoice[]>([]);
let buttonValues = $state<Record<string, string>>({});
let headerMediaUrl = $state('');
let targetTag = $state('');
// Send now or at a chosen time (local time of this browser)
let sendMode = $state<'now' | 'later'>('now');
let scheduleLocal = $state('');

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const minSchedule = $derived(toLocalInput(new Date(Date.now() + 5 * 60 * 1000)));
const maxSchedule = $derived(toLocalInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
function formatWhen(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
let tagOptions = $state<{ tag: string; count: number }[]>([]);
let totalContacts = $state(0);
let preparedFor = '';

const approvedTemplates = $derived(templateOptions.filter((t) => t.status === 'APPROVED'));
const selectedTemplate = $derived(approvedTemplates.find((t) => t.id === selectedTemplateId) || null);

const distinctVars = (text: unknown) => new Set(String(text || '').match(/\{\{\s*\d+\s*\}\}/g) || []).size;
const needs = $derived.by(() => {
  const comps: any[] = selectedTemplate?.components || [];
  const header = comps.find((c) => String(c?.type).toUpperCase() === 'HEADER');
  const body = comps.find((c) => String(c?.type).toUpperCase() === 'BODY');
  const btns: any[] = comps.find((c) => String(c?.type).toUpperCase() === 'BUTTONS')?.buttons || [];
  const headerFormat = header ? String(header.format || 'TEXT').toUpperCase() : null;
  return {
    headerFormat,
    headerText: header?.text || '',
    bodyText: body?.text || '',
    headerVars: headerFormat === 'TEXT' ? distinctVars(header?.text) : 0,
    bodyVars: distinctVars(body?.text),
    buttons: btns
      .map((b: any, index: number) => {
        const type = String(b?.type || '').toUpperCase();
        if (type === 'URL' && String(b?.url || '').includes('{{')) return { index, kind: 'url', text: b.text || 'Link', hint: b.url };
        if (type === 'COPY_CODE') {
          const ex = Array.isArray(b.example) ? b.example[0] : b.example;
          return { index, kind: 'copy_code', text: b.text || 'Salin kode', hint: ex ? `Kosongkan untuk memakai kode template: ${ex}` : 'Kode kupon' };
        }
        return null;
      })
      .filter(Boolean) as { index: number; kind: string; text: string; hint: string }[],
  };
});

// Reset the variable form whenever another template is picked ({{1}} defaults to the contact's name)
$effect(() => {
  const id = selectedTemplate?.id || '';
  if (id === preparedFor) return;
  preparedFor = id;
  const mk = (n: number): VarChoice[] => Array.from({ length: n }, (_, i) => ({ source: i === 0 ? 'contact_name' : 'text', value: '' }));
  headerChoices = mk(needs.headerVars);
  bodyChoices = mk(needs.bodyVars);
  buttonValues = {};
  headerMediaUrl = '';
});

const recipientCount = $derived(targetTag ? tagOptions.find((t) => t.tag === targetTag)?.count || 0 : totalContacts);

const previewText = $derived.by(() => {
  let text = needs.bodyText;
  bodyChoices.forEach((c, i) => {
    const val = c.source === 'contact_name' ? 'Budi' : c.value.trim() || `{{${i + 1}}}`;
    text = text.split(`{{${i + 1}}}`).join(val);
  });
  return text;
});

async function loadTags() {
  const res = await apiRequest<any>('/contacts/tags');
  if (res.success) {
    tagOptions = res.tags || [];
    totalContacts = res.total || 0;
  }
}

function openCreate() {
  errorMessage = null;
  targetTag = '';
  sendMode = 'now';
  scheduleLocal = toLocalInput(new Date(Date.now() + 60 * 60 * 1000));
  if (!approvedTemplates.some((t) => t.id === selectedTemplateId)) selectedTemplateId = approvedTemplates[0]?.id || '';
  preparedFor = '';
  showModal = true;
  loadTags();
}

function variablesPayload() {
  const conv = (c: VarChoice) => (c.source === 'contact_name' ? { source: 'contact_name' } : { source: 'text', value: c.value.trim() });
  return {
    header: headerChoices.map(conv),
    body: bodyChoices.map(conv),
    buttons: Object.fromEntries(Object.entries(buttonValues).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
    headerMediaUrl: headerMediaUrl.trim() || undefined,
  };
}

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
  // Same checks as the server, so the user sees what is missing before anything is sent
  const missing: string[] = [];
  if (needs.headerFormat && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(needs.headerFormat) && !headerMediaUrl.trim()) missing.push('link media header');
  headerChoices.forEach((c, i) => { if (c.source === 'text' && !c.value.trim()) missing.push(`header {{${i + 1}}}`); });
  bodyChoices.forEach((c, i) => { if (c.source === 'text' && !c.value.trim()) missing.push(`{{${i + 1}}}`); });
  needs.buttons.forEach((b) => {
    if (b.kind === 'url' && !(buttonValues[String(b.index)] || '').trim()) missing.push(`tombol "${b.text}"`);
  });
  if (missing.length) {
    errorMessage = `Lengkapi dulu: ${missing.join(', ')}.`;
    return;
  }
  if (recipientCount === 0) {
    errorMessage = 'Tidak ada kontak penerima untuk target ini.';
    return;
  }
  let scheduledIso: string | undefined;
  if (sendMode === 'later') {
    const at = new Date(scheduleLocal);
    if (!scheduleLocal || Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 2 * 60 * 1000) {
      errorMessage = 'Pilih waktu jadwal minimal beberapa menit dari sekarang.';
      return;
    }
    scheduledIso = at.toISOString();
  }
  const audience = `${recipientCount.toLocaleString('id-ID')} kontak${targetTag ? ` bertag "${targetTag}"` : ''}`;
  const question = scheduledIso
    ? `Jadwalkan "${selectedTemplate?.name}" ke ${audience} pada ${formatWhen(scheduledIso)}? Anda bisa membatalkannya sebelum waktu itu.`
    : `Kirim "${selectedTemplate?.name}" ke ${audience} sekarang? Pesan yang sudah terkirim tidak bisa ditarik.`;
  if (!confirm(question)) return;

  isSubmitting = true;
  const res = await apiRequest('/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      name: newName.trim(),
      templateId: selectedTemplateId,
      tag: targetTag || undefined,
      variables: variablesPayload(),
      scheduledAt: scheduledIso,
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
  const c = campaignList.find((x) => x.id === id);
  const question =
    c?.status === 'SCHEDULED'
      ? 'Batalkan broadcast terjadwal ini? Tidak ada pesan yang akan dikirim.'
      : c?.status === 'PROCESSING'
        ? 'Hentikan broadcast yang sedang berjalan? Pesan yang sudah terkirim tidak bisa ditarik.'
        : 'Hapus riwayat kampanye ini?';
  if (!confirm(question)) return;
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
    const hasProcessing = campaignList.some((c) => c.status === 'PROCESSING' || (c.status === 'SCHEDULED' && c.scheduledAt && new Date(c.scheduledAt).getTime() <= Date.now() + 60000));
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
      <button onclick={openCreate} class="ui-btn-primary">
        <Plus class="h-4 w-4" />
        Buat Kampanye
      </button>
    {/snippet}
  </PageHeader>

  <!-- Meta 24-Hour Messaging Quota -->
  {#if metaQuota}
    <MetaQuotaCard quota={metaQuota} />
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
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800" title={c.lastError || ''}>
                      ✕ Gagal
                    </span>
                    {#if c.lastError}<p class="mt-1 max-w-[14rem] text-[10px] leading-snug text-rose-600 dark:text-rose-300">{c.lastError}</p>{/if}
                  {:else if c.status === 'SCHEDULED'}
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      <Clock class="w-3 h-3" /> Terjadwal · {formatWhen(c.scheduledAt)}
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
                    title={c.status === 'SCHEDULED' ? 'Batalkan jadwal' : c.status === 'PROCESSING' ? 'Hentikan broadcast' : 'Hapus riwayat kampanye ini'}
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
            {selectedCampaign.status === 'COMPLETED' ? '✓ SELESAI' : selectedCampaign.status === 'FAILED' ? '✕ GAGAL' : selectedCampaign.status === 'SCHEDULED' ? `⏰ TERJADWAL ${formatWhen(selectedCampaign.scheduledAt)}` : '⏳ SEDANG DIPROSES'}
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
    <div class="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
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
          <label for="template_select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Template WhatsApp (yang sudah disetujui Meta)</label>
          <select
            id="template_select"
            bind:value={selectedTemplateId}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
            required
          >
            {#each approvedTemplates as t}
              <option value={t.id}>{t.name} · {t.language || 'id'}</option>
            {/each}
          </select>
          {#if approvedTemplates.length === 0}
            <p class="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Belum ada template yang disetujui. Buat / sinkronkan di menu Template WhatsApp.</p>
          {/if}
        </div>

        <div>
          <label for="target_tag" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Penerima</label>
          <select id="target_tag" bind:value={targetTag} class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500">
            <option value="">Semua kontak ({totalContacts.toLocaleString('id-ID')})</option>
            {#each tagOptions as t}
              <option value={t.tag}>Tag "{t.tag}" ({t.count.toLocaleString('id-ID')})</option>
            {/each}
          </select>
        </div>

        {#if selectedTemplate && (needs.headerFormat && needs.headerFormat !== 'TEXT' || needs.headerVars || needs.bodyVars || needs.buttons.length)}
          <div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Isian template</p>

            {#if needs.headerFormat && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(needs.headerFormat)}
              <div>
                <label for="hdr_media" class="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">Link {needs.headerFormat.toLowerCase()} header (https://…)</label>
                <input id="hdr_media" type="url" bind:value={headerMediaUrl} placeholder="https://…" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
              </div>
            {/if}

            {#each [{ label: 'Header', list: headerChoices }, { label: 'Isi', list: bodyChoices }] as group}
              {#each group.list as choice, i}
                <div class="grid grid-cols-[auto_8.5rem_1fr] items-center gap-2">
                  <span class="w-16 text-[11px] font-semibold text-slate-600 dark:text-slate-400">{group.label} &#123;&#123;{i + 1}&#125;&#125;</span>
                  <select bind:value={choice.source} class="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" aria-label={`Sumber ${group.label} ${i + 1}`}>
                    <option value="contact_name">Nama kontak</option>
                    <option value="text">Teks tetap</option>
                  </select>
                  {#if choice.source === 'text'}
                    <input bind:value={choice.value} placeholder="Isi untuk semua penerima" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" aria-label={`Nilai ${group.label} ${i + 1}`} />
                  {:else}
                    <span class="text-[11px] text-slate-500">Diisi nama masing-masing kontak</span>
                  {/if}
                </div>
              {/each}
            {/each}

            {#each needs.buttons as b (b.index)}
              <div>
                <label for={`bc_btn_${b.index}`} class="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-400">Tombol "{b.text}" <span class="font-normal text-slate-400">— {b.hint}</span></label>
                <input id={`bc_btn_${b.index}`} bind:value={buttonValues[String(b.index)]} placeholder={b.kind === 'url' ? 'Bagian akhir link' : 'Kode kupon'} class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
              </div>
            {/each}

            {#if needs.bodyText}
              <div class="rounded-lg bg-white p-3 text-xs whitespace-pre-line text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                <p class="mb-1 text-[10px] font-semibold uppercase text-slate-400">Pratinjau (contoh kontak "Budi")</p>
                {previewText}
              </div>
            {/if}
          </div>
        {/if}

        {#if errorMessage}
          <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        {/if}

        <fieldset class="space-y-2">
          <legend class="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">Waktu kirim</legend>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs {sendMode === 'now' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}">
              <input type="radio" bind:group={sendMode} value="now" class="accent-emerald-600" /> Kirim sekarang
            </label>
            <label class="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs {sendMode === 'later' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'}">
              <input type="radio" bind:group={sendMode} value="later" class="accent-emerald-600" /> Jadwalkan
            </label>
          </div>
          {#if sendMode === 'later'}
            <input
              type="datetime-local"
              bind:value={scheduleLocal}
              min={minSchedule}
              max={maxSchedule}
              aria-label="Tanggal dan jam kirim"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
            <p class="text-[11px] text-slate-500">Waktu sesuai zona waktu perangkat Anda. Penerima & isi template dihitung ulang saat jadwal tiba.</p>
          {/if}
        </fieldset>

        <div class="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
          💡 Akan dikirim ke <strong>{recipientCount.toLocaleString('id-ID')}</strong> kontak{targetTag ? ` bertag "${targetTag}"` : ''}, dengan pembatasan kecepatan sesuai aturan Meta.
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
            disabled={isSubmitting || !selectedTemplate}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
          >
            {isSubmitting ? 'Memproses...' : sendMode === 'later' ? 'Jadwalkan Broadcast' : 'Mulai Broadcast'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
