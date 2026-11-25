<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import Alert from '$lib/components/ui/Alert.svelte';
  import {
    X, Smartphone, Plus, CheckCircle2, ShieldCheck, MessageSquareText, PhoneCall, KeyRound,
    ArrowRight, ArrowLeft, Loader2, RefreshCw, AlertTriangle, BadgeCheck, Clock,
  } from 'lucide-svelte';

  interface WabaNumber {
    id: string;
    displayPhoneNumber: string;
    verifiedName: string;
    qualityRating?: string;
    status?: string;
    codeVerificationStatus?: string;
    nameStatus?: string;
    newNameStatus?: string;
    isActive: boolean;
  }

  interface Props {
    open: boolean;
    /** Current active number (for the summary) */
    currentNumber?: string;
    onclose: () => void;
    /** Called after the active number was switched */
    onchanged?: () => void;
  }
  let { open, currentNumber = '', onclose, onchanged }: Props = $props();

  type Step = 'intro' | 'pick' | 'add' | 'otp' | 'register' | 'confirm' | 'done';
  let step = $state<Step>('intro');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let info = $state<string | null>(null);

  let numbers = $state<WabaNumber[]>([]);
  let loadingNumbers = $state(false);
  let selected = $state<WabaNumber | null>(null);

  // add form
  let cc = $state('62');
  let newPhone = $state('');
  let newName = $state('');
  // otp / pin
  let otpMethod = $state<'SMS' | 'VOICE'>('SMS');
  let otpSent = $state(false);
  let otpCode = $state('');
  let pin = $state('');
  let doneMessage = $state('');

  const checklist = [
    'Nomor baru tidak sedang dipakai di aplikasi WhatsApp / WhatsApp Business di HP (hapus akunnya dulu).',
    'Nomor bisa menerima SMS atau panggilan telepon untuk kode OTP.',
    'Siapkan PIN 6 digit untuk verifikasi dua langkah nomor tersebut.',
    'Nama tampilan baru akan ditinjau Meta (biasanya beberapa jam hingga 1–2 hari).',
  ];

  $effect(() => {
    if (open) reset();
  });

  function reset() {
    step = 'intro';
    busy = false;
    error = null;
    info = null;
    selected = null;
    newPhone = '';
    newName = '';
    otpSent = false;
    otpCode = '';
    pin = '';
    doneMessage = '';
  }

  function go(next: Step) {
    error = null;
    info = null;
    step = next;
  }

  async function loadNumbers() {
    loadingNumbers = true;
    error = null;
    const res = await apiRequest<{ numbers: WabaNumber[] }>('/settings/waba/numbers');
    loadingNumbers = false;
    if (res.success) numbers = res.numbers || [];
    else error = res.error || 'Gagal memuat daftar nomor dari Meta';
  }

  async function openPick() {
    go('pick');
    await loadNumbers();
  }

  function choose(n: WabaNumber) {
    selected = n;
    if (n.codeVerificationStatus && n.codeVerificationStatus !== 'VERIFIED') {
      otpSent = false;
      otpCode = '';
      go('otp');
    } else {
      pin = '';
      go('register');
    }
  }

  async function addNumber(e: Event) {
    e.preventDefault();
    busy = true;
    error = null;
    const res = await apiRequest<{ phoneNumberId: string }>('/settings/waba/numbers', {
      method: 'POST',
      body: JSON.stringify({ cc, phoneNumber: newPhone, verifiedName: newName }),
    });
    busy = false;
    if (!res.success || !res.phoneNumberId) {
      error = res.error || 'Gagal menambahkan nomor';
      return;
    }
    selected = {
      id: res.phoneNumberId,
      displayPhoneNumber: `+${cc} ${newPhone.replace(/^0/, '')}`,
      verifiedName: newName,
      codeVerificationStatus: 'NOT_VERIFIED',
      isActive: false,
    };
    otpSent = false;
    otpCode = '';
    go('otp');
  }

  async function requestCode() {
    if (!selected) return;
    busy = true;
    error = null;
    const res = await apiRequest(`/settings/waba/numbers/${selected.id}/request-code`, {
      method: 'POST',
      body: JSON.stringify({ method: otpMethod }),
    });
    busy = false;
    if (res.success) {
      otpSent = true;
      info = res.message || 'Kode OTP dikirim.';
    } else error = res.error || 'Gagal mengirim kode OTP';
  }

  async function verifyCode(e: Event) {
    e.preventDefault();
    if (!selected) return;
    busy = true;
    error = null;
    const res = await apiRequest(`/settings/waba/numbers/${selected.id}/verify-code`, {
      method: 'POST',
      body: JSON.stringify({ code: otpCode }),
    });
    busy = false;
    if (res.success) {
      selected = { ...selected, codeVerificationStatus: 'VERIFIED' };
      pin = '';
      go('register');
      info = 'Nomor berhasil diverifikasi.';
    } else error = res.error || 'Kode OTP salah atau kedaluwarsa';
  }

  async function register(e: Event) {
    e.preventDefault();
    if (!selected) return;
    busy = true;
    error = null;
    const res = await apiRequest(`/settings/waba/numbers/${selected.id}/register`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    busy = false;
    if (res.success) {
      pin = '';
      go('confirm');
    } else error = res.error || 'Gagal mendaftarkan nomor';
  }

  async function activate() {
    if (!selected) return;
    busy = true;
    error = null;
    const res = await apiRequest<{ message: string }>(`/settings/waba/numbers/${selected.id}/activate`, { method: 'POST' });
    busy = false;
    if (res.success) {
      doneMessage = res.message || 'Nomor berhasil diganti.';
      go('done');
      onchanged?.();
    } else error = res.error || 'Gagal mengaktifkan nomor';
  }

  const stepIndex = $derived(
    { intro: 0, pick: 1, add: 1, otp: 2, register: 3, confirm: 4, done: 4 }[step],
  );
  const stepLabels = ['Persiapan', 'Pilih nomor', 'Verifikasi', 'PIN', 'Aktifkan'];

  function nameBadge(n: WabaNumber) {
    const s = (n.newNameStatus && n.newNameStatus !== 'NONE' ? n.newNameStatus : n.nameStatus) || '';
    if (s === 'APPROVED' || s === 'AVAILABLE_WITHOUT_REVIEW') return { text: 'Nama disetujui', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' };
    if (s.includes('PENDING') || s === 'NONE' || !s) return { text: 'Nama ditinjau', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' };
    if (s === 'DECLINED') return { text: 'Nama ditolak', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' };
    return { text: s.toLowerCase(), cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cn-title">
    <button type="button" class="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-[2px]" aria-label="Tutup" onclick={() => !busy && onclose()}></button>

    <div class="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Smartphone class="h-5 w-5" />
          </span>
          <div>
            <h2 id="cn-title" class="text-base font-semibold text-slate-900 dark:text-white">Ganti nomor WhatsApp</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">{currentNumber ? `Nomor sekarang: ${currentNumber}` : 'Hubungkan nomor baru ke organisasi Anda'}</p>
          </div>
        </div>
        <button type="button" class="ui-icon-btn" aria-label="Tutup" onclick={onclose} disabled={busy}><X class="h-5 w-5" /></button>
      </div>

      <!-- Stepper -->
      {#if step !== 'done'}
        <ol class="flex items-center gap-1 border-b border-slate-100 px-6 py-3 text-xs dark:border-slate-800">
          {#each stepLabels as label, i}
            <li class="flex flex-1 items-center gap-1.5 {i <= stepIndex ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}">
              <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold {i < stepIndex ? 'bg-emerald-600 text-white' : i === stepIndex ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/30 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800'}">
                {#if i < stepIndex}<CheckCircle2 class="h-3.5 w-3.5" />{:else}{i + 1}{/if}
              </span>
              <span class="hidden truncate font-medium sm:inline">{label}</span>
            </li>
          {/each}
        </ol>
      {/if}

      <!-- Body -->
      <div class="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {#if error}<Alert tone="error" message={error} />{/if}
        {#if info}<Alert tone="success" message={info} />{/if}

        {#if step === 'intro'}
          <p class="text-sm text-slate-600 dark:text-slate-300">Sebelum mulai, pastikan hal berikut:</p>
          <ul class="space-y-2.5">
            {#each checklist as item}
              <li class="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{item}
              </li>
            {/each}
          </ul>
          <div class="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:ring-slate-700">
            <p class="mb-1 font-medium text-slate-800 dark:text-slate-100">Yang terjadi setelah ganti nomor</p>
            <ul class="list-disc space-y-1 pl-5">
              <li>Riwayat percakapan tetap ada di Inbox.</li>
              <li>Pesan baru dikirim & diterima lewat nomor baru. Pelanggan melihatnya sebagai kontak berbeda.</li>
              <li>Template di WABA yang sama tetap bisa dipakai. Kualitas & limit pesan nomor baru mulai dari awal.</li>
            </ul>
          </div>

        {:else if step === 'pick'}
          <div class="flex items-center justify-between">
            <p class="text-sm text-slate-600 dark:text-slate-300">Nomor yang ada di WhatsApp Business Account Anda:</p>
            <button type="button" class="ui-icon-btn h-8 w-8" onclick={loadNumbers} aria-label="Muat ulang" disabled={loadingNumbers}>
              <RefreshCw class="h-4 w-4 {loadingNumbers ? 'animate-spin' : ''}" />
            </button>
          </div>

          {#if loadingNumbers}
            <div class="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 class="h-4 w-4 animate-spin" /> Memuat dari Meta…</div>
          {:else}
            <ul class="space-y-2">
              {#each numbers as n (n.id)}
                {@const nb = nameBadge(n)}
                <li class="flex items-center gap-3 rounded-xl border p-3.5 {n.isActive ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-500/5' : 'border-slate-200 dark:border-slate-700'}">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{n.displayPhoneNumber}</p>
                    <p class="truncate text-xs text-slate-500 dark:text-slate-400">{n.verifiedName}</p>
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      {#if n.codeVerificationStatus === 'VERIFIED'}
                        <span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><BadgeCheck class="h-3 w-3" /> Terverifikasi</span>
                      {:else}
                        <span class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Clock class="h-3 w-3" /> Belum verifikasi OTP</span>
                      {/if}
                      <span class="rounded-md px-1.5 py-0.5 text-[11px] font-medium {nb.cls}">{nb.text}</span>
                    </div>
                  </div>
                  {#if n.isActive}
                    <span class="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">Aktif</span>
                  {:else}
                    <button type="button" class="ui-btn-secondary shrink-0 !px-3 !py-1.5 text-xs" onclick={() => choose(n)}>
                      {n.codeVerificationStatus === 'VERIFIED' ? 'Pilih' : 'Verifikasi'}
                      <ArrowRight class="h-3.5 w-3.5" />
                    </button>
                  {/if}
                </li>
              {:else}
                <li class="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">Belum ada nomor lain di WABA ini.</li>
              {/each}
            </ul>
          {/if}

          <button type="button" class="ui-btn-secondary w-full border-dashed" onclick={() => go('add')}>
            <Plus class="h-4 w-4" /> Tambah nomor baru ke WABA
          </button>
          <p class="text-xs text-slate-500 dark:text-slate-400">Nomornya ada di WhatsApp Business Account lain? Tutup jendela ini dan gunakan <strong class="font-semibold">Login with Facebook</strong> untuk memilihnya.</p>

        {:else if step === 'add'}
          <form id="cn-add" onsubmit={addNumber} class="space-y-4">
            <div>
              <label for="cn-phone" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nomor WhatsApp baru</label>
              <div class="flex gap-2">
                <div class="relative w-24 shrink-0">
                  <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">+</span>
                  <input aria-label="Kode negara" class="ui-input pl-6 tabular-nums" bind:value={cc} inputmode="numeric" maxlength="3" required />
                </div>
                <input id="cn-phone" class="ui-input flex-1 tabular-nums" bind:value={newPhone} inputmode="tel" placeholder="81234567890" required />
              </div>
            </div>
            <div>
              <label for="cn-name" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama tampilan</label>
              <input id="cn-name" class="ui-input" bind:value={newName} placeholder="Nama bisnis Anda" minlength="3" maxlength="120" required />
              <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Harus sesuai nama bisnis. Akan ditinjau oleh Meta.</p>
            </div>
          </form>

        {:else if step === 'otp' && selected}
          <p class="text-sm text-slate-600 dark:text-slate-300">Kirim kode verifikasi ke <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{selected.displayPhoneNumber}</strong>.</p>
          <div class="grid grid-cols-2 gap-2">
            {#each [{ v: 'SMS', label: 'SMS', icon: MessageSquareText }, { v: 'VOICE', label: 'Telepon', icon: PhoneCall }] as m}
              <button
                type="button"
                onclick={() => (otpMethod = m.v as 'SMS' | 'VOICE')}
                class="flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition {otpMethod === m.v ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}"
              >
                <m.icon class="h-4 w-4" /> {m.label}
              </button>
            {/each}
          </div>
          <button type="button" class="ui-btn-secondary w-full" onclick={requestCode} disabled={busy}>
            {#if busy && !otpSent}<Loader2 class="h-4 w-4 animate-spin" />{/if}
            {otpSent ? 'Kirim ulang kode' : 'Kirim kode OTP'}
          </button>
          {#if otpSent}
            <form id="cn-otp" onsubmit={verifyCode}>
              <label for="cn-code" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kode OTP</label>
              <input id="cn-code" class="ui-input text-center font-mono text-lg tracking-[0.4em]" bind:value={otpCode} inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••" required />
            </form>
          {/if}

        {:else if step === 'register' && selected}
          <div class="flex items-start gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/50 dark:ring-slate-700">
            <KeyRound class="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <p class="text-sm text-slate-600 dark:text-slate-300">
              Daftarkan <strong class="font-semibold tabular-nums text-slate-900 dark:text-white">{selected.displayPhoneNumber}</strong> ke WhatsApp Cloud API dengan PIN 6 digit.
              Jika nomor sudah pernah memakai PIN verifikasi dua langkah, masukkan PIN yang sama.
            </p>
          </div>
          <form id="cn-pin" onsubmit={register}>
            <label for="cn-pin-input" class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">PIN verifikasi dua langkah</label>
            <input id="cn-pin-input" type="password" class="ui-input text-center font-mono text-lg tracking-[0.4em]" bind:value={pin} inputmode="numeric" maxlength="6" pattern="\d{6}" autocomplete="off" placeholder="••••••" required />
          </form>
          <p class="text-xs text-slate-500 dark:text-slate-400">Nomor sudah terdaftar di Cloud API sebelumnya? Anda boleh melewati langkah ini.</p>

        {:else if step === 'confirm' && selected}
          <div class="space-y-3">
            <div class="flex items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div class="min-w-0 flex-1">
                <p class="text-xs text-slate-500">Nomor lama</p>
                <p class="truncate text-sm font-semibold tabular-nums text-slate-500 line-through dark:text-slate-400">{currentNumber || '—'}</p>
              </div>
              <ArrowRight class="h-4 w-4 shrink-0 text-slate-400" />
              <div class="min-w-0 flex-1 text-right">
                <p class="text-xs text-slate-500">Nomor baru</p>
                <p class="truncate text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{selected.displayPhoneNumber}</p>
              </div>
            </div>
            <div class="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
              <p>Setelah diaktifkan, nomor lama diarsipkan dan tidak lagi menerima pesan di aplikasi ini. Riwayat chat tetap tersimpan.</p>
            </div>
          </div>

        {:else if step === 'done'}
          <div class="flex flex-col items-center py-6 text-center">
            <span class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <ShieldCheck class="h-7 w-7" />
            </span>
            <p class="text-base font-semibold text-slate-900 dark:text-white">{doneMessage}</p>
            <p class="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Kirim pesan uji ke nomor baru untuk memastikan pesan masuk ke Inbox. Jika nama tampilan masih ditinjau Meta, pesan tetap bisa dikirim dengan nama sementara.
            </p>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900">
        {#if step === 'intro'}
          <button type="button" class="ui-btn-ghost" onclick={onclose}>Batal</button>
          <button type="button" class="ui-btn-primary" onclick={openPick}>Saya siap <ArrowRight class="h-4 w-4" /></button>
        {:else if step === 'pick'}
          <button type="button" class="ui-btn-ghost" onclick={() => go('intro')}><ArrowLeft class="h-4 w-4" /> Kembali</button>
          <span></span>
        {:else if step === 'add'}
          <button type="button" class="ui-btn-ghost" onclick={() => go('pick')} disabled={busy}><ArrowLeft class="h-4 w-4" /> Kembali</button>
          <button type="submit" form="cn-add" class="ui-btn-primary" disabled={busy}>
            {#if busy}<Loader2 class="h-4 w-4 animate-spin" />{/if} Tambahkan & lanjut
          </button>
        {:else if step === 'otp'}
          <button type="button" class="ui-btn-ghost" onclick={() => go('pick')} disabled={busy}><ArrowLeft class="h-4 w-4" /> Kembali</button>
          <button type="submit" form="cn-otp" class="ui-btn-primary" disabled={busy || !otpSent || otpCode.length < 4}>
            {#if busy && otpSent}<Loader2 class="h-4 w-4 animate-spin" />{/if} Verifikasi
          </button>
        {:else if step === 'register'}
          <button type="button" class="ui-btn-ghost" onclick={() => go('confirm')} disabled={busy}>Lewati</button>
          <button type="submit" form="cn-pin" class="ui-btn-primary" disabled={busy || pin.length !== 6}>
            {#if busy}<Loader2 class="h-4 w-4 animate-spin" />{/if} Daftarkan
          </button>
        {:else if step === 'confirm'}
          <button type="button" class="ui-btn-ghost" onclick={() => go('pick')} disabled={busy}><ArrowLeft class="h-4 w-4" /> Pilih lagi</button>
          <button type="button" class="ui-btn-primary" onclick={activate} disabled={busy}>
            {#if busy}<Loader2 class="h-4 w-4 animate-spin" />{/if} Aktifkan nomor ini
          </button>
        {:else}
          <span></span>
          <button type="button" class="ui-btn-primary" onclick={onclose}>Selesai</button>
        {/if}
      </div>
    </div>
  </div>
{/if}
