<script lang="ts" module>
  export interface MetaQuota {
    dailyLimit: number;
    tierDisplay: string;
    totalUsed: number;
    remainingQuota: number;
    usedPercentage: number;
    uniqueContactsReached?: number;
    csReplies24h?: number;
    broadcastSent24h?: number;
    qualityRating?: string;
    resetWindow?: string;
  }
</script>

<script lang="ts">
  import { Flame } from 'lucide-svelte';


  interface Props {
    quota: MetaQuota;
    /** Show quality rating and the usage breakdown (monitoring view) */
    detailed?: boolean;
  }
  let { quota, detailed = false }: Props = $props();

  const pct = $derived(quota.usedPercentage);
  const quality = $derived(
    quota.qualityRating === 'GREEN'
      ? { label: 'Tinggi', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20', dot: 'bg-emerald-500' }
      : quota.qualityRating === 'YELLOW'
        ? { label: 'Sedang', cls: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20', dot: 'bg-amber-500' }
        : { label: 'Rendah', cls: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20', dot: 'bg-rose-500' },
  );
  const fmt = (n?: number) => (n ?? 0).toLocaleString('id-ID');
</script>

<div class="ui-card space-y-4 p-5">
  <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20">
        <Flame class="h-5 w-5" />
      </div>
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Kuota Pesan Meta (24 jam)</p>
          <span class="ui-pill border-indigo-200 bg-indigo-50 py-0.5 font-mono text-[11px] text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
            {quota.tierDisplay}
          </span>
        </div>
        <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Sisa kuota: <strong class="font-semibold text-emerald-600 dark:text-emerald-400">{fmt(quota.remainingQuota)} penerima</strong>
        </p>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2 sm:justify-end">
      {#if detailed && quota.qualityRating}
        <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset {quality.cls}" title="Rating kualitas nomor dari Meta">
          <span class="h-1.5 w-1.5 rounded-full {quality.dot}"></span>
          Kualitas nomor: {quality.label}
        </span>
      {/if}
      <p class="font-mono text-sm font-semibold {pct >= 90 ? 'text-rose-600 dark:text-rose-400' : pct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}">
        {fmt(quota.totalUsed)} / {fmt(quota.dailyLimit)} ({pct}%)
      </p>
    </div>
  </div>

  <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Pemakaian kuota Meta">
    <div
      class="h-full rounded-full transition-all duration-700 {pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}"
      style="width: {Math.max(pct, 2)}%"
    ></div>
  </div>

  {#if detailed}
    <dl class="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div>
        <dt class="text-xs text-slate-500 dark:text-slate-400">Kontak dilayani</dt>
        <dd class="mt-0.5 text-base font-semibold tabular-nums text-slate-900 dark:text-white">{fmt(quota.uniqueContactsReached)}</dd>
      </div>
      <div title="Balasan langsung oleh CS tidak memotong kuota Meta">
        <dt class="text-xs text-slate-500 dark:text-slate-400">Balasan CS <span class="text-emerald-600 dark:text-emerald-400">(gratis kuota)</span></dt>
        <dd class="mt-0.5 text-base font-semibold tabular-nums text-slate-900 dark:text-white">{fmt(quota.csReplies24h)}</dd>
      </div>
      <div title="Broadcast & notifikasi bisnis memotong kuota Meta">
        <dt class="text-xs text-slate-500 dark:text-slate-400">Broadcast <span class="text-amber-600 dark:text-amber-400">(memakai kuota)</span></dt>
        <dd class="mt-0.5 text-base font-semibold tabular-nums text-slate-900 dark:text-white">{fmt(quota.broadcastSent24h)}</dd>
      </div>
    </dl>
  {/if}
</div>
