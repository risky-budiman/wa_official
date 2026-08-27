<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { onMount } from 'svelte';
  import { Eye, Clock, MessageSquare, Phone, User, CheckCircle2 } from 'lucide-svelte';

  interface MonitoringItem {
    id: string;
    status: string;
    lastMessagePreview: string | null;
    lastMessageAt: string;
    contact: {
      id: string;
      name: string;
      waId: string;
    };
    assignedUser: {
      id: string;
      fullName: string;
      email: string;
    } | null;
  }

  let activeChats = $state<MonitoringItem[]>([]);
  let isLoading = $state(true);

  async function loadMonitoring() {
    isLoading = true;
    const res = await apiRequest<{ items: MonitoringItem[] }>('/conversations');
    isLoading = false;
    if (res.success && res.items) {
      activeChats = res.items;
    }
  }

  onMount(() => {
    loadMonitoring();
  });
</script>

<div class="p-8 max-w-7xl mx-auto space-y-6">
  <div>
    <h2 class="text-xl font-extrabold text-slate-900 dark:text-white">Live Monitoring Obrolan</h2>
    <p class="text-xs text-slate-600 dark:text-slate-400">Pantau seluruh percakapan tim yang sedang berlangsung secara real-time dan berikan bantuan via catatan internal (whispering)</p>
  </div>

  {#if isLoading}
    <div class="p-12 text-center text-xs text-slate-500 dark:text-slate-400">Memuat sesi obrolan tim...</div>
  {:else if activeChats.length === 0}
    <div class="p-12 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
      Tidak ada sesi obrolan aktif saat ini.
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      {#each activeChats as chat}
        <div class="bg-white dark:bg-slate-900/70 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="text-sm font-bold text-slate-900 dark:text-white">{chat.contact.name}</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Agen: <span class="text-slate-800 dark:text-slate-200 font-semibold">{chat.assignedUser?.fullName || 'Belum di-assign'}</span>
              </p>
            </div>
            
            {#if chat.status === 'RESOLVED'}
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <CheckCircle2 class="w-3 h-3" /> Tiket Selesai
              </span>
            {:else}
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Aktif
              </span>
            {/if}
          </div>

          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-300 leading-relaxed">
            <span class="text-slate-500 dark:text-slate-400 text-[10px] font-bold block mb-1">Pesan Terakhir:</span>
            "{chat.lastMessagePreview || 'Belum ada pesan'}"
          </div>

          <div class="flex items-center justify-between pt-2">
            <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              +{chat.contact.waId} • {new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            <a
              href="/inbox"
              class="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Eye class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Buka di Inbox
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
