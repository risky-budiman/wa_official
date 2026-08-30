<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { onMount, onDestroy } from 'svelte';
  import {
    Eye,
    Clock,
    MessageSquare,
    Phone,
    User,
    CheckCircle2,
    AlertCircle,
    Users,
    SlidersHorizontal,
    RefreshCw,
    Search,
    X,
    ArrowRight,
    Lock,
    Send,
    Sparkles,
    Shield,
    Activity,
    UserCheck,
    UserX,
    Layers,
    LayoutGrid,
    Columns3,
    Check,
    ExternalLink,
    ChevronRight,
    ArrowLeftRight,
    Timer,
    Flame,
    Tag,
    UserPlus,
    CornerDownRight
  } from 'lucide-svelte';

  interface MonitoringItem {
    id: string;
    status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'UNASSIGNED';
    windowExpiresAt: string | null;
    lastMessagePreview: string | null;
    lastMessageAt: string;
    createdAt: string;
    contactId: string;
    contactName: string;
    contactWaId: string;
    contactEmail: string | null;
    contactCustomAttributes: Record<string, any> | null;
    assignedUserId: string | null;
    assignedFullName: string | null;
    assignedEmail: string | null;
    assignedRole: string | null;
    participants?: Array<{
      id: string;
      userId: string;
      fullName: string;
      email: string;
      role: string;
      roleInChat: string;
    }>;
  }

  interface TeamUser {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
    isOnline: boolean;
    maxActiveChats: number;
    team?: {
      id: string;
      name: string;
    } | null;
  }

  interface ChatMessage {
    id: string;
    conversationId: string;
    direction: 'INBOUND' | 'OUTBOUND';
    senderType: string;
    senderName?: string;
    body: string;
    isInternalNote: boolean;
    status: string;
    createdAt: string;
  }

  let activeChats = $state<MonitoringItem[]>([]);
  let teamUsers = $state<TeamUser[]>([]);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let autoRefreshEnabled = $state(true);
  let refreshTimer: any = null;

  // View Modes: 'grid' | 'workload' | 'kanban'
  let viewMode = $state<'grid' | 'workload' | 'kanban'>('grid');

  // Filters & Search
  let searchQuery = $state('');
  let selectedAgentFilter = $state<string>('ALL');
  let selectedStatusFilter = $state<string>('ALL');
  let selectedWindowFilter = $state<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');

  // Slide-over Inspector Drawer State
  let selectedChat = $state<MonitoringItem | null>(null);
  let chatMessages = $state<ChatMessage[]>([]);
  let isLoadingMessages = $state(false);
  let whisperText = $state('');
  let isSendingWhisper = $state(false);
  let targetReassignUser = $state('');
  let isReassigning = $state(false);
  let feedbackToast = $state<string | null>(null);

  // Stats
  let totalActive = $derived(activeChats.filter((c) => c.status === 'OPEN' || c.status === 'PENDING').length);
  let totalUnassigned = $derived(activeChats.filter((c) => c.status === 'UNASSIGNED' || !c.assignedUserId).length);
  let totalResolved = $derived(activeChats.filter((c) => c.status === 'RESOLVED').length);
  let onlineAgentsCount = $derived(teamUsers.filter((u) => u.isOnline && u.role === 'AGENT').length);

  async function loadData(showLoading = true) {
    if (showLoading) isLoading = true;
    isRefreshing = true;

    try {
      const [convRes, usersRes] = await Promise.all([
        apiRequest<{ items: MonitoringItem[] }>('/conversations?limit=100'),
        apiRequest<{ items: TeamUser[] }>('/users'),
      ]);

      if (convRes.success && convRes.items) {
        activeChats = convRes.items;
      }
      if (usersRes.success && usersRes.items) {
        teamUsers = usersRes.items;
      }
    } catch (err) {
      console.error('Error loading monitoring data:', err);
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (autoRefreshEnabled) {
        loadData(false);
        if (selectedChat) {
          loadMessages(selectedChat.id, false);
        }
      }
    }, 10000); // Poll every 10 seconds
  }

  async function openInspector(chat: MonitoringItem) {
    selectedChat = chat;
    targetReassignUser = chat.assignedUserId || '';
    whisperText = '';
    await loadMessages(chat.id, true);
  }

  function closeInspector() {
    selectedChat = null;
    chatMessages = [];
  }

  async function loadMessages(conversationId: string, showLoading = true) {
    if (showLoading) isLoadingMessages = true;
    const res = await apiRequest<{ items: ChatMessage[] }>(`/messages/${conversationId}?limit=30`);
    if (showLoading) isLoadingMessages = false;
    if (res.success && res.items) {
      chatMessages = res.items;
    }
  }

  async function sendWhisperNote(e: Event) {
    e.preventDefault();
    if (!selectedChat || !whisperText.trim()) return;

    isSendingWhisper = true;
    const res = await apiRequest('/messages/internal-note', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: selectedChat.id,
        body: whisperText.trim(),
      }),
    });
    isSendingWhisper = false;

    if (res.success) {
      whisperText = '';
      showToast('Catatan internal (whisper) berhasil dikirim ke agen!');
      loadMessages(selectedChat.id, false);
    } else {
      showToast(res.error || 'Gagal mengirim catatan internal');
    }
  }

  async function handleReassign(chatId: string, newUserId: string) {
    if (!newUserId) return;
    isReassigning = true;
    const res = await apiRequest(`/conversations/${chatId}/assign`, {
      method: 'POST',
      body: JSON.stringify({
        assignedUserId: newUserId,
      }),
    });
    isReassigning = false;

    if (res.success) {
      showToast('Percakapan berhasil dialihkan ke agen terpilih!');
      loadData(false);
      if (selectedChat && selectedChat.id === chatId) {
        const assigned = teamUsers.find((u) => u.id === newUserId);
        if (assigned) {
          selectedChat.assignedUserId = assigned.id;
          selectedChat.assignedFullName = assigned.fullName;
        }
      }
    } else {
      showToast(res.error || 'Gagal mengalihkan percakapan');
    }
  }

  function showToast(msg: string) {
    feedbackToast = msg;
    setTimeout(() => (feedbackToast = null), 4000);
  }

  // Calculate 24-hr WhatsApp Session Window Status
  function getWindowStatus(expiresAt: string | null) {
    if (!expiresAt) return { isExpired: true, text: 'Kadaluarsa', hours: 0 };
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { isExpired: true, text: '24-Jam Berakhir', hours: 0 };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return {
      isExpired: false,
      text: `${hours}j ${mins}m tersisa`,
      hours,
    };
  }

  // Filtered Chats
  const filteredChats = $derived(
    activeChats.filter((chat) => {
      // Agent filter
      if (selectedAgentFilter === 'UNASSIGNED') {
        if (chat.assignedUserId) return false;
      } else if (selectedAgentFilter !== 'ALL') {
        if (chat.assignedUserId !== selectedAgentFilter) return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'ALL') {
        if (chat.status !== selectedStatusFilter) return false;
      }

      // 24-hr Window filter
      if (selectedWindowFilter !== 'ALL') {
        const win = getWindowStatus(chat.windowExpiresAt);
        if (selectedWindowFilter === 'ACTIVE' && win.isExpired) return false;
        if (selectedWindowFilter === 'EXPIRED' && !win.isExpired) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (chat.contactName || '').toLowerCase().includes(q);
        const matchPhone = (chat.contactWaId || '').includes(q);
        const matchPreview = (chat.lastMessagePreview || '').toLowerCase().includes(q);
        const matchAgent = (chat.assignedFullName || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchPreview || matchAgent;
      }

      return true;
    })
  );

  // Group chats by Agent for Workload Matrix
  const agentWorkload = $derived(
    teamUsers
      .filter((u) => u.role === 'AGENT' || u.role === 'SUPERVISOR')
      .map((user) => {
        const assigned = activeChats.filter(
          (c) => c.assignedUserId === user.id && c.status !== 'RESOLVED'
        );
        const maxLimit = user.maxActiveChats || 5;
        const percent = Math.min(Math.round((assigned.length / maxLimit) * 100), 100);
        return {
          user,
          chats: assigned,
          count: assigned.length,
          maxLimit,
          percent,
          isFull: assigned.length >= maxLimit,
        };
      })
  );

  onMount(() => {
    loadData();
    startAutoRefresh();
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });
</script>

<div class="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
  <!-- Header Bar -->
  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div>
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
          <Activity class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Live Monitoring Tim</h2>
            <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 font-mono animate-pulse">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> LIVE FEED
            </span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Pantau seluruh sesi chat aktif, beban kerja agen, dan berikan bantuan via catatan internal (whispering).
          </p>
        </div>
      </div>
    </div>

    <!-- Controls & View Mode Selector -->
    <div class="flex flex-wrap items-center gap-2.5">
      <!-- Auto-refresh switch -->
      <button
        onclick={() => (autoRefreshEnabled = !autoRefreshEnabled)}
        class="py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer {autoRefreshEnabled
          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}"
        title="Otomatis menyegarkan feed setiap 10 detik"
      >
        <Timer class="w-3.5 h-3.5 {autoRefreshEnabled ? 'text-emerald-500' : 'text-slate-400'}" />
        <span>Auto-Sync: {autoRefreshEnabled ? 'ON (10s)' : 'OFF'}</span>
      </button>

      <!-- Manual Refresh Button -->
      <button
        onclick={() => loadData(false)}
        disabled={isRefreshing}
        class="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-60"
      >
        <RefreshCw class="w-3.5 h-3.5 {isRefreshing ? 'animate-spin text-emerald-500' : ''}" />
        <span>Segarkan</span>
      </button>

      <!-- View Switcher -->
      <div class="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          onclick={() => (viewMode = 'grid')}
          class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer {viewMode === 'grid'
            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
          title="Tampilan Kartu Obrolan"
        >
          <LayoutGrid class="w-3.5 h-3.5" />
          <span>Kartu</span>
        </button>

        <button
          onclick={() => (viewMode = 'workload')}
          class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer {viewMode === 'workload'
            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
          title="Tampilan Matriks Beban Kerja Tim"
        >
          <Users class="w-3.5 h-3.5" />
          <span>Beban Tim</span>
        </button>

        <button
          onclick={() => (viewMode = 'kanban')}
          class="px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer {viewMode === 'kanban'
            ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}"
          title="Tampilan Papan Kolom Agen"
        >
          <Columns3 class="w-3.5 h-3.5" />
          <span>Kanban</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  {#if feedbackToast}
    <div class="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-sm animate-fadeIn">
      <div class="flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
        <span>{feedbackToast}</span>
      </div>
      <button onclick={() => (feedbackToast = null)} class="text-slate-400 hover:text-slate-600 cursor-pointer">
        <X class="w-4 h-4" />
      </button>
    </div>
  {/if}

  <!-- KPI Overview Stat Cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Card 1: Total Active Chats -->
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
      <div class="space-y-1">
        <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Obrolan Aktif</span>
        <div class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          {totalActive}
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
        </div>
        <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Sedang berlangsung</span>
      </div>
      <div class="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
        <MessageSquare class="w-5 h-5" />
      </div>
    </div>

    <!-- Card 2: Unassigned Queue -->
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
      <div class="space-y-1">
        <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Antrean Belum Di-assign</span>
        <div class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          {totalUnassigned}
          {#if totalUnassigned > 0}
            <span class="px-1.5 py-0.5 text-[10px] bg-rose-100 text-rose-700 font-bold rounded-md">Perlu Assign</span>
          {/if}
        </div>
        <span class="text-[10px] text-slate-500 dark:text-slate-400">Menunggu dialokasikan</span>
      </div>
      <div class="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
        <AlertCircle class="w-5 h-5" />
      </div>
    </div>

    <!-- Card 3: Online Agents -->
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
      <div class="space-y-1">
        <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agen Bertugas</span>
        <div class="text-2xl font-black text-slate-900 dark:text-white">
          {onlineAgentsCount} <span class="text-xs text-slate-400 font-normal">/ {teamUsers.filter(u => u.role === 'AGENT').length} Online</span>
        </div>
        <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Siap menerima chat</span>
      </div>
      <div class="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
        <UserCheck class="w-5 h-5" />
      </div>
    </div>

    <!-- Card 4: Selesai / Resolved -->
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
      <div class="space-y-1">
        <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tiket Selesai</span>
        <div class="text-2xl font-black text-slate-900 dark:text-white">
          {totalResolved}
        </div>
        <span class="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">Terselesaikan (Resolved)</span>
      </div>
      <div class="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
        <CheckCircle2 class="w-5 h-5" />
      </div>
    </div>
  </div>

  <!-- Filters Toolbar -->
  <div class="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
    <!-- Search Bar -->
    <div class="relative flex-1 max-w-md">
      <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Cari pelanggan, nomor WA, pesan, atau agen..."
        class="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
      />
      {#if searchQuery}
        <button onclick={() => (searchQuery = '')} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
          <X class="w-3.5 h-3.5" />
        </button>
      {/if}
    </div>

    <!-- Dropdown Filters -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Filter by Agent -->
      <select
        bind:value={selectedAgentFilter}
        class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
      >
        <option value="ALL">Semua Agen & Supervisor</option>
        <option value="UNASSIGNED">Belum Di-assign (Antrean)</option>
        {#each teamUsers as user}
          <option value={user.id}>{user.fullName} ({user.role})</option>
        {/each}
      </select>

      <!-- Filter by Status -->
      <select
        bind:value={selectedStatusFilter}
        class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
      >
        <option value="ALL">Semua Status Chat</option>
        <option value="OPEN">Aktif (Open)</option>
        <option value="PENDING">Menunggu (Pending)</option>
        <option value="UNASSIGNED">Unassigned</option>
        <option value="RESOLVED">Selesai (Resolved)</option>
      </select>

      <!-- Filter by 24h Window -->
      <select
        bind:value={selectedWindowFilter}
        class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
      >
        <option value="ALL">Semua Jendela WA</option>
        <option value="ACTIVE">Jendela Aktif (&lt;24 Jam)</option>
        <option value="EXPIRED">Jendela Kadaluarsa (&gt;24 Jam)</option>
      </select>
    </div>
  </div>

  <!-- MAIN VIEW CONTENT -->
  {#if isLoading}
    <div class="py-20 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
      <RefreshCw class="w-6 h-6 animate-spin text-amber-500" />
      <span>Memuat data monitoring obrolan tim...</span>
    </div>
  {:else if activeChats.length === 0}
    <div class="p-12 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
      <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
        <MessageSquare class="w-6 h-6" />
      </div>
      <h4 class="text-sm font-bold text-slate-800 dark:text-slate-200">Belum Ada Percakapan</h4>
      <p class="text-xs text-slate-500 dark:text-slate-400">Saat pesan masuk dari pelanggan, obrolan akan muncul di sini secara real-time.</p>
    </div>
  {:else}
    <!-- VIEW 1: GRID VIEW -->
    {#if viewMode === 'grid'}
      {#if filteredChats.length === 0}
        <div class="p-8 text-center text-xs text-slate-500 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
          Tidak ada percakapan yang cocok dengan filter yang dipilih.
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {#each filteredChats as chat (chat.id)}
            {@const win = getWindowStatus(chat.windowExpiresAt)}

            <div class="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-sm group">
              <div class="space-y-3">
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {(chat.contactName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 class="text-sm font-bold text-slate-900 dark:text-white leading-tight">{chat.contactName}</h4>
                      <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">+{chat.contactWaId}</span>
                    </div>
                  </div>

                  <!-- 24-hr Window Badge -->
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 {win.isExpired
                      ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'}"
                    title={win.isExpired ? 'Jendela 24-jam Meta telah berakhir. Harus menggunakan WhatsApp Template.' : 'Jendela pesan bebas masih terbuka.'}
                  >
                    <Clock class="w-3 h-3" />
                    <span>{win.text}</span>
                  </span>
                </div>

                <!-- Assigned Agent & Status Row -->
                <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <User class="w-3.5 h-3.5 text-slate-400" />
                    <span class="text-[11px]">Agen:</span>
                    {#if chat.assignedFullName}
                      <span class="font-bold text-slate-900 dark:text-slate-200 text-[11px]">{chat.assignedFullName}</span>
                    {:else}
                      <span class="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold">Unassigned</span>
                    {/if}
                  </div>

                  {#if chat.status === 'RESOLVED'}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                      Resolved
                    </span>
                  {:else if chat.status === 'OPEN'}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      Aktif (Open)
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      {chat.status}
                    </span>
                  {/if}
                </div>

                <!-- Last Message Bubble Preview -->
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 text-xs text-slate-800 dark:text-slate-300 space-y-1">
                  <div class="flex items-center justify-between text-[10px] text-slate-400">
                    <span class="font-bold">Pesan Terakhir:</span>
                    <span>{new Date(chat.lastMessageAt || chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p class="line-clamp-2 leading-relaxed italic">
                    "{chat.lastMessagePreview || 'Belum ada riwayat pesan'}"
                  </p>
                </div>
              </div>

              <!-- Card Action Buttons -->
              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <!-- Inspector Button -->
                <button
                  onclick={() => openInspector(chat)}
                  class="py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Intip pesan obrolan & kirim catatan internal (whisper)"
                >
                  <Eye class="w-3.5 h-3.5" />
                  <span>Intip & Whispering</span>
                </button>

                <!-- Open in Inbox Link -->
                <a
                  href="/inbox"
                  class="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <span>Buka Inbox</span>
                  <ExternalLink class="w-3 h-3 text-slate-400" />
                </a>
              </div>
            </div>
          {/each}
        </div>
      {/if}

    <!-- VIEW 2: TEAM WORKLOAD MATRIX -->
    {:else if viewMode === 'workload'}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {#each agentWorkload as item (item.user.id)}
          <div class="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-sm flex items-center justify-center">
                  {item.user.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white leading-tight">{item.user.fullName}</h4>
                    {#if item.user.isOnline}
                      <span class="w-2 h-2 rounded-full bg-emerald-500" title="Online"></span>
                    {:else}
                      <span class="w-2 h-2 rounded-full bg-slate-400" title="Offline"></span>
                    {/if}
                  </div>
                  <span class="text-[11px] text-slate-500 dark:text-slate-400">
                    {item.user.role} {item.user.team?.name ? `• ${item.user.team.name}` : ''}
                  </span>
                </div>
              </div>

              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {item.isFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
                {item.count} / {item.maxLimit} Chat
              </span>
            </div>

            <!-- Capacity Progress Bar -->
            <div class="space-y-1">
              <div class="flex justify-between text-[11px] text-slate-500 font-semibold">
                <span>Beban Kerja Agen</span>
                <span>{item.percent}%</span>
              </div>
              <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500 {item.percent >= 90
                    ? 'bg-rose-500'
                    : item.percent >= 60
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'}"
                  style="width: {item.percent}%"
                ></div>
              </div>
            </div>

            <!-- Assigned Customers Chips -->
            <div class="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pelanggan yang Ditangani:</span>
              {#if item.chats.length === 0}
                <span class="text-xs text-slate-400 italic">Sedang tidak menangani obrolan</span>
              {:else}
                <div class="flex flex-wrap gap-1.5">
                  {#each item.chats as chat}
                    <button
                      onclick={() => openInspector(chat)}
                      class="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 hover:bg-amber-50 dark:hover:bg-amber-950/60 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1 transition cursor-pointer"
                      title="Klik untuk intip percakapan ini"
                    >
                      <span>{chat.contactName}</span>
                      <ChevronRight class="w-3 h-3 text-slate-400" />
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

    <!-- VIEW 3: KANBAN BOARD VIEW -->
    {:else if viewMode === 'kanban'}
      <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        <!-- Column Unassigned -->
        <div class="w-80 shrink-0 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <h4 class="text-xs font-bold text-slate-900 dark:text-white uppercase">Antrean Unassigned</h4>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {activeChats.filter(c => !c.assignedUserId).length}
            </span>
          </div>

          <div class="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
            {#each activeChats.filter(c => !c.assignedUserId) as chat}
              <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-900 dark:text-white">{chat.contactName}</span>
                  <button
                    onclick={() => openInspector(chat)}
                    class="text-amber-600 hover:text-amber-700 dark:text-amber-400 p-1 cursor-pointer"
                    title="Intip"
                  >
                    <Eye class="w-3.5 h-3.5" />
                  </button>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">"{chat.lastMessagePreview || 'Pesan baru'}"</p>
                <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                  <span class="text-slate-400 font-mono">+{chat.contactWaId}</span>
                  <select
                    onchange={(e) => handleReassign(chat.id, (e.target as HTMLSelectElement).value)}
                    class="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] cursor-pointer"
                  >
                    <option value="">Assign ke...</option>
                    {#each teamUsers as u}
                      <option value={u.id}>{u.fullName}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Columns for each Agent -->
        {#each teamUsers.filter(u => u.role === 'AGENT' || u.role === 'SUPERVISOR') as user}
          {@const userChats = activeChats.filter(c => c.assignedUserId === user.id && c.status !== 'RESOLVED')}
          <div class="w-80 shrink-0 bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full {user.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{user.fullName}</h4>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {userChats.length} / {user.maxActiveChats || 5}
              </span>
            </div>

            <div class="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {#if userChats.length === 0}
                <div class="p-6 text-center text-xs text-slate-400 italic">Tidak ada chat aktif</div>
              {:else}
                {#each userChats as chat}
                  <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-900 dark:text-white">{chat.contactName}</span>
                      <button
                        onclick={() => openInspector(chat)}
                        class="text-amber-600 hover:text-amber-700 dark:text-amber-400 p-1 cursor-pointer"
                        title="Intip"
                      >
                        <Eye class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">"{chat.lastMessagePreview || 'Pesan'}"</p>
                    <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                      <span class="text-slate-400 font-mono">+{chat.contactWaId}</span>
                      <button
                        onclick={() => openInspector(chat)}
                        class="text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        Whisper / Reassign →
                      </button>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- SLIDE-OVER INSPECTOR & WHISPERING DRAWER -->
{#if selectedChat}
  <div class="fixed inset-0 z-50 overflow-hidden">
    <!-- Backdrop -->
    <button
      type="button"
      aria-label="Tutup drawer inspector"
      class="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity w-full h-full border-none cursor-pointer"
      onclick={closeInspector}
    ></button>

    <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
      <div class="w-screen max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        <!-- Drawer Header -->
        <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Eye class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-bold text-slate-900 dark:text-white">{selectedChat.contactName}</h3>
                <span class="text-[11px] font-mono text-slate-500">+{selectedChat.contactWaId}</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Agen: <span class="font-bold text-slate-800 dark:text-slate-200">{selectedChat.assignedFullName || 'Unassigned'}</span>
              </p>
            </div>
          </div>

          <button onclick={closeInspector} class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Quick Reassign Bar -->
        <div class="px-5 py-3 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
            <ArrowLeftRight class="w-4 h-4 text-indigo-600" />
            <span>Alihkan Agen:</span>
          </div>
          <div class="flex items-center gap-2">
            <select
              bind:value={targetReassignUser}
              class="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="">Pilih Agen Tujuan...</option>
              {#each teamUsers as u}
                <option value={u.id}>{u.fullName} ({u.role})</option>
              {/each}
            </select>
            <button
              onclick={() => selectedChat && handleReassign(selectedChat.id, targetReassignUser)}
              disabled={isReassigning || !targetReassignUser}
              class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              {isReassigning ? '...' : 'Transfer'}
            </button>
          </div>
        </div>

        <!-- Chat Stream (Middle scrollable area) -->
        <div class="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/40 dark:bg-slate-950/40">
          {#if isLoadingMessages}
            <div class="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw class="w-5 h-5 animate-spin text-amber-500" />
              <span>Memuat isi obrolan...</span>
            </div>
          {:else if chatMessages.length === 0}
            <div class="py-12 text-center text-xs text-slate-400">Belum ada riwayat pesan dalam percakapan ini.</div>
          {:else}
            {#each chatMessages as msg}
              {#if msg.isInternalNote}
                <!-- Internal Whispering Note Bubble (Yellow/Amber Locked) -->
                <div class="p-3 rounded-2xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 space-y-1 shadow-2xs">
                  <div class="flex items-center justify-between text-[10px] font-bold text-amber-800 dark:text-amber-400">
                    <span class="flex items-center gap-1">
                      <Lock class="w-3 h-3" />
                      Catatan Internal (Whispering) • {msg.senderName || 'Supervisor'}
                    </span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p class="leading-relaxed whitespace-pre-wrap font-sans">{msg.body}</p>
                </div>
              {:else if msg.direction === 'INBOUND'}
                <!-- Inbound WhatsApp from Customer -->
                <div class="flex flex-col items-start max-w-[85%]">
                  <div class="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-xs border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white shadow-2xs space-y-1">
                    <span class="text-[10px] font-bold text-slate-400 block">{selectedChat.contactName}</span>
                    <p class="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <span class="text-[9px] text-slate-400 block text-right">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              {:else}
                <!-- Outbound WhatsApp to Customer -->
                <div class="flex flex-col items-end max-w-[85%] ml-auto">
                  <div class="bg-emerald-600 text-white p-3 rounded-2xl rounded-tr-xs shadow-2xs text-xs space-y-1">
                    <span class="text-[10px] text-emerald-200 font-bold block">{msg.senderName || 'Agen'}</span>
                    <p class="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <span class="text-[9px] text-emerald-200 block text-right">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </div>

        <!-- Whispering Form (Bottom Area) -->
        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Lock class="w-3.5 h-3.5" />
              Kirim Whispering (Catatan Internal Rahasia):
            </span>
            <span class="text-[10px] text-slate-400">Hanya dilihat tim, pelanggan tidak tahu</span>
          </div>

          <form onsubmit={sendWhisperNote} class="flex items-end gap-2">
            <textarea
              bind:value={whisperText}
              rows="2"
              placeholder="Ketik instruksi / saran untuk agen yang menangani..."
              class="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
              required
            ></textarea>

            <button
              type="submit"
              disabled={isSendingWhisper || !whisperText.trim()}
              class="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Send class="w-3.5 h-3.5" />
              <span>{isSendingWhisper ? 'Mengirim...' : 'Kirim'}</span>
            </button>
          </form>

          <div class="pt-1 flex items-center justify-between text-xs text-slate-500">
            <span class="text-[11px]">Ingin balas langsung ke customer?</span>
            <a
              href="/inbox"
              class="font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1"
            >
              <span>Buka Percakapan di Inbox</span>
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
