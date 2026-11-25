<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { channelStore } from '$lib/stores/channel.svelte';
  import { notificationStore } from '$lib/stores/notifications.svelte';
  import { apiRequest } from '$lib/api/client';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { findNavItem } from '$lib/navigation';
  import {
    Bell,
    Volume2,
    VolumeX,
    ShieldCheck,
    Sun,
    Moon,
    X,
    Check,
    MessageSquare,
    Radio,
    UserCheck,
    Lock,
    ExternalLink,
    Smartphone,
    AlertCircle,
    CircleDot,
    Menu,
    ChevronRight
  } from 'lucide-svelte';

  interface Props {
    title?: string;
    subtitle?: string;
  }
  let { title, subtitle }: Props = $props();

  // Page title & breadcrumb come from the shared navigation config (unless a page overrides them)
  const current = $derived(findNavItem($page.url.pathname));
  const pageTitle = $derived(title || current?.item.name || 'WhatsApp CRM');
  const pageSubtitle = $derived(subtitle ?? current?.item.description);

  let showNotifications = $state(false);
  let showSecurityModal = $state(false);
  let showWabaModal = $state(false);
  let showLoginStatusPrompt = $state(false);

  onMount(() => {
    channelStore.checkStatus();
    notificationStore.startPolling();
    notificationStore.requestBrowserPermission();

    if (typeof window !== 'undefined' && authStore.isAuthenticated) {
      const prompted = sessionStorage.getItem('wa_crm_status_prompted');
      if (!prompted) {
        showLoginStatusPrompt = true;
      }
    }
  });

  function setLoginStatus(online: boolean) {
    authStore.setOnlineStatus(online);
    showLoginStatusPrompt = false;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('wa_crm_status_prompted', 'true');
    }
  }
</script>

<svelte:head>
  <title>{pageTitle} · WhatsApp CRM</title>
</svelte:head>

<header class="relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur transition-colors duration-200 sm:px-6 dark:border-slate-800 dark:bg-slate-900/90">
  <div class="flex min-w-0 items-center gap-3">
    <button
      type="button"
      class="ui-icon-btn -ml-1 lg:hidden"
      aria-label="Buka menu"
      onclick={() => uiStore.openSidebar()}
    >
      <Menu class="h-5 w-5" />
    </button>

    <div class="min-w-0">
      <!-- Breadcrumb only: the page itself renders its own H1 via <PageHeader> -->
      <nav aria-label="Breadcrumb" class="flex min-w-0 items-center gap-1.5 text-sm">
        {#if current}
          <span class="hidden shrink-0 text-slate-500 sm:inline dark:text-slate-400">{current.section.label}</span>
          <ChevronRight class="hidden h-3.5 w-3.5 shrink-0 text-slate-300 sm:inline dark:text-slate-600" />
        {/if}
        <span class="truncate font-semibold text-slate-900 dark:text-white" aria-current="page">{pageTitle}</span>
      </nav>
      {#if pageSubtitle && !current}
        <p class="truncate text-xs text-slate-500 dark:text-slate-400">{pageSubtitle}</p>
      {/if}
    </div>
  </div>

  <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
    <!-- Availability (online / offline) -->
    <button
      type="button"
      onclick={() => authStore.toggleOnline()}
      class="ui-pill transition {authStore.isOnline
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15'
        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}"
      title="Klik untuk mengubah status ketersediaan Anda"
    >
      <span class="relative flex h-2 w-2">
        {#if authStore.isOnline}
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
        {/if}
        <span class="relative inline-flex h-2 w-2 rounded-full {authStore.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
      </span>
      {authStore.isOnline ? 'Online' : 'Offline'}
    </button>

    <!-- WhatsApp channel health -->
    <button
      type="button"
      onclick={() => (showWabaModal = true)}
      class="ui-pill hidden transition md:inline-flex {channelStore.isConnected
        ? 'border-emerald-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15'}"
      title="Lihat status saluran WhatsApp"
    >
      <Smartphone class="h-3.5 w-3.5" />
      {channelStore.isConnected ? 'WhatsApp Terhubung' : 'WhatsApp Terputus'}
    </button>

    <span class="mx-1 hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700"></span>

    <!-- Theme toggle -->
    <button
      type="button"
      onclick={() => themeStore.toggle()}
      class="ui-icon-btn"
      title={themeStore.current === 'dark' ? 'Mode terang' : 'Mode gelap'}
      aria-label="Ubah tema"
    >
      {#if themeStore.current === 'dark'}
        <Sun class="h-[18px] w-[18px]" />
      {:else}
        <Moon class="h-[18px] w-[18px]" />
      {/if}
    </button>

    <!-- Security center -->
    <button
      type="button"
      onclick={() => (showSecurityModal = true)}
      class="ui-icon-btn hidden sm:inline-flex"
      title="Pusat Keamanan & Enkripsi"
      aria-label="Pusat keamanan"
    >
      <ShieldCheck class="h-[18px] w-[18px]" />
    </button>

    <!-- 🔔 Notification Bell (Clickable with Live Badge) -->
    <div class="relative">
      <button
        onclick={() => (showNotifications = !showNotifications)}
        class="ui-icon-btn"
        title="Notifikasi"
        aria-label="Notifikasi"
      >
        <Bell class="h-[18px] w-[18px]" />
        {#if notificationStore.unreadCount > 0}
          <span class="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
            {notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount}
          </span>
        {/if}
      </button>

      <!-- Notification Dropdown Popover -->
      {#if showNotifications}
        <div class="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div class="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold text-slate-900 dark:text-white">Pemberitahuan Pesan</h4>
              {#if notificationStore.unreadCount > 0}
                <span class="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  {notificationStore.unreadCount} baru
                </span>
              {/if}
            </div>
            
            <div class="flex items-center gap-2">
              <!-- Suara Notifikasi Toggle -->
              <button
                onclick={() => notificationStore.toggleSound()}
                class="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                title={notificationStore.soundEnabled ? 'Suara Aktif (Klik untuk mute)' : 'Suara Mute (Klik untuk aktifkan)'}
              >
                {#if notificationStore.soundEnabled}
                  <Volume2 class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {:else}
                  <VolumeX class="w-3.5 h-3.5 text-slate-400" />
                {/if}
              </button>

              {#if notificationStore.unreadCount > 0}
                <button
                  onclick={() => notificationStore.markAllAsRead()}
                  class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Tandai Dibaca
                </button>
              {/if}
            </div>
          </div>

          <div class="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {#if notificationStore.items.length === 0}
              <div class="p-6 text-center text-xs text-slate-400">
                <Bell class="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p>Belum ada notifikasi pesan baru.</p>
              </div>
            {:else}
              {#each notificationStore.items as n}
                <button
                  onclick={() => {
                    notificationStore.markAsRead(n.id);
                    showNotifications = false;
                    goto('/inbox');
                  }}
                  class="w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer {n.unread ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''}"
                >
                  <div class="flex items-start justify-between gap-2 mb-1">
                    <span class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {#if n.type === 'chat'}
                        <MessageSquare class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      {:else if n.type === 'collab'}
                        <UserCheck class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      {:else}
                        <Radio class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      {/if}
                      <span class="truncate">{n.title}</span>
                    </span>
                    <span class="text-[10px] text-slate-400 shrink-0">{n.time}</span>
                  </div>
                  <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed truncate">{n.desc}</p>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</header>

<!-- 🛡️ MODAL PUSAT KEAMANAN & ENKRIPSI -->
{#if showSecurityModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Status Keamanan & Enkripsi
        </h3>
        <button onclick={() => (showSecurityModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-3 text-xs">
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p class="font-bold text-slate-900 dark:text-white">Webhook HMAC SHA-256</p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">Verifikasi tanda tangan Meta</p>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
            AKTIF
          </span>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p class="font-bold text-slate-900 dark:text-white">Autentikasi JWT Scoped</p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">Argon2 Password Hashing</p>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
            TERLINDUNGI
          </span>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <p class="font-bold text-slate-900 dark:text-white">Meta Graph API v20.0</p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">Enkripsi End-to-End WhatsApp</p>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
            TERHUBUNG
          </span>
        </div>
      </div>

      <div class="flex justify-end pt-2">
        <button
          onclick={() => (showSecurityModal = false)}
          class="py-2 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 📱 MODAL STATUS SALURAN WHATSAPP (WABA) -->
{#if showWabaModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Smartphone class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Status Saluran WhatsApp
        </h3>
        <button onclick={() => (showWabaModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      {#if channelStore.isConnected && channelStore.channel}
        <div class="space-y-3 text-xs">
          <div class="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div class="flex justify-between">
              <span class="text-slate-600 dark:text-slate-400">Nomor WhatsApp:</span>
              <span class="font-mono font-bold text-slate-900 dark:text-white">{channelStore.channel.displayPhoneNumber}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600 dark:text-slate-400">Nama Tampilan:</span>
              <span class="font-bold text-emerald-700 dark:text-emerald-400">{channelStore.channel.verifiedName}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600 dark:text-slate-400">WABA ID:</span>
              <span class="font-mono text-slate-800 dark:text-slate-200">{channelStore.channel.wabaId}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600 dark:text-slate-400">Quality Rating:</span>
              <span class="px-2 py-0.2 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-bold text-[10px]">
                {channelStore.channel.qualityRating} ⭐
              </span>
            </div>
          </div>
        </div>
      {:else}
        <div class="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 space-y-2">
          <div class="flex items-center gap-2 font-bold">
            <AlertCircle class="w-4 h-4" />
            Saluran WhatsApp Belum Terhubung
          </div>
          <p class="text-[11px] text-rose-700 dark:text-rose-400">
            Anda belum menghubungkan akun Facebook atau konfigurasi token WABA.
          </p>
        </div>
      {/if}

      <div class="flex justify-end gap-2 pt-2">
        {#if !channelStore.isConnected}
          <a
            href="/admin/settings"
            onclick={() => (showWabaModal = false)}
            class="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
          >
            Hubungkan di Pengaturan →
          </a>
        {/if}
        <button
          onclick={() => (showWabaModal = false)}
          class="py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 🟢/⚪ LOGIN STATUS PROMPT MODAL -->
{#if showLoginStatusPrompt}
  <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-center">
      <div class="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20 shadow-sm">
        <UserCheck class="w-7 h-7" />
      </div>

      <div class="space-y-1">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">
          Halo, {authStore.user?.fullName || 'Agen'}! 👋
        </h3>
        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Status ketersediaan Anda saat ini adalah <strong class="text-slate-700 dark:text-slate-300">⚪ Offline</strong>. Apakah Anda ingin mengaktifkan status menjadi <strong class="text-emerald-600 dark:text-emerald-400">🟢 Online</strong> untuk mulai menangani pesan pelanggan?
        </p>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
        <button
          type="button"
          onclick={() => setLoginStatus(false)}
          class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
        >
          ⚪ Tetap Offline
        </button>

        <button
          type="button"
          onclick={() => setLoginStatus(true)}
          class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
        >
          <span>🟢 Ya, Ubah Ke Online</span>
        </button>
      </div>
    </div>
  </div>
{/if}
