<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { onMount } from 'svelte';
  import { Radio, Plus, CheckCircle, Clock, Users, Send, X } from 'lucide-svelte';

  interface CampaignItem {
    id: string;
    name: string;
    status: 'COMPLETED' | 'PROCESSING' | 'DRAFT';
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    createdAt: string;
    template: {
      name: string;
      category: string;
    };
  }

  interface TemplateOption {
    id: string;
    name: string;
  }

  let campaignList = $state<CampaignItem[]>([]);
  let templateOptions = $state<TemplateOption[]>([]);
  let isLoading = $state(true);
  let showModal = $state(false);

  let newName = $state('');
  let selectedTemplateId = $state('');
  let isSubmitting = $state(false);

  async function loadData() {
    isLoading = true;
    const [cRes, tRes] = await Promise.all([
      apiRequest<{ items: CampaignItem[] }>('/broadcast'),
      apiRequest<{ items: TemplateOption[] }>('/templates'),
    ]);
    isLoading = false;

    if (cRes.success && cRes.items) {
      campaignList = cRes.items;
    }
    if (tRes.success && tRes.items) {
      templateOptions = tRes.items;
      if (templateOptions.length > 0) {
        selectedTemplateId = templateOptions[0].id;
      }
    }
  }

  async function createCampaign(e: Event) {
    e.preventDefault();
    if (!newName.trim() || !selectedTemplateId) return;

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
      loadData();
    }
  }

  onMount(() => {
    loadData();
  });
</script>

<div class="p-8 max-w-7xl mx-auto space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">Broadcast Campaign</h2>
      <p class="text-xs text-slate-600 dark:text-slate-400">Jalankan pengiriman pesan massal resmi dengan Sliding Window Rate Limiter</p>
    </div>

    <button
      onclick={() => (showModal = true)}
      class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer"
    >
      <Plus class="w-4 h-4" />
      Buat Kampanye Baru
    </button>
  </div>

  <!-- Campaign Stats Overview -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Kampanye</span>
      <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">{campaignList.length}</div>
      <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Aktif & Selesai</span>
    </div>
    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Rata-rata Delivery Rate</span>
      <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">98.8%</div>
      <span class="text-[11px] text-slate-500 dark:text-slate-400">Terkirim ke WhatsApp Pelanggan</span>
    </div>
    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
      <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Rata-rata Read Rate</span>
      <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">86.2%</div>
      <span class="text-[11px] text-slate-500 dark:text-slate-400">Dibaca oleh Pelanggan</span>
    </div>
  </div>

  <!-- Campaign List Table -->
  <div class="bg-white dark:bg-slate-900/70 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
    <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <h3 class="text-sm font-bold text-slate-900 dark:text-white">Riwayat Kampanye</h3>
    </div>

    {#if isLoading}
      <div class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Memuat kampanye...</div>
    {:else if campaignList.length === 0}
      <div class="p-8 text-center text-xs text-slate-500 dark:text-slate-400">Belum ada kampanye broadcast.</div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="py-3 px-4">Nama Kampanye</th>
              <th class="py-3 px-4">Template</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Penerima</th>
              <th class="py-3 px-4">Delivered</th>
              <th class="py-3 px-4">Read</th>
              <th class="py-3 px-4">Tanggal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
            {#each campaignList as c}
              <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{c.name}</td>
                <td class="py-3.5 px-4 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">{c.template.name}</td>
                <td class="py-3.5 px-4">
                  {#if c.status === 'COMPLETED'}
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Selesai
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Diproses
                    </span>
                  {/if}
                </td>
                <td class="py-3.5 px-4 font-semibold">{c.totalRecipients} kontak</td>
                <td class="py-3.5 px-4 text-emerald-700 dark:text-emerald-400 font-bold">{c.deliveredCount}</td>
                <td class="py-3.5 px-4 text-indigo-700 dark:text-indigo-400 font-bold">{c.readCount}</td>
                <td class="py-3.5 px-4 text-slate-500 dark:text-slate-400">{new Date(c.createdAt).toLocaleDateString('id-ID')}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

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
          <label for="template_select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pilih WhatsApp Template</label>
          <select
            id="template_select"
            bind:value={selectedTemplateId}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
            required
          >
            {#each templateOptions as t}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
        </div>

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
