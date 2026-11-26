<script lang="ts">
  import { notificationStore, type NotificationItem } from '$lib/stores/notifications.svelte';
  import { Bell, BellRing, Volume2, VolumeX, MonitorSmartphone, CheckCheck, Inbox, ArrowRight, X } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);
  let now = $state(Date.now());

  const unread = $derived(notificationStore.unreadCount);
  const items = $derived(notificationStore.items);

  $effect(() => {
    if (!open) return;
    now = Date.now();
    const t = setInterval(() => (now = Date.now()), 30000);
    const onDoc = (e: MouseEvent) => {
      if (rootEl && !rootEl.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open = false;
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      clearInterval(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  });

  function relTime(iso: string) {
    const diff = Math.max(0, now - new Date(iso).getTime());
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Baru saja';
    if (m < 60) return `${m} mnt`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam`;
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  function initials(name: string) {
    const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function openItem(n: NotificationItem) {
    open = false;
    notificationStore.open(n);
  }

  const desktopState = $derived(
    notificationStore.permission === 'unsupported'
      ? 'unsupported'
      : notificationStore.permission === 'denied'
        ? 'denied'
        : notificationStore.permission === 'granted'
          ? notificationStore.desktopEnabled ? 'on' : 'off'
          : 'ask'
  );
</script>

<div class="relative" bind:this={rootEl}>
  <button
    type="button"
    onclick={() => (open = !open)}
    class="ui-icon-btn {open ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : ''}"
    title="Notifikasi"
    aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
    aria-expanded={open}
    aria-haspopup="dialog"
  >
    {#if unread > 0}<BellRing class="h-[18px] w-[18px]" />{:else}<Bell class="h-[18px] w-[18px]" />{/if}
    {#if unread > 0}
      <span class="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white dark:ring-slate-900">
        {unread > 9 ? '9+' : unread}
      </span>
    {/if}
  </button>

  {#if open}
    <div
      class="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px] dark:border-slate-800 dark:bg-slate-900"
      role="dialog"
      aria-label="Notifikasi"
    >
      <!-- Header -->
      <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Notifikasi</h3>
          {#if unread > 0}
            <span class="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{unread} belum dibaca</span>
          {/if}
        </div>
        <div class="flex items-center gap-1">
          {#if unread > 0}
            <button type="button" class="ui-icon-btn h-8 w-8" title="Tandai semua dibaca" aria-label="Tandai semua dibaca" onclick={() => notificationStore.markAllAsRead()}>
              <CheckCheck class="h-4 w-4" />
            </button>
          {/if}
          <button type="button" class="ui-icon-btn h-8 w-8 sm:hidden" aria-label="Tutup" onclick={() => (open = false)}><X class="h-4 w-4" /></button>
        </div>
      </div>

      <!-- Desktop permission prompt (needs a click) -->
      {#if desktopState === 'ask'}
        <div class="flex items-center gap-3 border-b border-slate-100 bg-emerald-50/60 px-4 py-3 dark:border-slate-800 dark:bg-emerald-500/5">
          <MonitorSmartphone class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p class="flex-1 text-xs text-slate-600 dark:text-slate-300">Dapatkan pemberitahuan pesan baru walau tab ini tidak sedang dibuka.</p>
          <button type="button" class="ui-btn-primary shrink-0 !px-2.5 !py-1 text-xs" onclick={() => notificationStore.requestBrowserPermission()}>Izinkan</button>
        </div>
      {:else if desktopState === 'denied'}
        <div class="border-b border-slate-100 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800 dark:border-slate-800 dark:bg-amber-500/5 dark:text-amber-200">
          Notifikasi desktop diblokir browser. Izinkan lewat ikon gembok di address bar.
        </div>
      {/if}

      <!-- List -->
      <div class="max-h-[min(60vh,420px)] overflow-y-auto">
        {#if items.length === 0}
          <div class="flex flex-col items-center px-6 py-10 text-center">
            <span class="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><Bell class="h-5 w-5" /></span>
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Tidak ada notifikasi</p>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Pesan baru dari pelanggan akan muncul di sini.</p>
          </div>
        {:else}
          <ul class="divide-y divide-slate-100 dark:divide-slate-800">
            {#each items as n (n.id)}
              <li>
                <button
                  type="button"
                  onclick={() => openItem(n)}
                  class="relative flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 {n.unread ? 'bg-emerald-50/40 dark:bg-emerald-500/5' : ''}"
                >
                  <span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {initials(n.contactName)}
                    {#if n.kind === 'queue'}
                      <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" title="Belum ditugaskan"></span>
                    {/if}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-baseline justify-between gap-2">
                      <span class="truncate text-sm {n.unread ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}">{n.contactName}</span>
                      <span class="shrink-0 text-[11px] {n.unread ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">{relTime(n.at)}</span>
                    </span>
                    <span class="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-slate-500 dark:text-slate-400">{n.preview}</span>
                    {#if n.unread && (n.count > 1 || n.kind === 'queue')}
                      <span class="mt-1.5 flex flex-wrap gap-1.5">
                        {#if n.count > 1}<span class="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-emerald-500 dark:text-slate-950">{n.count} pesan baru</span>{/if}
                        {#if n.kind === 'queue'}<span class="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Antrean</span>{/if}
                      </span>
                    {/if}
                  </span>
                  {#if n.unread}<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Belum dibaca"></span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Footer: preferences -->
      <div class="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center gap-1">
          <button
            type="button"
            onclick={() => notificationStore.toggleSound()}
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-pressed={notificationStore.soundEnabled}
          >
            {#if notificationStore.soundEnabled}<Volume2 class="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Suara aktif{:else}<VolumeX class="h-4 w-4 text-slate-400" /> Suara mati{/if}
          </button>
          {#if desktopState === 'on' || desktopState === 'off'}
            <button
              type="button"
              onclick={() => notificationStore.toggleDesktop()}
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-pressed={desktopState === 'on'}
            >
              <MonitorSmartphone class="h-4 w-4 {desktopState === 'on' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}" />
              Desktop {desktopState === 'on' ? 'aktif' : 'mati'}
            </button>
          {/if}
        </div>
        <button
          type="button"
          onclick={() => { open = false; goto('/inbox'); }}
          class="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
        >
          <Inbox class="h-4 w-4" /> Buka Inbox <ArrowRight class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  {/if}
</div>
