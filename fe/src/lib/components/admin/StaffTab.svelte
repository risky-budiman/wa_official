<script lang="ts">
  import { apiRequest } from "$lib/api/client";
  import { authStore } from "$lib/stores/auth.svelte";

  import RoleBadge from "$lib/components/layout/RoleBadge.svelte";
  import {
    Plus,
    Search,
    RefreshCw,
    Shield,
    Users,
    Edit3,
    Trash2,
    Key,
    X,
    Check,
    Wallet,
    Network,
    ShieldCheck,
  } from "lucide-svelte";
  import type { PlatformStaffItem } from "$lib/admin/types";
  import { portal } from "$lib/admin/portal.svelte";

  let staffLoading = $state(false);
  let staffSearchQuery = $state("");
  let staffSelectedRole = $state<string>("ALL");

  let showCreateStaffModal = $state(false);
  let showEditStaffModal = $state(false);
  let showResetStaffPasswordModal = $state(false);
  let showDeleteStaffModal = $state(false);
  let activeStaff = $state<PlatformStaffItem | null>(null);

  let newStaffName = $state("");
  let newStaffEmail = $state("");
  let newStaffPassword = $state("");

  let newStaffRole = $state<"SUPER_ADMIN" | "CO_SUPER_ADMIN" | "ADMIN_FINANCE" | "ADMIN_SUPPORT">(
    "CO_SUPER_ADMIN",
  );

  let editStaffName = $state("");
  let editStaffEmail = $state("");

  let editStaffRole = $state<"SUPER_ADMIN" | "CO_SUPER_ADMIN" | "ADMIN_FINANCE" | "ADMIN_SUPPORT">(
    "CO_SUPER_ADMIN",
  );

  let editStaffStatus = $state<"ACTIVE" | "INACTIVE" | "SUSPENDED">("ACTIVE");
  let editStaffPassword = $state("");
  let resetStaffNewPassword = $state("");

  async function loadStaff() {
    staffLoading = true;
    try {
      const res = await apiRequest<any>("/super-admin/staff");
      if (res && res.success) {
        portal.staffList = res.data || [];
      }
    } catch (e) {
      console.error("Gagal memuat daftar staf:", e);
    } finally {
      staffLoading = false;
    }
  }

  function openCreateStaff() {
    newStaffName = "";
    newStaffEmail = "";
    newStaffPassword = "";
    newStaffRole = "ADMIN_FINANCE";
    showCreateStaffModal = true;
  }

  async function handleCreateStaff(e: Event) {
    e.preventDefault();
    if (
      !newStaffName.trim() ||
      !newStaffEmail.trim() ||
      !newStaffPassword.trim()
    ) {
      portal.feedbackMessage = {
        text: "Harap lengkapi semua kolom yang wajib diisi!",
        type: "error",
      };
      return;
    }

    portal.isSubmitting = true;
    try {
      const res = await apiRequest<any>("/super-admin/staff", {
        method: "POST",
        body: JSON.stringify({
          fullName: newStaffName.trim(),
          email: newStaffEmail.toLowerCase().trim(),
          password: newStaffPassword.trim(),
          role: newStaffRole,
        }),
      });

      if (res && res.success) {
        showCreateStaffModal = false;
        portal.feedbackMessage = {
          text: res.message || "Akun staf platform berhasil ditambahkan!",
          type: "success",
        };
        await loadStaff();
      } else {
        portal.feedbackMessage = {
          text: res?.error || "Gagal menambahkan staf platform",
          type: "error",
        };
      }
    } catch (err: any) {
      portal.feedbackMessage = {
        text: err.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      portal.isSubmitting = false;
      setTimeout(() => (portal.feedbackMessage = null), 5000);
    }
  }

  function openEditStaff(staff: PlatformStaffItem) {
    activeStaff = staff;
    editStaffName = staff.fullName;
    editStaffEmail = staff.email;
    editStaffRole = staff.role;
    editStaffStatus = staff.status;
    editStaffPassword = "";
    showEditStaffModal = true;
  }

  async function handleUpdateStaff(e: Event) {
    e.preventDefault();
    if (!activeStaff) return;

    portal.isSubmitting = true;
    try {
      const payload: Record<string, any> = {
        fullName: editStaffName.trim(),
        email: editStaffEmail.toLowerCase().trim(),
        role: editStaffRole,
        status: editStaffStatus,
      };
      if (editStaffPassword.trim()) {
        payload.password = editStaffPassword.trim();
      }

      const res = await apiRequest<any>(
        `/super-admin/staff/${activeStaff.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );

      if (res && res.success) {
        showEditStaffModal = false;
        portal.feedbackMessage = {
          text: res.message || "Data staf platform berhasil diperbarui!",
          type: "success",
        };
        await loadStaff();
      } else {
        portal.feedbackMessage = {
          text: res?.error || "Gagal memperbarui data staf",
          type: "error",
        };
      }
    } catch (err: any) {
      portal.feedbackMessage = {
        text: err.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      portal.isSubmitting = false;
      setTimeout(() => (portal.feedbackMessage = null), 5000);
    }
  }

  function openResetStaffPassword(staff: PlatformStaffItem) {
    activeStaff = staff;
    resetStaffNewPassword = "";
    showResetStaffPasswordModal = true;
  }

  async function handleResetStaffPassword(e: Event) {
    e.preventDefault();
    if (!activeStaff || !resetStaffNewPassword.trim()) return;

    portal.isSubmitting = true;
    try {
      const res = await apiRequest<any>(
        `/super-admin/staff/${activeStaff.id}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ newPassword: resetStaffNewPassword.trim() }),
        },
      );

      if (res && res.success) {
        showResetStaffPasswordModal = false;
        portal.feedbackMessage = {
          text: res.message || "Password staf platform berhasil direset!",
          type: "success",
        };
      } else {
        portal.feedbackMessage = {
          text: res?.error || "Gagal mereset password staf",
          type: "error",
        };
      }
    } catch (err: any) {
      portal.feedbackMessage = {
        text: err.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      portal.isSubmitting = false;
      setTimeout(() => (portal.feedbackMessage = null), 5000);
    }
  }

  function openDeleteStaff(staff: PlatformStaffItem) {
    activeStaff = staff;
    showDeleteStaffModal = true;
  }

  async function handleDeleteStaff() {
    if (!activeStaff) return;

    portal.isSubmitting = true;
    try {
      const res = await apiRequest<any>(
        `/super-admin/staff/${activeStaff.id}`,
        {
          method: "DELETE",
        },
      );

      if (res && res.success) {
        showDeleteStaffModal = false;
        portal.feedbackMessage = {
          text: res.message || "Akun staf platform berhasil dihapus!",
          type: "success",
        };
        await loadStaff();
      } else {
        portal.feedbackMessage = {
          text: res?.error || "Gagal menghapus staf platform",
          type: "error",
        };
      }
    } catch (err: any) {
      portal.feedbackMessage = {
        text: err.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      portal.isSubmitting = false;
      setTimeout(() => (portal.feedbackMessage = null), 5000);
    }
  }

  const filteredStaff = $derived(
    portal.staffList.filter((s) => {
      const q = staffSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);

      const matchesRole =
        staffSelectedRole === "ALL" || s.role === staffSelectedRole;

      return matchesSearch && matchesRole;
    }),
  );

  // ==========================================
  // META CLOUD API INTEGRATION WIZARD HANDLERS
  // ==========================================
</script>

  <!-- Top Action Banner -->
  <div
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
  >
    <div class="space-y-1">
      <div class="flex items-center gap-2 flex-wrap">
        <h2
          class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
        >
          <span>Tim & Staf Administrator Platform</span>
          <span
            class="text-xs font-normal text-slate-500 dark:text-slate-400"
            >({portal.staffList.length} Akun)</span
          >
        </h2>
        <span
          class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25"
        >
          Berdiri Sendiri (organization_id = NULL)
        </span>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Akun-akun di bawah ini adalah staf pengelola platform utama (Super
        Admin, Finance, Support). Akun ini <strong
          >benar-benar berdiri sendiri</strong
        > dan tidak terikat pada organisasi klien mana pun.
      </p>
    </div>

    <div class="flex items-center gap-2.5">
      <button
        onclick={loadStaff}
        disabled={staffLoading}
        class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-60"
      >
        <RefreshCw class="w-4 h-4 {staffLoading ? 'animate-spin' : ''}" />
        <span>Refresh</span>
      </button>

      {#if authStore.isSuperAdmin}
        <button
          onclick={openCreateStaff}
          class="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition cursor-pointer"
        >
          <Plus class="w-4 h-4 stroke-[3]" />
          <span>+ Tambah Staf Baru</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Info Highlights Card -->
  <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
    <div
      class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
    >
      <div
        class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
      >
        <Users class="w-5 h-5" />
      </div>
      <div>
        <div
          class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Total Staf Platform
        </div>
        <div
          class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
        >
          {portal.staffList.length}
        </div>
      </div>
    </div>

    <div
      class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
    >
      <div
        class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0"
      >
        <Shield class="w-5 h-5" />
      </div>
      <div>
        <div
          class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Master Super Admin
        </div>
        <div
          class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
        >
          {portal.staffList.filter((s) => s.role === "SUPER_ADMIN").length}
        </div>
      </div>
    </div>

    <div
      class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
    >
      <div
        class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"
      >
        <Wallet class="w-5 h-5" />
      </div>
      <div>
        <div
          class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Finance Staff
        </div>
        <div
          class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
        >
          {portal.staffList.filter((s) => s.role === "ADMIN_FINANCE").length}
        </div>
      </div>
    </div>

    <div
      class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
    >
      <div
        class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0"
      >
        <Network class="w-5 h-5" />
      </div>
      <div>
        <div
          class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
        >
          Support / Teknis
        </div>
        <div
          class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
        >
          {portal.staffList.filter((s) => s.role === "ADMIN_SUPPORT").length}
        </div>
      </div>
    </div>
  </div>

  <!-- Filter & Search Bar -->
  <div
    class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
  >
    <div class="relative w-full sm:w-80">
      <Search
        class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        bind:value={staffSearchQuery}
        placeholder="Cari nama atau email staf..."
        class="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
      />
    </div>

    <div class="flex items-center gap-2 w-full sm:w-auto">
      <label
        for="staff_role_filter"
        class="text-xs font-semibold text-slate-500 shrink-0">Role:</label
      >
      <select
        id="staff_role_filter"
        bind:value={staffSelectedRole}
        class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
      >
        <option value="ALL">Semua Peran ({portal.staffList.length})</option>
        <option value="SUPER_ADMIN">Master Super Admin (Utama)</option>
        <option value="CO_SUPER_ADMIN">Co-Super Administrator</option>
        <option value="ADMIN_FINANCE">Finance (Keuangan)</option>
        <option value="ADMIN_SUPPORT">Support / Teknis</option>
      </select>
    </div>
  </div>

  <!-- Staff List Table -->
  <div
    class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
  >
    {#if staffLoading && portal.staffList.length === 0}
      <div class="p-12 text-center space-y-3">
        <div
          class="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"
        ></div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Memuat daftar staf platform...
        </p>
      </div>
    {:else if filteredStaff.length === 0}
      <div class="p-12 text-center space-y-3">
        <div
          class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto"
        >
          <Users class="w-6 h-6" />
        </div>
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">
          Tidak Ada Staf Platform
        </h3>
        <p
          class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto"
        >
          {staffSearchQuery
            ? "Tidak ada akun staf yang cocok dengan pencarian."
            : "Belum ada staf platform yang ditambahkan."}
        </p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead
            class="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]"
          >
            <tr>
              <th class="px-5 py-3.5">Nama & Email</th>
              <th class="px-4 py-3.5">Peran / Jabatan</th>
              <th class="px-4 py-3.5">Status Akun</th>
              <th class="px-4 py-3.5">Tipe Akun</th>
              <th class="px-4 py-3.5">Tanggal Dibuat</th>
              <th class="px-5 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
            {#each filteredStaff as staff (staff.id)}
              <tr
                class="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition"
              >
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 {staff.role ===
                      'SUPER_ADMIN'
                        ? 'bg-indigo-600 text-white'
                        : staff.role === 'CO_SUPER_ADMIN'
                          ? 'bg-violet-600 text-white'
                          : staff.role === 'ADMIN_FINANCE'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-cyan-600 text-white'}"
                    >
                      {staff.fullName.charAt(0)}
                    </div>
                    <div>
                      <div
                        class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5"
                      >
                        <span>{staff.fullName}</span>
                        {#if staff.id === authStore.user?.id}
                          <span
                            class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                          >
                            (Anda)
                          </span>
                        {/if}
                      </div>
                      <div
                        class="font-mono text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        {staff.email}
                      </div>
                    </div>
                  </div>
                </td>

                <td class="px-4 py-3.5">
                  <RoleBadge role={staff.role} isPrimaryAdmin={Boolean(staff.isPrimaryAdmin || (staff.role === 'SUPER_ADMIN' && staff.email === 'admin@perusahaan.com'))} />
                </td>

                <td class="px-4 py-3.5">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold {staff.status ===
                    'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : staff.status === 'SUSPENDED'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'}"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full {staff.status ===
                      'ACTIVE'
                        ? 'bg-emerald-500'
                        : staff.status === 'SUSPENDED'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'}"
                    ></span>
                    <span>{staff.status}</span>
                  </span>
                </td>

                <td class="px-4 py-3.5">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    <ShieldCheck class="w-3 h-3 text-indigo-500" />
                    <span>Platform Independen</span>
                  </span>
                </td>

                <td
                  class="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]"
                >
                  {new Date(staff.createdAt).toLocaleDateString("id-ID", {
                    dateStyle: "medium",
                  })}
                </td>

                <td class="px-5 py-3.5 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    {#if authStore.isSuperAdmin}
                      <button
                        type="button"
                        onclick={() => openResetStaffPassword(staff)}
                        class="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition cursor-pointer"
                        title="Reset Password Staf"
                      >
                        <Key class="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onclick={() => openEditStaff(staff)}
                        class="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition cursor-pointer"
                        title="Edit Data Staf"
                      >
                        <Edit3 class="w-3.5 h-3.5" />
                      </button>

                      {#if staff.id !== authStore.user?.id}
                        <button
                          type="button"
                          onclick={() => openDeleteStaff(staff)}
                          class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
                          title="Hapus Staf"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      {/if}
                    {:else}
                      <span class="text-[11px] text-slate-400 italic"
                        >Hanya Baca</span
                      >
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

<!-- ========================================================= -->
<!-- MODAL: TAMBAH STAF PLATFORM ADMINISTRATOR BARU            -->
<!-- ========================================================= -->
{#if showCreateStaffModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showCreateStaffModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <Users class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Tambah Staf Administrator Platform
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Akun mandiri pengelola platform (Finance, Support, Co-Admin)
            </p>
          </div>
        </div>
        <button
          onclick={() => (showCreateStaffModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form
        onsubmit={handleCreateStaff}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]"
        >
          <div
            class="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-300"
          >
            <ShieldCheck class="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
            <span>
              <strong>Akun Berdiri Sendiri</strong>: Akun ini tidak dikaitkan
              dengan organisasi atau tenant manapun. Staf ini dapat mengakses
              panel <em>/administrator</em> sesuai peran yang diberikan.
            </span>
          </div>

          <div>
            <label
              for="new_staff_name"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Nama Lengkap Staf *
            </label>
            <input
              id="new_staff_name"
              type="text"
              bind:value={newStaffName}
              placeholder="e.g. Dewi Sartika (Finance)"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label
              for="new_staff_email"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Email Login *
            </label>
            <input
              id="new_staff_email"
              type="email"
              bind:value={newStaffEmail}
              placeholder="e.g. finance@perusahaan.com"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label
              for="new_staff_pwd"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Kata Sandi Awal *
            </label>
            <input
              id="new_staff_pwd"
              type="password"
              bind:value={newStaffPassword}
              placeholder="Minimal 6 karakter..."
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
              minlength="6"
            />
          </div>

          <div>
            <span
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2"
            >
              Peran / Hak Akses Staf *
            </span>
            <div class="space-y-2.5">
              <label
                class="p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition {newStaffRole ===
                'ADMIN_FINANCE'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
              >
                <input
                  type="radio"
                  name="new_role"
                  value="ADMIN_FINANCE"
                  bind:group={newStaffRole}
                  class="mt-1 text-emerald-600"
                />
                <div>
                  <div class="text-xs font-bold flex items-center gap-1.5">
                    <Wallet class="w-3.5 h-3.5 text-emerald-500" />
                    <span>Finance Staff (Keuangan & Langganan)</span>
                  </div>
                  <div class="text-[11px] opacity-75 mt-0.5">
                    Mengelola Paket SaaS, Tagihan/Invoice, Gateway Pembayaran
                    Midtrans, dan perpanjangan sewa klien.
                  </div>
                </div>
              </label>

              <label
                class="p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition {newStaffRole ===
                'ADMIN_SUPPORT'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-950 dark:text-cyan-200'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
              >
                <input
                  type="radio"
                  name="new_role"
                  value="ADMIN_SUPPORT"
                  bind:group={newStaffRole}
                  class="mt-1 text-cyan-600"
                />
                <div>
                  <div class="text-xs font-bold flex items-center gap-1.5">
                    <Network class="w-3.5 h-3.5 text-cyan-500" />
                    <span>Support / Technical Staff (Teknis & WABA)</span>
                  </div>
                  <div class="text-[11px] opacity-75 mt-0.5">
                    Membantu klien memantau organisasi, menguji validasi API
                    Meta WhatsApp, dan reset password penyewa.
                  </div>
                </div>
              </label>

              <label
                class="p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition {newStaffRole ===
                'CO_SUPER_ADMIN'
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-950 dark:text-indigo-200'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
              >
                <input
                  type="radio"
                  name="new_role"
                  value="CO_SUPER_ADMIN"
                  bind:group={newStaffRole}
                  class="mt-1 text-indigo-600"
                />
                <div>
                  <div class="text-xs font-bold flex items-center gap-1.5">
                    <Shield class="w-3.5 h-3.5 text-indigo-500" />
                    <span>Co-Super Administrator</span>
                  </div>
                  <div class="text-[11px] opacity-75 mt-0.5">
                    Memiliki hak akses untuk mengelola seluruh organisasi,
                    paket SaaS, keuangan, serta staf (tanpa akses Update Sistem Server).
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            type="button"
            onclick={() => (showCreateStaffModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{portal.isSubmitting ? "Menyimpan..." : "Simpan Staf Baru"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: EDIT DATA STAF PLATFORM ADMINISTRATOR              -->
<!-- ========================================================= -->
{#if showEditStaffModal && activeStaff}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showEditStaffModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <Edit3 class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Edit Staf Platform
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {activeStaff.fullName}
            </p>
          </div>
        </div>
        <button
          onclick={() => (showEditStaffModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form
        onsubmit={handleUpdateStaff}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]"
        >
          <div>
            <label
              for="edit_staff_name"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Nama Lengkap Staf *
            </label>
            <input
              id="edit_staff_name"
              type="text"
              bind:value={editStaffName}
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label
              for="edit_staff_email"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Email Login *
            </label>
            <input
              id="edit_staff_email"
              type="email"
              bind:value={editStaffEmail}
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                for="edit_staff_role"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Peran / Jabatan *
              </label>
              <select
                id="edit_staff_role"
                bind:value={editStaffRole}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="SUPER_ADMIN">Master Super Admin (Utama)</option>
                <option value="CO_SUPER_ADMIN">Co-Super Administrator</option>
                <option value="ADMIN_FINANCE">Finance Staff</option>
                <option value="ADMIN_SUPPORT">Support Staff</option>
              </select>
            </div>

            <div>
              <label
                for="edit_staff_status"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Status Akun *
              </label>
              <select
                id="edit_staff_status"
                bind:value={editStaffStatus}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="ACTIVE">ACTIVE (Aktif)</option>
                <option value="INACTIVE">INACTIVE (Nonaktif)</option>
                <option value="SUSPENDED">SUSPENDED (Ditangguhkan)</option>
              </select>
            </div>
          </div>

          <div>
            <label
              for="edit_staff_pwd"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Ganti Kata Sandi (Kosongkan jika tidak ingin diubah)
            </label>
            <input
              id="edit_staff_pwd"
              type="password"
              bind:value={editStaffPassword}
              placeholder="Masukkan password baru jika ingin mengubah..."
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              minlength="6"
            />
          </div>
        </div>

        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            type="button"
            onclick={() => (showEditStaffModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{portal.isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: RESET PASSWORD STAF PLATFORM                       -->
<!-- ========================================================= -->
{#if showResetStaffPasswordModal && activeStaff}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showResetStaffPasswordModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <Key class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Reset Password Staf
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {activeStaff.fullName} ({activeStaff.email})
            </p>
          </div>
        </div>
        <button
          onclick={() => (showResetStaffPasswordModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleResetStaffPassword} class="p-6 space-y-4">
        <div>
          <label
            for="reset_staff_new_pwd"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Kata Sandi Baru *
          </label>
          <input
            id="reset_staff_new_pwd"
            type="text"
            bind:value={resetStaffNewPassword}
            placeholder="Ketik password baru..."
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition"
            required
            minlength="6"
          />
        </div>

        <div
          class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
        >
          <button
            type="button"
            onclick={() => (showResetStaffPasswordModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-amber-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Key class="w-4 h-4 stroke-[3]" />
            <span>{portal.isSubmitting ? "Mereset..." : "Reset Password"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: HAPUS STAF PLATFORM ADMINISTRATOR                  -->
<!-- ========================================================= -->
{#if showDeleteStaffModal && activeStaff}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showDeleteStaffModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col p-6 space-y-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"
        >
          <Trash2 class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">
            Hapus Staf Platform
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Konfirmasi tindakan penghapusan
          </p>
        </div>
      </div>

      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Apakah Anda yakin ingin menghapus akun staf <strong
          >{activeStaff.fullName}</strong
        >
        ({activeStaff.email})? Tindakan ini tidak dapat dibatalkan.
      </p>

      <div
        class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          onclick={() => (showDeleteStaffModal = false)}
          class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onclick={handleDeleteStaff}
          disabled={portal.isSubmitting}
          class="py-2 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-rose-500/20 transition cursor-pointer disabled:opacity-60"
        >
          <Trash2 class="w-4 h-4 stroke-[3]" />
          <span>{portal.isSubmitting ? "Menghapus..." : "Hapus Sekarang"}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
