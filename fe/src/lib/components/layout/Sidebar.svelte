<script lang="ts">
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';
  import { channelStore } from '$lib/stores/channel.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { NAV_SECTIONS, isNavItemActive } from '$lib/navigation';
  import RoleBadge from './RoleBadge.svelte';
  import { LogOut, MessageCircle, ShieldAlert, ArrowLeft, X } from 'lucide-svelte';

  const orgName = $derived(
    channelStore.channel?.companyName || authStore.user?.organizationName || 'Organisasi Anda',
  );

  const visibleSections = $derived(
    NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => authStore.role && item.roles.includes(authStore.role)),
    })).filter((section) => section.items.length > 0),
  );

  const initials = $derived(
    (authStore.user?.fullName || 'U')
      .replace(/\([^)]*\)/g, '') // ignore notes like "(Supervisor)"
      .split(/\s+/)
      .filter((w) => /^[\p{L}\p{N}]/u.test(w))
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase(),
  );
</script>

<!-- Mobile backdrop -->
{#if uiStore.sidebarOpen}
  <button
    type="button"
    aria-label="Tutup menu"
    class="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
    onclick={() => uiStore.closeSidebar()}
  ></button>
{/if}

<aside
  class="fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 {uiStore.sidebarOpen
    ? 'translate-x-0 shadow-2xl'
    : '-translate-x-full'}"
  aria-label="Navigasi utama"
>
  <!-- Brand -->
  <div class="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 dark:bg-emerald-500 dark:text-slate-950">
      <MessageCircle class="h-5 w-5" strokeWidth={2.4} />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-bold leading-tight tracking-tight text-slate-900 dark:text-white">WhatsApp CRM</p>
      <p class="truncate text-xs text-slate-500 dark:text-slate-400" title={orgName}>{orgName}</p>
    </div>
    <button
      type="button"
      class="ui-icon-btn -mr-2 lg:hidden"
      aria-label="Tutup menu"
      onclick={() => uiStore.closeSidebar()}
    >
      <X class="h-4 w-4" />
    </button>
  </div>

  <!-- Impersonation banner -->
  {#if authStore.isImpersonating}
    <div class="mx-3 mt-3 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
      <div class="flex items-center gap-1.5 font-bold">
        <ShieldAlert class="h-4 w-4 shrink-0 text-amber-500" />
        <span>Mode Akses Tenant</span>
      </div>
      <p class="leading-snug text-slate-600 dark:text-slate-400">
        Anda masuk sebagai <strong class="text-slate-800 dark:text-slate-200">{authStore.user?.organizationName || 'klien'}</strong>.
      </p>
      <button
        type="button"
        onclick={() => authStore.revertImpersonation()}
        class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-2 py-1.5 font-bold text-slate-950 transition hover:bg-amber-400"
      >
        <ArrowLeft class="h-3.5 w-3.5" />
        Kembali ke Portal Admin
      </button>
    </div>
  {/if}

  <!-- Navigation -->
  <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-4">
    {#each visibleSections as section (section.label)}
      <div>
        <p class="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {section.label}
        </p>
        <ul class="space-y-0.5">
          {#each section.items as item (item.path)}
            {@const active = isNavItemActive(item, $page.url.pathname)}
            {@const Icon = item.icon}
            <li>
              <a
                href={item.path}
                onclick={() => uiStore.closeSidebar()}
                aria-current={active ? 'page' : undefined}
                class="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {active
                  ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white'}"
              >
                {#if active}
                  <span class="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-emerald-600 dark:bg-emerald-400"></span>
                {/if}
                <Icon
                  class="h-[18px] w-[18px] shrink-0 {active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'}"
                />
                <span class="truncate">{item.name}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>

  <!-- Account -->
  <div class="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
    <div class="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <div class="relative shrink-0">
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          {initials}
        </div>
        <span
          class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 {authStore.isOnline
            ? 'bg-emerald-500'
            : 'bg-slate-400'}"
          title={authStore.isOnline ? 'Online' : 'Offline'}
        ></span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{authStore.user?.fullName || 'Pengguna'}</p>
        <div class="mt-0.5"><RoleBadge role={authStore.role} size="sm" /></div>
      </div>
      <button
        type="button"
        onclick={() => authStore.logout()}
        title="Keluar"
        aria-label="Keluar"
        class="ui-icon-btn h-8 w-8 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
      >
        <LogOut class="h-4 w-4" />
      </button>
    </div>
  </div>
</aside>
