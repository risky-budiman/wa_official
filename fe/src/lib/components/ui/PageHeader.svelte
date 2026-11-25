<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    /** Optional lucide icon component shown next to the title */
    icon?: any;
    /** Buttons on the right (refresh, primary action, …) */
    actions?: Snippet;
    /** Extra content under the description (badges, counters, …) */
    meta?: Snippet;
  }
  let { title, description, icon: Icon, actions, meta }: Props = $props();
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
  <div class="flex min-w-0 items-start gap-3.5">
    {#if Icon}
      <div class="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/15 sm:flex dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20">
        <Icon class="h-5 w-5" />
      </div>
    {/if}
    <div class="min-w-0">
      <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{title}</h1>
      {#if description}
        <p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      {/if}
      {#if meta}
        <div class="mt-2 flex flex-wrap items-center gap-2">{@render meta()}</div>
      {/if}
    </div>
  </div>

  {#if actions}
    <div class="flex shrink-0 flex-wrap items-center gap-2">{@render actions()}</div>
  {/if}
</div>
