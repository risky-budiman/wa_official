<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount } from 'svelte';
  import {
    FileText,
    Plus,
    CheckCircle,
    Clock,
    XCircle,
    Search,
    Trash2,
    X,
    RefreshCw,
    Sparkles,
    Pencil,
    Eye,
    Tag,
    MessageSquare,
    Copy,
    Check,
    Layers,
    BookOpen,
    HelpCircle,
    SlidersHorizontal,
    Send
  } from 'lucide-svelte';

  interface TemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: string;
    text?: string;
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  }

  interface TemplateItem {
    id: string;
    name: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
    language: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';
    components: TemplateComponent[];
    metaTemplateId?: string;
    createdAt: string;
  }

  interface SamplePreset {
    id: string;
    title: string;
    badge: string;
    name: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    header: string;
    body: string;
    footer: string;
    sampleVariables: Record<string, string>;
  }

  const SAMPLE_PRESETS: SamplePreset[] = [
    {
      id: 'order_conf',
      title: 'Konfirmasi Pesanan',
      badge: 'UTILITY',
      name: 'konfirmasi_pesanan_v1',
      category: 'UTILITY',
      header: 'Konfirmasi Pesanan',
      body: 'Halo {{1}}, terima kasih telah berbelanja di toko kami. Pesanan Anda #{{2}} telah kami konfirmasi sebesar Rp {{3}}. Paket akan segera diproses pengirimannya.',
      footer: 'Layanan WhatsApp Resmi',
      sampleVariables: { '{{1}}': 'Budi Santoso', '{{2}}': 'ORD-9821', '{{3}}': '250.000' }
    },
    {
      id: 'appointment',
      title: 'Pengingat Janji Temu',
      badge: 'UTILITY',
      name: 'pengingat_jadwal_v1',
      category: 'UTILITY',
      header: 'Pengingat Janji Temu',
      body: 'Halo Bapak/Ibu {{1}}, kami mengingatkan jadwal janji temu Anda pada hari {{2}} pukul {{3}} WIB di {{4}}. Mohon konfirmasi jika ada perubahan jadwal.',
      footer: 'Customer Service Support',
      sampleVariables: { '{{1}}': 'dr. Rina Wijaya', '{{2}}': 'Senin, 1 September', '{{3}}': '14:00', '{{4}}': 'Klinik Utama Lt. 2' }
    },
    {
      id: 'invoice',
      title: 'Notifikasi Tagihan',
      badge: 'UTILITY',
      name: 'notifikasi_tagihan_v1',
      category: 'UTILITY',
      header: 'Pemberitahuan Tagihan',
      body: 'Yth. {{1}}, tagihan layanan Anda untuk periode {{2}} sebesar Rp {{3}} telah terbit dan jatuh tempo pada {{4}}. Segera lakukan pembayaran untuk menjaga kelancaran layanan.',
      footer: 'Divisi Billing & Keuangan',
      sampleVariables: { '{{1}}': 'PT Maju Bersama', '{{2}}': 'Agustus 2026', '{{3}}': '1.500.000', '{{4}}': '05 September 2026' }
    },
    {
      id: 'promo',
      title: 'Promo Spesial Diskon',
      badge: 'MARKETING',
      name: 'promo_spesial_member_v1',
      category: 'MARKETING',
      header: '🎉 Promo Spesial Eksklusif!',
      body: 'Hai {{1}}! Dapatkan penawaran istimewa diskon {{2}}% untuk semua produk pilihan dengan kode promo {{3}}. Promo ini berlaku terbatas s/d {{4}}. Klaim sekarang sebelum berakhir!',
      footer: 'Syarat & Ketentuan berlaku',
      sampleVariables: { '{{1}}': 'Rian Pratama', '{{2}}': '30', '{{3}}': 'GAJIAN30', '{{4}}': '31 Agustus 2026' }
    },
    {
      id: 'otp',
      title: 'Verifikasi Kode OTP',
      badge: 'AUTHENTICATION',
      name: 'verifikasi_otp_v1',
      category: 'AUTHENTICATION',
      header: '',
      body: 'Kode verifikasi (OTP) keamanan Anda adalah: {{1}}. Jangan berikan kode ini kepada siapa pun termasuk pihak kami demi keamanan akun Anda. Berlaku {{2}} menit.',
      footer: 'Keamanan Akun WhatsApp',
      sampleVariables: { '{{1}}': '849201', '{{2}}': '5' }
    },
    {
      id: 'survey',
      title: 'Survei Kepuasan CS',
      badge: 'UTILITY',
      name: 'survei_kepuasan_layanan_v1',
      category: 'UTILITY',
      header: 'Survei Kepuasan Pelanggan',
      body: 'Halo {{1}}, terima kasih telah menghubungi layanan kami. Bagaimana kepuasan Anda terhadap bantuan yang diberikan oleh agen {{2}}? Nilai kami dari skala 1-5.',
      footer: 'Tanggapan Anda sangat berharga bagi kami',
      sampleVariables: { '{{1}}': 'Siti Aminah', '{{2}}': 'Andi' }
    }
  ];

  let templateList = $state<TemplateItem[]>([]);
  let isLoading = $state(true);
  let isSyncing = $state(false);
  let isSeeding = $state(false);
  let feedbackMessage = $state<{ text: string; type: 'success' | 'error' } | null>(null);

  // Search & Filter
  let searchQuery = $state('');
  let selectedCategoryFilter = $state<'ALL' | 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('ALL');
  let selectedStatusFilter = $state<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');

  // Modal State
  let showModal = $state(false);
  let modalMode = $state<'create' | 'edit'>('create');
  let editingId = $state<string | null>(null);
  let isSubmitting = $state(false);

  // Form Fields
  let formName = $state('');
  let formCategory = $state<'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('UTILITY');
  let formLanguage = $state('id');
  let formHeaderText = $state('');
  let formBodyText = $state('');
  let formFooterText = $state('');

  // Sample variable preview values
  let previewVars = $state<Record<string, string>>({
    '{{1}}': 'Budi Santoso',
    '{{2}}': 'INV-2026-08',
    '{{3}}': '350.000',
    '{{4}}': '1 September 2026'
  });

  // Copied indicator
  let copiedId = $state<string | null>(null);

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
    feedbackMessage = null;
    const res = await apiRequest<any>('/templates/sync', { method: 'POST' });
    isSyncing = false;
    if (res.success) {
      feedbackMessage = {
        text: res.message || 'Template berhasil disinkronkan dari Meta Graph API!',
        type: 'success'
      };
      if (res.items) {
        templateList = res.items;
      }
    } else {
      feedbackMessage = {
        text: res.error || 'Gagal menyinkronkan template dari Meta',
        type: 'error'
      };
    }
    setTimeout(() => (feedbackMessage = null), 4500);
  }

  async function seedSampleTemplates() {
    isSeeding = true;
    feedbackMessage = null;
    const res = await apiRequest<any>('/templates/samples', { method: 'POST' });
    isSeeding = false;
    if (res.success) {
      feedbackMessage = {
        text: res.message || 'Berhasil menambahkan sample template pesan siap pakai!',
        type: 'success'
      };
      if (res.items) {
        templateList = res.items;
      }
    } else {
      feedbackMessage = {
        text: res.error || 'Gagal memuat sample template',
        type: 'error'
      };
    }
    setTimeout(() => (feedbackMessage = null), 4500);
  }

  function openCreateModal() {
    modalMode = 'create';
    editingId = null;
    formName = '';
    formCategory = 'UTILITY';
    formLanguage = 'id';
    formHeaderText = '';
    formBodyText = '';
    formFooterText = '';
    showModal = true;
  }

  function openEditModal(tpl: TemplateItem) {
    modalMode = 'edit';
    editingId = tpl.id;
    formName = tpl.name;
    formCategory = tpl.category;
    formLanguage = tpl.language || 'id';
    
    // Extract components
    const headerComp = tpl.components?.find((c) => c.type === 'HEADER');
    const bodyComp = tpl.components?.find((c) => c.type === 'BODY');
    const footerComp = tpl.components?.find((c) => c.type === 'FOOTER');

    formHeaderText = headerComp?.text || '';
    formBodyText = bodyComp?.text || '';
    formFooterText = footerComp?.text || '';

    showModal = true;
  }

  function applyPreset(preset: SamplePreset) {
    if (modalMode === 'create') {
      formName = preset.name;
    }
    formCategory = preset.category;
    formHeaderText = preset.header;
    formBodyText = preset.body;
    formFooterText = preset.footer;
    previewVars = { ...previewVars, ...preset.sampleVariables };
  }

  async function handleSaveTemplate(e: Event) {
    e.preventDefault();
    if (!formBodyText.trim()) return;
    if (modalMode === 'create' && !formName.trim()) return;

    isSubmitting = true;

    // Assemble components
    const components: any[] = [];
    if (formHeaderText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: formHeaderText.trim()
      });
    }
    components.push({
      type: 'BODY',
      text: formBodyText.trim()
    });
    if (formFooterText.trim()) {
      components.push({
        type: 'FOOTER',
        text: formFooterText.trim()
      });
    }

    if (modalMode === 'create') {
      const res = await apiRequest('/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: formName.trim().toLowerCase().replace(/\s+/g, '_'),
          category: formCategory,
          language: formLanguage,
          components
        })
      });
      isSubmitting = false;

      if (res.success) {
        showModal = false;
        feedbackMessage = {
          text: `Template "${formName}" berhasil diajukan dan disimpan!`,
          type: 'success'
        };
        setTimeout(() => (feedbackMessage = null), 4000);
        loadTemplates();
      } else {
        feedbackMessage = {
          text: res.error || 'Gagal membuat template',
          type: 'error'
        };
        setTimeout(() => (feedbackMessage = null), 4000);
      }
    } else if (modalMode === 'edit' && editingId) {
      const res = await apiRequest(`/templates/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          category: formCategory,
          language: formLanguage,
          components
        })
      });
      isSubmitting = false;

      if (res.success) {
        showModal = false;
        feedbackMessage = {
          text: `Template "${formName}" berhasil diperbarui!`,
          type: 'success'
        };
        setTimeout(() => (feedbackMessage = null), 4000);
        loadTemplates();
      } else {
        feedbackMessage = {
          text: res.error || 'Gagal memperbarui template',
          type: 'error'
        };
        setTimeout(() => (feedbackMessage = null), 4000);
      }
    }
  }

  async function deleteTemplate(id: string, name: string) {
    if (!confirm(`Apakah Anda yakin ingin menghapus template "${name}"?`)) return;
    const res = await apiRequest(`/templates/${id}`, { method: 'DELETE' });
    if (res.success) {
      templateList = templateList.filter((t) => t.id !== id);
      feedbackMessage = {
        text: `Template "${name}" berhasil dihapus.`,
        type: 'success'
      };
      setTimeout(() => (feedbackMessage = null), 4000);
    } else {
      feedbackMessage = {
        text: res.error || 'Gagal menghapus template',
        type: 'error'
      };
      setTimeout(() => (feedbackMessage = null), 4000);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    copiedId = id;
    setTimeout(() => (copiedId = null), 2000);
  }

  // Render preview text with variables replaced or highlighted
  function renderPreview(text: string, isDynamic = false) {
    if (!text) return '';
    let result = text;
    if (isDynamic) {
      for (const [key, val] of Object.entries(previewVars)) {
        result = result.replaceAll(key, val);
      }
    }
    return result;
  }

  // Filtered Templates
  const filteredTemplates = $derived(
    templateList.filter((tpl) => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL' && tpl.category !== selectedCategoryFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'ALL' && tpl.status !== selectedStatusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = tpl.name.toLowerCase().includes(q);
        const bodyMatch = tpl.components?.some((c) => c.text?.toLowerCase().includes(q));
        return nameMatch || bodyMatch;
      }
      return true;
    })
  );

  onMount(() => {
    loadTemplates();
  });
</script>

<div class="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
  <!-- Header Bar -->
  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <div>
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <FileText class="w-5 h-5" />
        </div>
        <div>
          <h2 class="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Template Pesan WhatsApp</h2>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-mono">
              <Sparkles class="w-3 h-3" /> Meta Cloud API Sync
            </span>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              Total {templateList.length} template terdaftar
            </span>
          </div>
        </div>
      </div>
    </div>

    {#if authStore.role !== 'AGENT'}
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Button Seed Sample Templates -->
        <button
          onclick={seedSampleTemplates}
          disabled={isSeeding}
          class="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 border border-slate-300 dark:border-slate-700 transition cursor-pointer disabled:opacity-60"
          title="Tambahkan koleksi template contoh standar WhatsApp (Konfirmasi, Tagihan, Jadwal, Promo, OTP)"
        >
          <BookOpen class="w-3.5 h-3.5 text-indigo-500 {isSeeding ? 'animate-spin' : ''}" />
          <span>{isSeeding ? 'Memuat Sample...' : 'Muat Sample Otomatis'}</span>
        </button>

        <!-- Button Sync Meta -->
        <button
          onclick={syncFromMeta}
          disabled={isSyncing}
          class="py-2 px-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-60"
          title="Sinkronkan template langsung dari Meta WhatsApp Business Account"
        >
          <RefreshCw class="w-3.5 h-3.5 {isSyncing ? 'animate-spin text-emerald-500' : ''}" />
          <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan dari Meta'}</span>
        </button>

        <!-- Button Create Template -->
        <button
          onclick={openCreateModal}
          class="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Buat Template Baru</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Notification Banner -->
  {#if feedbackMessage}
    <div
      class="p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn {feedbackMessage.type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
        : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'}"
    >
      <div class="flex items-center gap-2.5">
        {#if feedbackMessage.type === 'success'}
          <CheckCircle class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        {:else}
          <XCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
        {/if}
        <span>{feedbackMessage.text}</span>
      </div>
      <button onclick={() => (feedbackMessage = null)} class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
        <X class="w-4 h-4" />
      </button>
    </div>
  {/if}

  <!-- Filters & Search Toolbar -->
  <div class="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
    <!-- Search Box -->
    <div class="relative flex-1 max-w-md">
      <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Cari nama template atau isi pesan..."
        class="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
      />
      {#if searchQuery}
        <button onclick={() => (searchQuery = '')} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
          <X class="w-3.5 h-3.5" />
        </button>
      {/if}
    </div>

    <!-- Category & Status Tabs -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Category Tabs -->
      <div class="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          onclick={() => (selectedCategoryFilter = 'ALL')}
          class="px-2.5 py-1 rounded-lg transition cursor-pointer {selectedCategoryFilter === 'ALL'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
        >
          Semua
        </button>
        <button
          onclick={() => (selectedCategoryFilter = 'UTILITY')}
          class="px-2.5 py-1 rounded-lg transition cursor-pointer {selectedCategoryFilter === 'UTILITY'
            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
        >
          Utility
        </button>
        <button
          onclick={() => (selectedCategoryFilter = 'MARKETING')}
          class="px-2.5 py-1 rounded-lg transition cursor-pointer {selectedCategoryFilter === 'MARKETING'
            ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
        >
          Marketing
        </button>
        <button
          onclick={() => (selectedCategoryFilter = 'AUTHENTICATION')}
          class="px-2.5 py-1 rounded-lg transition cursor-pointer {selectedCategoryFilter === 'AUTHENTICATION'
            ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
        >
          OTP
        </button>
      </div>

      <!-- Status Filter -->
      <select
        bind:value={selectedStatusFilter}
        class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
      >
        <option value="ALL">Semua Status</option>
        <option value="APPROVED">Disetujui (Approved)</option>
        <option value="PENDING">Menunggu (Pending)</option>
        <option value="REJECTED">Ditolak (Rejected)</option>
      </select>
    </div>
  </div>

  <!-- Templates Grid -->
  {#if isLoading}
    <div class="py-16 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
      <RefreshCw class="w-6 h-6 animate-spin text-emerald-500" />
      <span>Memuat daftar template...</span>
    </div>
  {:else if filteredTemplates.length === 0}
    <div class="p-12 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
      <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
        <FileText class="w-6 h-6" />
      </div>
      <div>
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200">
          {searchQuery ? 'Tidak ada template yang cocok' : 'Belum Ada Template WhatsApp'}
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
          {searchQuery
            ? 'Coba gunakan kata kunci pencarian lain atau reset filter kategori.'
            : 'Buat template pesan kustom atau klik tombol "Muat Sample Otomatis" untuk memasang template transaksi, notifikasi, dan promo siap pakai.'}
        </p>
      </div>

      {#if !searchQuery && authStore.role !== 'AGENT'}
        <div class="pt-2 flex items-center justify-center gap-2">
          <button
            onclick={seedSampleTemplates}
            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Muat Contoh Template Siap Pakai</span>
          </button>
          <button
            onclick={openCreateModal}
            class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>Buat Template Baru</span>
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each filteredTemplates as tpl (tpl.id)}
        {@const header = tpl.components?.find((c) => c.type === 'HEADER')?.text}
        {@const body = tpl.components?.find((c) => c.type === 'BODY')?.text || ''}
        {@const footer = tpl.components?.find((c) => c.type === 'FOOTER')?.text}

        <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-sm group">
          <div class="space-y-3">
            <!-- Card Header -->
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4 class="text-xs font-bold text-slate-900 dark:text-white font-mono">{tpl.name}</h4>
                  <button
                    onclick={() => copyToClipboard(tpl.name, `name-${tpl.id}`)}
                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                    title="Salin nama template"
                  >
                    {#if copiedId === `name-${tpl.id}`}
                      <Check class="w-3 h-3 text-emerald-500" />
                    {:else}
                      <Copy class="w-3 h-3" />
                    {/if}
                  </button>
                </div>
                
                <div class="flex items-center gap-1.5 flex-wrap">
                  <!-- Category Pill -->
                  <span
                    class="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase {tpl.category === 'UTILITY'
                      ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : tpl.category === 'MARKETING'
                        ? 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                        : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}"
                  >
                    {tpl.category}
                  </span>

                  <!-- Language Pill -->
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                    {tpl.language || 'id'}
                  </span>
                </div>
              </div>

              <!-- Status Pill -->
              {#if tpl.status === 'APPROVED'}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                  <CheckCircle class="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Disetujui
                </span>
              {:else if tpl.status === 'PENDING'}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                  <Clock class="w-3 h-3 text-amber-600 dark:text-amber-400" /> Menunggu
                </span>
              {:else}
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                  <XCircle class="w-3 h-3 text-rose-600 dark:text-rose-400" /> Ditolak
                </span>
              {/if}
            </div>

            <!-- WhatsApp Message Chat Bubble Box -->
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-300 font-sans space-y-2 relative">
              {#if header}
                <div class="font-bold text-slate-900 dark:text-white border-b border-slate-200/70 dark:border-slate-800/70 pb-1.5 text-xs">
                  {header}
                </div>
              {/if}

              <div class="leading-relaxed whitespace-pre-wrap">
                {body}
              </div>

              {#if footer}
                <div class="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                  {footer}
                </div>
              {/if}
            </div>
          </div>

          <!-- Card Footer Actions -->
          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Dibuat: {new Date(tpl.createdAt).toLocaleDateString('id-ID')}</span>

            {#if authStore.role !== 'AGENT'}
              <div class="flex items-center gap-1">
                <!-- Edit Button -->
                <button
                  onclick={() => openEditModal(tpl)}
                  class="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition cursor-pointer"
                  title="Ubah template pesan"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </button>

                <!-- Delete Button -->
                <button
                  onclick={() => deleteTemplate(tpl.id, tpl.name)}
                  class="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                  title="Hapus template"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal Create / Edit Template -->
{#if showModal}
  <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
    <div class="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {#if modalMode === 'create'}
              <Plus class="w-5 h-5" />
            {:else}
              <Pencil class="w-5 h-5" />
            {/if}
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              {modalMode === 'create' ? 'Buat Template Pesan Baru' : `Ubah Template: ${formName}`}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {modalMode === 'create'
                ? 'Daftarkan template WhatsApp resmi dengan format dan variabel dinamis'
                : 'Perbarui isi pesan, kategori, dan struktur komponen template'}
            </p>
          </div>
        </div>

        <button onclick={() => (showModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Quick Sample Presets (Available on Create Mode) -->
      {#if modalMode === 'create'}
        <div class="px-6 py-3 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Pilih dari Contoh Template Standar:
            </span>
            <span class="text-[10px] text-indigo-600 dark:text-indigo-400">Klik salah satu untuk otomatis mengisi</span>
          </div>

          <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {#each SAMPLE_PRESETS as preset}
              <button
                type="button"
                onclick={() => applyPreset(preset)}
                class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 shrink-0 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <span class="w-1.5 h-1.5 rounded-full {preset.badge === 'UTILITY' ? 'bg-blue-500' : preset.badge === 'MARKETING' ? 'bg-purple-500' : 'bg-amber-500'}"></span>
                <span>{preset.title}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Modal Body (Form & Live WhatsApp Preview) -->
      <form onsubmit={handleSaveTemplate} class="p-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Form Input Fields (Left 7 Cols) -->
          <div class="lg:col-span-7 space-y-4">
            <!-- Template Name & Language -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label for="f_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Template {modalMode === 'edit' ? '(Terkunci)' : '(Huruf kecil & underscore)'}
                </label>
                <input
                  id="f_name"
                  type="text"
                  bind:value={formName}
                  disabled={modalMode === 'edit'}
                  placeholder="e.g. konfirmasi_pesanan_v1"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                />
              </div>

              <div>
                <label for="f_lang" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Bahasa</label>
                <select
                  id="f_lang"
                  bind:value={formLanguage}
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="id">Indonesia (id)</option>
                  <option value="en_US">English (en_US)</option>
                </select>
              </div>
            </div>

            <!-- Meta Category -->
            <div>
              <label for="f_cat" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori Meta</label>
              <select
                id="f_cat"
                bind:value={formCategory}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="UTILITY">UTILITY — Transaksi, Resi, Konfirmasi, Janji Temu</option>
                <option value="MARKETING">MARKETING — Promosi, Penawaran Diskon, Produk Baru</option>
                <option value="AUTHENTICATION">AUTHENTICATION — Kode OTP, Verifikasi Keamanan Akun</option>
              </select>
            </div>

            <!-- Header Text (Optional) -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="f_hdr" class="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Header Judul (Opsional)
                </label>
                <span class="text-[10px] text-slate-400">Teks tebal di awal pesan</span>
              </div>
              <input
                id="f_hdr"
                type="text"
                bind:value={formHeaderText}
                placeholder="e.g. Konfirmasi Pesanan"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <!-- Body Message Text (Required) -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="f_body" class="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Isi Pesan / Body Text (Wajib)
                </label>
                <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  Gunakan &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; untuk variabel
                </span>
              </div>
              <textarea
                id="f_body"
                rows="5"
                bind:value={formBodyText}
                placeholder="Halo &#123;&#123;1&#125;&#125;, pesanan #&#123;&#123;2&#125;&#125; Anda sebesar Rp &#123;&#123;3&#125;&#125; telah kami terima."
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
                required
              ></textarea>
            </div>

            <!-- Footer Text (Optional) -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="f_ftr" class="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Footer / Catatan Kaki (Opsional)
                </label>
                <span class="text-[10px] text-slate-400">Teks kecil di bagian bawah</span>
              </div>
              <input
                id="f_ftr"
                type="text"
                bind:value={formFooterText}
                placeholder="e.g. Layanan Pelanggan Resmi WhatsApp"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <!-- Live WhatsApp Preview (Right 5 Cols) -->
          <div class="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Eye class="w-3.5 h-3.5 text-emerald-500" />
                  Pratinjau Pesan WhatsApp
                </span>
                <span class="text-[10px] font-mono text-slate-400">Live Preview</span>
              </div>

              <!-- WhatsApp Chat Phone Mockup Card -->
              <div class="rounded-2xl bg-[#0b141a] dark:bg-slate-950 border border-slate-800 p-4 shadow-inner min-h-[260px] flex flex-col justify-between">
                <!-- Chat Bubble -->
                <div class="bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-xs p-3.5 text-xs shadow-md space-y-2 border border-slate-700/50">
                  {#if formHeaderText}
                    <div class="font-bold text-white text-xs border-b border-slate-700 pb-1.5">
                      {formHeaderText}
                    </div>
                  {/if}

                  <div class="leading-relaxed whitespace-pre-wrap font-sans text-xs">
                    {#if formBodyText}
                      {renderPreview(formBodyText, true)}
                    {:else}
                      <span class="text-slate-500 italic">Isi template akan muncul di sini...</span>
                    {/if}
                  </div>

                  {#if formFooterText}
                    <div class="text-[10px] text-slate-400 pt-1 border-t border-slate-700/60">
                      {formFooterText}
                    </div>
                  {/if}

                  <div class="flex items-center justify-end gap-1 text-[9px] text-slate-400 pt-0.5">
                    <span>10:30</span>
                    <span class="text-[#53bdeb]">✓✓</span>
                  </div>
                </div>

                <!-- Simulation Variables Note -->
                <div class="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
                  <div class="font-bold text-slate-300 flex items-center gap-1">
                    <HelpCircle class="w-3 h-3 text-emerald-400" />
                    Variabel Pengujian Pratinjau:
                  </div>
                  <div class="grid grid-cols-2 gap-1 font-mono text-[9px]">
                    <div>&#123;&#123;1&#125;&#125; : {previewVars['{{1}}'] || 'Nama'}</div>
                    <div>&#123;&#123;2&#125;&#125; : {previewVars['{{2}}'] || 'Parameter 2'}</div>
                    <div>&#123;&#123;3&#125;&#125; : {previewVars['{{3}}'] || 'Parameter 3'}</div>
                    <div>&#123;&#123;4&#125;&#125; : {previewVars['{{4}}'] || 'Parameter 4'}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onclick={() => (showModal = false)}
                class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
              >
                <Send class="w-3.5 h-3.5" />
                <span>
                  {isSubmitting
                    ? 'Menyimpan...'
                    : modalMode === 'create'
                      ? 'Ajukan Template'
                      : 'Simpan Perubahan'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}
