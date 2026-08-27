<script lang="ts">
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
    Sparkles
  } from 'lucide-svelte';

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
        customAttributes: {
          ...(selectedContact.customAttributes || {}),
          tag: editTag.trim() || undefined,
        },
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
  });
</script>

<div class="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
  <!-- Top Header & Actions -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <Contact class="w-4 h-4" />
        </div>
        Kontak Pelanggan (CRM)
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Kelola database kontak pelanggan. Pelanggan baru otomatis tersimpan saat pertama kali mengirim pesan WhatsApp.
      </p>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        onclick={() => loadContacts(currentPage)}
        class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 transition cursor-pointer"
        title="Muat Ulang"
      >
        <RefreshCw class="w-4 h-4 {isLoading ? 'animate-spin' : ''}" />
      </button>

      <button
        onclick={() => (showAddModal = true)}
        class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30 transition cursor-pointer"
      >
        <Plus class="w-4 h-4" />
        Tambah Kontak Baru
      </button>
    </div>
  </div>

  <!-- Notification Banners -->
  {#if successMsg}
    <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold shadow-sm">
      <Check class="w-4 h-4 shrink-0 text-emerald-600" />
      <span>{successMsg}</span>
    </div>
  {/if}

  {#if errorMsg}
    <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 font-bold shadow-sm">
      <AlertCircle class="w-4 h-4 shrink-0 text-rose-600" />
      <span>{errorMsg}</span>
    </div>
  {/if}

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="bg-white dark:bg-slate-900/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
      <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
        <Contact class="w-6 h-6" />
      </div>
      <div>
        <span class="text-slate-500 dark:text-slate-400 text-xs font-semibold block">Total Kontak CRM</span>
        <span class="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 block">{totalContacts}</span>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
      <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
        <Sparkles class="w-6 h-6" />
      </div>
      <div>
        <span class="text-slate-500 dark:text-slate-400 text-xs font-semibold block">Perekaman Otomatis</span>
        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">🟢 Aktif (Meta Webhook)</span>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
      <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shrink-0">
        <Phone class="w-6 h-6" />
      </div>
      <div>
        <span class="text-slate-500 dark:text-slate-400 text-xs font-semibold block">Kanal Pengirim</span>
        <span class="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block">Meta WhatsApp Official</span>
      </div>
    </div>
  </div>

  <!-- Search Bar & Filters -->
  <div class="bg-white dark:bg-slate-900/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div class="relative flex-1 max-w-md">
      <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        bind:value={searchQuery}
        oninput={handleSearchInput}
        placeholder="Cari berdasarkan nama, nomor WhatsApp (+62), atau email..."
        class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
      />
    </div>

    <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold">
      Menampilkan {contactList.length} dari {totalContacts} kontak
    </div>
  </div>

  <!-- Contacts Table -->
  <div class="bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
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
                      onclick={() => goto('/inbox')}
                      class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
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
