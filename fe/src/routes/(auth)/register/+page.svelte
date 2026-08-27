<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { Bot, Lock, Mail, User, Building, ArrowRight, AlertCircle } from 'lucide-svelte';

  let fullName = $state('');
  let email = $state('');
  let organizationName = $state('');
  let password = $state('');
  let isLoading = $state(false);
  let errorMsg = $state<string | null>(null);

  async function handleRegister(e: Event) {
    e.preventDefault();
    if (!fullName || !email || !organizationName || !password) {
      errorMsg = 'Harap lengkapi semua data formulir';
      return;
    }

    isLoading = true;
    errorMsg = null;

    const res = await authStore.register({
      fullName,
      email,
      organizationName,
      password
    });
    isLoading = false;

    if (res.success) {
      goto('/inbox');
    } else {
      errorMsg = res.error || 'Registrasi gagal';
    }
  }
</script>

<div class="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
  <div class="absolute top-1/3 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
  <div class="absolute bottom-1/3 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

  <div class="w-full max-w-md relative z-10">
    <div class="text-center mb-6">
      <div class="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 items-center justify-center shadow-xl shadow-emerald-500/20 text-slate-950 mb-3">
        <Bot class="w-7 h-7 stroke-[2.5]" />
      </div>
      <h1 class="text-xl font-extrabold tracking-tight text-white">Buat Organisasi Baru</h1>
      <p class="text-xs text-slate-400 mt-1">Daftarkan akun Administrator pertama untuk tim Anda</p>
    </div>

    <div class="glass-panel rounded-2xl p-7 shadow-2xl">
      {#if errorMsg}
        <div class="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-400">
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleRegister} class="space-y-3.5">
        <div>
          <label for="orgName" class="block text-xs font-semibold text-slate-300 mb-1">Nama Perusahaan / Brand</label>
          <div class="relative">
            <Building class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="orgName"
              type="text"
              bind:value={organizationName}
              placeholder="PT Contoh Bisnis Maju"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>
        </div>

        <div>
          <label for="fullName" class="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap Administrator</label>
          <div class="relative">
            <User class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="fullName"
              type="text"
              bind:value={fullName}
              placeholder="Budi Setiawan"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>
        </div>

        <div>
          <label for="email" class="block text-xs font-semibold text-slate-300 mb-1">Email Resmi</label>
          <div class="relative">
            <Mail class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder="admin@perusahaan.com"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>
        </div>

        <div>
          <label for="password" class="block text-xs font-semibold text-slate-300 mb-1">Kata Sandi (Min 8 karakter)</label>
          <div class="relative">
            <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type="password"
              bind:value={password}
              placeholder="••••••••"
              minlength="8"
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          class="w-full mt-3 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition disabled:opacity-50 cursor-pointer"
        >
          {#if isLoading}
            <div class="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></div>
            Mendaftarkan...
          {:else}
            Buat Akun & Organisasi
            <ArrowRight class="w-4 h-4" />
          {/if}
        </button>
      </form>

      <div class="mt-5 pt-4 border-t border-slate-800 text-center">
        <p class="text-xs text-slate-400">
          Sudah terdaftar?
          <a href="/login" class="text-emerald-400 hover:underline font-semibold ml-1">Masuk di sini</a>
        </p>
      </div>
    </div>
  </div>
</div>
