<script lang="ts">
  import { apiRequest } from "$lib/api/client";
  import { authStore } from "$lib/stores/auth.svelte";
  import { themeStore } from "$lib/stores/theme.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  import {
    Building2,
    Shield,
    CheckCircle2,
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
    User,
    UserCog,
    Settings,
    Package,
    Wallet,
    ShieldCheck,
    Receipt,
    Menu,
    GitBranch,
  } from "lucide-svelte";

  import { portal } from "$lib/admin/portal.svelte";
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
            class="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase"
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
            class="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white"
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
                  class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono transition"
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
                  class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono transition"
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
    <!-- MASTER SUPER ADMIN DASHBOARD: SIDEBAR + CONTENT           -->
    <!-- ========================================================= -->
    <div class="flex-1 flex flex-col md:flex-row min-h-screen w-full relative">
      <!-- Backdrop overlay on Mobile when sidebar is open -->
      {#if mobileSidebarOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40"
          onclick={() => (mobileSidebarOpen = false)}
        ></div>
      {/if}

      <!-- Enterprise Left Sidebar -->
      <aside
        class="fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 h-screen {mobileSidebarOpen
          ? 'translate-x-0 shadow-2xl'
          : '-translate-x-full md:translate-x-0'}"
      >
        <!-- Top Section: Brand & User Info -->
        <div
          class="p-5 border-b border-slate-100 dark:border-slate-800/80 shrink-0"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20"
              >
                <Shield class="w-5 h-5 stroke-[2.5]" />
              </div>
              <div class="min-w-0">
                <h1
                  class="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white truncate"
                >
                  WA CRM Master
                </h1>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span
                    class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                  ></span>
                  <span
                    class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                    >Super Administrator</span
                  >
                </div>
              </div>
            </div>

            <!-- Close button for mobile -->
            <button
              onclick={() => (mobileSidebarOpen = false)}
              class="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Staff User Status Card -->
          <div
            class="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                >{authStore.user?.fullName || "Super Admin"}</span
              >
              <span
                class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 shrink-0"
              >
                {authStore.user?.role || "SUPER_ADMIN"}
              </span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono truncate">
              {authStore.user?.email || "admin@perusahaan.com"}
            </div>
          </div>
        </div>

        <!-- Middle Section: Navigation Menu Items -->
        <div class="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          <!-- Group 1: MANAJEMEN SAAS -->
          <div class="space-y-1">
            <div
              class="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2"
            >
              Manajemen SaaS
            </div>
            <button
              onclick={() => {
                portal.activeTab = "tenants";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {portal.activeTab ===
              'tenants'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <Building2
                  class="w-4 h-4 {portal.activeTab === 'tenants'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Organisasi Klien</span>
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-bold {portal.activeTab ===
                'tenants'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
              >
                {portal.organizationsList.length}
              </span>
            </button>

            <button
              onclick={() => {
                portal.activeTab = "plans";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {portal.activeTab ===
              'plans'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <Package
                  class="w-4 h-4 {portal.activeTab === 'plans'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Paket & Promo SaaS</span>
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-bold {portal.activeTab ===
                'plans'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
              >
                {portal.saasPlans.length}
              </span>
            </button>
          </div>

          <!-- Group 2: BILLING & KEUANGAN -->
          <div class="space-y-1">
            <div
              class="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2"
            >
              Billing & Keuangan
            </div>
            <button
              onclick={() => {
                portal.activeTab = "transactions";
                portal.loadTransactions();
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {portal.activeTab ===
              'transactions'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <Receipt
                  class="w-4 h-4 {portal.activeTab === 'transactions'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Transaksi & Omset</span>
              </div>
              {#if portal.transactionSummary.pendingCount > 0}
                <span
                  class="text-[9px] px-1.5 py-0.5 rounded-full font-extrabold bg-amber-500 text-slate-950 animate-pulse"
                >
                  {portal.transactionSummary.pendingCount} Pending
                </span>
              {:else}
                <span
                  class="text-[10px] px-2 py-0.5 rounded-full font-bold {portal.activeTab ===
                  'transactions'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
                >
                  {portal.transactionsList.length}
                </span>
              {/if}
            </button>

            <button
              onclick={() => {
                portal.activeTab = "midtrans";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {portal.activeTab ===
              'midtrans'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <Wallet
                  class="w-4 h-4 {portal.activeTab === 'midtrans'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Gateway Midtrans</span>
              </div>
              {#if portal.midtrans.isEnabled}
                <span
                  class="w-2 h-2 rounded-full bg-emerald-400 shadow-sm animate-pulse"
                ></span>
              {/if}
            </button>
          </div>

          <!-- Group 3: ADMINISTRASI & STAF -->
          <div class="space-y-1">
            <div
              class="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2"
            >
              Administrasi & Tim
            </div>
            <button
              onclick={() => {
                portal.activeTab = "staff";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {portal.activeTab ===
              'staff'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <ShieldCheck
                  class="w-4 h-4 {portal.activeTab === 'staff'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Tim & Staf Admin</span>
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-bold {portal.activeTab ===
                'staff'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
              >
                {portal.staffList.length}
              </span>
            </button>

            <!-- Menu Update Sistem (GitHub) — HANYA Administrator Utama -->
            {#if authStore.isPrimaryAdmin}
            <button
              onclick={() => {
                portal.activeTab = "system_update";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {portal.activeTab ===
              'system_update'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <GitBranch
                  class="w-4 h-4 {portal.activeTab === 'system_update'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Update Sistem (GitHub)</span>
              </div>
              <span
                class="text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider {portal.activeTab ===
                'system_update'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'}"
              >
                Root Only
              </span>
            </button>
            {/if}
          </div>
        </div>

        <!-- Bottom Section: System Status Indicator -->
        <div class="p-4 border-t border-slate-100 dark:border-slate-800/80 shrink-0">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-700 dark:text-slate-300">Engine Platform</span>
              <span class="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-[10px]">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                v2.4 Online
              </span>
            </div>
            <div class="text-[10px] text-slate-400">
              Administrator Platform Independen
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content Container with Top Executive Navbar -->
      <div class="flex-1 flex flex-col min-w-0 min-h-screen">
        <!-- Top Executive Navbar -->
        <header
          class="sticky top-0 z-30 h-16 px-4 sm:px-8 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 shrink-0"
        >
          <!-- Left: Mobile Menu Toggle & Breadcrumb -->
          <div class="flex items-center gap-3">
            <button
              onclick={() => (mobileSidebarOpen = !mobileSidebarOpen)}
              class="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              title="Menu Navigasi"
            >
              <Menu class="w-4 h-4" />
            </button>

            <!-- Breadcrumb / Section Badge -->
            <div class="flex items-center gap-2 text-xs">
              <span class="font-bold text-slate-400 dark:text-slate-500 hidden sm:inline">
                Portal Master
              </span>
              <span class="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
              <span class="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                {#if portal.activeTab === "tenants"}
                  <Building2 class="w-4 h-4 text-indigo-500" />
                  <span>Manajemen Organisasi Klien</span>
                {:else if portal.activeTab === "plans"}
                  <Package class="w-4 h-4 text-indigo-500" />
                  <span>Pengaturan Paket & Promo SaaS</span>
                {:else if portal.activeTab === "transactions"}
                  <Receipt class="w-4 h-4 text-indigo-500" />
                  <span>Pusat Transaksi & Omset</span>
                {:else if portal.activeTab === "midtrans"}
                  <Wallet class="w-4 h-4 text-indigo-500" />
                  <span>Channel Pembayaran Midtrans</span>
                {:else if portal.activeTab === "staff"}
                  <ShieldCheck class="w-3.5 h-3.5 text-indigo-500" />
                  <span>Tim & Staf Administrator</span>
                {:else if portal.activeTab === "system_update"}
                  <GitBranch class="w-3.5 h-3.5 text-indigo-500" />
                  <span>Pusat Update Sistem (GitHub)</span>
                {/if}
              </span>
            </div>
          </div>

          <!-- Right: Theme Switcher, Account Profile Pill, Logout -->
          <div class="flex items-center gap-2 sm:gap-3">
            <!-- Theme Switcher -->
            <button
              onclick={() => themeStore.toggle()}
              class="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 transition cursor-pointer"
              title="Ubah Tema Mode Terang / Gelap"
            >
              {#if themeStore.current === "dark"}
                <Sun class="w-4 h-4 text-amber-400" />
              {:else}
                <Moon class="w-4 h-4 text-indigo-600" />
              {/if}
            </button>

            <!-- Separator -->
            <div class="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

            <!-- Profile & Account Settings Action Pill -->
            <button
              onclick={openSuperAdminProfile}
              class="flex items-center gap-2.5 py-1.5 pl-1.5 pr-3 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 transition cursor-pointer"
              title="Ubah Profil Akun, Email & Password Saya"
            >
              <div
                class="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs"
              >
                {(authStore.user?.fullName || "A")[0].toUpperCase()}
              </div>
              <div class="text-left hidden md:block">
                <div class="text-xs font-bold leading-tight truncate max-w-[120px]">
                  {authStore.user?.fullName || "Super Admin"}
                </div>
                <div class="text-[9px] text-slate-400 font-semibold leading-tight">
                  {authStore.user?.role || "SUPER_ADMIN"}
                </div>
              </div>
              <UserCog class="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            </button>

            <!-- Logout Button -->
            <button
              onclick={() => {
                authStore.logout();
                goto("/administrator/login");
              }}
              class="p-2 sm:p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
              title="Keluar / Logout"
            >
              <LogOut class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- Main Content Area -->
        <main
          class="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-8 space-y-6 overflow-y-auto"
        >

      <!-- Feedback Banner -->
      {#if portal.feedbackMessage}
        <div
          class="p-4 rounded-2xl flex items-center gap-3 border text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 {portal.feedbackMessage.type ===
          'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'}"
        >
          {#if portal.feedbackMessage.type === "success"}
            <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
          {:else}
            <AlertTriangle class="w-4 h-4 text-rose-500 shrink-0" />
          {/if}
          <span class="flex-1">{portal.feedbackMessage.text}</span>
          <button
            onclick={() => (portal.feedbackMessage = null)}
            class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 1: MANAJEMEN TENANT & ORGANISASI                      -->
      <!-- ========================================================= -->
      {#if portal.activeTab === "tenants"}
        <TenantsTab />
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 2: PENGATURAN PAKET & HARGA SEWA SAAS                 -->
      <!-- ========================================================= -->
      {#if portal.activeTab === "plans"}
        <PlansTab />
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 3: RIWAYAT TRANSAKSI & OMSET PEMBAYARAN SAAS          -->
      <!-- ========================================================= -->
      {#if portal.activeTab === "transactions"}
        <TransactionsTab />
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 4: CHANNEL PEMBAYARAN MIDTRANS                        -->
      <!-- ========================================================= -->
      {#if portal.activeTab === "midtrans"}
        <PaymentGatewayTab />
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 4: TIM & STAF ADMINISTRATOR (BERDIRI SENDIRI)         -->
      <!-- ========================================================= -->
      {#if portal.activeTab === "staff"}
        <StaffTab />
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 6: PUSAT PEMBARUAN SISTEM (GIT / GITHUB UPDATE)       -->
      <!-- ========================================================= -->
      {#if portal.activeTab === "system_update"}
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
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
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
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            required
          />
          <span class="text-[10px] text-slate-400 mt-1 block"
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
              class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
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
              class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
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













