<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ShieldCheck, Lock, Mail, ArrowRight, Sun, Moon, Eye, EyeOff, Building2 } from 'lucide-svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let errorMsg = $state<string | null>(null);
  let showPassword = $state(false);

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

<svelte:head>
  <title>Masuk Portal Admin · WhatsApp CRM</title>
</svelte:head>

<div class="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
  <div class="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40" style="background-image: radial-gradient(rgb(148 163 184 / 0.25) 1px, transparent 1px); background-size: 22px 22px;" aria-hidden="true"></div>

  <button onclick={() => themeStore.toggle()} class="ui-icon-btn absolute top-4 right-4 sm:top-6 sm:right-6" title="Ubah tema" aria-label="Ubah tema">
    {#if themeStore.current === 'dark'}<Sun class="h-5 w-5" />{:else}<Moon class="h-5 w-5" />{/if}
  </button>

  <div class="relative w-full max-w-sm">
    <div class="mb-8 flex flex-col items-center text-center">
      <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 dark:bg-indigo-500">
        <ShieldCheck class="h-6 w-6" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Portal admin platform</h1>
      <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Khusus pemilik platform dan staf (Super Admin, Finance, Support).</p>
    </div>

    <div class="ui-card p-6 shadow-sm">
      {#if errorMsg}
        <div class="mb-5"><Alert tone="error" message={errorMsg} /></div>
      {/if}

      <form onsubmit={handleAdminLogin} class="space-y-5">
        <div>
          <label for="admin-email" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <div class="relative">
            <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="admin-email" type="email" bind:value={email} autocomplete="username" placeholder="admin@domain.com" class="ui-input py-2.5 pl-10 focus:border-indigo-500 focus:ring-indigo-500/10" required />
          </div>
        </div>
        <div>
          <label for="admin-password" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kata sandi</label>
          <div class="relative">
            <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              bind:value={password}
              autocomplete="current-password"
              placeholder="••••••••"
              class="ui-input py-2.5 pr-10 pl-10 focus:border-indigo-500 focus:ring-indigo-500/10"
              required
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              class="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {#if showPassword}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {#if isLoading}
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
            Memproses…
          {:else}
            Masuk
            <ArrowRight class="h-4 w-4" />
          {/if}
        </button>
      </form>
    </div>

    <p class="mt-6 flex items-center justify-center gap-1.5 text-center text-sm text-slate-500 dark:text-slate-400">
      <Building2 class="h-4 w-4" />
      Pengguna tenant?
      <a href="/login" class="font-semibold text-emerald-600 hover:underline dark:text-emerald-400">Masuk di sini</a>
    </p>
  </div>
</div>
