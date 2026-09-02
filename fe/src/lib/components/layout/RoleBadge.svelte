<script lang="ts">
  interface Props {
    role?: 'SUPER_ADMIN' | 'CO_SUPER_ADMIN' | 'ADMIN_FINANCE' | 'ADMIN_SUPPORT' | 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT' | null;
    isPrimaryAdmin?: boolean;
  }
  let { role = 'AGENT', isPrimaryAdmin = false }: Props = $props();
</script>

{#if role === 'SUPER_ADMIN'}
  {#if isPrimaryAdmin}
    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-xs">
      <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
      Administrator Utama
    </span>
  {:else}
    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30">
      <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
      Co-Super Admin
    </span>
  {/if}
{:else if role === 'CO_SUPER_ADMIN'}
  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30">
    <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
    Co-Super Admin
  </span>
{:else if role === 'ADMIN_FINANCE'}
  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
    Finance Staff
  </span>
{:else if role === 'ADMIN_SUPPORT'}
  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
    <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
    Support Staff
  </span>
{:else if role === 'ADMINISTRATOR'}
  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/20">
    <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
    Admin
  </span>
{:else if role === 'SUPERVISOR'}
  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
    <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
    Supervisor
  </span>
{:else}
  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
    Agent
  </span>
{/if}
