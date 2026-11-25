<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import { apiRequest } from '$lib/api/client';
  import { onMount } from 'svelte';
  import { BarChart3, Clock, CheckCircle2, Zap } from 'lucide-svelte';

  interface AgentSla {
    id: string;
    name: string;
    email: string;
    role: string;
    resolved: number;
    frt: string | null;
    art: string | null;
    csat: string | null;
  }

  interface SlaData {
    overview: {
      totalResolved: number;
      totalActive: number;
      avgFirstResponseTime: string | null;
      avgResolutionTime: string | null;
      csatScore: string | null;
    };
    agentPerformance: AgentSla[];
  }

  let slaData = $state<SlaData | null>(null);
  let isLoading = $state(true);

  async function loadMetrics() {
    isLoading = true;
    const res = await apiRequest<SlaData>('/analytics/sla');
    isLoading = false;
    if (res.success && res.overview) {
      slaData = res as any;
    }
  }

  onMount(() => {
    loadMetrics();
  });
</script>

<div class="ui-page">
  <PageHeader
    title="Laporan & SLA"
    description="Kecepatan respons pertama (FRT), durasi penyelesaian (ART) dan kepuasan pelanggan (CSAT)."
    icon={BarChart3}
  />

  <!-- SLA Metric Cards (no placeholder numbers: show "—" until real data exists) -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard label="Respons Pertama (FRT)" value={slaData?.overview.avgFirstResponseTime || '—'} icon={Clock} tone="emerald" hint="Target di bawah 3 menit" />
    <StatCard label="Durasi Tiket Selesai" value={slaData?.overview.avgResolutionTime || '—'} icon={Zap} tone="cyan" hint="Rata-rata dari tiket dibuka hingga pesan terakhir" />
    <StatCard label="Tiket Selesai" value={slaData?.overview.totalResolved ?? '—'} icon={CheckCircle2} tone="violet" hint="Total tiket berstatus selesai" />
    <StatCard label="Kepuasan Pelanggan (CSAT)" value={slaData?.overview.csatScore || '—'} icon={BarChart3} tone="amber" hint={slaData?.overview.csatScore ? 'Skala 1 – 5' : 'Survei kepuasan belum diaktifkan'} />
  </div>

  <!-- Agent Leaderboard -->
  <div class="ui-card overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
      <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Performa Tim & Agen</h2>
    </div>

    <div class="overflow-x-auto">
      <table class="ui-table w-full text-left text-slate-700 dark:text-slate-300">
        <thead class="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th class="py-3 px-4">Nama Anggota</th>
            <th class="py-3 px-4">Peran</th>
            <th class="py-3 px-4">Tiket Selesai</th>
            <th class="py-3 px-4">Respons Pertama</th>
            <th class="py-3 px-4">Durasi Tiket</th>
            <th class="py-3 px-4">CSAT</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
          {#if isLoading}
            <tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Memuat performa...</td></tr>
          {:else if !slaData?.agentPerformance?.length}
            <tr><td colspan="6" class="p-8 text-center text-slate-500 dark:text-slate-400">Belum ada data performa. Data muncul setelah tim menyelesaikan percakapan.</td></tr>
          {:else if slaData?.agentPerformance}
            {#each slaData.agentPerformance as agent}
              <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    {agent.name.charAt(0)}
                  </div>
                  {agent.name}
                </td>
                <td class="py-3.5 px-4 text-slate-500 dark:text-slate-400">{agent.role}</td>
                <td class="py-3.5 px-4 text-slate-900 dark:text-white font-bold">{agent.resolved} tiket</td>
                <td class="py-3.5 px-4 font-semibold {agent.frt ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}">{agent.frt ?? '—'}</td>
                <td class="py-3.5 px-4 font-semibold {agent.art ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-400'}">{agent.art ?? '—'}</td>
                <td class="py-3.5 px-4 font-semibold {agent.csat ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}">{agent.csat ?? '—'}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
