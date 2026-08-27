<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { onMount } from 'svelte';
  import {
    Users,
    UserPlus,
    Shield,
    Mail,
    CheckCircle,
    XCircle,
    Trash2,
    X,
    Edit3,
    Check,
    AlertCircle,
    Radio,
    CircleDot,
    Lock,
    RefreshCw
  } from 'lucide-svelte';
  import RoleBadge from '$lib/components/layout/RoleBadge.svelte';

  interface UserItem {
    id: string;
    fullName: string;
    email: string;
    role: 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT';
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    isOnline: boolean;
    maxActiveChats: number | null;
    createdAt: string;
    team: { id: string; name: string } | null;
  }

  let userList = $state<UserItem[]>([]);
  let isLoading = $state(true);
  let successMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);

  // Modals state
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let selectedUser = $state<UserItem | null>(null);

  // Add User State
  let newName = $state('');
  let newEmail = $state('');
  let newPassword = $state('');
  let newRole = $state<'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT'>('AGENT');
  let isSubmitting = $state(false);

  // Edit User State
  let editName = $state('');
  let editEmail = $state('');
  let editRole = $state<'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT'>('AGENT');
  let editStatus = $state<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  let editIsOnline = $state(false);
  let editMaxChats = $state(10);
  let editPassword = $state('');
  let isUpdating = $state(false);

  // Stats
  const onlineCount = $derived(userList.filter(u => u.isOnline).length);
  const offlineCount = $derived(userList.filter(u => !u.isOnline).length);

  async function loadUsers() {
    isLoading = true;
    errorMsg = null;
    const res = await apiRequest<{ items: UserItem[] }>('/users');
    isLoading = false;
    if (res.success && res.items) {
      userList = res.items;
    } else {
      errorMsg = res.error || 'Gagal memuat data pengguna';
    }
  }

  async function createUser(e: Event) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    isSubmitting = true;
    errorMsg = null;
    successMsg = null;

    const res = await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        fullName: newName.trim(),
        email: newEmail.trim(),
        password: newPassword.trim() || 'admin12345',
        role: newRole,
      }),
    });
    isSubmitting = false;

    if (res.success) {
      showAddModal = false;
      newName = '';
      newEmail = '';
      newPassword = '';
      newRole = 'AGENT';
      successMsg = 'Pengguna baru berhasil ditambahkan!';
      await loadUsers();
      setTimeout(() => (successMsg = null), 4000);
    } else {
      errorMsg = res.error || 'Gagal menambahkan pengguna baru';
    }
  }

  function openEditModal(u: UserItem) {
    selectedUser = u;
    editName = u.fullName;
    editEmail = u.email;
    editRole = u.role;
    editStatus = u.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
    editIsOnline = Boolean(u.isOnline);
    editMaxChats = u.maxActiveChats || 10;
    editPassword = '';
    showEditModal = true;
  }

  async function handleUpdateUser(e: Event) {
    e.preventDefault();
    if (!selectedUser) return;

    isUpdating = true;
    errorMsg = null;
    successMsg = null;

    const payload: any = {
      fullName: editName.trim(),
      email: editEmail.trim(),
      role: editRole,
      status: editStatus,
      isOnline: editIsOnline,
      maxActiveChats: Number(editMaxChats),
    };

    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    const res = await apiRequest(`/users/${selectedUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    isUpdating = false;

    if (res.success) {
      showEditModal = false;
      successMsg = 'Data pengguna berhasil diperbarui!';
      await loadUsers();
      setTimeout(() => (successMsg = null), 4000);
    } else {
      errorMsg = res.error || 'Gagal memperbarui data pengguna';
    }
  }

  async function toggleOnlineStatus(u: UserItem) {
    const targetStatus = !u.isOnline;
    // Optimistic UI update
    u.isOnline = targetStatus;

    const res = await apiRequest(`/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isOnline: targetStatus }),
    });

    if (!res.success) {
      // Revert on error
      u.isOnline = !targetStatus;
      errorMsg = res.error || 'Gagal mengubah status online';
      setTimeout(() => (errorMsg = null), 3000);
    }
  }

  async function deleteUser(u: UserItem) {
    if (!confirm(`Apakah Anda yakin ingin menghapus pengguna "${u.fullName}"?`)) return;

    errorMsg = null;
    successMsg = null;
    const res = await apiRequest(`/users/${u.id}`, { method: 'DELETE' });

    if (res.success) {
      userList = userList.filter((item) => item.id !== u.id);
      successMsg = 'Pengguna berhasil dihapus';
      setTimeout(() => (successMsg = null), 4000);
    } else {
      errorMsg = res.error || 'Gagal menghapus pengguna';
    }
  }

  onMount(() => {
    loadUsers();
  });
</script>

<div class="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
  <!-- Header & Actions -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h2 class="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <Users class="w-4 h-4" />
        </div>
        Manajemen Tim & Pengguna (RBAC)
      </h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Kelola anggota tim, edit hak akses peran (Admin/SPV/Agent), dan atur status Online/Offline agen.
      </p>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        onclick={loadUsers}
        class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 transition cursor-pointer"
        title="Muat Ulang"
      >
        <RefreshCw class="w-4 h-4 {isLoading ? 'animate-spin' : ''}" />
      </button>

      <button
        onclick={() => (showAddModal = true)}
        class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30 transition cursor-pointer"
      >
        <UserPlus class="w-4 h-4" />
        Tambah Pengguna Baru
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
        <Users class="w-6 h-6" />
      </div>
      <div>
        <span class="text-slate-500 dark:text-slate-400 text-xs font-semibold block">Total Anggota Tim</span>
        <span class="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 block">{userList.length}</span>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
      <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
        <CircleDot class="w-6 h-6" />
      </div>
      <div>
        <span class="text-slate-500 dark:text-slate-400 text-xs font-semibold block">Agen Online (Siap Melayani)</span>
        <span class="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{onlineCount}</span>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
      <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
        <Radio class="w-6 h-6" />
      </div>
      <div>
        <span class="text-slate-500 dark:text-slate-400 text-xs font-semibold block">Agen Offline</span>
        <span class="text-xl font-extrabold text-slate-600 dark:text-slate-300 mt-0.5 block">{offlineCount}</span>
      </div>
    </div>
  </div>

  <!-- Users Table Card -->
  <div class="bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            <th class="py-3.5 px-4">Nama Lengkap</th>
            <th class="py-3.5 px-4">Email Resmi</th>
            <th class="py-3.5 px-4">Peran (Role)</th>
            <th class="py-3.5 px-4">Status Online / Offline</th>
            <th class="py-3.5 px-4">Status Akun</th>
            <th class="py-3.5 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
          {#if isLoading}
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-400">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Memuat daftar anggota tim...</span>
                </div>
              </td>
            </tr>
          {:else if userList.length === 0}
            <tr>
              <td colspan="6" class="py-12 text-center text-slate-400">
                <Users class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p class="font-bold text-slate-700 dark:text-slate-300">Belum ada pengguna terdaftar</p>
              </td>
            </tr>
          {:else}
            {#each userList as u}
              <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group">
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="relative w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center uppercase text-xs shrink-0">
                      {u.fullName.charAt(0)}
                      <!-- Online Dot Indicator on Avatar -->
                      <span
                        class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 {u.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}"
                        title={u.isOnline ? 'Online' : 'Offline'}
                      ></span>
                    </div>
                    <span class="font-bold text-slate-900 dark:text-white">
                      {u.fullName}
                    </span>
                  </div>
                </td>

                <td class="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  {u.email}
                </td>

                <td class="py-3.5 px-4">
                  <RoleBadge role={u.role} />
                </td>

                <!-- Toggle Online / Offline Switch -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-2.5">
                    <button
                      type="button"
                      onclick={() => toggleOnlineStatus(u)}
                      class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {u.isOnline ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}"
                      title="Klik untuk mengubah status Online / Offline"
                    >
                      <span
                        class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {u.isOnline ? 'translate-x-4' : 'translate-x-0'}"
                      ></span>
                    </button>
                    <span class="text-[11px] font-bold {u.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">
                      {u.isOnline ? '🟢 Online' : '⚪ Offline'}
                    </span>
                  </div>
                </td>

                <td class="py-3.5 px-4">
                  {#if u.status === 'ACTIVE'}
                    <span class="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                      <CheckCircle class="w-3.5 h-3.5" /> Aktif
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 text-slate-400 font-bold text-[11px]">
                      <XCircle class="w-3.5 h-3.5" /> Nonaktif
                    </span>
                  {/if}
                </td>

                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                    <button
                      onclick={() => openEditModal(u)}
                      class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      title="Edit Pengguna"
                    >
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>

                    <button
                      onclick={() => deleteUser(u)}
                      class="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
                      title="Hapus Pengguna"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Modal Tambah Pengguna Baru -->
{#if showAddModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserPlus class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Tambah Pengguna Baru
        </h3>
        <button onclick={() => (showAddModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={createUser} class="space-y-4 text-xs">
        <div>
          <label for="new_user_name" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
          <input
            id="new_user_name"
            type="text"
            bind:value={newName}
            placeholder="e.g. Hendra Wijaya"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <label for="new_user_email" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Resmi</label>
          <input
            id="new_user_email"
            type="email"
            bind:value={newEmail}
            placeholder="hendra@perusahaan.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <label for="new_user_pwd" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kata Sandi (Default: admin12345)</label>
          <input
            id="new_user_pwd"
            type="password"
            bind:value={newPassword}
            placeholder="••••••••"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label for="new_user_role" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Peran (Role RBAC)</label>
          <select
            id="new_user_role"
            bind:value={newRole}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="AGENT">AGENT (Hanya melihat obrolan yang ditugaskan)</option>
            <option value="SUPERVISOR">SUPERVISOR (Melihat & memantau seluruh obrolan tim)</option>
            <option value="ADMINISTRATOR">ADMINISTRATOR (Akses penuh sistem & pengaturan)</option>
          </select>
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
            disabled={isSubmitting}
            class="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
          >
            {isSubmitting ? 'Menyimpan...' : 'Simpan Pengguna'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal Edit Pengguna -->
{#if showEditModal && selectedUser}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Edit3 class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Edit Data Pengguna
        </h3>
        <button onclick={() => (showEditModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleUpdateUser} class="space-y-4 text-xs">
        <div>
          <label for="edit_user_name" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
          <input
            id="edit_user_name"
            type="text"
            bind:value={editName}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div>
          <label for="edit_user_email" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Resmi</label>
          <input
            id="edit_user_email"
            type="email"
            bind:value={editEmail}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="edit_user_role" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Peran (Role)</label>
            <select
              id="edit_user_role"
              bind:value={editRole}
              class="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="AGENT">AGENT</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
              <option value="ADMINISTRATOR">ADMINISTRATOR</option>
            </select>
          </div>

          <div>
            <label for="edit_user_status" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status Akun</label>
            <select
              id="edit_user_status"
              bind:value={editStatus}
              class="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>
        </div>

        <!-- Online / Offline Switch in Edit Modal -->
        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span class="block font-semibold text-slate-800 dark:text-slate-200">Status Ketersediaan (Online)</span>
            <span class="text-[11px] text-slate-500 dark:text-slate-400">Izinkan menerima penugasan chat otomatis</span>
          </div>
          <button
            type="button"
            onclick={() => (editIsOnline = !editIsOnline)}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {editIsOnline ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}"
            title="Ubah status ketersediaan online"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {editIsOnline ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>

        <div>
          <label for="edit_user_pwd" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Ganti Kata Sandi (Kosongkan jika tidak ingin mengubah)
          </label>
          <input
            id="edit_user_pwd"
            type="password"
            bind:value={editPassword}
            placeholder="Masukkan kata sandi baru..."
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
            disabled={isUpdating}
            class="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
          >
            {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
