<script lang="ts">
  import type { Snippet } from 'svelte';
  import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-svelte';

  interface Props {
    tone?: 'success' | 'error' | 'info' | 'warning';
    message?: string | null;
    title?: string;
    /** Show a close button; called when clicked */
    ondismiss?: () => void;
    children?: Snippet;
  }
  let { tone = 'info', message, title, ondismiss, children }: Props = $props();

  const styles = {
    success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200', icon: CheckCircle2, iconCls: 'text-emerald-600 dark:text-emerald-400' },
    error: { box: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200', icon: AlertCircle, iconCls: 'text-rose-600 dark:text-rose-400' },
    info: { box: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200', icon: Info, iconCls: 'text-blue-600 dark:text-blue-400' },
    warning: { box: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200', icon: AlertTriangle, iconCls: 'text-amber-600 dark:text-amber-400' },
  } as const;
  const s = $derived(styles[tone]);
  const Icon = $derived(s.icon);
</script>

<div class="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm {s.box}" role={tone === 'error' ? 'alert' : 'status'}>
  <Icon class="mt-0.5 h-4 w-4 shrink-0 {s.iconCls}" />
  <div class="min-w-0 flex-1">
    {#if title}<p class="font-semibold">{title}</p>{/if}
    {#if message}<p class={title ? 'mt-0.5 opacity-90' : 'font-medium'}>{message}</p>{/if}
    {#if children}{@render children()}{/if}
  </div>
  {#if ondismiss}
    <button type="button" class="-m-1 rounded-md p-1 opacity-60 hover:opacity-100" aria-label="Tutup" onclick={ondismiss}>
      <X class="h-4 w-4" />
    </button>
  {/if}
</div>
