<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tone = 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'cyan' | 'slate';

  interface Props {
    label: string;
    value?: string | number;
    icon?: any;
    tone?: Tone;
    /** Small helper text under the value */
    hint?: string;
    /** Color of the hint (defaults to muted) */
    hintTone?: Tone | 'muted';
    /** Custom value rendering (overrides `value`) */
    children?: Snippet;
  }
  let { label, value, icon: Icon, tone = 'emerald', hint, hintTone = 'muted', children }: Props = $props();

  const iconTone: Record<Tone, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
    blue: 'bg-blue-50 text-blue-600 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20',
    violet: 'bg-violet-50 text-violet-600 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-400/20',
    amber: 'bg-amber-50 text-amber-600 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
    rose: 'bg-rose-50 text-rose-600 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-400/20',
    cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-600/15 dark:bg-cyan-500/10 dark:text-cyan-400 dark:ring-cyan-400/20',
    slate: 'bg-slate-100 text-slate-600 ring-slate-600/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
  };
  const textTone: Record<Tone | 'muted', string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    violet: 'text-violet-600 dark:text-violet-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    cyan: 'text-cyan-600 dark:text-cyan-400',
    slate: 'text-slate-600 dark:text-slate-300',
    muted: 'text-slate-500 dark:text-slate-400',
  };
</script>

<div class="ui-card flex items-start gap-4 p-5">
  {#if Icon}
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset {iconTone[tone]}">
      <Icon class="h-5 w-5" />
    </div>
  {/if}
  <div class="min-w-0 flex-1">
    <p class="text-sm font-medium leading-snug text-slate-500 dark:text-slate-400">{label}</p>
    <div class="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
      {#if children}{@render children()}{:else}{value}{/if}
    </div>
    {#if hint}
      <p class="mt-1 text-xs font-medium leading-snug {textTone[hintTone]}">{hint}</p>
    {/if}
  </div>
</div>
