<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    icon?: any;
    title: string;
    description?: string;
    /** Optional call-to-action button(s) */
    children?: Snippet;
  }
  let { icon: Icon, title, description, children }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center px-6 py-12 text-center">
  {#if Icon}
    <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <Icon class="h-6 w-6" />
    </div>
  {/if}
  <p class="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
  {#if description}
    <p class="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
  {/if}
  {#if children}
    <div class="mt-4">{@render children()}</div>
  {/if}
</div>
