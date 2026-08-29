<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';
  import { FileText, Plus, CheckCircle, Clock, XCircle, Search, Trash2, X, RefreshCw, Sparkles } from 'lucide-svelte';

  interface TemplateItem {
    id: string;
    name: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    language: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED';
    components: Array<{ type: string; text?: string }>;
    createdAt: string;
  }

  let templateList = $state<TemplateItem[]>([]);
  let isLoading = $state(true);
  let isSyncing = $state(false);
  let syncFeedback = $state<string | null>(null);
  let showModal = $state(false);

  let newName = $state('');
  let newCategory = $state<'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('UTILITY');
  let newBodyText = $state('');
  let isCreating = $state(false);

  async function loadTemplates() {
    isLoading = true;
    const res = await apiRequest<{ items: TemplateItem[] }>('/templates');
    isLoading = false;
    if (res.success && res.items) {
      templateList = res.items;
    }
  }

  async function syncFromMeta() {
    isSyncing = true;
    syncFeedback = null;
    const res = await apiRequest<any>('/templates/sync', { method: 'POST' });
    isSyncing = false;
    if (res.success) {
      syncFeedback = res.message || 'Template berhasil disinkronkan dari Meta!';
      if (res.items) {
        templateList = res.items;
      }
      setTimeout(() => (syncFeedback = null), 4000);
    } else {
      syncFeedback = res.error || 'Gagal menyinkronkan dari Meta';
      setTimeout(() => (syncFeedback = null), 4000);
    }
  }

  async function createTemplate(e: Event) {
    e.preventDefault();
    if (!newName.trim() || !newBodyText.trim()) return;

    isCreating = true;
    const res = await apiRequest('/templates', {
      method: 'POST',
      body: JSON.stringify({
        name: newName.trim(),
        category: newCategory,
        language: 'id',
        components: [{ type: 'BODY', text: newBodyText.trim() }],
      }),
    });
    isCreating = false;

    if (res.success) {
      showModal = false;
      newName = '';
      newBodyText = '';
      loadTemplates();
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus template ini?')) return;
    const res = await apiRequest(`/templates/${id}`, { method: 'DELETE' });
    if (res.success) {
      templateList = templateList.filter((t) => t.id !== id);
    }
  }

  onMount(() => {
    loadTemplates();
  });
</script>

<div class="p-8 max-w-7xl mx-auto space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <div class="flex items-center gap-2.5">
        <h2 class="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Template Pesan WhatsApp</h2>
        <span class="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-mono">
          <Sparkles class="w-3 h-3" /> Meta Live Sync
        </span>
      </div>
      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">Kelola dan daftarkan template pesan resmi ke Meta WhatsApp Cloud API</p>
    </div>

    {#if authStore.role !== 'AGENT'}
      <div class="flex items-center gap-2.5">
        <button
          onclick={syncFromMeta}
          disabled={isSyncing}
          class="py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
          title="Sinkronkan template langsung dari Meta WhatsApp Business Account"
        >
          <RefreshCw class="w-3.5 h-3.5 {isSyncing ? 'animate-spin text-emerald-500' : ''}" />
          <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan dari Meta'}</span>
        </button>

        <button
          onclick={() => (showModal = true)}
          class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Buat Template Baru</span>
        </button>
      </div>
    {/if}
  </div>

  {#if syncFeedback}
    <div class="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
      <CheckCircle class="w-4 h-4 text-emerald-600 shrink-0" />
      <span>{syncFeedback}</span>
    </div>
  {/if}

  <!-- Template Cards Grid -->
  {#if isLoading}
    <div class="p-12 text-center text-xs text-slate-500 dark:text-slate-400">Memuat template...</div>
  {:else if templateList.length === 0}
    <div class="p-12 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
      Belum ada template yang dibuat. Klik tombol di atas untuk membuat template pertama.
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each templateList as tpl}
        <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-sm">
          <div>
            <div class="flex items-start justify-between gap-2 mb-3">
              <div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white font-mono">{tpl.name}</h4>
                <span class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                  {tpl.category} • {tpl.language}
                </span>
              </div>

              {#if tpl.status === 'APPROVED'}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle class="w-3 h-3" /> Disetujui
                </span>
              {:else if tpl.status === 'PENDING'}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Clock class="w-3 h-3" /> Menunggu
                </span>
              {:else}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <XCircle class="w-3 h-3" /> Ditolak
                </span>
              {/if}
            </div>

            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
              {tpl.components?.find((c: any) => c.type === 'BODY')?.text || tpl.components?.[0]?.text || 'Konten Template'}
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Dibuat: {new Date(tpl.createdAt).toLocaleDateString('id-ID')}</span>
            
            {#if authStore.role !== 'AGENT'}
              <button
                onclick={() => deleteTemplate(tpl.id)}
                class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 transition p-1 cursor-pointer"
                title="Hapus template"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal Create Template -->
{#if showModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Buat Template Pesan Baru</h3>
        <button onclick={() => (showModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={createTemplate} class="space-y-4">
        <div>
          <label for="template_name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Template (Huruf kecil & underscore)</label>
          <input
            id="template_name"
            type="text"
            bind:value={newName}
            placeholder="e.g. konfirmasi_jadwal_v1"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
            required
          />
        </div>

        <div>
          <label for="template_cat" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategori Meta</label>
          <select
            id="template_cat"
            bind:value={newCategory}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="UTILITY">UTILITY (Transaksi, Konfirmasi, Resi)</option>
            <option value="MARKETING">MARKETING (Promosi, Penawaran Diskon)</option>
            <option value="AUTHENTICATION">AUTHENTICATION (OTP, Verifikasi)</option>
          </select>
        </div>

        <div>
          <label for="template_body" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Isi Pesan (Gunakan &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; untuk variabel dinamis)</label>
          <textarea
            id="template_body"
            rows="4"
            bind:value={newBodyText}
            placeholder="Halo &#123;&#123;1&#125;&#125;, pesanan Anda #&#123;&#123;2&#125;&#125; telah dikirim."
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 leading-relaxed"
            required
          ></textarea>
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
            disabled={isCreating}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
          >
            {isCreating ? 'Menyimpan...' : 'Ajukan Template'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
