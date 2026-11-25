<script lang="ts">
  import { apiRequest } from "$lib/api/client";
  import { authStore } from "$lib/stores/auth.svelte";
  import { themeStore } from "$lib/stores/theme.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  import {
    Building2,
    Shield,
    AlertTriangle,
    Lock,
    X,
    Check,
    ArrowRight,
    Sun,
    Moon,
    LogOut,
    Mail,
    Eye,
    EyeOff,
    UserCog,
    Package,
    Wallet,
    ShieldCheck,
    Receipt,
    Menu,
    GitBranch,
    ChevronRight,
  } from "lucide-svelte";

  import { portal, type AdminTab } from "$lib/admin/portal.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import TenantsTab from "$lib/components/admin/TenantsTab.svelte";
  import PlansTab from "$lib/components/admin/PlansTab.svelte";
  import TransactionsTab from "$lib/components/admin/TransactionsTab.svelte";
  import PaymentGatewayTab from "$lib/components/admin/PaymentGatewayTab.svelte";
  import StaffTab from "$lib/components/admin/StaffTab.svelte";
  import SystemUpdateTab from "$lib/components/admin/SystemUpdateTab.svelte";

  let mobileSidebarOpen = $state(false);

  let loginEmail = $state("admin@perusahaan.com");
  let loginPassword = $state("");
  let loginLoading = $state(false);
  let loginError = $state<string | null>(null);
  let showPassword = $state(false);

  let showProfileModal = $state(false);
  let profileFullName = $state("");
  let profileEmail = $state("");
  let profileCurrentPassword = $state("");
  let profileNewPassword = $state("");
  let profileLoading = $state(false);

  onMount(async () => {
    if (authStore.token) {
      await authStore.fetchFreshProfile();
      if (authStore.isPlatformStaff) {
        await portal.loadData();
      } else {
        goto("/administrator/login");
      }
    } else {
      goto("/administrator/login");
    }
  });

  function openSuperAdminProfile() {
    profileFullName = authStore.user?.fullName || "Master Administrator";
    profileEmail = authStore.user?.email || "admin@perusahaan.com";
    profileCurrentPassword = "";
    profileNewPassword = "";
    showProfileModal = true;
  }

  async function handleUpdateProfile(e: Event) {
    e.preventDefault();
    if (!profileEmail.trim()) {
      portal.feedbackMessage = { text: "Email tidak boleh kosong!", type: "error" };
      return;
    }

    profileLoading = true;
    const res = await apiRequest<any>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({
        fullName: profileFullName.trim(),
        email: profileEmail.trim(),
        currentPassword: profileCurrentPassword.trim() || undefined,
        newPassword: profileNewPassword.trim() || undefined,
      }),
    });
    profileLoading = false;

    if (res.success) {
      showProfileModal = false;
      portal.feedbackMessage = {
        text: res.message || "Profil & Data Login Anda Berhasil Diperbarui!",
        type: "success",
      };
      if (res.token && res.user) {
        authStore.setAuth(res.token, {
          ...authStore.user!,
          ...res.user,
        });
      }
      await authStore.fetchFreshProfile();
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal memperbarui profil login",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 5000);
  }

  async function handleSuperAdminLogin(e: Event) {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      loginError = "Harap isi email dan password super admin";
      return;
    }

    loginLoading = true;
    loginError = null;

    const res = await authStore.login({
      email: loginEmail,
      password: loginPassword,
    });
    loginLoading = false;

    if (res.success) {
      await authStore.fetchFreshProfile();
      if (!authStore.isPlatformStaff) {
        authStore.logout();
        loginError =
          "Akses Ditolak: Halaman Master Control Administrator ini khusus untuk Pemilik Platform & Staf Administrator. Akun staf/admin penyewa (tenant) silakan login melalui halaman login utama (/login).";
        return;
      }
      await portal.loadData();
    } else {
      loginError =
        res.error || "Login gagal. Periksa kembali email dan kata sandi Anda.";
    }
  }

</script>

<svelte:head>
  <title>Portal Master Administrator — WhatsApp CRM SaaS</title>
</svelte:head>

<div
  class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200"
>
  {#if !portal.isSuperAdminLoggedIn}
    <!-- Top Master Navigation Bar for Login -->
    <header
      class="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs"
    >
      <div class="flex items-center gap-3.5">
        <div
          class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25"
        >
          <Shield class="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h1
            class="text-sm font-bold tracking-tight text-slate-900 dark:text-white uppercase"
          >
            Portal Kontrol Master SaaS
          </h1>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            Pusat Manajemen Seluruh Organisasi, Paket Sewa, & Integrasi WhatsApp
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          onclick={() => themeStore.toggle()}
          class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          title="Ubah Tema Light / Dark"
        >
          {#if themeStore.current === "dark"}
            <Sun class="w-4 h-4 text-amber-400" />
          {:else}
            <Moon class="w-4 h-4 text-indigo-600" />
          {/if}
        </button>
      </div>
    </header>
  {/if}

  <!-- Content Area -->
  {#if !portal.isSuperAdminLoggedIn}
    <!-- ========================================================= -->
    <!-- DEDICATED SUPER ADMIN LOGIN GATE                          -->
    <!-- ========================================================= -->
    <div
      class="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
    >
      <!-- Glow effects -->
      <div
        class="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"
      ></div>

      <div class="w-full max-w-md relative z-10 my-8">
        <!-- Logo & Title -->
        <div class="text-center mb-6">
          <div
            class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 items-center justify-center shadow-xl shadow-indigo-500/25 text-white mb-3"
          >
            <Shield class="w-7 h-7 stroke-[2.5]" />
          </div>
          <h2
            class="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            Autentikasi Master Super Admin
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Masuk untuk mengelola seluruh organisasi & kontrol sewa SaaS
          </p>
        </div>

        <!-- Login Card -->
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5"
        >
          {#if loginError}
            <div
              class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{loginError}</span>
            </div>
          {/if}

          <form onsubmit={handleSuperAdminLogin} class="space-y-4">
            <div>
              <label
                for="super_email"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >Email Super Admin</label
              >
              <div class="relative">
                <Mail
                  class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="super_email"
                  type="email"
                  bind:value={loginEmail}
                  placeholder="admin@perusahaan.com"
                  class="ui-input pl-10 pr-4 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label
                for="super_pwd"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >Password Super Admin</label
              >
              <div class="relative">
                <Lock
                  class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="super_pwd"
                  type={showPassword ? "text" : "password"}
                  bind:value={loginPassword}
                  placeholder="Masukkan password admin..."
                  class="ui-input pl-10 pr-10 font-mono"
                  required
                />
                <button
                  type="button"
                  onclick={() => (showPassword = !showPassword)}
                  class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {#if showPassword}
                    <EyeOff class="w-4 h-4" />
                  {:else}
                    <Eye class="w-4 h-4" />
                  {/if}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              class="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 cursor-pointer"
            >
              {#if loginLoading}
                <div
                  class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"
                ></div>
                <span>Memverifikasi Akses...</span>
              {:else}
                <span>Masuk ke Portal Master</span>
                <ArrowRight class="w-4 h-4" />
              {/if}
            </button>
          </form>

          {#if import.meta.env.DEV}
          <div
            class="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center"
          >
            <p class="text-[11px] text-slate-400">
              Kredensial Default: <span class="font-mono text-indigo-500"
                >admin@perusahaan.com</span
              >
              / <span class="font-mono text-indigo-500">admin12345</span>
            </p>
          </div>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <!-- ========================================================= -->
    <!-- PLATFORM ADMIN: SIDEBAR + CONTENT                         -->
    <!-- ========================================================= -->
    {@const navSections = [
      {
        label: "Manajemen SaaS",
        items: [
          { id: "tenants", label: "Organisasi klien", icon: Building2, count: portal.organizationsList.length },
          { id: "plans", label: "Paket & promo", icon: Package, count: portal.saasPlans.length },
        ],
      },
      {
        label: "Billing & keuangan",
        items: [
          { id: "transactions", label: "Transaksi & omzet", icon: Receipt, count: portal.transactionsList.length, pending: portal.transactionSummary.pendingCount },
          { id: "midtrans", label: "Gateway Midtrans", icon: Wallet, dot: portal.midtrans.isEnabled },
        ],
      },
      {
        label: "Administrasi",
        items: [
          { id: "staff", label: "Tim & staf admin", icon: ShieldCheck, count: portal.staffList.length },
          ...(authStore.isPrimaryAdmin ? [{ id: "system_update", label: "Update sistem", icon: GitBranch, rootOnly: true }] : []),
        ],
      },
    ] as { label: string; items: { id: AdminTab; label: string; icon: any; count?: number; pending?: number; dot?: boolean; rootOnly?: boolean }[] }[]}
    {@const activeItem = navSections.flatMap((s) => s.items).find((i) => i.id === portal.activeTab)}

    <div class="relative flex min-h-screen w-full flex-1 flex-col md:flex-row">
      {#if mobileSidebarOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] md:hidden" onclick={() => (mobileSidebarOpen = false)}></div>
      {/if}

      <!-- Sidebar -->
      <aside
        class="fixed top-0 bottom-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:sticky md:z-30 md:translate-x-0 dark:border-slate-800 dark:bg-slate-900 {mobileSidebarOpen
          ? 'translate-x-0 shadow-2xl'
          : '-translate-x-full md:translate-x-0'}"
        aria-label="Navigasi portal admin"
      >
        <!-- Brand -->
        <div class="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 dark:bg-indigo-500">
              <Shield class="h-5 w-5" />
            </div>
            <div class="min-w-0 leading-tight">
              <p class="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">WhatsApp CRM</p>
              <p class="truncate text-xs text-slate-500 dark:text-slate-400">Portal admin platform</p>
            </div>
          </div>
          <button onclick={() => (mobileSidebarOpen = false)} class="ui-icon-btn md:hidden" aria-label="Tutup menu">
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {#each navSections as section}
            <div>
              <p class="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{section.label}</p>
              <ul class="space-y-0.5">
                {#each section.items as item}
                  {@const active = portal.activeTab === item.id}
                  <li>
                    <button
                      onclick={() => {
                        portal.activeTab = item.id;
                        if (item.id === "transactions") portal.loadTransactions();
                        mobileSidebarOpen = false;
                      }}
                      aria-current={active ? "page" : undefined}
                      class="relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {active
                        ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}"
                    >
                      {#if active}<span class="absolute inset-y-1.5 -left-3 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400" aria-hidden="true"></span>{/if}
                      <item.icon class="h-[18px] w-[18px] shrink-0 {active ? '' : 'text-slate-400 dark:text-slate-500'}" />
                      <span class="flex-1 truncate text-left">{item.label}</span>
                      {#if item.pending}
                        <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{item.pending} menunggu</span>
                      {:else if item.rootOnly}
                        <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">Root</span>
                      {:else if item.dot}
                        <span class="h-2 w-2 rounded-full bg-emerald-500" title="Aktif"></span>
                      {:else if item.count !== undefined}
                        <span class="min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums {active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}">{item.count}</span>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </nav>

        <!-- Account -->
        <div class="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
          <div class="flex items-center gap-3 rounded-xl px-2 py-2">
            <button onclick={openSuperAdminProfile} class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left" title="Ubah profil, email & kata sandi">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                {(authStore.user?.fullName || "A")[0].toUpperCase()}
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-slate-900 dark:text-white">{authStore.user?.fullName || "Super Admin"}</p>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">{(authStore.user?.role || "SUPER_ADMIN").replace(/_/g, " ").toLowerCase()}</p>
              </div>
            </button>
            <button
              onclick={() => {
                authStore.logout();
                goto("/administrator/login");
              }}
              class="ui-icon-btn h-8 w-8 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              title="Keluar"
              aria-label="Keluar"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <!-- Content -->
      <div class="flex min-h-screen min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900/90">
          <div class="flex min-w-0 items-center gap-2">
            <button onclick={() => (mobileSidebarOpen = !mobileSidebarOpen)} class="ui-icon-btn -ml-2 md:hidden" aria-label="Buka menu">
              <Menu class="h-5 w-5" />
            </button>
            <nav class="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
              <span class="hidden text-slate-500 sm:inline dark:text-slate-400">Portal admin</span>
              <ChevronRight class="hidden h-4 w-4 text-slate-300 sm:inline dark:text-slate-600" />
              <span class="truncate font-semibold text-slate-900 dark:text-white">{activeItem?.label ?? ""}</span>
            </nav>
          </div>

          <div class="flex items-center gap-1">
            <button onclick={() => themeStore.toggle()} class="ui-icon-btn" title="Ubah tema" aria-label="Ubah tema">
              {#if themeStore.current === "dark"}<Sun class="h-5 w-5" />{:else}<Moon class="h-5 w-5" />{/if}
            </button>
            <button onclick={openSuperAdminProfile} class="ui-icon-btn" title="Profil akun saya" aria-label="Profil akun saya">
              <UserCog class="h-5 w-5" />
            </button>
          </div>
        </header>

        <main class="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col space-y-6 p-4 sm:p-6 lg:p-8">
          {#if portal.feedbackMessage}
            <Alert
              tone={portal.feedbackMessage.type === "success" ? "success" : "error"}
              message={portal.feedbackMessage.text}
              ondismiss={() => (portal.feedbackMessage = null)}
            />
          {/if}

          {#if portal.activeTab === "tenants"}
            <TenantsTab />
          {:else if portal.activeTab === "plans"}
            <PlansTab />
          {:else if portal.activeTab === "transactions"}
            <TransactionsTab />
          {:else if portal.activeTab === "midtrans"}
            <PaymentGatewayTab />
          {:else if portal.activeTab === "staff"}
            <StaffTab />
          {:else if portal.activeTab === "system_update"}
            <SystemUpdateTab />
          {/if}
        </main>
      </div>
    </div>
  {/if}
</div>



<!-- ========================================================= -->
<!-- MODAL: EDIT AKUN LOGIN SUPER ADMIN SAYA                   -->
<!-- ========================================================= -->
{#if showProfileModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    onclick={(e) => {
      if (e.target === e.currentTarget) showProfileModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6"
    >
      <div
        class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <UserCog class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Pengaturan Akun Super Admin Saya
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Ubah email login, nama profil, dan kata sandi akses portal
            </p>
          </div>
        </div>
        <button
          onclick={() => (showProfileModal = false)}
          class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleUpdateProfile} class="p-6 space-y-4">
        <div>
          <label
            for="prof_name"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Nama Lengkap Super Admin
          </label>
          <input
            id="prof_name"
            type="text"
            bind:value={profileFullName}
            placeholder="e.g. Master Administrator"
            class="ui-input"
            required
          />
        </div>

        <div>
          <label
            for="prof_email"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Email Login Super Admin *
          </label>
          <input
            id="prof_email"
            type="email"
            bind:value={profileEmail}
            placeholder="admin@perusahaan.com"
            class="ui-input font-mono"
            required
          />
          <span class="text-[11px] text-slate-400 mt-1 block"
            >Email ini digunakan untuk login ke portal /administrator</span
          >
        </div>

        <div
          class="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3"
        >
          <h4
            class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
          >
            <Lock class="w-3.5 h-3.5 text-indigo-500" />
            Ubah Kata Sandi (Opsional)
          </h4>

          <div>
            <label
              for="prof_cur_pwd"
              class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
            >
              Password Lama (Opsional / Jika ingin mengganti)
            </label>
            <input
              id="prof_cur_pwd"
              type="password"
              bind:value={profileCurrentPassword}
              placeholder="Masukkan password saat ini..."
              class="ui-input font-mono"
            />
          </div>

          <div>
            <label
              for="prof_new_pwd"
              class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
            >
              Password Baru (Minimal 6 karakter)
            </label>
            <input
              id="prof_new_pwd"
              type="password"
              bind:value={profileNewPassword}
              placeholder="Kosongkan jika tidak ingin mengganti password..."
              minlength="6"
              class="ui-input font-mono"
            />
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
        >
          <button
            type="button"
            onclick={() => (showProfileModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={profileLoading}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span
              >{profileLoading ? "Menyimpan..." : "Simpan Perubahan Akun"}</span
            >
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}













