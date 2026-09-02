<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    ShieldCheck,
    Lock,
    Mail,
    ArrowRight,
    AlertCircle,
    Sun,
    Moon,
    Building2,
  } from 'lucide-svelte';

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let errorMsg = $state<string | null>(null);

  onMount(() => {
    // If already logged in as platform staff, redirect directly to dashboard
    if (authStore.isAuthenticated && authStore.isPlatformStaff) {
      goto('/administrator');
    }
  });

  async function handleAdminLogin(e: Event) {
    e.preventDefault();
    if (!email || !password) {
      errorMsg = 'Harap isi email dan kata sandi administrator';
      return;
    }

    isLoading = true;
    errorMsg = null;

    const res = await authStore.login({
      email,
      password,
      portalType: 'PLATFORM',
    });
    isLoading = false;

    if (res.success) {
      goto('/administrator');
    } else {
      errorMsg = res.error || 'Login Administrator gagal';
    }
  }
</script>

<div
  class="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white"
>
  <!-- Background Glow & Grid -->
  <div
    class="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"
  ></div>
  <div
    class="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"
  ></div>
  <div
    class="absolute inset-0 bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none"
  ></div>

  <!-- Floating Theme Switcher -->
  <button
    onclick={() => themeStore.toggle()}
    class="absolute top-6 right-6 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 shadow-md backdrop-blur transition cursor-pointer hover:bg-slate-800"
    title="Ubah Tema"
  >
    {#if themeStore.current === 'dark'}
      <Sun class="w-4 h-4 text-amber-400" />
    {:else}
      <Moon class="w-4 h-4 text-indigo-400" />
    {/if}
  </button>

  <div class="w-full max-w-md relative z-10">
    <!-- Header Logo & Badge -->
    <div class="text-center mb-7">
      <div
        class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 items-center justify-center shadow-xl shadow-indigo-500/25 text-white mb-3"
      >
        <ShieldCheck class="w-8 h-8 stroke-[2.2]" />
      </div>
      <div class="flex items-center justify-center gap-2 mb-1">
        <h1 class="text-xl font-extrabold tracking-tight text-white">
          SaaS Master Administrator
        </h1>
      </div>
      <p class="text-xs text-slate-400 font-medium">
        Pintu Masuk Terisolasi Khusus Super Admin & Tim Staf Platform
      </p>
    </div>

    <!-- Login Card -->
    <div
      class="rounded-2xl p-7 bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md space-y-5"
    >
      <div class="border-b border-slate-800/80 pb-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-white">Autentikasi Eksekutif</h2>
            <p class="text-[11px] text-slate-400">
              Akses kontrol manajemen multi-tenancy & billing
            </p>
          </div>
          <span
            class="text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
          >
            Standalone
          </span>
        </div>
      </div>

      {#if errorMsg}
        <div
          class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-400 leading-relaxed"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleAdminLogin} class="space-y-4">
        <div>
          <label
            for="admin_email"
            class="block text-xs font-semibold text-slate-300 mb-1.5"
          >
            Email Administrator Platform
          </label>
          <div class="relative">
            <Mail
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              id="admin_email"
              type="email"
              bind:value={email}
              placeholder="admin@perusahaan.com"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              required
            />
          </div>
        </div>

        <div>
          <label
            for="admin_password"
            class="block text-xs font-semibold text-slate-300 mb-1.5"
          >
            Kata Sandi
          </label>
          <div class="relative">
            <Lock
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              id="admin_password"
              type="password"
              bind:value={password}
              placeholder="••••••••"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          class="w-full mt-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 cursor-pointer"
        >
          {#if isLoading}
            <div
              class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"
            ></div>
            <span>Memverifikasi Otoritas...</span>
          {:else}
            <span>Masuk ke Konsol Administrator</span>
            <ArrowRight class="w-3.5 h-3.5" />
          {/if}
        </button>
      </form>

      <!-- Security Notice -->
      <div
        class="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1"
      >
        <div class="font-bold text-slate-300 flex items-center gap-1.5">
          <ShieldCheck class="w-3.5 h-3.5 text-indigo-400" />
          <span>Isolasi Pintu Masuk Administrator</span>
        </div>
        <p class="text-[10px] leading-relaxed text-slate-400">
          Halaman ini khusus untuk pemegang role <strong>SUPER_ADMIN</strong> dan
          staf platform. Akun tenant klien dilarang masuk dari pintu ini.
        </p>
      </div>

      <!-- Switch back to Tenant Portal -->
      <div class="pt-3 border-t border-slate-800/80 text-center">
        <a
          href="/login"
          class="text-[11px] text-slate-400 hover:text-white transition inline-flex items-center gap-1.5"
        >
          <Building2 class="w-3.5 h-3.5 text-emerald-400" />
          <span>Pengguna / Staf Tenant Klien?</span>
          <span class="font-bold underline text-emerald-400"
            >Masuk ke Portal Tenant →</span
          >
        </a>
      </div>
    </div>
  </div>
</div>
