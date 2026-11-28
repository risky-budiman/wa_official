<script lang="ts">
  import MetaQuotaCard from '$lib/components/ui/MetaQuotaCard.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
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

  /** The conversations API returns nested contact/assignedUser objects; flatten them for this view. */
  function toMonitoringItem(c: any): MonitoringItem {
    if (c && c.contactName !== undefined) return c as MonitoringItem; // already flat
    return {
      id: c.id,
      status: c.status,
      windowExpiresAt: c.windowExpiresAt ?? null,
      lastMessagePreview: c.lastMessagePreview ?? null,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      contactId: c.contact?.id ?? '',
      contactName: c.contact?.name ?? '',
      contactWaId: c.contact?.waId ?? '',
      contactEmail: c.contact?.email ?? null,
      contactCustomAttributes: c.contact?.customAttributes ?? null,
      assignedUserId: c.assignedUser?.id ?? null,
      assignedFullName: c.assignedUser?.fullName ?? null,
      assignedEmail: c.assignedUser?.email ?? null,
      assignedRole: c.assignedUser?.role ?? null,
      participants: c.participants,
    };
  }

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

  interface MetaQuotaData {
    dailyLimit: number;
    tier: string;
    tierDisplay: string;
    totalUsed: number;
    remainingQuota: number;
    usedPercentage: number;
    uniqueContactsReached: number;
    csReplies24h: number;
    broadcastSent24h: number;
    templateSent24h: number;
    qualityRating: string;
    status: string;
    verifiedName: string;
    displayPhoneNumber: string;
    resetWindow: string;
  }

  let activeChats = $state<MonitoringItem[]>([]);
  let teamUsers = $state<TeamUser[]>([]);
  let metaQuota = $state<MetaQuotaData | null>(null);
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
      const [convRes, usersRes, quotaRes] = await Promise.all([
        apiRequest<{ items: any[] }>('/conversations?limit=100'),
        apiRequest<{ items: TeamUser[] }>('/users'),
        apiRequest<{ quota: MetaQuotaData }>('/settings/waba/quota'),
      ]);

      if (convRes.success && convRes.items) {
        activeChats = convRes.items.map(toMonitoringItem);
      }
      if (usersRes.success && usersRes.items) {
        teamUsers = usersRes.items;
      }
      if (quotaRes.success && quotaRes.quota) {
        metaQuota = quotaRes.quota;
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
    if (!expiresAt) return { isExpired: true, text: 'Sesi habis', hours: 0 };
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { isExpired: true, text: 'Sesi habis', hours: 0 };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return {
      isExpired: false,
      text: `Sesi ${hours}j ${mins}m`,
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

<div class="ui-page">
  <PageHeader
    title="Monitoring Tim"
    description="Pantau percakapan aktif dan beban kerja agen, lalu bantu lewat catatan internal tanpa diketahui pelanggan."
    icon={Activity}
  >
    {#snippet meta()}
      <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 {autoRefreshEnabled ? 'animate-pulse' : 'opacity-40'}"></span>
        {autoRefreshEnabled ? 'Live · diperbarui tiap 10 detik' : 'Pembaruan otomatis mati'}
      </span>
    {/snippet}
    {#snippet actions()}
      <button
        onclick={() => (autoRefreshEnabled = !autoRefreshEnabled)}
        class="ui-btn-secondary"
        aria-pressed={autoRefreshEnabled}
        title="Otomatis menyegarkan data setiap 10 detik"
      >
        <Timer class="h-4 w-4 {autoRefreshEnabled ? 'text-emerald-500' : 'text-slate-400'}" />
        Auto {autoRefreshEnabled ? 'aktif' : 'mati'}
      </button>
      <button onclick={() => loadData(false)} disabled={isRefreshing} class="ui-btn-secondary px-2.5" title="Muat ulang" aria-label="Muat ulang">
        <RefreshCw class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
      </button>
    {/snippet}
  </PageHeader>

  {#if feedbackToast}
    <Alert tone="success" message={feedbackToast} ondismiss={() => (feedbackToast = null)} />
  {/if}

  {#if metaQuota}
    <MetaQuotaCard quota={metaQuota} detailed />
  {/if}

  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <StatCard label="Obrolan aktif" value={totalActive} icon={MessageSquare} tone="emerald" hint="Sedang berlangsung" />
    <StatCard
      label="Belum ditugaskan"
      value={totalUnassigned}
      icon={AlertCircle}
      tone={totalUnassigned > 0 ? 'rose' : 'slate'}
      hint={totalUnassigned > 0 ? 'Perlu segera dialokasikan' : 'Antrean kosong'}
      hintTone={totalUnassigned > 0 ? 'rose' : 'muted'}
    />
    <StatCard label="Agen online" icon={UserCheck} tone="blue" hint="Siap menerima chat">
      {onlineAgentsCount}<span class="ml-1 text-sm font-medium text-slate-400">/ {teamUsers.filter((u) => u.role === 'AGENT').length}</span>
    </StatCard>
    <StatCard label="Tiket selesai" value={totalResolved} icon={CheckCircle2} tone="violet" hint="Sudah diselesaikan" />
  </div>

  <div class="ui-card flex flex-col gap-3 p-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
    <div class="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div class="relative w-full sm:min-w-[220px] sm:flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" bind:value={searchQuery} placeholder="Cari pelanggan, nomor, pesan, atau agen…" class="ui-input pl-9 pr-8" aria-label="Cari percakapan" />
        {#if searchQuery}
          <button onclick={() => (searchQuery = '')} class="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Hapus pencarian">
            <X class="h-3.5 w-3.5" />
          </button>
        {/if}
      </div>
      <select bind:value={selectedAgentFilter} class="ui-input w-full sm:w-44" aria-label="Filter agen">
        <option value="ALL">Semua agen</option>
        <option value="UNASSIGNED">Belum ditugaskan</option>
        {#each teamUsers as user}
          <option value={user.id}>{user.fullName}</option>
        {/each}
      </select>
      <select bind:value={selectedStatusFilter} class="ui-input w-full sm:w-44" aria-label="Filter status">
        <option value="ALL">Semua status</option>
        <option value="OPEN">Aktif</option>
        <option value="PENDING">Menunggu</option>
        <option value="UNASSIGNED">Belum ditugaskan</option>
        <option value="RESOLVED">Selesai</option>
      </select>
      <select bind:value={selectedWindowFilter} class="ui-input w-full sm:w-44" aria-label="Filter sesi 24 jam">
        <option value="ALL">Semua sesi</option>
        <option value="ACTIVE">Sesi 24 jam aktif</option>
        <option value="EXPIRED">Sesi 24 jam habis</option>
      </select>
    </div>

    <div class="inline-flex shrink-0 self-start rounded-xl bg-slate-100 p-1 text-sm font-medium dark:bg-slate-800" role="tablist" aria-label="Tampilan">
      {#each [{ id: 'grid', label: 'Kartu', icon: LayoutGrid }, { id: 'workload', label: 'Beban tim', icon: Users }, { id: 'kanban', label: 'Kanban', icon: Columns3 }] as v}
        <button
          role="tab"
          aria-selected={viewMode === v.id}
          onclick={() => (viewMode = v.id as typeof viewMode)}
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 transition {viewMode === v.id
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}"
        >
          <v.icon class="h-4 w-4" />
          {v.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- MAIN VIEW CONTENT -->
  {#if isLoading}
    <div class="ui-card flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
      <RefreshCw class="h-5 w-5 animate-spin text-emerald-500" />
      Memuat data monitoring…
    </div>
  {:else if activeChats.length === 0}
    <div class="ui-card">
      <EmptyState icon={MessageSquare} title="Belum ada percakapan" description="Percakapan akan muncul di sini secara real-time saat pelanggan mengirim pesan." />
    </div>
  {:else}
    <!-- VIEW 1: GRID VIEW -->
    {#if viewMode === 'grid'}
      {#if filteredChats.length === 0}
        <div class="ui-card">
          <EmptyState icon={Search} title="Tidak ada hasil" description="Tidak ada percakapan yang cocok dengan filter yang dipilih." />
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {#each filteredChats as chat (chat.id)}
            {@const win = getWindowStatus(chat.windowExpiresAt)}

            <div class="ui-card flex flex-col justify-between space-y-4 p-5 transition hover:border-slate-300 hover:shadow-sm dark:hover:border-slate-700">
              <div class="space-y-3">
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {(chat.contactName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 class="text-sm font-bold text-slate-900 dark:text-white leading-tight">{chat.contactName}</h4>
                      <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">+{chat.contactWaId}</span>
                    </div>
                  </div>

                  {#if chat.status !== 'RESOLVED'}
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
                  {/if}
                </div>

                <!-- Assigned Agent & Status Row -->
                <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <User class="w-3.5 h-3.5 text-slate-400" />
                    <span class="text-[11px]">Agen:</span>
                    {#if chat.assignedFullName}
                      <span class="font-bold text-slate-900 dark:text-slate-200 text-[11px]">{chat.assignedFullName}</span>
                    {:else}
                      <span class="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Belum ditugaskan</span>
                    {/if}
                  </div>

                  {#if chat.status === 'RESOLVED'}
                    <span class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Selesai
                    </span>
                  {:else if chat.status === 'OPEN'}
                    <span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Aktif
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      {chat.status}
                    </span>
                  {/if}
                </div>

                <!-- Last Message Bubble Preview -->
                <div class="space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                  <div class="flex items-center justify-between text-[10px] text-slate-400">
                    <span class="font-medium">Pesan terakhir</span>
                    <span>{new Date(chat.lastMessageAt || chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p class="line-clamp-2 leading-relaxed">
                    {chat.lastMessagePreview || 'Belum ada riwayat pesan'}
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
                  <span>Intip & beri catatan</span>
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
          <div class="ui-card space-y-4 p-5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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

              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {item.isFull ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}">
                {item.count} / {item.maxLimit} chat
              </span>
            </div>

            <!-- Capacity Progress Bar -->
            <div class="space-y-1">
              <div class="flex justify-between text-[11px] text-slate-500 font-semibold">
                <span>Kapasitas terpakai</span>
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
              <span class="block text-xs font-medium text-slate-500 dark:text-slate-400">Pelanggan yang ditangani</span>
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
        <div class="flex w-80 shrink-0 flex-col space-y-3 rounded-2xl bg-slate-100/80 p-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-900/60 dark:ring-slate-800">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Belum ditugaskan</h4>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {activeChats.filter(c => !c.assignedUserId).length}
            </span>
          </div>

          <div class="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
            {#each activeChats.filter(c => !c.assignedUserId) as chat}
              <div class="space-y-2 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white">{chat.contactName}</span>
                  <button
                    onclick={() => openInspector(chat)}
                    class="text-amber-600 hover:text-amber-700 dark:text-amber-400 p-1 cursor-pointer"
                    title="Intip"
                  >
                    <Eye class="w-3.5 h-3.5" />
                  </button>
                </div>
                <p class="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{chat.lastMessagePreview || 'Pesan baru'}</p>
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
          <div class="flex w-80 shrink-0 flex-col space-y-3 rounded-2xl bg-slate-100/80 p-3 ring-1 ring-inset ring-slate-200 dark:bg-slate-900/60 dark:ring-slate-800">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full {user.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                <h4 class="max-w-[170px] truncate text-sm font-semibold text-slate-900 dark:text-white">{user.fullName}</h4>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {userChats.length} / {user.maxActiveChats || 5}
              </span>
            </div>

            <div class="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
              {#if userChats.length === 0}
                <div class="p-6 text-center text-xs text-slate-400">Tidak ada chat aktif</div>
              {:else}
                {#each userChats as chat}
                  <div class="space-y-2 rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-slate-900 dark:text-white">{chat.contactName}</span>
                      <button
                        onclick={() => openInspector(chat)}
                        class="text-amber-600 hover:text-amber-700 dark:text-amber-400 p-1 cursor-pointer"
                        title="Intip"
                      >
                        <Eye class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p class="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{chat.lastMessagePreview || 'Pesan'}</p>
                    <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                      <span class="text-slate-400 font-mono">+{chat.contactWaId}</span>
                      <button
                        onclick={() => openInspector(chat)}
                        class="text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        Catatan / alihkan →
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
              <option value="">Pilih agen tujuan…</option>
              {#each teamUsers as u}
                <option value={u.id}>{u.fullName} ({u.role})</option>
              {/each}
            </select>
            <button
              onclick={() => selectedChat && handleReassign(selectedChat.id, targetReassignUser)}
              disabled={isReassigning || !targetReassignUser}
              class="ui-btn-primary !px-3 !py-1.5 text-xs"
            >
              {isReassigning ? 'Memindahkan…' : 'Pindahkan'}
            </button>
          </div>
        </div>

        <!-- Chat Stream (Middle scrollable area) -->
        <div class="chat-canvas flex-1 space-y-3 overflow-y-auto p-5">
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
                <div class="space-y-1 rounded-xl border border-dashed border-amber-300 bg-amber-50/90 p-3 text-sm text-slate-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
                  <div class="flex items-center justify-between text-[10px] font-bold text-amber-800 dark:text-amber-400">
                    <span class="flex items-center gap-1">
                      <Lock class="w-3 h-3" />
                      Catatan internal · {msg.senderName || 'Supervisor'}
                    </span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p class="leading-relaxed whitespace-pre-wrap font-sans">{msg.body}</p>
                </div>
              {:else if msg.direction === 'INBOUND'}
                <!-- Inbound WhatsApp from Customer -->
                <div class="flex flex-col items-start max-w-[85%]">
                  <div class="space-y-1 rounded-2xl rounded-tl-md bg-white p-3 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700/60">
                    <span class="text-[10px] font-bold text-slate-400 block">{selectedChat.contactName}</span>
                    <p class="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <span class="block text-right text-[11px] text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              {:else}
                <!-- Outbound WhatsApp to Customer -->
                <div class="flex flex-col items-end max-w-[85%] ml-auto">
                  <div class="space-y-1 rounded-2xl rounded-tr-md bg-emerald-50 p-3 text-sm text-slate-800 shadow-sm ring-1 ring-emerald-200/70 dark:bg-emerald-900/35 dark:text-slate-100 dark:ring-emerald-800/50">
                    <span class="block text-xs font-semibold text-emerald-700 dark:text-emerald-400">{msg.senderName || 'Agen'}</span>
                    <p class="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <span class="block text-right text-[11px] text-slate-400">
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
              Catatan internal untuk agen
            </span>
            <span class="text-[10px] text-slate-400">Hanya dilihat tim, pelanggan tidak tahu</span>
          </div>

          <form onsubmit={sendWhisperNote} class="flex items-end gap-2">
            <textarea
              bind:value={whisperText}
              rows="2"
              placeholder="Ketik instruksi / saran untuk agen yang menangani..."
              class="ui-input flex-1 resize-none leading-relaxed"
              required
            ></textarea>

            <button
              type="submit"
              disabled={isSendingWhisper || !whisperText.trim()}
              class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:opacity-50"
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
