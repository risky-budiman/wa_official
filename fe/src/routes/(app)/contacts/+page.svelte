<script lang="ts">
  import Alert from '$lib/components/ui/Alert.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { onMount } from 'svelte';
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import {
    Contact,
    Search,
    Plus,
    MessageSquare,
    Edit3,
    Trash2,
    X,
    UserPlus,
    Check,
    AlertCircle,
    Phone,
    Mail,
    Tag,
    Clock,
    RefreshCw,
    Sparkles,
    Zap,
    Send,
    Upload,
    Download,
    FileSpreadsheet
  } from 'lucide-svelte';
  import { parseCsv, buildCsv, downloadText } from '$lib/utils/csv';
  import SendSingleTemplateModal from '$lib/components/templates/SendSingleTemplateModal.svelte';

  interface ContactItem {
    id: string;
    organizationId: string;
    waId: string;
    name: string | null;
    email: string | null;
    customAttributes: Record<string, any> | null;
    createdAt: string;
    updatedAt: string;
  }

  let contactList = $state<ContactItem[]>([]);
  let isLoading = $state(false);
  let searchQuery = $state('');
  let currentPage = $state(1);
  let totalContacts = $state(0);
  let totalPages = $state(1);
  let successMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);

  // Modals state
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let selectedContact = $state<ContactItem | null>(null);

  // Add Contact Form State
  let newWaId = $state('');
  let newName = $state('');
  let newEmail = $state('');
  let newTag = $state('');
  let isSavingNew = $state(false);

  // Edit Contact Form State
  let editName = $state('');
  let editEmail = $state('');
  let editTag = $state('');
  let isSavingEdit = $state(false);

  // Send Template Modal State
  let showSendTemplateModal = $state(false);
  let selectedContactForTemplate = $state<ContactItem | null>(null);
  let approvedTemplates = $state<any[]>([]);

  async function loadApprovedTemplates() {
    const res = await apiRequest<{ items: any[] }>('/templates');
    if (res.success && res.items) {
      approvedTemplates = res.items.filter((t: any) => t.status === 'APPROVED');
    }
  }

  function openSendTemplateModal(contact: ContactItem) {
    selectedContactForTemplate = contact;
    showSendTemplateModal = true;
    if (approvedTemplates.length === 0) {
      loadApprovedTemplates();
    }
  }

  async function loadContacts(page = 1) {
    isLoading = true;
    errorMsg = null;
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: searchQuery.trim(),
      });
      const res = await apiRequest<any>(`/contacts?${queryParams.toString()}`);
      if (res.success) {
        contactList = res.contacts || [];
        currentPage = res.pagination.page;
        totalContacts = res.pagination.total;
        totalPages = res.pagination.totalPages || 1;
      } else {
        errorMsg = res.error || 'Gagal memuat daftar kontak';
      }
    } catch (err: any) {
      errorMsg = 'Terjadi kesalahan koneksi saat memuat kontak';
    } finally {
      isLoading = false;
    }
  }

  // Debounced search
  let searchTimeout: any;
  function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      loadContacts(1);
    }, 300);
  }

  async function handleCreateContact(e: Event) {
    e.preventDefault();
    if (!newWaId.trim()) return;

    isSavingNew = true;
    errorMsg = null;
    successMsg = null;

    const res = await apiRequest<any>('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        waId: newWaId.trim(),
        name: newName.trim() || undefined,
        email: newEmail.trim() || undefined,
        customAttributes: newTag.trim() ? { tag: newTag.trim() } : {},
      }),
    });

    isSavingNew = false;

    if (res.success) {
      showAddModal = false;
      newWaId = '';
      newName = '';
      newEmail = '';
      newTag = '';
      successMsg = res.message || 'Kontak baru berhasil ditambahkan!';
      await loadContacts(1);
      setTimeout(() => (successMsg = null), 4000);
    } else {
      errorMsg = res.error || 'Gagal menambahkan kontak baru';
    }
  }

  function openEditModal(c: ContactItem) {
    selectedContact = c;
    editName = c.name || '';
    editEmail = c.email || '';
    editTag = (c.customAttributes as any)?.tag || '';
    showEditModal = true;
  }

  async function handleUpdateContact(e: Event) {
    e.preventDefault();
    if (!selectedContact) return;

    isSavingEdit = true;
    errorMsg = null;
    successMsg = null;

    const res = await apiRequest<any>(`/contacts/${selectedContact.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editName.trim() || undefined,
        email: editEmail.trim() || null,
        // null removes the tag on the server
        customAttributes: { tag: editTag.trim() || null },
      }),
    });

    isSavingEdit = false;

    if (res.success) {
      showEditModal = false;
      successMsg = 'Informasi kontak berhasil diperbarui!';
      await loadContacts(currentPage);
      setTimeout(() => (successMsg = null), 4000);
    } else {
      errorMsg = res.error || 'Gagal memperbarui kontak';
    }
  }

  async function handleDeleteContact(c: ContactItem) {
    if (!confirm(`Hapus kontak "${c.name || c.waId}" beserta riwayat percakapannya?`)) return;

    errorMsg = null;
    successMsg = null;
    const res = await apiRequest<any>(`/contacts/${c.id}`, { method: 'DELETE' });

    if (res.success) {
      successMsg = 'Kontak berhasil dihapus';
      await loadContacts(currentPage);
      setTimeout(() => (successMsg = null), 4000);
    } else {
      errorMsg = res.error || 'Gagal menghapus kontak';
    }
  }

  // ─── Import / export (Admin & Supervisor) ───
  const canManage = $derived(authStore.role === 'ADMINISTRATOR' || authStore.role === 'SUPERVISOR');
  let showImportModal = $state(false);
  let importFileName = $state('');
  let importRows = $state<{ waId: string; name: string; email: string; tag: string }[]>([]);
  let importError = $state<string | null>(null);
  let importUpdateExisting = $state(false);
  let isImporting = $state(false);
  let isExporting = $state(false);
  let importResult = $state<{
    created: number;
    updated: number;
    skipped: number;
    duplicatesInFile: number;
    errorCount: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  const HEADER_ALIASES: Record<string, 'waId' | 'name' | 'email' | 'tag'> = {
    nomor: 'waId', nomor_whatsapp: 'waId', no: 'waId', no_hp: 'waId', hp: 'waId', telepon: 'waId', phone: 'waId',
    whatsapp: 'waId', wa: 'waId', wa_id: 'waId', waid: 'waId', nomor_wa: 'waId', no_wa: 'waId', number: 'waId',
    nama: 'name', name: 'name', nama_lengkap: 'name',
    email: 'email', 'e-mail': 'email', surel: 'email',
    tag: 'tag', label: 'tag', kategori: 'tag',
  };

  function openImport() {
    importFileName = '';
    importRows = [];
    importError = null;
    importResult = null;
    importUpdateExisting = false;
    showImportModal = true;
  }

  async function handleImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    importRows = [];
    importError = null;
    importResult = null;
    if (!file) return;
    importFileName = file.name;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      importError = 'Gunakan file .csv. Dari Excel: File → Save As → CSV (UTF-8).';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      importError = 'File terlalu besar (maksimal 5 MB).';
      return;
    }
    const table = parseCsv(await file.text());
    if (table.length < 2) {
      importError = 'File kosong atau hanya berisi judul kolom.';
      return;
    }
    const header = table[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const cols = header.map((h) => HEADER_ALIASES[h]);
    if (!cols.includes('waId')) {
      importError = 'Kolom nomor tidak ditemukan. Baris pertama harus berisi judul kolom, misalnya: nomor_whatsapp, nama, email, tag.';
      return;
    }
    importRows = table.slice(1).map((cells) => {
      const row = { waId: '', name: '', email: '', tag: '' };
      cells.forEach((c, i) => {
        const key = cols[i];
        if (key) row[key] = c.trim();
      });
      return row;
    });
    if (importRows.length > 5000) {
      importError = `File berisi ${importRows.length.toLocaleString('id-ID')} baris. Maksimal 5.000 per impor.`;
      importRows = [];
    }
  }

  async function submitImport() {
    if (importRows.length === 0) return;
    isImporting = true;
    importError = null;
    const res = await apiRequest<any>('/contacts/import', {
      method: 'POST',
      body: JSON.stringify({ rows: importRows, updateExisting: importUpdateExisting }),
    });
    isImporting = false;
    if (!res.success) {
      importError = res.error || 'Impor gagal';
      return;
    }
    importResult = res as any;
    importRows = [];
    await loadContacts(1);
  }

  function downloadTemplate() {
    downloadText(
      'template-impor-kontak.csv',
      buildCsv(['nomor_whatsapp', 'nama', 'email', 'tag'], [['081234567890', 'Budi Santoso', 'budi@contoh.com', 'VIP']])
    );
  }

  async function exportContacts() {
    isExporting = true;
    const res = await apiRequest<any>('/contacts/export');
    isExporting = false;
    if (!res.success) {
      errorMsg = res.error || 'Gagal mengekspor kontak';
      return;
    }
    const list: any[] = res.contacts || [];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(
      `kontak-${stamp}.csv`,
      buildCsv(
        ['nomor_whatsapp', 'nama', 'email', 'tag', 'dibuat'],
        list.map((c) => [c.waId, c.name || '', c.email || '', c.customAttributes?.tag || '', c.createdAt ? new Date(c.createdAt).toLocaleString('id-ID') : ''])
      )
    );
    successMsg = `${list.length.toLocaleString('id-ID')} kontak diekspor.`;
    setTimeout(() => (successMsg = null), 4000);
  }

  function formatWaId(waId: string) {
    if (waId.startsWith('62') && waId.length >= 11) {
      return `+62 ${waId.slice(2, 5)}-${waId.slice(5, 9)}-${waId.slice(9)}`;
    }
    return `+${waId}`;
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  onMount(() => {
    loadContacts(1);
    loadApprovedTemplates();
  });
</script>

<div class="ui-page">
  <PageHeader
    title="Kontak Pelanggan"
    description="Database pelanggan Anda. Pelanggan baru tersimpan otomatis saat pertama kali mengirim pesan WhatsApp."
    icon={Contact}
  >
    {#snippet actions()}
      <button onclick={() => loadContacts(currentPage)} class="ui-btn-secondary px-2.5" title="Muat ulang" aria-label="Muat ulang">
        <RefreshCw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
      </button>
      {#if canManage}
        <button onclick={exportContacts} class="ui-btn-secondary" disabled={isExporting}>
          <Download class="h-4 w-4" />
          {isExporting ? 'Mengekspor…' : 'Ekspor'}
        </button>
        <button onclick={openImport} class="ui-btn-secondary">
          <Upload class="h-4 w-4" />
          Impor CSV
        </button>
      {/if}
      <button onclick={() => (showAddModal = true)} class="ui-btn-primary">
        <Plus class="h-4 w-4" />
        Tambah Kontak
      </button>
    {/snippet}
  </PageHeader>

  <!-- Notification Banners -->
  {#if successMsg}
    <Alert tone="success" message={successMsg} />
  {/if}

  {#if errorMsg}
    <Alert tone="error" message={errorMsg} />
  {/if}

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <StatCard label="Total Kontak" value={totalContacts} icon={Contact} tone="emerald" />
    <StatCard label="Perekaman Otomatis" icon={Sparkles} tone="blue" hint="Kontak baru tersimpan dari webhook Meta">
      <span class="inline-flex items-center gap-1.5 text-base font-semibold text-emerald-600 dark:text-emerald-400">
        <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Aktif
      </span>
    </StatCard>
    <StatCard label="Kanal Pengirim" icon={Phone} tone="violet" hint="WhatsApp Business Platform">
      <span class="text-base font-semibold">Meta WhatsApp Official</span>
    </StatCard>
  </div>

  <!-- Search Bar & Filters -->
  <div class="ui-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div class="relative flex-1 max-w-md">
      <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        bind:value={searchQuery}
        oninput={handleSearchInput}
        placeholder="Cari berdasarkan nama, nomor WhatsApp (+62), atau email..."
        class="ui-input pl-10"
      />
    </div>

    <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold">
      Menampilkan {contactList.length} dari {totalContacts} kontak
    </div>
  </div>

  <!-- Contacts Table -->
  <div class="ui-card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="ui-table w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            <th class="py-3.5 px-4">Nama Pelanggan</th>
            <th class="py-3.5 px-4">Nomor WhatsApp</th>
            <th class="py-3.5 px-4">Email</th>
            <th class="py-3.5 px-4">Tag / Segmen</th>
            <th class="py-3.5 px-4">Terdaftar Sejak</th>
            <th class="py-3.5 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
          {#if isLoading}
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-400">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Memuat data kontak...</span>
                </div>
              </td>
            </tr>
          {:else if contactList.length === 0}
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-400">
                <Contact class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p class="font-bold text-slate-700 dark:text-slate-300">Belum ada kontak terdaftar</p>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  Kontak akan otomatis muncul di sini saat pelanggan mengirim pesan pertama ke nomor WhatsApp resmi Anda.
                </p>
              </td>
            </tr>
          {:else}
            {#each contactList as contact}
              {@const tag = (contact.customAttributes as any)?.tag}
              <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group">
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center uppercase text-xs shrink-0">
                      {contact.name?.charAt(0) || 'P'}
                    </div>
                    <span class="font-bold text-slate-900 dark:text-white">
                      {contact.name || 'Pelanggan WhatsApp'}
                    </span>
                  </div>
                </td>

                <td class="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                  {formatWaId(contact.waId)}
                </td>

                <td class="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                  {contact.email || '-'}
                </td>

                <td class="py-3.5 px-4">
                  {#if tag}
                    <span class="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                      {tag}
                    </span>
                  {:else}
                    <span class="text-slate-400">-</span>
                  {/if}
                </td>

                <td class="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                  {formatDate(contact.createdAt)}
                </td>

                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                    <button
                      onclick={() => openSendTemplateModal(contact)}
                      class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer flex items-center gap-1 font-bold text-[11px]"
                      title="Kirim pesan template instan ke nomor ini"
                    >
                      <Zap class="w-3.5 h-3.5 fill-current" />
                      <span class="hidden sm:inline">Kirim Template</span>
                    </button>

                    <button
                      onclick={() => goto('/inbox')}
                      class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      title="Buka Chat di Inbox"
                    >
                      <MessageSquare class="w-3.5 h-3.5" />
                    </button>

                    <button
                      onclick={() => openEditModal(contact)}
                      class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      title="Edit Kontak"
                    >
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>

                    {#if authStore.role === 'ADMINISTRATOR' || authStore.role === 'SUPERVISOR'}
                      <button
                        onclick={() => handleDeleteContact(contact)}
                        class="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                        title="Hapus Kontak"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination Footer -->
    {#if totalPages > 1}
      <div class="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <button
          onclick={() => loadContacts(currentPage - 1)}
          disabled={currentPage <= 1}
          class="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Sebelumnya
        </button>

        <span class="text-slate-500 dark:text-slate-400 font-semibold">
          Halaman {currentPage} dari {totalPages}
        </span>

        <button
          onclick={() => loadContacts(currentPage + 1)}
          disabled={currentPage >= totalPages}
          class="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Berikutnya
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- Modal Tambah Kontak Baru -->
{#if showAddModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserPlus class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Tambah Kontak Pelanggan Baru
        </h3>
        <button onclick={() => (showAddModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleCreateContact} class="space-y-4 text-xs">
        <div>
          <label for="new_wa_id" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nomor WhatsApp Pelanggan (Format: 62812... / 0812...) <span class="text-rose-500">*</span>
          </label>
          <input
            id="new_wa_id"
            type="text"
            bind:value={newWaId}
            placeholder="e.g. 6281234567890"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <label for="new_name" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nama Pelanggan
          </label>
          <input
            id="new_name"
            type="text"
            bind:value={newName}
            placeholder="e.g. Rian Pratama"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label for="new_email" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Email Pelanggan (Opsional)
          </label>
          <input
            id="new_email"
            type="email"
            bind:value={newEmail}
            placeholder="e.g. rian@example.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label for="new_tag" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tag / Label Segmen (Opsional)
          </label>
          <input
            id="new_tag"
            type="text"
            bind:value={newTag}
            placeholder="e.g. VIP Member, Reseller, Hot Lead"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onclick={() => (showAddModal = false)}
            class="py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSavingNew}
            class="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
          >
            {isSavingNew ? 'Menyimpan...' : 'Simpan Kontak'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal Edit Kontak -->
{#if showEditModal && selectedContact}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Edit3 class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Edit Data Kontak
        </h3>
        <button onclick={() => (showEditModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleUpdateContact} class="space-y-4 text-xs">
        <div>
          <label for="edit_wa" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nomor WhatsApp (Terkunci)
          </label>
          <input
            id="edit_wa"
            type="text"
            disabled
            value={formatWaId(selectedContact.waId)}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 font-mono"
          />
        </div>

        <div>
          <label for="edit_name" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nama Pelanggan
          </label>
          <input
            id="edit_name"
            type="text"
            bind:value={editName}
            placeholder="e.g. Rian Pratama"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <label for="edit_email" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Email Pelanggan
          </label>
          <input
            id="edit_email"
            type="email"
            bind:value={editEmail}
            placeholder="e.g. rian@example.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label for="edit_tag" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tag / Label Segmen
          </label>
          <input
            id="edit_tag"
            type="text"
            bind:value={editTag}
            placeholder="e.g. VIP Member, Reseller, Hot Lead"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onclick={() => (showEditModal = false)}
            class="py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSavingEdit}
            class="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
          >
            {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal Impor Kontak -->
{#if showImportModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Impor kontak">
    <div class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"><FileSpreadsheet class="h-5 w-5" /></span>
          <div>
            <h3 class="text-base font-semibold text-slate-900 dark:text-white">Impor kontak dari CSV</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Maksimal 5.000 kontak per file.</p>
          </div>
        </div>
        <button type="button" class="ui-icon-btn" aria-label="Tutup" onclick={() => (showImportModal = false)}><X class="h-4 w-4" /></button>
      </div>

      {#if importResult}
        <div class="space-y-3">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10"><p class="text-xl font-semibold text-emerald-700 dark:text-emerald-300">{importResult.created}</p><p class="text-[11px] text-slate-500">Ditambahkan</p></div>
            <div class="rounded-xl bg-sky-50 p-3 dark:bg-sky-500/10"><p class="text-xl font-semibold text-sky-700 dark:text-sky-300">{importResult.updated}</p><p class="text-[11px] text-slate-500">Diperbarui</p></div>
            <div class="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p class="text-xl font-semibold text-slate-700 dark:text-slate-200">{importResult.skipped + importResult.duplicatesInFile}</p><p class="text-[11px] text-slate-500">Dilewati</p></div>
          </div>
          {#if importResult.errorCount > 0}
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <p class="mb-1 font-semibold">{importResult.errorCount} baris tidak diimpor:</p>
              <ul class="max-h-32 space-y-0.5 overflow-y-auto">
                {#each importResult.errors as er}<li>Baris {er.row}: {er.reason}</li>{/each}
              </ul>
            </div>
          {/if}
          <div class="flex justify-end"><button type="button" class="ui-btn-primary" onclick={() => (showImportModal = false)}>Selesai</button></div>
        </div>
      {:else}
        <ol class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
          <li>1. Baris pertama berisi judul kolom: <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">nomor_whatsapp</code> (wajib), <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">nama</code>, <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">email</code>, <code class="rounded bg-slate-100 px-1 dark:bg-slate-800">tag</code>.</li>
          <li>2. Nomor boleh ditulis 0812…, 812… atau +62 812….</li>
          <li>3. Dari Excel: <em>File → Save As → CSV UTF-8</em>.</li>
        </ol>
        <button type="button" onclick={downloadTemplate} class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          <Download class="h-3.5 w-3.5" /> Unduh template CSV
        </button>

        <label class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center hover:border-emerald-400 dark:border-slate-700">
          <Upload class="h-6 w-6 text-slate-400" />
          <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{importFileName || 'Pilih file CSV'}</span>
          <span class="text-xs text-slate-500">{importRows.length > 0 ? `${importRows.length.toLocaleString('id-ID')} baris siap diimpor` : 'Klik untuk memilih file'}</span>
          <input type="file" accept=".csv,text/csv" class="sr-only" onchange={handleImportFile} />
        </label>

        {#if importRows.length > 0}
          <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 dark:bg-slate-800/60"><tr><th class="px-3 py-2">Nomor</th><th class="px-3 py-2">Nama</th><th class="px-3 py-2">Tag</th></tr></thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                {#each importRows.slice(0, 4) as row}
                  <tr><td class="px-3 py-1.5 font-mono">{row.waId}</td><td class="px-3 py-1.5">{row.name}</td><td class="px-3 py-1.5">{row.tag}</td></tr>
                {/each}
              </tbody>
            </table>
            {#if importRows.length > 4}<p class="bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500 dark:bg-slate-800/60">+ {(importRows.length - 4).toLocaleString('id-ID')} baris lainnya</p>{/if}
          </div>
          <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" bind:checked={importUpdateExisting} class="rounded" />
            Perbarui nama/email/tag kontak yang nomornya sudah ada
          </label>
        {/if}

        {#if importError}<Alert tone="error" message={importError} />{/if}

        <div class="flex justify-end gap-2">
          <button type="button" class="ui-btn-secondary" onclick={() => (showImportModal = false)}>Batal</button>
          <button type="button" class="ui-btn-primary" disabled={importRows.length === 0 || isImporting} onclick={submitImport}>
            {isImporting ? 'Mengimpor…' : `Impor ${importRows.length ? importRows.length.toLocaleString('id-ID') + ' kontak' : ''}`}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Modal Kirim Single Template -->
<SendSingleTemplateModal
  bind:isOpen={showSendTemplateModal}
  templates={approvedTemplates}
  initialPhoneNumber={selectedContactForTemplate?.waId || ''}
  initialContactName={selectedContactForTemplate?.name || ''}
  onClose={() => {
    showSendTemplateModal = false;
  }}
  onSuccess={() => {
    successMsg = 'Pesan template berhasil terkirim!';
    setTimeout(() => (successMsg = null), 4500);
  }}
/>
