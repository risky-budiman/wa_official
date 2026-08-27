<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { channelStore } from '$lib/stores/channel.svelte';
  import { apiRequest } from '$lib/api/client';
  import { onMount } from 'svelte';
  import {
    Bell,
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
    CircleDot
  } from 'lucide-svelte';

  interface Props {
    title?: string;
    subtitle?: string;
  }
  let { title = 'Dashboard', subtitle }: Props = $props();

  let showNotifications = $state(false);
  let showSecurityModal = $state(false);
  let showWabaModal = $state(false);

  let notifications = $state([
    {
      id: 1,
      title: 'Pesan Baru dari Rian Pratama',
      desc: 'Apakah produk varian hitam masih tersedia stoknya?',
      time: 'Baru saja',
      unread: true,
      type: 'chat',
    },
    {
      id: 2,
      title: 'Kolaborasi Ditambahkan',
      desc: 'Anda ditambahkan ke percakapan Siti Aminah oleh SPV.',
      time: '5 menit lalu',
      unread: true,
      type: 'collab',
    },
    {
      id: 3,
      title: 'Broadcast Campaign Selesai',
      desc: 'Promo Flash Sale: 1,500 pesan terkirim (Delivery: 98.8%).',
      time: '1 jam lalu',
      unread: false,
      type: 'broadcast',
    },
  ]);

  const unreadCount = $derived(notifications.filter((n) => n.unread).length);

  function markAllAsRead() {
    notifications = notifications.map((n) => ({ ...n, unread: false }));
  }

  onMount(() => {
    channelStore.checkStatus();
  });
</script>

<header class="h-16 bg-white dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 relative z-30 transition-colors duration-200">
  <div class="min-w-0">
    <h2 class="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">{title}</h2>
    {#if subtitle}
      <p class="text-xs text-slate-600 dark:text-slate-400 truncate">{subtitle}</p>
    {/if}
  </div>

  <div class="flex items-center gap-2.5 sm:gap-3.5">
    <!-- 🟢/⚪ User Online/Offline Status Pill Toggle -->
    <button
      onclick={() => authStore.toggleOnline()}
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition cursor-pointer {authStore.isOnline 
        ? 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold' 
        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold'}"
      title="Klik untuk mengubah status ketersediaan Anda (Online / Offline)"
    >
      <span class="w-2 h-2 rounded-full {authStore.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
      <span class="text-[11px]">{authStore.isOnline ? '🟢 Online' : '⚪ Offline'}</span>
    </button>

    <!-- 🟢/🔴 DYNAMIC WhatsApp Connection Health Badge -->
    <button
      onclick={() => (showWabaModal = true)}
      class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition cursor-pointer {channelStore.isConnected 
        ? 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}"
      title="Lihat Status Saluran WhatsApp"
    >
      {#if channelStore.isConnected}
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-400"></span>
        </span>
        <span class="font-semibold text-[11px]">WABA Connected</span>
      {:else}
        <span class="relative flex h-2 w-2">
          <span class="inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
        </span>
        <span class="font-semibold text-[11px]">WABA Disconnected</span>
      {/if}
    </button>

    <!-- 🌓 THEME TOGGLE BUTTON -->
    <button
      onclick={() => themeStore.toggle()}
      class="p-2 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
      title="Ubah Tema (Light / Dark)"
    >
      {#if themeStore.current === 'dark'}
        <Sun class="w-4 h-4 text-amber-400" />
      {:else}
        <Moon class="w-4 h-4 text-indigo-600" />
      {/if}
    </button>

    <!-- 🛡️ Security Indicator (Clickable) -->
    <button
      onclick={() => (showSecurityModal = true)}
      class="p-2 rounded-xl text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 border border-emerald-200 dark:border-slate-700 transition cursor-pointer"
      title="Pusat Keamanan & Enkripsi"
    >
      <ShieldCheck class="w-4 h-4 stroke-[2.5]" />
    </button>

    <!-- 🔔 Notification Bell (Clickable) -->
    <div class="relative">
      <button
        onclick={() => (showNotifications = !showNotifications)}
        class="relative p-2 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer"
        title="Notifikasi"
      >
        <Bell class="w-4 h-4" />
        {#if unreadCount > 0}
          <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
        {/if}
      </button>

      <!-- Notification Dropdown Popover -->
      {#if showNotifications}
        <div class="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div class="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold text-slate-900 dark:text-white">Notifikasi Aktivitas</h4>
              {#if unreadCount > 0}
                <span class="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  {unreadCount} baru
                </span>
              {/if}
            </div>
            <button
              onclick={markAllAsRead}
              class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Tandai Dibaca
            </button>
          </div>

          <div class="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {#each notifications as n}
              <div class="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition {n.unread ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}">
                <div class="flex items-start justify-between gap-2 mb-1">
                  <span class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {#if n.type === 'chat'}
                      <MessageSquare class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    {:else if n.type === 'collab'}
                      <UserCheck class="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {:else}
                      <Radio class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    {/if}
                    {n.title}
                  </span>
                  <span class="text-[10px] text-slate-500 shrink-0">{n.time}</span>
                </div>
                <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{n.desc}</p>
              </div>
            {/each}
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
