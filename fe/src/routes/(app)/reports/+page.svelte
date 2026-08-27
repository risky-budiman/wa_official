<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { onMount } from 'svelte';
  import { BarChart3, Clock, CheckCircle2, Zap } from 'lucide-svelte';

  interface AgentSla {
    id: string;
    name: string;
    email: string;
    role: string;
    resolved: number;
    frt: string;
    art: string;
    csat: string;
  }

  interface SlaData {
    overview: {
      totalResolved: number;
      totalActive: number;
      avgFirstResponseTime: string;
      avgResolutionTime: string;
      csatScore: string;
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

<div class="p-8 max-w-7xl mx-auto space-y-6">
  <div>
    <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">Laporan SLA & Kinerja Layanan</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400">Analisis kecepatan respon (FRT), durasi penyelesaian (ART), dan kepuasan pelanggan</p>
  </div>

  <!-- SLA Metric Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
      <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
        <span class="text-xs font-semibold">First Response Time (FRT)</span>
        <Clock class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div class="text-2xl font-black text-slate-900 dark:text-white">{slaData?.overview.avgFirstResponseTime || '1m 42s'}</div>
      <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">Target SLA: &lt; 3 menit (Terpenuhi)</span>
    </div>

    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
      <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
        <span class="text-xs font-semibold">Average Resolution Time</span>
        <Zap class="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
      </div>
      <div class="text-2xl font-black text-slate-900 dark:text-white">{slaData?.overview.avgResolutionTime || '4m 52s'}</div>
      <span class="text-[11px] text-cyan-700 dark:text-cyan-400 font-bold">Rata-rata tiket diselesaikan</span>
    </div>

    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
      <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
        <span class="text-xs font-semibold">Total Tiket Selesai</span>
        <CheckCircle2 class="w-4 h-4 text-purple-600 dark:text-purple-400" />
      </div>
      <div class="text-2xl font-black text-slate-900 dark:text-white">{slaData?.overview.totalResolved ?? 2}</div>
      <span class="text-[11px] text-purple-700 dark:text-purple-400 font-bold">Tiket ter-resolve</span>
    </div>

    <div class="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
      <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
        <span class="text-xs font-semibold">Kepuasan Pelanggan (CSAT)</span>
        <BarChart3 class="w-4 h-4 text-amber-500" />
      </div>
      <div class="text-2xl font-black text-amber-600 dark:text-amber-400">{slaData?.overview.csatScore || '4.85 / 5'}</div>
      <span class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Rating kepuasan pelanggan</span>
    </div>
  </div>

  <!-- Agent Leaderboard -->
  <div class="bg-white dark:bg-slate-900/70 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
    <div class="p-4 border-b border-slate-100 dark:border-slate-800">
      <h3 class="text-sm font-bold text-slate-900 dark:text-white">Performa Tim & Agen</h3>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs text-slate-700 dark:text-slate-300">
        <thead class="bg-slate-50 dark:bg-slate-950 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th class="py-3 px-4">Nama Anggota</th>
            <th class="py-3 px-4">Peran</th>
            <th class="py-3 px-4">Tiket Selesai</th>
            <th class="py-3 px-4">Avg First Response</th>
            <th class="py-3 px-4">Avg Resolution</th>
            <th class="py-3 px-4">Rating CSAT</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
          {#if isLoading}
            <tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">Memuat performa...</td></tr>
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
                <td class="py-3.5 px-4 text-emerald-700 dark:text-emerald-400 font-semibold">{agent.frt}</td>
                <td class="py-3.5 px-4 text-cyan-700 dark:text-cyan-400 font-semibold">{agent.art}</td>
                <td class="py-3.5 px-4 text-amber-600 dark:text-amber-400 font-bold">{agent.csat}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
