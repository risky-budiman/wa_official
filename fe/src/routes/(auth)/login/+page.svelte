<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-svelte';
  import AuthShell from '$lib/components/layout/AuthShell.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  let email = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let errorMsg = $state<string | null>(null);
  let showPassword = $state(false);

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

    const res = await authStore.login({ email, password, portalType: 'TENANT' });
    isLoading = false;

    if (res.success) {
      goto('/inbox');
    } else {
      errorMsg = res.error || 'Login gagal';
    }
  }
</script>

<AuthShell title="Masuk ke akun Anda" subtitle="Kelola percakapan WhatsApp pelanggan bersama tim Anda.">
  {#if errorMsg}
    <div class="mb-5"><Alert tone="error" message={errorMsg} /></div>
  {/if}

  <form onsubmit={handleLogin} class="space-y-5">
    <div>
      <label for="email" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
      <div class="relative">
        <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="email" type="email" bind:value={email} placeholder="nama@perusahaan.com" autocomplete="email" class="ui-input py-2.5 pl-10" required />
      </div>
    </div>

    <div>
      <label for="password" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kata sandi</label>
      <div class="relative">
        <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          bind:value={password}
          placeholder="••••••••"
          autocomplete="current-password"
          class="ui-input py-2.5 pr-10 pl-10"
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

    <button type="submit" disabled={isLoading} class="ui-btn-primary w-full py-2.5">
      {#if isLoading}
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
        Memproses…
      {:else}
        Masuk
        <ArrowRight class="h-4 w-4" />
      {/if}
    </button>
  </form>

  <!-- Demo shortcuts (development builds only) -->
  {#if isDev}
    <div class="mt-8 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
      <p class="mb-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">Akun demo (hanya mode development)</p>
      <div class="grid grid-cols-3 gap-2">
        {#each [{ label: 'Admin', email: 'admin@perusahaan.com' }, { label: 'Supervisor', email: 'spv@perusahaan.com' }, { label: 'Agent', email: 'agent@perusahaan.com' }] as demo}
          <button
            type="button"
            onclick={() => { email = demo.email; password = 'admin12345'; }}
            class="ui-btn-secondary !px-2 !py-1.5 text-xs"
          >
            {demo.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#snippet footer()}
    Belum punya organisasi?
    <a href="/register" class="ml-1 font-semibold text-emerald-600 hover:underline dark:text-emerald-400">Daftar sekarang</a>
  {/snippet}
</AuthShell>
