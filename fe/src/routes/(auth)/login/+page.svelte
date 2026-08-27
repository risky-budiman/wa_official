<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { goto } from '$app/navigation';
  import { Bot, Lock, Mail, ArrowRight, AlertCircle, Sun, Moon } from 'lucide-svelte';

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let errorMsg = $state<string | null>(null);

  // Automatically hide demo shortcuts in production builds (import.meta.env.DEV === false)
  const isDev = import.meta.env.DEV;

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!email || !password) {
      errorMsg = 'Harap isi email dan password';
      return;
    }

    isLoading = true;
    errorMsg = null;

    const res = await authStore.login({ email, password });
    isLoading = false;

    if (res.success) {
      goto('/inbox');
    } else {
      errorMsg = res.error || 'Login gagal';
    }
  }
</script>

<div class="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden transition-colors duration-200">
  <!-- Glowing Background Orbs -->
  <div class="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
  <div class="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

  <!-- Floating Theme Switcher -->
  <button
    onclick={() => themeStore.toggle()}
    class="absolute top-6 right-6 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-md backdrop-blur transition cursor-pointer"
    title="Ubah Tema"
  >
    {#if themeStore.current === 'dark'}
      <Sun class="w-4 h-4 text-amber-400" />
    {:else}
      <Moon class="w-4 h-4 text-indigo-500" />
    {/if}
  </button>

  <div class="w-full max-w-md relative z-10">
    <!-- Header Logo -->
    <div class="text-center mb-8">
      <div class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 items-center justify-center shadow-xl shadow-emerald-500/20 text-slate-950 mb-4">
        <Bot class="w-8 h-8 stroke-[2.5]" />
      </div>
      <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">WhatsApp CRM</h1>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Platform Omnichannel & Customer Relationship Management</p>
    </div>

    <!-- Login Card -->
    <div class="glass-panel rounded-2xl p-7 shadow-2xl">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-1">Masuk ke Akun Anda</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-6">Pilih portal Agen, Supervisor, atau Administrator</p>

      {#if errorMsg}
        <div class="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleLogin} class="space-y-4">
        <div>
          <label for="email" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Perusahaan</label>
          <div class="relative">
            <Mail class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder="admin@perusahaan.com"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label for="password" class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Kata Sandi</label>
          </div>
          <div class="relative">
            <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type="password"
              bind:value={password}
              placeholder="••••••••"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          class="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 cursor-pointer"
        >
          {#if isLoading}
            <div class="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></div>
            Memproses...
          {:else}
            Masuk ke Portal
            <ArrowRight class="w-4 h-4" />
          {/if}
        </button>
      </form>

      <!-- Demo 1-Click Login Shortcuts (hidden in production) -->
      {#if isDev}
      <div class="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
        <p class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center mb-2.5">
          Akun Demo Siap Pakai (1-Click)
        </p>
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            onclick={() => { email = 'admin@perusahaan.com'; password = 'admin12345'; }}
            class="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-center transition cursor-pointer"
          >
            <span class="block text-[11px] font-bold text-rose-600 dark:text-rose-400">Admin</span>
            <span class="block text-[9px] text-slate-500 dark:text-slate-400">admin@</span>
          </button>

          <button
            type="button"
            onclick={() => { email = 'spv@perusahaan.com'; password = 'admin12345'; }}
            class="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-center transition cursor-pointer"
          >
            <span class="block text-[11px] font-bold text-amber-600 dark:text-amber-400">Supervisor</span>
            <span class="block text-[9px] text-slate-500 dark:text-slate-400">spv@</span>
          </button>

          <button
            type="button"
            onclick={() => { email = 'agent@perusahaan.com'; password = 'admin12345'; }}
            class="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-center transition cursor-pointer"
          >
            <span class="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Agent</span>
            <span class="block text-[9px] text-slate-500 dark:text-slate-400">agent@</span>
          </button>
        </div>
      </div>
      {/if}

      <div class="mt-4 text-center">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Belum punya organisasi?
          <a href="/register" class="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold ml-1">Daftar sekarang</a>
        </p>
      </div>
    </div>
  </div>
</div>
