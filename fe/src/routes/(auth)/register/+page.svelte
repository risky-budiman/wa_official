<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { apiRequest } from '$lib/api/client';
  import { goto } from '$app/navigation';
  import { Bot, Lock, Mail, User, Building, ArrowRight, AlertCircle, Users, Plus, Link, CheckCircle2, Shield, Eye, EyeOff } from 'lucide-svelte';

  // ─── Mode: 'create' = Buat Organisasi Baru, 'join' = Gabung Organisasi ───
  let mode = $state<'create' | 'join'>('create');

  // ─── Common Fields ───
  let fullName = $state('');
  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);

  // ─── Create Org Fields ───
  let organizationName = $state('');

  // ─── Join Org Fields ───
  let organizationId = $state('');
  let selectedRole = $state<'AGENT' | 'SUPERVISOR'>('AGENT');
  let orgLookup = $state<{ name: string; id: string; memberCount: number } | null>(null);
  let orgLookupLoading = $state(false);
  let orgLookupError = $state<string | null>(null);

  // ─── State ───
  let isLoading = $state(false);
  let errorMsg = $state<string | null>(null);
  let lookupTimeout: any = null;

  // ─── Debounced Organization ID Lookup ───
  function handleOrgIdInput() {
    orgLookup = null;
    orgLookupError = null;

    if (lookupTimeout) clearTimeout(lookupTimeout);

    const trimmed = organizationId.trim();
    if (trimmed.length < 5) return;

    lookupTimeout = setTimeout(async () => {
      orgLookupLoading = true;
      orgLookupError = null;
      try {
        const res = await apiRequest(`/auth/org/${trimmed}`);
        if (res.success && res.organization) {
          orgLookup = res.organization;
        } else {
          orgLookupError = res.error || 'Organisasi tidak ditemukan';
          orgLookup = null;
        }
      } catch {
        orgLookupError = 'Gagal memvalidasi ID organisasi';
      }
      orgLookupLoading = false;
    }, 600);
  }

  // ─── Password Strength ───
  let passwordStrength = $derived(() => {
    const p = password;
    if (!p) return { level: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 1) return { level: 1, label: 'Lemah', color: 'bg-rose-500' };
    if (score <= 2) return { level: 2, label: 'Sedang', color: 'bg-amber-500' };
    if (score <= 3) return { level: 3, label: 'Kuat', color: 'bg-emerald-400' };
    return { level: 4, label: 'Sangat Kuat', color: 'bg-emerald-500' };
  });

  // ─── Validation ───
  let isFormValid = $derived(() => {
    const commonValid = fullName.trim().length >= 2 && email.includes('@') && password.length >= 8;
    if (mode === 'create') {
      return commonValid && organizationName.trim().length >= 2;
    } else {
      return commonValid && !!orgLookup;
    }
  });

  // ─── Submit Registration ───
  async function handleRegister(e: Event) {
    e.preventDefault();
    if (!isFormValid()) return;

    isLoading = true;
    errorMsg = null;

    const body: any = {
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    };

    if (mode === 'create') {
      body.organizationName = organizationName.trim();
    } else {
      body.organizationId = organizationId.trim();
      body.role = selectedRole;
    }

    const res = await authStore.register(body);
    isLoading = false;

    if (res.success) {
      goto('/inbox');
    } else {
      errorMsg = res.error || 'Registrasi gagal';
    }
  }
</script>

<div class="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden transition-colors duration-300">
  <!-- Ambient Background -->
  <div class="absolute top-1/3 -left-32 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
  <div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-3xl pointer-events-none animate-pulse" style="animation-delay: 1s;"></div>

  <div class="w-full max-w-lg relative z-10">
    <!-- Header -->
    <div class="text-center mb-6">
      <div class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 items-center justify-center shadow-xl shadow-emerald-500/20 text-slate-950 mb-4">
        <Bot class="w-8 h-8 stroke-[2.5]" />
      </div>
      <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Mulai Menggunakan CRM</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Buat organisasi baru atau bergabung ke tim yang sudah ada</p>
    </div>

    <!-- Mode Switcher -->
    <div class="flex bg-slate-100 dark:bg-slate-900/60 rounded-2xl p-1.5 mb-5 border border-slate-200 dark:border-slate-800 shadow-sm">
      <button
        type="button"
        onclick={() => { mode = 'create'; errorMsg = null; }}
        class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer {mode === 'create' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
      >
        <Plus class="w-4 h-4" />
        Buat Organisasi
      </button>
      <button
        type="button"
        onclick={() => { mode = 'join'; errorMsg = null; }}
        class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer {mode === 'join' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md shadow-blue-500/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
      >
        <Link class="w-4 h-4" />
        Gabung Organisasi
      </button>
    </div>

    <!-- Main Card -->
    <div class="glass-panel rounded-2xl p-7 shadow-2xl">
      {#if errorMsg}
        <div class="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleRegister} class="space-y-4">
        <!-- ━━━ MODE: CREATE ORG ━━━ -->
        {#if mode === 'create'}
          <div class="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <p class="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Building class="w-3.5 h-3.5" />
              Buat Organisasi Baru
            </p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Anda akan menjadi <strong class="text-emerald-600 dark:text-emerald-400">Administrator</strong> pertama</p>
          </div>

          <div>
            <label for="orgName" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Perusahaan / Brand</label>
            <div class="relative">
              <Building class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="orgName"
                type="text"
                bind:value={organizationName}
                placeholder="PT Contoh Bisnis Maju"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                required
              />
            </div>
          </div>

        <!-- ━━━ MODE: JOIN ORG ━━━ -->
        {:else}
          <div class="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <p class="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Users class="w-3.5 h-3.5" />
              Gabung Organisasi yang Sudah Ada
            </p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Minta ID organisasi dari Administrator tim Anda</p>
          </div>

          <div>
            <label for="orgId" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">ID Organisasi</label>
            <div class="relative">
              <Link class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="orgId"
                type="text"
                bind:value={organizationId}
                oninput={handleOrgIdInput}
                placeholder="Masukkan ID organisasi dari Admin"
                class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition
                  {orgLookup ? 'border-emerald-500 focus:ring-1 focus:ring-emerald-500' : orgLookupError ? 'border-rose-500 focus:ring-1 focus:ring-rose-500' : 'border-slate-200 dark:border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}"
                required
              />
              {#if orgLookupLoading}
                <div class="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
              {:else if orgLookup}
                <CheckCircle2 class="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
              {/if}
            </div>

            <!-- Org Lookup Result -->
            {#if orgLookup}
              <div class="mt-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Building class="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p class="text-sm font-bold text-slate-900 dark:text-white">{orgLookup.name}</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">ID: {orgLookup.id}</p>
                </div>
              </div>
            {:else if orgLookupError}
              <p class="mt-1.5 text-[11px] text-rose-500 flex items-center gap-1">
                <AlertCircle class="w-3 h-3" />
                {orgLookupError}
              </p>
            {/if}
          </div>

          <!-- Role Selector (Join Mode) -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Peran Anda di Tim</label>
            <div class="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onclick={() => selectedRole = 'AGENT'}
                class="p-3 rounded-xl border text-left transition cursor-pointer
                  {selectedRole === 'AGENT' ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <div class="flex items-center gap-2 mb-1">
                  <User class="w-3.5 h-3.5 {selectedRole === 'AGENT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}" />
                  <span class="text-xs font-bold {selectedRole === 'AGENT' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}">Agent</span>
                </div>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">Menangani chat pelanggan</p>
              </button>
              <button
                type="button"
                onclick={() => selectedRole = 'SUPERVISOR'}
                class="p-3 rounded-xl border text-left transition cursor-pointer
                  {selectedRole === 'SUPERVISOR' ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'}"
              >
                <div class="flex items-center gap-2 mb-1">
                  <Shield class="w-3.5 h-3.5 {selectedRole === 'SUPERVISOR' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}" />
                  <span class="text-xs font-bold {selectedRole === 'SUPERVISOR' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}">Supervisor</span>
                </div>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">Monitoring & manajemen tim</p>
              </button>
            </div>
          </div>
        {/if}

        <!-- ━━━ COMMON FIELDS ━━━ -->
        <div class="pt-1 border-t border-slate-100 dark:border-slate-800/50 space-y-3.5">
          <div>
            <label for="fullName" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
            <div class="relative">
              <User class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="fullName"
                type="text"
                bind:value={fullName}
                placeholder="Budi Setiawan"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                required
              />
            </div>
          </div>

          <div>
            <label for="email" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
            <div class="relative">
              <Mail class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                bind:value={email}
                placeholder="anda@perusahaan.com"
                class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                required
              />
            </div>
          </div>

          <div>
            <label for="password" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Kata Sandi (Min 8 karakter)</label>
            <div class="relative">
              <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                bind:value={password}
                placeholder="••••••••"
                minlength="8"
                class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                required
              />
              <button
                type="button"
                onclick={() => showPassword = !showPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition cursor-pointer"
                tabindex="-1"
              >
                {#if showPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
            <!-- Password Strength Indicator -->
            {#if password.length > 0}
              {@const strength = passwordStrength()}
              <div class="mt-2 flex items-center gap-2">
                <div class="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-300 {strength.color}"
                    style="width: {strength.level * 25}%"
                  ></div>
                </div>
                <span class="text-[10px] font-semibold {strength.level <= 1 ? 'text-rose-500' : strength.level <= 2 ? 'text-amber-500' : 'text-emerald-500'}">{strength.label}</span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          disabled={isLoading || !isFormValid()}
          class="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50 cursor-pointer
            {mode === 'create'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
              : 'bg-blue-500 hover:bg-blue-400 text-white shadow-blue-500/25'}"
        >
          {#if isLoading}
            <div class="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
            Mendaftarkan...
          {:else if mode === 'create'}
            Buat Akun & Organisasi
            <ArrowRight class="w-4 h-4" />
          {:else}
            Bergabung ke Organisasi
            <ArrowRight class="w-4 h-4" />
          {/if}
        </button>
      </form>

      <!-- Login Link -->
      <div class="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Sudah punya akun?
          <a href="/login" class="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold ml-1">Masuk di sini</a>
        </p>
      </div>
    </div>

    <!-- Info Footer -->
    <div class="mt-4 text-center">
      <p class="text-[11px] text-slate-400 dark:text-slate-500">
        {#if mode === 'join'}
          💡 Minta ID Organisasi dari Administrator tim Anda
        {:else}
          🔒 Data Anda terenkripsi dan aman
        {/if}
      </p>
    </div>
  </div>
</div>
