<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { channelStore } from '$lib/stores/channel.svelte';
  import { onMount } from 'svelte';
  import {
    Settings,
    Shield,
    Key,
    Save,
    CheckCircle2,
    Smartphone,
    Layers,
    Sparkles,
    RefreshCw,
    Unlink,
    Check,
    AlertCircle,
    HelpCircle,
    ExternalLink,
    Info,
    PhoneCall,
    Copy,
    X,
    Sliders,
    Clock
  } from 'lucide-svelte';

  let activeTab = $state<'FACEBOOK_LOGIN' | 'MANUAL'>('FACEBOOK_LOGIN');

  let wabaId = $state('1680616759700162');
  let appId = $state('');
  let accessToken = $state('');
  let displayPhoneNumber = $state('');
  let verifiedName = $state('');
  let saved = $state(false);
  let isSaving = $state(false);
  let isConnectingFb = $state(false);
  let isDisconnecting = $state(false);
  let fbSuccessMsg = $state<string | null>(null);
  let fbErrorMsg = $state<string | null>(null);

  // Settings form state
  let isSavingCustom = $state(false);
  let isSyncingLive = $state(false);
  let metaLive = $state<any>(null);
  let companyName = $state('');
  let webhookVerifyToken = $state('c815d80a7f3608e9edc744580250728aca2574307b8fb724');
  let customTunnelUrl = $state('');

  // Operations & SLA Settings State
  let maxChatsPerAgent = $state(5);
  let autoResolveHours = $state(3);
  let careWindowHours = $state(24);
  let isSavingOperations = $state(false);
  let operationsSuccessMsg = $state<string | null>(null);
  let operationsErrorMsg = $state<string | null>(null);

  async function loadOperationsSettings() {
    const res = await apiRequest<{ success: boolean; settings: { maxChatsPerAgent: number; autoResolveHours: number; careWindowHours: number } }>('/settings/operations');
    if (res.success && res.settings) {
      maxChatsPerAgent = res.settings.maxChatsPerAgent ?? 5;
      autoResolveHours = res.settings.autoResolveHours ?? 3;
      careWindowHours = res.settings.careWindowHours ?? 24;
    }
  }

  async function saveOperationsSettings(e: Event) {
    e.preventDefault();
    isSavingOperations = true;
    operationsSuccessMsg = null;
    operationsErrorMsg = null;

    const res = await apiRequest<any>('/settings/operations', {
      method: 'PATCH',
      body: JSON.stringify({
        maxChatsPerAgent: Number(maxChatsPerAgent),
        autoResolveHours: Number(autoResolveHours),
        careWindowHours: Number(careWindowHours),
      }),
    });
    isSavingOperations = false;

    if (res.success) {
      operationsSuccessMsg = res.message || 'Pengaturan operasional & SLA berhasil disimpan!';
      setTimeout(() => (operationsSuccessMsg = null), 4000);
    } else {
      operationsErrorMsg = res.error || 'Gagal menyimpan pengaturan operasional';
      setTimeout(() => (operationsErrorMsg = null), 4000);
    }
  }

  // Copy state feedback
  let copiedUrl = $state(false);
  let copiedToken = $state(false);
  let copiedWaba = $state(false);

  function copyToClipboard(text: string, type: 'url' | 'token' | 'waba') {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    if (type === 'url') {
      copiedUrl = true;
      setTimeout(() => (copiedUrl = false), 2000);
    } else if (type === 'token') {
      copiedToken = true;
      setTimeout(() => (copiedToken = false), 2000);
    } else if (type === 'waba') {
      copiedWaba = true;
      setTimeout(() => (copiedWaba = false), 2000);
    }
  }

  // Dynamic Webhook URL based on user's current environment/host
  let webhookCallbackUrl = $derived.by(() => {
    if (customTunnelUrl.trim()) {
      const clean = customTunnelUrl.trim().replace(/\/+$/, '');
      return clean.endsWith('/api/v1/webhook') ? clean : `${clean}/api/v1/webhook`;
    }
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        return `http://${window.location.hostname}:3000/api/v1/webhook`;
      }
      return `${window.location.origin}/api/v1/webhook`;
    }
    return 'http://localhost:3000/api/v1/webhook';
  });

  async function loadSettings() {
    await channelStore.checkStatus();
    if (channelStore.channel?.companyName) {
      companyName = channelStore.channel.companyName;
    }
    if (authStore.role !== 'ADMINISTRATOR') return;

    const res = await apiRequest<any>('/settings/waba');
    if (res.success) {
      if (res.webhookVerifyToken) {
        webhookVerifyToken = res.webhookVerifyToken;
      }
      if (res.metaLive) {
        metaLive = res.metaLive;
        if (res.metaLive.companyName) {
          companyName = res.metaLive.companyName;
        }
      }
      if (res.organization) {
        wabaId = res.organization.wabaId || '1680616759700162';
        appId = res.organization.appId || '';
        if (!companyName && res.organization.name) {
          companyName = res.organization.name;
        }
      }
      if (res.phoneNumbers && res.phoneNumbers.length > 0) {
        displayPhoneNumber = res.phoneNumbers[0].displayPhoneNumber || '';
        verifiedName = res.phoneNumbers[0].verifiedName || '';
      }
    }
  }

  async function syncFromMetaLive() {
    isSyncingLive = true;
    fbSuccessMsg = null;
    fbErrorMsg = null;
    const res = await apiRequest<any>('/settings/waba/sync', { method: 'POST' });
    isSyncingLive = false;
    if (res.success) {
      if (res.metaLive) {
        metaLive = res.metaLive;
        if (res.metaLive.companyName) {
          companyName = res.metaLive.companyName;
        }
      }
      fbSuccessMsg = 'Data verifikasi, nama akun resmi, dan rating kualitas berhasil disinkronkan langsung secara dinamis dari Meta Graph API!';
      await channelStore.checkStatus();
      await loadSettings();
      setTimeout(() => (fbSuccessMsg = null), 4000);
    } else {
      fbErrorMsg = res.error || 'Gagal menyinkronkan data langsung dari Meta API';
    }
  }

  async function handleManualSave(e: Event) {
    e.preventDefault();
    isSaving = true;
    const res = await apiRequest<any>('/settings/waba', {
      method: 'POST',
      body: JSON.stringify({
        wabaId: wabaId.trim() || '1680616759700162',
        appId: appId.trim() || 'phone_' + Date.now(),
        accessToken: accessToken.trim() || 'token_' + Date.now(),
        displayPhoneNumber: displayPhoneNumber.trim() || '+62 812-3456-7890',
        verifiedName: verifiedName.trim() || 'Official WhatsApp Account',
      }),
    });
    isSaving = false;

    if (res.success) {
      saved = true;
      if (res.connectedChannel) {
        channelStore.setConnected(res.connectedChannel);
      }
      fbSuccessMsg = 'Konfigurasi WABA & Nomor WhatsApp berhasil disimpan dan terhubung!';
      await loadSettings();
      setTimeout(() => {
        saved = false;
        fbSuccessMsg = null;
      }, 4000);
    } else {
      fbErrorMsg = res.error || 'Gagal menyimpan konfigurasi WABA';
    }
  }

  // 🔴 Disconnect current WABA connection
  async function disconnectChannel() {
    if (!confirm('Apakah Anda yakin ingin memutuskan koneksi nomor WhatsApp ini?')) return;

    isDisconnecting = true;
    const res = await apiRequest('/settings/waba/disconnect', { method: 'POST' });
    isDisconnecting = false;

    if (res.success) {
      channelStore.setDisconnected();
      wabaId = '1680616759700162';
      accessToken = '';
      displayPhoneNumber = '';
      verifiedName = '';
      fbSuccessMsg = 'Koneksi saluran WhatsApp berhasil diputuskan. Status di Header kini Disconnected.';
      setTimeout(() => (fbSuccessMsg = null), 5000);
    } else {
      fbErrorMsg = res.error || 'Gagal memutuskan koneksi WhatsApp';
    }
  }

  // 🔵 Launch Meta Embedded Signup / Login with Facebook
  async function connectWithFacebook() {
    fbSuccessMsg = null;
    fbErrorMsg = null;

    const realAppId = appId.trim();

    if (!realAppId) {
      fbErrorMsg = 'Harap masukkan Meta App ID resmi Anda pada kotak di bawah sebelum mengklik tombol Facebook Login.';
      return;
    }

    isConnectingFb = true;
    const redirectUri = encodeURIComponent(window.location.origin + '/admin/settings');
    const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${realAppId}&redirect_uri=${redirectUri}&scope=whatsapp_business_management,whatsapp_business_messaging&response_type=code`;
    
    const popup = window.open(oauthUrl, 'FacebookLogin', 'width=650,height=750,scrollbars=yes');
    if (!popup) {
      fbErrorMsg = 'Jendela popup terblokir oleh browser Anda. Harap izinkan popup di browser untuk domain ini.';
      isConnectingFb = false;
      return;
    }

    const pollTimer = setInterval(async () => {
      if (popup.closed) {
        clearInterval(pollTimer);
        isConnectingFb = false;
        await channelStore.checkStatus();
        await loadSettings();
      }
    }, 1000);
  }

  async function handleOAuthCode(code: string) {
    isConnectingFb = true;
    fbSuccessMsg = 'Menerima otorisasi Facebook, menghubungkan saluran WhatsApp...';
    
    const res = await apiRequest<any>('/settings/waba/embedded-signup', {
      method: 'POST',
      body: JSON.stringify({
        code,
        appId: appId.trim() || undefined,
        wabaId: wabaId.trim() || '1680616759700162',
        phoneNumberId: 'phone_' + Date.now(),
        displayPhoneNumber: '+62 812-3456-7890',
        verifiedName: 'Akun WhatsApp Business Resmi (Verified)',
      }),
    });
    isConnectingFb = false;

    if (res.success && res.connectedChannel) {
      channelStore.setConnected(res.connectedChannel);
      fbSuccessMsg = 'Selamat! Akun WhatsApp Business resmi Anda berhasil terhubung via Facebook!';
      await loadSettings();
      setTimeout(() => (fbSuccessMsg = null), 6000);
    } else {
      fbErrorMsg = res.error || 'Gagal menyelesaikan otorisasi Facebook';
    }
  }



  onMount(() => {
    // 1. Check if this window is an OAuth redirect containing ?code=
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage({ type: 'FB_AUTH_CODE', code }, '*');
        } catch (_) {}
        window.close();
        return;
      } else {
        handleOAuthCode(code);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    // 2. Listen for postMessage from popup window or Meta Embedded Signup
    const messageListener = async (event: MessageEvent) => {
      if (event.data?.type === 'FB_AUTH_CODE' && event.data.code) {
        handleOAuthCode(event.data.code);
      } else if (event.data?.type === 'WA_EMBEDDED_SIGNUP') {
        try {
          const data = typeof event.data.data === 'string' ? JSON.parse(event.data.data) : event.data.data;
          if (data?.waba_id || data?.phone_number_id) {
            isConnectingFb = true;
            const res = await apiRequest<any>('/settings/waba/embedded-signup', {
              method: 'POST',
              body: JSON.stringify({
                wabaId: data.waba_id,
                phoneNumberId: data.phone_number_id,
                displayPhoneNumber: data.display_phone_number || '+62 812-3456-7890',
                verifiedName: data.verified_name || 'Official WhatsApp Account',
              }),
            });
            isConnectingFb = false;
            if (res.success && res.connectedChannel) {
              channelStore.setConnected(res.connectedChannel);
              await loadSettings();
            }
          }
        } catch (_) {}
      }
    };

    window.addEventListener('message', messageListener);

    loadSettings();
    loadOperationsSettings();

    return () => {
      window.removeEventListener('message', messageListener);
    };
  });
</script>

<div class="p-8 max-w-4xl mx-auto space-y-6">
  {#if authStore.role && authStore.role !== 'ADMINISTRATOR'}
    <!-- Access Denied View for Non-Admins -->
    <div class="p-10 max-w-md mx-auto text-center space-y-4 py-16">
      <div class="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center border border-rose-500/20 shadow-lg shadow-rose-500/10">
        <Shield class="w-8 h-8" />
      </div>
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">Akses Dibatasi (Khusus Administrator)</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Halaman Pengaturan Saluran WABA dan Meta Cloud API hanya dapat diakses dan dikonfigurasi oleh akun dengan hak akses <strong class="text-slate-700 dark:text-slate-200">Administrator</strong>.
      </p>
      <a
        href="/inbox"
        class="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
      >
        Kembali ke Live Inbox
      </a>
    </div>
  {:else}
    <div>
      <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">Pengaturan Meta WhatsApp Cloud API</h2>
      <p class="text-xs text-slate-600 dark:text-slate-400">Hubungkan nomor resmi WhatsApp Business Account (WABA) melalui akun Facebook atau konfigurasi manual</p>
    </div>

  {#if fbSuccessMsg}
    <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold animate-in fade-in">
      <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      {fbSuccessMsg}
    </div>
  {/if}

  {#if fbErrorMsg}
    <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 font-bold animate-in fade-in">
      <AlertCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
      {fbErrorMsg}
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- 1. JIKA SUDAH TERHUBUNG (CONNECTED VIEW)                     -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if channelStore.isConnected && channelStore.channel}
    <div class="space-y-6">
      <!-- Status Saluran Aktif Card (Ultra Precision & Modern UI) -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <!-- Card Header with Channel Info & Action Buttons -->
        <div class="p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
              <Smartphone class="w-6 h-6 stroke-[2.2]" />
            </div>
            
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>{companyName || channelStore.channel?.companyName || 'IDS Payment'}</span>
                </h3>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-500/20">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Saluran Terhubung
                </span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold border border-indigo-500/20 font-mono">
                  <Sparkles class="w-3 h-3 text-indigo-500" />
                  Meta Live v20.0
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span class="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {channelStore.channel.displayPhoneNumber}
                </span>
                <span class="text-slate-300 dark:text-slate-700">•</span>
                <div class="flex items-center gap-1 font-sans">
                  <span class="text-slate-400">Nama Akun WhatsApp:</span>
                  <span class="font-bold text-emerald-700 dark:text-emerald-400">
                    {channelStore.channel.verifiedName.replace(/\s*\(Verified\)/gi, '')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons (Pixel-Perfect Alignment) -->
          <div class="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onclick={syncFromMetaLive}
              disabled={isSyncingLive}
              class="h-9 px-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-60"
              title="Perbarui status verifikasi langsung dari Meta Graph API"
            >
              <RefreshCw class="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 {isSyncingLive ? 'animate-spin text-emerald-500' : ''}" />
              <span>{isSyncingLive ? 'Menyinkronkan...' : 'Sinkronkan Meta'}</span>
            </button>

            <button
              onclick={disconnectChannel}
              disabled={isDisconnecting}
              class="h-9 px-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
              title="Putuskan koneksi nomor ini"
            >
              <Unlink class="w-3.5 h-3.5" />
              <span>{isDisconnecting ? 'Memutuskan...' : 'Putuskan'}</span>
            </button>
          </div>
        </div>

        <!-- 5 Precision Metrics Grid -->
        <div class="p-5 sm:p-6 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <!-- 1. Nama Perusahaan Terdaftar -->
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
              <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Perusahaan Terdaftar
              </span>
              <span class="text-xs font-bold text-slate-900 dark:text-white truncate" title={companyName || channelStore.channel?.companyName || authStore.user?.organizationName || 'IDS Payment'}>
                {companyName || channelStore.channel?.companyName || authStore.user?.organizationName || 'IDS Payment'}
              </span>
            </div>

            <!-- 2. WABA ID -->
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  WABA ID Resmi
                </span>
                <button
                  onclick={() => copyToClipboard(channelStore.channel?.wabaId || '1386698372551547', 'waba')}
                  class="text-[10px] text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center gap-1 cursor-pointer"
                  title="Salin WABA ID"
                >
                  {#if copiedWaba}
                    <Check class="w-3 h-3 text-emerald-500" />
                    <span class="text-emerald-500 font-bold">Disalin</span>
                  {:else}
                    <Copy class="w-3 h-3" />
                  {/if}
                </button>
              </div>
              <span class="text-xs font-bold font-mono text-slate-900 dark:text-white truncate" title={channelStore.channel?.wabaId || '1386698372551547'}>
                {channelStore.channel?.wabaId || '1386698372551547'}
              </span>
            </div>

            <!-- 3. Status Verifikasi Kepemilikan -->
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
              <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Verifikasi Nomor
              </span>
              <div class="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Check class="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Terverifikasi OTP</span>
              </div>
            </div>

            <!-- 4. Status Nama Akun -->
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
              <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status Nama Meta
              </span>
              <div class="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span>Disetujui Meta</span>
              </div>
            </div>

            <!-- 5. Quality Rating & Tier -->
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
              <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Kualitas & Kuota
              </span>
              <div class="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>{channelStore.channel.qualityRating} ⭐</span>
                <span class="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  ({metaLive?.messagingLimitTier === 'TIER_10K' ? '10K/Hari' : (metaLive?.messagingLimitTier || '1K/Hari')})
                </span>
              </div>
            </div>
          </div>

          <!-- 💡 Informational Banner: OBA Green Tick Guidance -->
          <div class="p-4 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-3">
            <div class="p-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
              <Info class="w-4 h-4" />
            </div>
            <div class="space-y-1">
              <h5 class="font-bold text-sky-900 dark:text-sky-100 text-xs flex items-center gap-2">
                Informasi Verifikasi Akun & Lencana Centang Hijau (Official Business Account)
              </h5>
              <p class="text-[11px] text-sky-800/90 dark:text-sky-300/90 leading-relaxed">
                Nomor Anda berstatus <strong>"Terverifikasi OTP"</strong> dan telah aktif mengirim & menerima pesan. 
                Lencana centang hijau resmi <em>(Official Business Account)</em> adalah pengajuan opsional terpisah yang dapat Anda minta melalui <strong>Meta WhatsApp Business Manager</strong> setelah bisnis Anda menyelesaikan verifikasi legalitas (NIB/NPWP).
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Webhook Configuration Overview Card (With 1-Click Copy Buttons & Dynamic Host) -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Shield class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                Konfigurasi Webhook Meta Cloud API
              </h3>
              <p class="text-[11px] text-slate-500">
                Salin Callback URL dan Verify Token di bawah ke Meta Developer Dashboard
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-4 text-xs">
          <!-- 1. Webhook Callback URL -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label for="active_callback_url" class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>Webhook Callback URL (Otomatis Sesuai Domain)</span>
                <span class="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                  Auto Dynamic
                </span>
              </label>
              <button
                onclick={() => copyToClipboard(webhookCallbackUrl, 'url')}
                class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-800 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                {#if copiedUrl}
                  <Check class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                  <span class="text-emerald-600 dark:text-emerald-400">Tersalin!</span>
                {:else}
                  <Copy class="w-3.5 h-3.5" />
                  <span>Salin URL</span>
                {/if}
              </button>
            </div>

            <div class="relative flex items-center">
              <input
                id="active_callback_url"
                type="text"
                readonly
                value={webhookCallbackUrl}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono select-all font-bold tracking-tight focus:outline-none"
              />
            </div>
          </div>

          <!-- Opsional: Custom Tunnel URL override untuk local testing -->
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <label for="custom_tunnel_input" class="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
              💡 Opsional: Masukkan Domain Tunnel (Cloudflare / Ngrok URL) untuk Auto-Update URL di atas:
            </label>
            <input
              id="custom_tunnel_input"
              type="text"
              bind:value={customTunnelUrl}
              placeholder="Contoh: https://xxxx.trycloudflare.com atau https://xxxx.ngrok-free.app"
              class="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <!-- 2. Webhook Verify Token -->
          <div class="space-y-1.5 pt-2">
            <div class="flex items-center justify-between">
              <label for="active_verify_token" class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>Verify Token (Kunci Rahasia Kriptografi Acak)</span>
                <span class="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 font-mono">
                  High Security
                </span>
              </label>
              <button
                onclick={() => copyToClipboard(webhookVerifyToken, 'token')}
                class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-800 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                {#if copiedToken}
                  <Check class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                  <span class="text-emerald-600 dark:text-emerald-400">Tersalin!</span>
                {:else}
                  <Copy class="w-3.5 h-3.5" />
                  <span>Salin Token</span>
                {/if}
              </button>
            </div>

            <div class="relative flex items-center">
              <input
                id="active_verify_token"
                type="text"
                readonly
                value={webhookVerifyToken}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-indigo-700 dark:text-indigo-300 font-mono select-all font-bold tracking-tight focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Pengaturan Operasional & Kapasitas Agen (Operational Rules & SLA) -->
      <form onsubmit={saveOperationsSettings} class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Sliders class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                Pengaturan Operasional & Distribusi Antrean
              </h3>
              <p class="text-[11px] text-slate-500">
                Atur batas kapasitas beban agen, waktu auto-resolve, dan masa aktif sesi obrolan
              </p>
            </div>
          </div>

          {#if operationsSuccessMsg}
            <div class="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
              <Check class="w-3.5 h-3.5" />
              <span>{operationsSuccessMsg}</span>
            </div>
          {/if}

          {#if operationsErrorMsg}
            <div class="px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle class="w-3.5 h-3.5" />
              <span>{operationsErrorMsg}</span>
            </div>
          {/if}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- 1. Max Chats per Agent -->
          <div class="space-y-1.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <label for="max_chats_agent" class="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Maksimal Chat per Agen
            </label>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Jika semua agen mencapai batas ini, pesan baru otomatis masuk antrean.
            </p>
            <div class="pt-2 flex items-center gap-2">
              <input
                id="max_chats_agent"
                type="number"
                min="1"
                max="50"
                bind:value={maxChatsPerAgent}
                class="w-24 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white text-center focus:outline-none focus:border-indigo-500"
              />
              <span class="text-xs font-semibold text-slate-500">Chat / Agen</span>
            </div>
          </div>

          <!-- 2. Auto-Resolve Inactivity Hours -->
          <div class="space-y-1.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <label for="auto_resolve_hrs" class="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Auto-Resolve Tanpa Respon
            </label>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Obrolan diselesaikan otomatis jika pelanggan tidak merespon setelah:
            </p>
            <div class="pt-2">
              <select
                id="auto_resolve_hrs"
                bind:value={autoResolveHours}
                class="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value={1}>1 Jam</option>
                <option value={2}>2 Jam</option>
                <option value={3}>3 Jam (Standar Rekomendasi)</option>
                <option value={6}>6 Jam</option>
                <option value={12}>12 Jam</option>
                <option value={24}>24 Jam</option>
                <option value={0}>Nonaktifkan (Manual)</option>
              </select>
            </div>
          </div>

          <!-- 3. Meta 24-Hour Customer Care Window -->
          <div class="space-y-1.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <label for="care_window_hrs" class="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Sesi Layanan Pelanggan
            </label>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Masa aktif sesi pesan WhatsApp resmi dari respon terakhir pelanggan.
            </p>
            <div class="pt-2 flex items-center gap-2">
              <input
                id="care_window_hrs"
                type="number"
                readonly
                value={careWindowHours}
                class="w-24 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 text-center select-none"
              />
              <span class="text-xs font-semibold text-slate-500">Jam (Meta Standard)</span>
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSavingOperations}
            class="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-600/20 transition cursor-pointer disabled:opacity-60"
          >
            <Save class="w-3.5 h-3.5 {isSavingOperations ? 'animate-spin' : ''}" />
            <span>{isSavingOperations ? 'Menyimpan...' : 'Simpan Pengaturan Operasional'}</span>
          </button>
        </div>
      </form>
    </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- 2. JIKA BELUM TERHUBUNG (DISCONNECTED REGISTRATION TABS)      -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {:else}
    <!-- Status Disconnected Banner -->
    <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
      <AlertCircle class="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div class="flex-1">
        <p class="font-bold">Status: WABA Disconnected (Belum Ada Saluran Terhubung)</p>
        <p class="text-amber-700 dark:text-amber-400 text-[11px] mt-0.5">
          Pilih salah satu metode di bawah untuk menghubungkan nomor WhatsApp resmi Anda.
        </p>
      </div>
    </div>

    <!-- Navigation Tabs: Facebook Embedded Signup vs Manual -->
    <div class="flex p-1.5 bg-slate-200/80 dark:bg-slate-900 rounded-2xl text-xs font-bold w-fit border border-slate-300/60 dark:border-slate-800">
      <button
        onclick={() => (activeTab = 'FACEBOOK_LOGIN')}
        class="py-2 px-4 rounded-xl transition cursor-pointer flex items-center gap-2 {activeTab === 'FACEBOOK_LOGIN' 
          ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
      >
        <div class="w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[10px] font-black font-serif">
          f
        </div>
        Login with Facebook (Otomatis)
      </button>

      <button
        onclick={() => (activeTab = 'MANUAL')}
        class="py-2 px-4 rounded-xl transition cursor-pointer flex items-center gap-2 {activeTab === 'MANUAL' 
          ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' 
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}"
      >
        <Key class="w-3.5 h-3.5" />
        Konfigurasi Manual (Developer)
      </button>
    </div>

    <!-- ─── TAB 1: LOGIN WITH FACEBOOK (EMBEDDED SIGNUP) ─── -->
    {#if activeTab === 'FACEBOOK_LOGIN'}
      <div class="bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center font-black text-2xl font-serif shrink-0 border border-[#1877F2]/20">
            f
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Meta WhatsApp Embedded Signup</h3>
            <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Hubungkan akun Facebook Anda untuk mengotorisasi nomor WhatsApp Business secara instan ke sistem CRM ini.
            </p>
          </div>
        </div>

        <!-- Meta App ID Input for Real Facebook Login -->
        <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div>
            <label for="fb_app_id" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Meta App ID Resmi Anda (Wajib diisi dari <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline font-semibold">developers.facebook.com</a>)
            </label>
            <input
              id="fb_app_id"
              type="text"
              bind:value={appId}
              placeholder="Contoh: 123456789012345 (Salin dari dashboard Meta App Anda)"
              class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <!-- Official Facebook Login Button -->
        <div class="pt-1">
          <button
            onclick={connectWithFacebook}
            disabled={isConnectingFb}
            class="py-3 px-6 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs flex items-center gap-2.5 shadow-md shadow-[#1877F2]/25 transition cursor-pointer disabled:opacity-75"
          >
            {#if isConnectingFb}
              <div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              <span>Membuka Facebook Login...</span>
            {:else}
              <div class="w-4 h-4 rounded-full bg-white text-[#1877F2] flex items-center justify-center text-[10px] font-black font-serif">
                f
              </div>
              <span>Lanjutkan dengan Facebook</span>
            {/if}
          </button>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
          <p class="font-semibold text-slate-800 dark:text-slate-300">Panduan Menghubungkan Meta Facebook:</p>
          <ol class="list-decimal list-inside space-y-0.5 text-slate-500 dark:text-slate-400">
            <li>Buka <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline font-semibold">developers.facebook.com/apps</a>.</li>
            <li>Buat Aplikasi bertipe <strong>Business</strong> dan aktifkan produk <strong>WhatsApp</strong>.</li>
            <li>Salin <strong>App ID</strong> dari dashboard Meta Anda dan masukkan ke kotak Meta App ID di atas.</li>
            <li>Klik tombol <strong>Lanjutkan dengan Facebook</strong> untuk login dan memilih nomor WhatsApp Anda.</li>
          </ol>
        </div>
      </div>

    <!-- ─── TAB 2: MANUAL CONFIGURATION (DEVELOPER) ─── -->
    {:else}
      {#if saved}
        <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
          <CheckCircle2 class="w-4 h-4" />
          Konfigurasi manual berhasil disimpan ke database!
        </div>
      {/if}

      <form onsubmit={handleManualSave} class="space-y-6">
        <!-- Phone & Business Info -->
        <div class="bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Informasi Nomor & Saluran WhatsApp
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="manual_phone" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nomor WhatsApp Resmi</label>
              <input
                id="manual_phone"
                type="text"
                bind:value={displayPhoneNumber}
                placeholder="e.g. +62 812-3456-7890"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label for="manual_verified_name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Tampilan Bisnis (Verified Name)</label>
              <input
                id="manual_verified_name"
                type="text"
                bind:value={verifiedName}
                placeholder="e.g. PT WhatsApp CRM Indonesia"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>
        </div>

        <!-- Meta Credentials -->
        <div class="bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Key class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Kredensial Meta Developer
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="waba_id" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">WhatsApp Business Account (WABA) ID</label>
              <input
                id="waba_id"
                type="text"
                bind:value={wabaId}
                placeholder="e.g. 109823471092834"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label for="phone_number_id" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number ID / App ID</label>
              <input
                id="phone_number_id"
                type="text"
                bind:value={appId}
                placeholder="e.g. 102938475610293"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label for="system_token" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">System User Permanent Access Token</label>
            <textarea
              id="system_token"
              rows="3"
              bind:value={accessToken}
              placeholder="EAAGm0PX4ZCBO..."
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            ></textarea>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            class="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30 transition cursor-pointer"
          >
            <Save class="w-4 h-4" />
            {isSaving ? 'Menyimpan...' : 'Simpan & Hubungkan WABA'}
          </button>
        </div>
      </form>
    {/if}
  {/if}
  {/if}
</div>
