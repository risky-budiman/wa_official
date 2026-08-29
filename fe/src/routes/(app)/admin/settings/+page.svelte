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
    Clock,
    Bot,
    MessageSquare,
    Send,
    Calendar
  } from 'lucide-svelte';

  let activeTab = $state<'FACEBOOK_LOGIN' | 'MANUAL'>('FACEBOOK_LOGIN');

  let wabaId = $state('');
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

  // Main Section Tabs: WABA Channel vs Operating Hours & AI vs Operations & SLA
  let mainSettingsTab = $state<'WABA' | 'HOURS_AI' | 'OPERATIONS'>('WABA');

  // Operating Hours State
  let operatingHours = $state({
    enabled: false,
    timezone: 'Asia/Jakarta',
    days: [1, 2, 3, 4, 5],
    startTime: '08:00',
    endTime: '17:00',
  });

  // AI Agent Auto-Responder State
  let aiAgentConfig = $state({
    enabled: false,
    mode: 'AI_ASSISTANT' as 'AI_ASSISTANT' | 'STATIC_MESSAGE',
    provider: 'gemini' as 'gemini' | 'openai',
    apiKey: '',
    model: 'gemini-2.0-flash',
    systemPrompt: '',
    staticMessage: 'Halo! Layanan kami saat ini sedang berada di luar jam operasional. Pesan Anda telah kami terima dan akan segera dibalas oleh tim kami saat jam kerja dimulai. Terima kasih! 🙏',
  });

  let isSavingHoursAi = $state(false);
  let hoursAiSuccessMsg = $state<string | null>(null);
  let hoursAiErrorMsg = $state<string | null>(null);

  // AI Agent Live Simulator Testing State
  let aiTestUserMessage = $state('Halo, saya ingin menanyakan jam buka dan produk yang tersedia.');
  let isTestingAi = $state(false);
  let aiTestResponse = $state<string | null>(null);
  let aiTestError = $state<string | null>(null);

  const daysOfWeek = [
    { id: 1, label: 'Senin' },
    { id: 2, label: 'Selasa' },
    { id: 3, label: 'Rabu' },
    { id: 4, label: 'Kamis' },
    { id: 5, label: 'Jumat' },
    { id: 6, label: 'Sabtu' },
    { id: 7, label: 'Minggu' },
  ];

  function toggleDay(dayId: number) {
    if (operatingHours.days.includes(dayId)) {
      operatingHours.days = operatingHours.days.filter((d) => d !== dayId);
    } else {
      operatingHours.days = [...operatingHours.days, dayId].sort();
    }
  }

  async function loadOperatingHoursSettings() {
    try {
      const res = await apiRequest<any>('/settings/operating-hours');
      if (res.success) {
        if (res.operatingHours) {
          operatingHours = {
            enabled: !!res.operatingHours.enabled,
            timezone: res.operatingHours.timezone || 'Asia/Jakarta',
            days: Array.isArray(res.operatingHours.days) ? res.operatingHours.days : [1, 2, 3, 4, 5],
            startTime: res.operatingHours.startTime || '08:00',
            endTime: res.operatingHours.endTime || '17:00',
          };
        }
        if (res.aiAgentConfig) {
          aiAgentConfig = {
            enabled: !!res.aiAgentConfig.enabled,
            mode: res.aiAgentConfig.mode || 'AI_ASSISTANT',
            provider: res.aiAgentConfig.provider || 'gemini',
            apiKey: res.aiAgentConfig.apiKey || '',
            model: res.aiAgentConfig.model || 'gemini-2.0-flash',
            systemPrompt: res.aiAgentConfig.systemPrompt || '',
            staticMessage: res.aiAgentConfig.staticMessage || 'Halo! Layanan kami saat ini sedang berada di luar jam operasional. Pesan Anda telah kami terima dan akan segera dibalas oleh tim kami saat jam kerja dimulai. Terima kasih! 🙏',
          };
        }
      }
    } catch (_) {}
  }

  async function saveOperatingHoursSettings(e: Event) {
    e.preventDefault();
    isSavingHoursAi = true;
    hoursAiSuccessMsg = null;
    hoursAiErrorMsg = null;

    try {
      const res = await apiRequest<any>('/settings/operating-hours', {
        method: 'PATCH',
        body: JSON.stringify({
          operatingHours,
          aiAgentConfig,
        }),
      });
      isSavingHoursAi = false;

      if (res.success) {
        hoursAiSuccessMsg = 'Jadwal jam operasional dan konfigurasi AI Agent berhasil disimpan!';
        setTimeout(() => (hoursAiSuccessMsg = null), 4000);
      } else {
        hoursAiErrorMsg = res.error || 'Gagal menyimpan pengaturan jam operasional';
        setTimeout(() => (hoursAiErrorMsg = null), 4000);
      }
    } catch (err: any) {
      isSavingHoursAi = false;
      hoursAiErrorMsg = err.message || 'Terjadi kesalahan sistem';
    }
  }

  async function testAiResponse() {
    if (!aiTestUserMessage.trim()) return;
    isTestingAi = true;
    aiTestResponse = null;
    aiTestError = null;

    try {
      const res = await apiRequest<any>('/settings/ai-agent/test', {
        method: 'POST',
        body: JSON.stringify({
          systemPrompt: aiAgentConfig.systemPrompt,
          userMessage: aiTestUserMessage,
          apiKey: aiAgentConfig.apiKey || undefined,
          model: aiAgentConfig.model || 'gemini-2.0-flash',
        }),
      });
      isTestingAi = false;

      if (res.success && res.reply) {
        aiTestResponse = res.reply;
      } else {
        aiTestError = res.error || 'AI tidak memberikan balasan.';
      }
    } catch (err: any) {
      isTestingAi = false;
      aiTestError = err.message || 'Gagal menghubungi Gemini API';
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
        wabaId: wabaId.trim(),
        appId: appId.trim(),
        accessToken: accessToken.trim(),
        displayPhoneNumber: displayPhoneNumber.trim(),
        verifiedName: verifiedName.trim(),
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
      wabaId = '';
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
    fbSuccessMsg = 'Menerima otorisasi Facebook, mengambil data akun WhatsApp asli dari Meta...';
    
    const res = await apiRequest<any>('/settings/waba/embedded-signup', {
      method: 'POST',
      body: JSON.stringify({
        code,
        appId: appId.trim() || undefined,
        wabaId: wabaId.trim() || undefined,
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
  <!-- MAIN SETTINGS TOP TABS                                       -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  <div class="flex items-center p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl gap-1">
    <button
      onclick={() => (mainSettingsTab = 'WABA')}
      class="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer {mainSettingsTab === 'WABA' 
        ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80' 
        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}"
    >
      <Smartphone class="w-4 h-4" />
      <span>Saluran WhatsApp (WABA)</span>
    </button>

    <button
      onclick={() => (mainSettingsTab = 'HOURS_AI')}
      class="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer {mainSettingsTab === 'HOURS_AI' 
        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80' 
        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}"
    >
      <Clock class="w-4 h-4" />
      <span>Jam Operasional & AI Agent</span>
      {#if operatingHours.enabled && aiAgentConfig.enabled}
        <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
      {/if}
    </button>

    <button
      onclick={() => (mainSettingsTab = 'OPERATIONS')}
      class="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer {mainSettingsTab === 'OPERATIONS' 
        ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-700/80' 
        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}"
    >
      <Sliders class="w-4 h-4" />
      <span>Kapasitas & SLA</span>
    </button>
  </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TAB CONTENT 1: WABA CHANNEL SETTINGS                         -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if mainSettingsTab === 'WABA'}
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

          <!-- Metrics Grid -->
          <div class="p-5 sm:p-6 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
                <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Perusahaan Terdaftar</span>
                <span class="text-xs font-bold text-slate-900 dark:text-white truncate">{companyName || 'IDS Payment'}</span>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">WABA ID Resmi</span>
                  <button onclick={() => copyToClipboard(channelStore.channel?.wabaId || '1386698372551547', 'waba')} class="text-[10px] text-slate-500 hover:text-emerald-600 transition flex items-center gap-1 cursor-pointer">
                    {#if copiedWaba}<Check class="w-3 h-3 text-emerald-500" />{:else}<Copy class="w-3 h-3" />{/if}
                  </button>
                </div>
                <span class="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">{channelStore.channel?.wabaId || '1386698372551547'}</span>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
                <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status Nomor</span>
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400">TERVERIFIKASI</span>
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
                <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kualitas Pesan</span>
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="text-xs font-bold text-emerald-700 dark:text-emerald-400">{metaLive?.qualityRating || channelStore.channel?.qualityRating || 'GREEN'} (Tinggi)</span>
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-1.5">
                <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Limit Pesan Meta</span>
                <span class="text-xs font-bold text-indigo-700 dark:text-indigo-400 font-mono">1.000 Chat / 24 Jam</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Webhook Configuration Box -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Pengaturan Webhook Meta Developer
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="cb_url" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Callback URL (Webhook)</label>
              <div class="flex items-center gap-2">
                <input id="cb_url" type="text" readonly value={webhookCallbackUrl} class="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300" />
                <button onclick={() => copyToClipboard(webhookCallbackUrl, 'url')} class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold transition cursor-pointer">
                  {#if copiedUrl}<Check class="w-4 h-4 text-emerald-500" />{:else}<Copy class="w-4 h-4 text-slate-600 dark:text-slate-400" />{/if}
                </button>
              </div>
            </div>
            <div>
              <label for="v_tok" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Verify Token</label>
              <div class="flex items-center gap-2">
                <input id="v_tok" type="text" readonly value={webhookVerifyToken} class="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300" />
                <button onclick={() => copyToClipboard(webhookVerifyToken, 'token')} class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold transition cursor-pointer">
                  {#if copiedToken}<Check class="w-4 h-4 text-emerald-500" />{:else}<Copy class="w-4 h-4 text-slate-600 dark:text-slate-400" />{/if}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {:else}
      <!-- Disconnected State: Facebook vs Manual Setup -->
      <div class="space-y-6">
        <div class="flex p-1.5 bg-slate-200/80 dark:bg-slate-900 rounded-2xl text-xs font-bold w-fit border border-slate-300/60 dark:border-slate-800">
          <button onclick={() => (activeTab = 'FACEBOOK_LOGIN')} class="py-2 px-4 rounded-xl transition cursor-pointer flex items-center gap-2 {activeTab === 'FACEBOOK_LOGIN' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}">
            <div class="w-4 h-4 rounded-full bg-[#1877F2] text-white flex items-center justify-center text-[10px] font-black font-serif">f</div>
            Login with Facebook (Otomatis)
          </button>
          <button onclick={() => (activeTab = 'MANUAL')} class="py-2 px-4 rounded-xl transition cursor-pointer flex items-center gap-2 {activeTab === 'MANUAL' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}">
            <Key class="w-3.5 h-3.5" />
            Konfigurasi Manual (Developer)
          </button>
        </div>

        {#if activeTab === 'FACEBOOK_LOGIN'}
          <div class="bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-2xl bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center font-black text-2xl font-serif shrink-0 border border-[#1877F2]/20">f</div>
              <div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Meta WhatsApp Embedded Signup</h3>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">Hubungkan akun Facebook Anda untuk mengotorisasi nomor WhatsApp Business secara instan ke sistem CRM ini.</p>
              </div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <label for="fb_app_id" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Meta App ID Resmi Anda</label>
                <input id="fb_app_id" type="text" bind:value={appId} placeholder="Contoh: 123456789012345" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono" />
              </div>
            </div>
            <button onclick={connectWithFacebook} disabled={isConnectingFb} class="py-3 px-6 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs flex items-center gap-2.5 shadow-md transition cursor-pointer">
              {#if isConnectingFb}<div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>{:else}<div class="w-4 h-4 rounded-full bg-white text-[#1877F2] flex items-center justify-center text-[10px] font-black font-serif">f</div>{/if}
              <span>Lanjutkan dengan Facebook</span>
            </button>
          </div>
        {:else}
          <form onsubmit={handleManualSave} class="space-y-6">
            <div class="bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Smartphone class="w-4 h-4 text-emerald-600" /> Informasi Nomor WhatsApp</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="m_phone" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nomor WhatsApp</label>
                  <input id="m_phone" type="text" bind:value={displayPhoneNumber} placeholder="+62 812-3456-7890" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono" required />
                </div>
                <div>
                  <label for="m_name" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Tampilan Bisnis</label>
                  <input id="m_name" type="text" bind:value={verifiedName} placeholder="PT WhatsApp CRM Indonesia" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs" required />
                </div>
              </div>
            </div>
            <div class="bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2"><Key class="w-4 h-4 text-emerald-600" /> Kredensial Meta Developer</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="waba_id" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">WABA ID</label>
                  <input id="waba_id" type="text" bind:value={wabaId} placeholder="109823471092834" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs" />
                </div>
                <div>
                  <label for="p_id" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number ID</label>
                  <input id="p_id" type="text" bind:value={appId} placeholder="102938475610293" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs" />
                </div>
              </div>
              <div>
                <label for="s_tok" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">System User Permanent Token</label>
                <textarea id="s_tok" rows="3" bind:value={accessToken} placeholder="EAAGm0PX4ZCBO..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"></textarea>
              </div>
            </div>
            <div class="flex justify-end pt-2">
              <button type="submit" disabled={isSaving} class="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition cursor-pointer">
                <Save class="w-4 h-4" />
                {isSaving ? 'Menyimpan...' : 'Simpan & Hubungkan WABA'}
              </button>
            </div>
          </form>
        {/if}
      </div>
    {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TAB CONTENT 2: JAM OPERASIONAL & AI AGENT                   -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {:else if mainSettingsTab === 'HOURS_AI'}
    {#if hoursAiSuccessMsg}
      <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold animate-in fade-in">
        <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        {hoursAiSuccessMsg}
      </div>
    {/if}

    {#if hoursAiErrorMsg}
      <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 font-bold animate-in fade-in">
        <AlertCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
        {hoursAiErrorMsg}
      </div>
    {/if}

    <form onsubmit={saveOperatingHoursSettings} class="space-y-6">
      <!-- 1. Card Jadwal Jam Operasional -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Jadwal Jam Operasional Layanan</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">Atur hari dan jam kerja agen manusia untuk menangani chat pelanggan</p>
            </div>
          </div>

          <!-- Toggle Enable Switch -->
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" bind:checked={operatingHours.enabled} class="sr-only peer" />
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {#if operatingHours.enabled}
          <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <!-- Hari Kerja Selector -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Hari Kerja Operasional:</label>
              <div class="flex flex-wrap gap-2">
                {#each daysOfWeek as day}
                  <button
                    type="button"
                    onclick={() => toggleDay(day.id)}
                    class="py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer {operatingHours.days.includes(day.id) 
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}"
                  >
                    {day.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Jam Buka & Jam Tutup + Timezone -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label for="start_time" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Jam Mulai Layanan</label>
                <input
                  id="start_time"
                  type="time"
                  bind:value={operatingHours.startTime}
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label for="end_time" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Jam Tutup Layanan</label>
                <input
                  id="end_time"
                  type="time"
                  bind:value={operatingHours.endTime}
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label for="tz_select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Zona Waktu</label>
                <select
                  id="tz_select"
                  bind:value={operatingHours.timezone}
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="Asia/Jakarta">WIB (Asia/Jakarta - UTC+7)</option>
                  <option value="Asia/Makassar">WITA (Asia/Makassar - UTC+8)</option>
                  <option value="Asia/Jayapura">WIT (Asia/Jayapura - UTC+9)</option>
                </select>
              </div>
            </div>
          </div>
        {:else}
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            Jam operasional dinonaktifkan. Sistem menganggap layanan pelanggan buka 24 jam setiap hari.
          </div>
        {/if}
      </div>

      <!-- 2. Card AI Agent Auto-Responder di Luar Jam Operasional -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bot class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">AI Agent Auto-Responder di Luar Jam Kerja</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">Secara otomatis menjawab dan melayani pelanggan dengan cerdas saat kantor tutup</p>
            </div>
          </div>

          <!-- Toggle Enable Switch -->
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" bind:checked={aiAgentConfig.enabled} class="sr-only peer" />
            <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {#if aiAgentConfig.enabled}
          <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-5">
            <!-- Pilihan Mode AI vs Pesan Statis -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Mode Respon Otomatis:</label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onclick={() => (aiAgentConfig.mode = 'AI_ASSISTANT')}
                  class="p-4 rounded-xl border text-left transition cursor-pointer {aiAgentConfig.mode === 'AI_ASSISTANT' 
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20' 
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}"
                >
                  <div class="flex items-center gap-2 font-bold text-xs mb-1">
                    <Sparkles class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>AI Smart Assistant (Google Gemini)</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    AI berpikir secara cerdas untuk menjawab FAQ, deskripsi produk, jam buka, dan pertanyaan pelanggan sesuai panduan bisnis Anda.
                  </p>
                </button>

                <button
                  type="button"
                  onclick={() => (aiAgentConfig.mode = 'STATIC_MESSAGE')}
                  class="p-4 rounded-xl border text-left transition cursor-pointer {aiAgentConfig.mode === 'STATIC_MESSAGE' 
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20' 
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}"
                >
                  <div class="flex items-center gap-2 font-bold text-xs mb-1">
                    <MessageSquare class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Pesan Teks Otomatis Statis</span>
                  </div>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Mengirim satu pesan pemberitahuan tetap bahwa kantor sedang tutup dan akan membalas di jam kerja berikutnya.
                  </p>
                </button>
              </div>
            </div>

            <!-- Jika Mode AI ASSISTANT: Prompt & Knowledge Base -->
            {#if aiAgentConfig.mode === 'AI_ASSISTANT'}
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label for="ai_model" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Model AI</label>
                    <select
                      id="ai_model"
                      bind:value={aiAgentConfig.model}
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="gemini-2.0-flash">Google Gemini 2.0 Flash (Sangat Cepat & Cerdas)</option>
                      <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Stabil)</option>
                    </select>
                  </div>

                  <div>
                    <label for="gemini_key" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Gemini API Key <span class="text-slate-400 font-normal">(Opsional — dapat dibuat gratis di aistudio.google.com)</span>
                    </label>
                    <input
                      id="gemini_key"
                      type="password"
                      bind:value={aiAgentConfig.apiKey}
                      placeholder="AIzaSy... (Biarkan kosong jika sudah diatur di server)"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label for="sys_prompt" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Panduan Bisnis, FAQ & Pengetahuan Perusahaan untuk AI (Knowledge Base):
                  </label>
                  <textarea
                    id="sys_prompt"
                    rows="6"
                    bind:value={aiAgentConfig.systemPrompt}
                    placeholder="Tulis informasi perusahaan Anda di sini agar AI dapat menjawab dengan akurat. Contoh:
- Nama Perusahaan: PT Infra Digital Solusindo (IDS)
- Layanan: Payment Gateway, Integrasi WhatsApp Resmi, Solusi IT.
- Jam Buka: Senin - Jumat 08:00 - 17:00 WIB.
- Alamat: Jakarta, Indonesia.
- Pertanyaan Umum (FAQ):
  1. Cara daftar menjadi mitra: Silakan kirimkan email ke info@ids.net.id
  2. Keluhan transaksi: Harap sertakan nomor referensi pembayaran..."
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-sans placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  ></textarea>
                </div>
              </div>
              <!-- Jika Mode STATIC MESSAGE -->
              <div>
                <label for="static_msg" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Isi Pesan Otomatis di Luar Jam Operasional:
                </label>
                <textarea
                  id="static_msg"
                  rows="4"
                  bind:value={aiAgentConfig.staticMessage}
                  placeholder="Halo! Layanan kami saat ini sedang berada di luar jam operasional..."
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>
            {/if}
          </div>
        {/if}

        <div class="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSavingHoursAi}
            class="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/30 transition cursor-pointer disabled:opacity-60"
          >
            <Save class="w-4 h-4" />
            <span>{isSavingHoursAi ? 'Menyimpan...' : 'Simpan Pengaturan Jam & AI'}</span>
          </button>
        </div>
      </div>
    </form>

    <!-- 3. Card Simulasi & Uji Coba Chat AI Langsung (Live AI Simulator) -->
    {#if aiAgentConfig.enabled && aiAgentConfig.mode === 'AI_ASSISTANT'}
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div class="flex items-center gap-2.5">
          <Sparkles class="w-4 h-4 text-indigo-500" />
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Simulasi & Uji Coba Respon AI</h3>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Ketik pesan uji coba untuk melihat bagaimana AI akan membalas pertanyaan pelanggan berdasarkan panduan bisnis di atas:
        </p>

        <div class="flex items-center gap-2">
          <input
            type="text"
            bind:value={aiTestUserMessage}
            placeholder="Ketik pertanyaan uji coba, misal: 'Halo, kantor buka jam berapa ya?'"
            class="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onclick={testAiResponse}
            disabled={isTestingAi}
            class="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60 shrink-0"
          >
            <Send class="w-3.5 h-3.5 {isTestingAi ? 'animate-spin' : ''}" />
            <span>{isTestingAi ? 'Memproses AI...' : 'Uji Respon AI'}</span>
          </button>
        </div>

        {#if aiTestResponse}
          <div class="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-1.5 animate-in fade-in">
            <div class="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
              <Bot class="w-3.5 h-3.5" />
              <span>Hasil Balasan AI:</span>
            </div>
            <p class="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-sans">
              {aiTestResponse}
            </p>
          </div>
        {/if}

        {#if aiTestError}
          <div class="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
            ❌ {aiTestError}
          </div>
        {/if}
      </div>
    {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- TAB CONTENT 3: KAPASITAS & SLA SETTINGS                      -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {:else if mainSettingsTab === 'OPERATIONS'}
    {#if operationsSuccessMsg}
      <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold animate-in fade-in">
        <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        {operationsSuccessMsg}
      </div>
    {/if}

    {#if operationsErrorMsg}
      <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 font-bold animate-in fade-in">
        <AlertCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
        {operationsErrorMsg}
      </div>
    {/if}

    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Sliders class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Pengaturan Kapasitas Beban Kerja & Batas SLA</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Atur batas maksimal obrolan aktif per agen dan otomatisasi penyelesaian tiket kedaluwarsa</p>
        </div>
      </div>

      <form onsubmit={saveOperationsSettings} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="max_c_op" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Maksimal Chat per Agen</label>
            <input id="max_c_op" type="number" min="1" max="50" bind:value={maxChatsPerAgent} class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white" required />
            <p class="text-[10px] text-slate-500 mt-1">Jika mencapai batas, chat masuk dialihkan ke Antrean.</p>
          </div>

          <div>
            <label for="auto_r_op" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Auto-Resolve Inactivity (Jam)</label>
            <input id="auto_r_op" type="number" min="1" max="72" bind:value={autoResolveHours} class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white" required />
            <p class="text-[10px] text-slate-500 mt-1">Tutup tiket otomatis jika pelanggan tidak merespons.</p>
          </div>

          <div>
            <label for="care_w_op" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Customer Care Window (Jam)</label>
            <input id="care_w_op" type="number" min="1" max="72" bind:value={careWindowHours} class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white" required />
            <p class="text-[10px] text-slate-500 mt-1">Masa aktif sesi Meta (standar 24 jam).</p>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button type="submit" disabled={isSavingOperations} class="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition cursor-pointer">
            <Save class="w-4 h-4" />
            {isSavingOperations ? 'Menyimpan...' : 'Simpan SLA'}
          </button>
        </div>
      </form>
    </div>
  {/if}
  {/if}
</div>
