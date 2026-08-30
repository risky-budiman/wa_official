<script lang="ts">
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.svelte';
  import { channelStore } from '$lib/stores/channel.svelte';
  import RoleBadge from './RoleBadge.svelte';
  import {
    MessageSquare,
    Contact,
    Radio,
    FileText,
    BarChart3,
    Eye,
    Users,
    Settings,
    Key,
    LogOut,
    Bot,
    Building2,
    ShieldAlert,
    ArrowLeft,
    CreditCard
  } from 'lucide-svelte';

  const menuItems = $derived([
    {
      label: 'Main',
      items: [
        { name: 'Live Inbox', path: '/inbox', icon: MessageSquare, roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR', 'AGENT'] },
        { name: 'Kontak Pelanggan', path: '/contacts', icon: Contact, roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR', 'AGENT'] },
        { name: 'Template WA', path: '/templates', icon: FileText, roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'] },
        { name: 'Broadcast', path: '/broadcast', icon: Radio, roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'] },
        { name: 'Laporan & SLA', path: '/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'] }
      ]
    },
    {
      label: 'Supervisor',
      items: [
        { name: 'Monitoring Tim', path: '/supervisor/monitoring', icon: Eye, roles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'] }
      ]
    },
    {
      label: 'Administration',
      items: [
        { name: 'Kelola Tim & Agen', path: '/admin/users', icon: Users, roles: ['SUPER_ADMIN', 'ADMINISTRATOR'] },
        { name: 'Paket & Langganan', path: '/admin/subscription', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMINISTRATOR'] },
        { name: 'Pengaturan WABA', path: '/admin/settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMINISTRATOR'] },
        { name: 'API Key & Developer', path: '/admin/api-keys', icon: Key, roles: ['SUPER_ADMIN', 'ADMINISTRATOR'] }
      ]
    }
  ]);
</script>

<aside class="w-64 bg-white dark:bg-slate-900/95 backdrop-blur border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0">
  <!-- Impersonation Active Banner -->
  {#if authStore.isImpersonating}
    <div class="m-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs space-y-2">
      <div class="flex items-center gap-1.5 font-bold">
        <ShieldAlert class="w-4 h-4 text-amber-500 shrink-0" />
        <span>Mode Akses Tenant</span>
      </div>
      <p class="text-[11px] leading-tight text-slate-600 dark:text-slate-400">
        Anda sedang masuk ke akun tenant <strong>{authStore.user?.organizationName || 'Klien'}</strong>.
      </p>
      <button
        type="button"
        onclick={() => authStore.revertImpersonation()}
        class="w-full py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
      >
        <ArrowLeft class="w-3.5 h-3.5" />
        <span>Kembali ke Portal /administrator</span>
      </button>
    </div>
  {/if}

  <!-- Brand Logo -->
  <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
    <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
      <Bot class="w-5 h-5 stroke-[2.5]" />
    </div>
    <div>
      <h1 class="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
        WhatsApp CRM
      </h1>
      <p class="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[130px]" title={channelStore.channel?.companyName || authStore.user?.organizationName || 'IDS Payment'}>
        {channelStore.channel?.companyName || authStore.user?.organizationName || 'IDS Payment'}
      </p>
    </div>
  </div>

  <!-- Role Status Bar -->
  <div class="px-4 py-3 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
    <span class="text-xs text-slate-500 dark:text-slate-400">Status Akun</span>
    <RoleBadge role={authStore.role} />
  </div>

  <!-- Navigation Links -->
  <nav class="flex-1 overflow-y-auto p-3 space-y-6">
    {#each menuItems as section}
      {@const visibleItems = section.items.filter(item => authStore.role && item.roles.includes(authStore.role))}
      {#if visibleItems.length > 0}
        <div>
          <div class="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {section.label}
          </div>
          <div class="space-y-1">
            {#each visibleItems as item}
              {@const isActive = $page.url.pathname === item.path || ($page.url.pathname.startsWith(item.path) && item.path !== '/')}
              {@const Icon = item.icon}
              <a
                href={item.path}
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 {isActive 
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-semibold' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'}"
              >
                <Icon class="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </nav>

  <!-- User Profile & Logout -->
  <div class="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
    <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm dark:shadow-none">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/15 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase shrink-0">
          {authStore.user?.fullName?.charAt(0) || 'U'}
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-slate-900 dark:text-slate-200 truncate">{authStore.user?.fullName || 'User'}</p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">{authStore.user?.email}</p>
        </div>
      </div>

      <button
        onclick={() => authStore.logout()}
        title="Logout"
        class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
      >
        <LogOut class="w-4 h-4" />
      </button>
    </div>
  </div>
</aside>
