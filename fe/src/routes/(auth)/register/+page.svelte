<script lang="ts">
  import Alert from '$lib/components/ui/Alert.svelte';
  import AuthShell from '$lib/components/layout/AuthShell.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { apiRequest } from '$lib/api/client';
  import { goto } from '$app/navigation';
  import { Lock, Mail, User, Building, ArrowRight, AlertCircle, Users, Plus, Link, CheckCircle2, Eye, EyeOff } from 'lucide-svelte';

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

<AuthShell title="Buat akun baru" subtitle="Daftarkan perusahaan Anda, atau bergabung ke tim yang sudah ada." width="md">
    <!-- Mode Switcher -->
    <div class="mb-6 flex rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800/60">
      <button
        type="button"
        onclick={() => { mode = 'create'; errorMsg = null; }}
        class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 {mode === 'create' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
      >
        <Plus class="w-4 h-4" />
        Buat Organisasi
      </button>
      <button
        type="button"
        onclick={() => { mode = 'join'; errorMsg = null; }}
        class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 {mode === 'join' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md shadow-blue-500/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}"
      >
        <Link class="w-4 h-4" />
        Gabung Organisasi
      </button>
    </div>

    <!-- Main Card -->
    <div>
      {#if errorMsg}
        <div class="mb-5"><Alert tone="error" message={errorMsg} /></div>
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
            <label for="orgName" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Perusahaan / Brand</label>
            <div class="relative">
              <Building class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="orgName"
                type="text"
                bind:value={organizationName}
                placeholder="PT Contoh Bisnis Maju"
                class="ui-input py-2.5 pl-10 pr-4"
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
            <label for="orgId" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">ID Organisasi</label>
            <div class="relative">
              <Link class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="orgId"
                type="text"
                bind:value={organizationId}
                oninput={handleOrgIdInput}
                placeholder="Masukkan ID organisasi dari Admin"
                class="ui-input py-2.5 pl-10 pr-10
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

          <!-- Role info (Join Mode) — role is assigned by the organization's Administrator -->
          <div class="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/40">
            <div class="flex items-center gap-2 mb-1">
              <User class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400">Bergabung sebagai Agent</span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Akun baru masuk sebagai Agent. Administrator organisasi dapat mengubah peran Anda (mis. Supervisor) lewat menu Manajemen Pengguna.
            </p>
          </div>
        {/if}

        <!-- ━━━ COMMON FIELDS ━━━ -->
        <div class="pt-1 border-t border-slate-100 dark:border-slate-800/50 space-y-3.5">
          <div>
            <label for="fullName" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Lengkap</label>
            <div class="relative">
              <User class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="fullName"
                type="text"
                bind:value={fullName}
                placeholder="Budi Setiawan"
                class="ui-input py-2.5 pl-10 pr-4"
                required
              />
            </div>
          </div>

          <div>
            <label for="email" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <div class="relative">
              <Mail class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                bind:value={email}
                placeholder="anda@perusahaan.com"
                class="ui-input py-2.5 pl-10 pr-4"
                required
              />
            </div>
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kata Sandi (Min 8 karakter)</label>
            <div class="relative">
              <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                bind:value={password}
                placeholder="••••••••"
                minlength="8"
                class="ui-input py-2.5 pl-10 pr-10"
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
                <span class="text-[11px] font-semibold {strength.level <= 1 ? 'text-rose-500' : strength.level <= 2 ? 'text-amber-500' : 'text-emerald-500'}">{strength.label}</span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          disabled={isLoading || !isFormValid()}
          class="ui-btn-primary mt-2 w-full py-2.5"
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

    </div>

  {#snippet footer()}
    Sudah punya akun?
    <a href="/login" class="ml-1 font-semibold text-emerald-600 hover:underline dark:text-emerald-400">Masuk</a>
    <p class="mt-2 text-xs text-slate-400 dark:text-slate-500">
      {#if mode === 'join'}Minta ID organisasi dari Administrator tim Anda.{:else}Anda akan menjadi Administrator pertama organisasi ini.{/if}
    </p>
  {/snippet}
</AuthShell>
