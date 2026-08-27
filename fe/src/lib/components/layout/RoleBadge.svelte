<script lang="ts">
  interface Props {
    role?: 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT' | null;
  }
  let { role = 'AGENT' }: Props = $props();
</script>

{#if role === 'ADMINISTRATOR'}
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
