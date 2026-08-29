<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { apiRequest } from '$lib/api/client';
  import { onMount } from 'svelte';
  import {
    Search,
    Send,
    Clock,
    Paperclip,
    Smile,
    CheckCheck,
    CheckCircle2,
    RotateCcw,
    Eye,
    Tag,
    User,
    Users,
    UserPlus,
    Phone,
    FileText,
    Shield,
    Lock,
    X,
    Plus,
    Check,
    Image,
    Sparkles,
    Trash2,
    ChevronRight,
    MoreVertical,
    Inbox,
    Bell,
    Bot
  } from 'lucide-svelte';
  import { formatWhatsAppMarkdown } from '$lib/utils/whatsapp-formatter';

  let activeTab = $state<'ALL' | 'MINE' | 'UNASSIGNED'>('ALL');
  let statusFilter = $state<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  let selectedConvId = $state<string | null>(null);
  let isInternalNote = $state(false);
  let messageText = $state('');
  let searchQuery = $state('');
  let isLoading = $state(false);
  let isActionLoading = $state(false);
  let isClaimingNext = $state(false);
  let unassignedQueueCount = $state(0);
  let myActiveCount = $state(0);

  // Modals & Drawers state
  let showReassignModal = $state(false);
  let showAddCollaboratorModal = $state(false);
  let showTagModal = $state(false);
  let showTemplatePicker = $state(false);
  let showEmojiPicker = $state(false);
  let messagesContainer = $state<HTMLDivElement | null>(null);

  function scrollToBottom(smooth = false) {
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    }, 60);
  }

  interface Contact {
    id: string;
    waId: string;
    name: string;
    email?: string;
    customAttributes?: Record<string, any>;
  }

  interface AssignedUser {
    id: string;
    fullName: string;
    email: string;
    role: string;
  }

  interface Participant {
    id: string;
    fullName: string;
    email: string;
    role: string;
    roleInChat: string;
  }

  interface ConversationItem {
    id: string;
    status: 'OPEN' | 'RESOLVED' | 'UNASSIGNED' | 'PENDING';
    windowExpiresAt: string | null;
    lastMessagePreview: string | null;
    lastMessageAt: string;
    contact: Contact;
    assignedUser: AssignedUser | null;
    participants?: Participant[];
  }

  interface MessageItem {
    id: string;
    senderType: string;
    senderId: string | null;
    senderName?: string | null;
    body: string;
    isInternalNote: boolean;
    status: string;
    createdAt: string;
  }

  interface UserOption {
    id: string;
    fullName: string;
    email: string;
    role: string;
  }

  interface TemplateItem {
    id: string;
    name: string;
    category: string;
    components: any[];
  }

  let conversationList = $state<ConversationItem[]>([]);
  let messageList = $state<MessageItem[]>([]);
  let availableAgents = $state<UserOption[]>([]);
  let availableTemplates = $state<TemplateItem[]>([]);

  let selectedAgentId = $state('');
  let selectedCollaboratorId = $state('');
  let newTagInput = $state('');
  let customTags = $state<string[]>(['VIP Member', 'Hot Lead']);

  const emojis = ['👋', '🙏', '✅', '📦', '💰', '⭐', '🔥', '❤️', '😊', '📞', '🎉', '🤝'];

  const selectedConv = $derived(
    conversationList.find((c) => c.id === selectedConvId) || null
  );

  // Filter list based on selected tab, status filter, agent restrictions, and search
  const filteredConversations = $derived(
    conversationList.filter((c) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.contact.name.toLowerCase().includes(q);
        const matchPhone = c.contact.waId.includes(q);
        const matchPreview = c.lastMessagePreview?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchPreview) return false;
      }

      // 2. Agent privacy check: For AGENTS, only show chats assigned to this agent or where they are a collaborator.
      // Unassigned chats stay strictly in the "Antrean Masuk" queue until claimed!
      if (authStore.role === 'AGENT') {
        const isAssignedToMe = c.assignedUser?.id === authStore.user?.id;
        const isMyCollaborator = c.participants?.some((p) => p.id === authStore.user?.id);
        if (!isAssignedToMe && !isMyCollaborator) {
          return false;
        }
      }

      // 3. Tab filter for Admin / Supervisor
      if (authStore.role !== 'AGENT') {
        if (activeTab === 'MINE') {
          const isMine = c.assignedUser?.id === authStore.user?.id || c.participants?.some((p) => p.id === authStore.user?.id);
          if (!isMine) return false;
        }
        if (activeTab === 'UNASSIGNED' && (c.status !== 'UNASSIGNED' && c.assignedUser)) {
          return false;
        }
      }

      // 4. Status filter (All / Open / Resolved)
      if (statusFilter === 'OPEN' && c.status === 'RESOLVED') {
        return false;
      }
      if (statusFilter === 'RESOLVED' && c.status !== 'RESOLVED') {
        return false;
      }

      return true;
    })
  );

  async function loadConversations(isSilent = false) {
    if (!isSilent && conversationList.length === 0) {
      isLoading = true;
    }
    try {
      const res = await apiRequest<{ items: ConversationItem[] }>('/conversations');
      if (res && res.success && Array.isArray(res.items)) {
        conversationList = res.items;
        if (conversationList.length > 0 && (!selectedConvId || !conversationList.some(c => c.id === selectedConvId))) {
          selectedConvId = conversationList[0].id;
          loadMessages(conversationList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      isLoading = false;
    }
  }

  async function loadMessages(convId: string, shouldScroll = true) {
    const res = await apiRequest<{ items: MessageItem[] }>(`/messages/${convId}`);
    if (res.success && res.items) {
      const prevCount = messageList.length;
      messageList = [...res.items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (shouldScroll || messageList.length !== prevCount) {
        scrollToBottom(false);
      }
    }
  }

  async function loadAgents() {
    const res = await apiRequest<{ items: UserOption[] }>('/users');
    if (res.success && res.items) {
      availableAgents = res.items;
      if (availableAgents.length > 0) {
        selectedAgentId = availableAgents[0].id;
        selectedCollaboratorId = availableAgents[0].id;
      }
    }
  }

  async function loadTemplates() {
    const res = await apiRequest<{ items: TemplateItem[] }>('/templates');
    if (res.success && res.items) {
      availableTemplates = res.items;
    }
  }

  async function loadQueueStats() {
    const res = await apiRequest<{ unassignedCount: number; myActiveCount: number }>('/conversations/queue-stats');
    if (res.success) {
      unassignedQueueCount = res.unassignedCount || 0;
      myActiveCount = res.myActiveCount || 0;
    }
  }

  async function claimNextFromQueue() {
    if (isClaimingNext) return;
    isClaimingNext = true;
    const res = await apiRequest<{ success: boolean; conversationId?: string; error?: string }>('/conversations/claim-next', {
      method: 'POST',
    });
    isClaimingNext = false;

    if (res.success && res.conversationId) {
      await loadConversations();
      await loadQueueStats();
      selectConversation(res.conversationId);
    } else if (res.error) {
      alert(res.error);
    }
  }

  function selectConversation(convId: string) {
    selectedConvId = convId;
    loadMessages(convId, true);
  }

  async function claimConversation(convIdToClaim?: string) {
    const targetId = convIdToClaim || selectedConvId;
    if (!targetId || isActionLoading || !authStore.user) return;

    isActionLoading = true;
    const res = await apiRequest(`/conversations/${targetId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedUserId: authStore.user.id }),
    });
    isActionLoading = false;

    if (res.success) {
      const conv = conversationList.find((c) => c.id === targetId);
      if (conv) {
        conv.assignedUser = {
          id: authStore.user.id,
          fullName: authStore.user.fullName,
          email: authStore.user.email,
          role: authStore.user.role,
        };
        conv.status = 'OPEN';
      }

      if (targetId === selectedConvId) {
        messageList.push({
          id: 'claim-' + Date.now(),
          senderType: authStore.role || 'AGENT',
          senderId: authStore.user.id,
          body: `📥 Tiket obrolan diambil oleh ${authStore.user.fullName}`,
          isInternalNote: true,
          status: 'SENT',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  async function resolveConversation() {
    if (!selectedConvId || isActionLoading) return;

    isActionLoading = true;
    const res = await apiRequest(`/conversations/${selectedConvId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    isActionLoading = false;

    if (res.success) {
      const conv = conversationList.find((c) => c.id === selectedConvId);
      if (conv) conv.status = 'RESOLVED';

      messageList.push({
        id: 'res-' + Date.now(),
        senderType: authStore.role || 'AGENT',
        senderId: authStore.user?.id || null,
        body: `✅ Tiket diselesaikan (Resolved) oleh ${authStore.user?.fullName || 'Agen'}`,
        isInternalNote: true,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function reopenConversation() {
    if (!selectedConvId || isActionLoading) return;

    isActionLoading = true;
    const res = await apiRequest(`/conversations/${selectedConvId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'OPEN' }),
    });
    isActionLoading = false;

    if (res.success) {
      const conv = conversationList.find((c) => c.id === selectedConvId);
      if (conv) conv.status = 'OPEN';

      messageList.push({
        id: 'reopen-' + Date.now(),
        senderType: authStore.role || 'AGENT',
        senderId: authStore.user?.id || null,
        body: `🔄 Tiket dibuka kembali (Reopened) oleh ${authStore.user?.fullName || 'Agen'}`,
        isInternalNote: true,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function handleReassign() {
    if (!selectedConvId || !selectedAgentId) return;

    isActionLoading = true;
    const res = await apiRequest(`/conversations/${selectedConvId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedUserId: selectedAgentId }),
    });
    isActionLoading = false;

    if (res.success) {
      showReassignModal = false;
      const targetAgent = availableAgents.find((a) => a.id === selectedAgentId);
      
      const conv = conversationList.find((c) => c.id === selectedConvId);
      if (conv && targetAgent) {
        conv.assignedUser = {
          id: targetAgent.id,
          fullName: targetAgent.fullName,
          email: targetAgent.email,
          role: targetAgent.role,
        };
      }

      messageList.push({
        id: 'reassign-' + Date.now(),
        senderType: authStore.role || 'SUPERVISOR',
        senderId: authStore.user?.id || null,
        body: `👤 Agen Utama dipindahkan ke ${targetAgent?.fullName || 'Agen Baru'} oleh ${authStore.user?.fullName || 'Supervisor'}`,
        isInternalNote: true,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function handleAddCollaborator() {
    if (!selectedConvId || !selectedCollaboratorId) return;

    isActionLoading = true;
    const res = await apiRequest<{ user: UserOption }>(`/conversations/${selectedConvId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ userId: selectedCollaboratorId }),
    });
    isActionLoading = false;

    if (res.success) {
      showAddCollaboratorModal = false;
      const targetUser = availableAgents.find((a) => a.id === selectedCollaboratorId);
      const conv = conversationList.find((c) => c.id === selectedConvId);
      
      if (conv && targetUser) {
        if (!conv.participants) conv.participants = [];
        if (!conv.participants.some((p) => p.id === targetUser.id)) {
          conv.participants.push({
            id: targetUser.id,
            fullName: targetUser.fullName,
            email: targetUser.email,
            role: targetUser.role,
            roleInChat: 'COLLABORATOR',
          });
        }
      }

      messageList.push({
        id: 'collab-' + Date.now(),
        senderType: 'SYSTEM',
        senderId: authStore.user?.id || null,
        body: `👥 ${targetUser?.fullName} (${targetUser?.role}) ditambahkan ke obrolan oleh ${authStore.user?.fullName || 'Tim'}`,
        isInternalNote: true,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function removeCollaborator(userId: string) {
    if (!selectedConvId) return;
    if (!confirm('Hapus agen ini dari tim penanganan chat?')) return;

    const res = await apiRequest(`/conversations/${selectedConvId}/participants/${userId}`, {
      method: 'DELETE',
    });

    if (res.success) {
      const conv = conversationList.find((c) => c.id === selectedConvId);
      if (conv && conv.participants) {
        conv.participants = conv.participants.filter((p) => p.id !== userId);
      }
    }
  }

  function addTag() {
    if (!newTagInput.trim()) return;
    if (!customTags.includes(newTagInput.trim())) {
      customTags.push(newTagInput.trim());
    }
    newTagInput = '';
  }

  function removeTag(tagToRemove: string) {
    customTags = customTags.filter((t) => t !== tagToRemove);
  }

  function pickTemplate(tpl: TemplateItem) {
    const text = tpl.components?.[0]?.text || tpl.name;
    messageText = text;
    showTemplatePicker = false;
  }

  function insertEmoji(emoji: string) {
    messageText += emoji;
  }

  async function sendMessage() {
    if (!messageText.trim() || !selectedConvId) return;

    const textToSend = messageText.trim();
    messageText = '';
    showEmojiPicker = false;

    if (isInternalNote) {
      const res = await apiRequest('/messages/internal-note', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedConvId,
          body: textToSend,
        }),
      });
      if (res.success && res.note) {
        messageList.push(res.note);
        scrollToBottom(true);
      }
    } else {
      const res = await apiRequest('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedConvId,
          body: textToSend,
        }),
      });
      if (res.success && res.message) {
        messageList.push(res.message);
        scrollToBottom(true);
        const conv = conversationList.find((c) => c.id === selectedConvId);
        if (conv) {
          conv.lastMessagePreview = textToSend;
          conv.status = 'OPEN';
        }
      }
    }
  }



  onMount(() => {
    loadConversations();
    loadAgents();
    loadTemplates();
    loadQueueStats();

    // Auto-refresh conversations, queue stats, and messages every 3 seconds in background (silently)
    const refreshTimer = setInterval(() => {
      loadQueueStats();
      loadConversations(true);
      if (selectedConvId) {
        loadMessages(selectedConvId);
      }
    }, 3000);

    return () => {
      clearInterval(refreshTimer);
    };
  });
</script>

<div class="h-full flex overflow-hidden bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
  <!-- 1. LEFT COLUMN: Conversation List -->
  <div class="w-80 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 flex flex-col shrink-0">
    <!-- Search Bar & Filters -->
    <div class="p-3.5 border-b border-slate-200 dark:border-slate-800/80 space-y-3">
      <!-- 🔔 Antrean Pesan Masuk (Khusus Role AGENT: Blind Queue Widget & 1-Click FIFO Claim) -->
      {#if authStore.role === 'AGENT'}
        <div class="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-500/25 space-y-2.5 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="relative">
                {#if unassignedQueueCount > 0}
                  <span class="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -right-0.5 animate-ping"></span>
                  <span class="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -right-0.5"></span>
                {/if}
                <Inbox class="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span class="text-xs font-extrabold text-amber-900 dark:text-amber-200 tracking-tight">
                Antrean Masuk
              </span>
            </div>
            
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black font-mono {unassignedQueueCount > 0 ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">
              {unassignedQueueCount} Menunggu
            </span>
          </div>

          {#if unassignedQueueCount > 0}
            <button
              onclick={claimNextFromQueue}
              disabled={isClaimingNext}
              class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
              title="Tarik 1 pesan terlama dari antrean untuk ditangani"
            >
              <UserPlus class="w-3.5 h-3.5 {isClaimingNext ? 'animate-spin' : ''}" />
              <span>{isClaimingNext ? 'Menarik Tiket...' : '⚡ Ambil 1 Pesan dari Antrean'}</span>
            </button>
          {:else}
            <div class="text-[10px] text-amber-800/70 dark:text-amber-400/70 italic text-center py-0.5">
              Semua pesan telah ditangani (Antrean kosong)
            </div>
          {/if}
        </div>
      {/if}

      <div class="relative">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Cari kontak / pesan..."
          class="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
        />
      </div>

      <!-- Role Tabs -->
      {#if authStore.role === 'AGENT'}
        <div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
          <span class="flex items-center gap-1.5">
            <Lock class="w-3.5 h-3.5" />
            Chat & Kolaborasi Anda
          </span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px]">
            {filteredConversations.length}
          </span>
        </div>
      {:else}
        <div class="flex p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl text-[11px] font-semibold">
          <button
            onclick={() => activeTab = 'ALL'}
            class="flex-1 py-1.5 text-center rounded-lg transition cursor-pointer {activeTab === 'ALL' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
          >
            Semua ({conversationList.length})
          </button>
          <button
            onclick={() => activeTab = 'MINE'}
            class="flex-1 py-1.5 text-center rounded-lg transition cursor-pointer {activeTab === 'MINE' ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
          >
            Milik Saya
          </button>
          <button
            onclick={() => activeTab = 'UNASSIGNED'}
            class="flex-1 py-1.5 text-center rounded-lg transition cursor-pointer {activeTab === 'UNASSIGNED' ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
          >
            Antrean ({unassignedQueueCount})
          </button>
        </div>
      {/if}

      <!-- Status Filter Tabs: All | Open | Resolved -->
      <div class="flex items-center gap-1 text-[11px] font-semibold">
        <button
          onclick={() => statusFilter = 'ALL'}
          class="px-2.5 py-1 rounded-lg transition cursor-pointer {statusFilter === 'ALL' ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}"
        >
          Semua
        </button>
        <button
          onclick={() => statusFilter = 'OPEN'}
          class="px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer {statusFilter === 'OPEN' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Aktif
        </button>
        <button
          onclick={() => statusFilter = 'RESOLVED'}
          class="px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer {statusFilter === 'RESOLVED' ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}"
        >
          <CheckCircle2 class="w-3 h-3" />
          Selesai
        </button>
      </div>
    </div>

    <!-- Conversation List Scrollable -->
    <div class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
      {#if isLoading && conversationList.length === 0}
        <div class="p-6 text-center text-xs text-slate-400">Memuat percakapan...</div>
      {:else if filteredConversations.length === 0}
        <div class="p-8 text-center text-xs text-slate-400">
          <Shield class="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          Tidak ada percakapan dengan filter ini.
        </div>
      {:else}
        {#each filteredConversations as conv}
          <button
            onclick={() => selectConversation(conv.id)}
            class="w-full text-left p-3.5 flex items-start gap-3 transition cursor-pointer {selectedConvId === conv.id ? 'bg-slate-100 dark:bg-slate-800/70 border-l-4 border-emerald-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}"
          >
            <div class="relative shrink-0">
              <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-emerald-700 dark:text-emerald-400 border border-slate-300 dark:border-slate-600/40">
                {conv.contact.name.charAt(0)}
              </div>
              {#if conv.status === 'UNASSIGNED' || !conv.assignedUser}
                <span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 animate-ping" title="Pesan Belum Diambil"></span>
                <span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" title="Pesan Belum Diambil"></span>
              {:else if conv.status === 'OPEN'}
                <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" title="Aktif"></span>
              {/if}
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-0.5">
                <span class="text-xs font-bold text-slate-900 dark:text-white truncate">{conv.contact.name}</span>
                <span class="text-[10px] text-slate-400 shrink-0 ml-1">
                  {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p class="text-[11px] text-slate-600 dark:text-slate-300 truncate mb-1.5">
                {conv.lastMessagePreview || 'Percakapan baru'}
              </p>

              <div class="flex items-center gap-1.5 flex-wrap">
                <!-- Multi-agent pill -->
                {#if conv.participants && conv.participants.length > 0}
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-0.5">
                    <Users class="w-2.5 h-2.5" /> {1 + conv.participants.length} Agen
                  </span>
                {/if}

                {#if conv.status === 'UNASSIGNED' || !conv.assignedUser}
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                    Belum Ditugaskan
                  </span>
                {:else if conv.status === 'RESOLVED'}
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 flex items-center gap-0.5">
                    <CheckCircle2 class="w-2.5 h-2.5" /> Selesai
                  </span>
                {:else}
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    Aktif
                  </span>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>

  <!-- 2. MIDDLE COLUMN: Active Chat Thread -->
  <div class="flex-1 flex flex-col bg-white dark:bg-slate-950 min-w-0">
    {#if selectedConv}
      <!-- Chat Header (Clean, Premium, Non-overlapping) -->
      <div class="h-16 px-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0 shadow-sm">
        <!-- Left: Contact Details -->
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sm text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm">
            {selectedConv.contact.name.charAt(0)}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedConv.contact.name}</h3>
              
              {#if selectedConv.status === 'UNASSIGNED' || !selectedConv.assignedUser}
                <span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30 shrink-0">
                  Belum Ditugaskan
                </span>
              {:else if selectedConv.status === 'RESOLVED'}
                <span class="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30 shrink-0">
                  Selesai
                </span>
              {:else}
                <span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20 shrink-0">
                  Aktif
                </span>
              {/if}
            </div>

            <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
              <span class="font-mono">+{selectedConv.contact.waId}</span>
              <span>•</span>
              <span class="text-slate-700 dark:text-slate-300 font-medium">{selectedConv.assignedUser?.fullName || 'Belum di-assign'}</span>
              {#if selectedConv.windowExpiresAt}
                {@const timeLeftMs = new Date(selectedConv.windowExpiresAt).getTime() - Date.now()}
                {@const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60))}
                <span>•</span>
                <span class="text-emerald-600 dark:text-emerald-400 font-medium">Sesi: {hoursLeft > 0 ? hoursLeft + 'j' : '< 1j'}</span>
              {/if}
            </p>
          </div>
        </div>

        <!-- Right: Action Buttons -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Ambil Obrolan / Claim Button if unassigned -->
          {#if !selectedConv.assignedUser || selectedConv.status === 'UNASSIGNED'}
            <button
              onclick={() => claimConversation()}
              disabled={isActionLoading}
              class="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 transition cursor-pointer"
              title="Ambil dan tugaskan obrolan ini ke saya"
            >
              <UserPlus class="w-3.5 h-3.5" />
              <span>Ambil</span>
            </button>
          {/if}

          <!-- + Kolaborator button -->
          {#if authStore.role !== 'AGENT'}
            <button
              onclick={() => (showAddCollaboratorModal = true)}
              class="py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
              title="Tambah Kolaborator"
            >
              <Users class="w-3.5 h-3.5 text-indigo-500" />
              <span class="hidden sm:inline">Kolaborator</span>
            </button>
          {/if}

          <!-- Resolve / Reopen button -->
          {#if selectedConv.status === 'RESOLVED'}
            <button
              onclick={reopenConversation}
              disabled={isActionLoading}
              class="py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw class="w-3.5 h-3.5" />
              <span>Buka</span>
            </button>
          {:else}
            <button
              onclick={resolveConversation}
              disabled={isActionLoading}
              class="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Tandai Tiket Selesai"
            >
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
              <span>Selesaikan</span>
            </button>
          {/if}
        </div>
      </div>

      <!-- Messages Thread Flow (Soft Contrast) -->
      <div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 dark:bg-slate-950">
        {#each messageList as msg}
          {#if msg.isInternalNote}
            <!-- Internal Note Bubble (Eye-friendly Amber) -->
            <div class="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 max-w-xl mx-auto text-xs shadow-sm">
              <div class="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold mb-1">
                <Eye class="w-3.5 h-3.5" />
                <span>Catatan Tim Internal ({msg.senderType})</span>
                <span class="text-[10px] font-normal text-slate-500 dark:text-slate-400 ml-auto">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p class="text-slate-800 dark:text-slate-200 leading-relaxed">{@html formatWhatsAppMarkdown(msg.body)}</p>
              <p class="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-1 italic">Hanya terlihat oleh seluruh agen/supervisor di percakapan ini</p>
            </div>
          {:else if msg.senderType === 'CONTACT'}
            <!-- Inbound Customer Message (Clean White / Soft Slate) -->
            <div class="flex items-end gap-2.5 max-w-lg">
              <div class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                {selectedConv.contact.name.charAt(0)}
              </div>
              <div class="p-3.5 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white shadow-sm leading-relaxed space-y-1">
                <!-- Label Pengirim: Pelanggan -->
                <div class="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-700/50">
                  <User class="w-3 h-3 text-slate-400" />
                  <span class="text-slate-700 dark:text-slate-200">{selectedConv.contact.name}</span>
                  <span class="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-300 text-[9px] font-semibold">Pelanggan</span>
                </div>
                <div class="text-slate-800 dark:text-slate-100 leading-relaxed font-sans">
                  {@html formatWhatsAppMarkdown(msg.body)}
                </div>
                <div class="text-[10px] text-slate-400 text-right mt-1.5">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          {:else if msg.senderType === 'BOT'}
            <!-- AI Auto-Responder / FAQ BOT Message (Indigo / Purple Glowing Badge) -->
            <div class="flex items-end gap-2 max-w-lg ml-auto justify-end">
              <div class="p-3.5 rounded-2xl rounded-br-sm bg-indigo-600 dark:bg-indigo-700 text-xs text-white shadow-md shadow-indigo-600/20 leading-relaxed border border-indigo-500/40 space-y-1">
                <!-- Label Pengirim: AI Auto-Responder (FAQ / Jam Tutup) -->
                <div class="flex items-center justify-between gap-3 text-[10px] font-bold text-indigo-100 pb-1 border-b border-indigo-400/40">
                  <div class="flex items-center gap-1.5">
                    <Bot class="w-3.5 h-3.5 text-indigo-200" />
                    <span>AI Assistant (FAQ / Auto-Reply)</span>
                  </div>
                  <span class="px-1.5 py-0.5 rounded bg-indigo-500/60 text-white text-[9px] font-mono font-black">BOT</span>
                </div>
                <div class="text-white/95 leading-relaxed font-sans">
                  {@html formatWhatsAppMarkdown(msg.body)}
                </div>
                <div class="text-[10px] text-indigo-200 flex items-center justify-end gap-1 mt-1.5">
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCheck class="w-3.5 h-3.5 text-indigo-300" />
                </div>
              </div>
            </div>
          {:else}
            <!-- Outbound Agent Message (Soft Emerald with CS Badge) -->
            <div class="flex items-end gap-2 max-w-lg ml-auto justify-end">
              <div class="p-3.5 rounded-2xl rounded-br-sm bg-emerald-600 text-xs text-white shadow-sm shadow-emerald-600/10 leading-relaxed space-y-1">
                <!-- Label Pengirim: CS / Agent -->
                <div class="flex items-center justify-between gap-3 text-[10px] font-bold text-emerald-100 pb-1 border-b border-emerald-500/40">
                  <div class="flex items-center gap-1.5">
                    <User class="w-3.5 h-3.5 text-emerald-200" />
                    <span>{msg.senderName || 'Customer Service'}</span>
                  </div>
                  <span class="px-1.5 py-0.5 rounded bg-emerald-700/70 text-white text-[9px] font-bold">AGENT</span>
                </div>
                <div class="text-white/95 leading-relaxed font-sans">
                  {@html formatWhatsAppMarkdown(msg.body)}
                </div>
                <div class="text-[10px] text-emerald-100 flex items-center justify-end gap-1 mt-1.5">
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCheck class="w-3.5 h-3.5 text-emerald-200" />
                </div>
              </div>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Quick Emoji Bar -->
      {#if showEmojiPicker}
        <div class="px-4 py-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          {#each emojis as em}
            <button
              onclick={() => insertEmoji(em)}
              class="p-1 text-base hover:scale-125 transition cursor-pointer"
            >
              {em}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Bottom Chat Input Bar -->
      <div class="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 space-y-2">
        {#if selectedConv.status === 'RESOLVED'}
          <div class="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl flex items-center justify-between gap-3 text-xs text-purple-900 dark:text-purple-200 shadow-sm">
            <div class="flex items-center gap-2">
              <CheckCircle2 class="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Tiket percakapan ini telah <strong>Diselesaikan (Resolved)</strong>.</span>
            </div>
            <button
              onclick={reopenConversation}
              disabled={isActionLoading}
              class="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shrink-0 shadow-sm shadow-purple-600/20"
            >
              Buka Kembali Tiket
            </button>
          </div>
        {:else}
          <!-- Action Row -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <button
                onclick={() => isInternalNote = !isInternalNote}
                class="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer {isInternalNote 
                  ? 'bg-amber-500 text-slate-950 shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}"
              >
                <Eye class="w-3.5 h-3.5" />
                {isInternalNote ? 'Catatan Internal (Aktif)' : 'Beri Catatan Tim'}
              </button>

              <button
                onclick={() => (showTemplatePicker = true)}
                class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Template Picker
              </button>
            </div>

            <span class="text-[10px] text-slate-400 hidden sm:inline">Tekan Enter untuk kirim</span>
          </div>

          <!-- Input Box -->
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 text-slate-500 dark:text-slate-400 shrink-0">
              <button
                onclick={() => alert('Fitur upload lampiran terhubung ke media storage.')}
                class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Kirim Media"
              >
                <Paperclip class="w-4 h-4" />
              </button>
              <button
                onclick={() => (showEmojiPicker = !showEmojiPicker)}
                class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Emoji"
              >
                <Smile class="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              bind:value={messageText}
              onkeydown={(e) => { if (e.key === 'Enter') sendMessage(); }}
              placeholder={isInternalNote ? 'Ketik catatan internal untuk seluruh tim chat...' : 'Ketik balasan WhatsApp resmi...'}
              class="flex-1 px-4 py-2.5 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition {isInternalNote 
                ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 focus:border-amber-500' 
                : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500'}"
            />

            <button
              onclick={sendMessage}
              class="p-2.5 rounded-xl text-white font-bold transition shadow-sm shrink-0 {isInternalNote 
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' 
                : 'bg-emerald-600 hover:bg-emerald-500'} cursor-pointer"
            >
              <Send class="w-4 h-4" />
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center text-xs text-slate-400">
        Pilih percakapan dari daftar di sebelah kiri untuk melihat pesan
      </div>
    {/if}
  </div>

  <!-- 3. RIGHT COLUMN: Contact & Team Info -->
  {#if selectedConv}
    <div class="w-72 border-l border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 p-4 space-y-5 overflow-y-auto hidden lg:block shrink-0">
      <!-- Profile Header -->
      <div class="text-center pb-4 border-b border-slate-200 dark:border-slate-800/80">
        <div class="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto flex items-center justify-center font-bold text-xl text-emerald-700 dark:text-emerald-400 border-2 border-emerald-500/30 mb-2">
          {selectedConv.contact.name.charAt(0)}
        </div>
        <h4 class="text-sm font-bold text-slate-900 dark:text-white">{selectedConv.contact.name}</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400">+{selectedConv.contact.waId}</p>
      </div>

      <!-- 👥 TIM PENANGGUNG JAWAB (Multi-Agent) -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between">
          <h5 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users class="w-3.5 h-3.5 text-indigo-500" />
            Tim Penangan ({1 + (selectedConv.participants?.length || 0)})
          </h5>

          {#if authStore.role !== 'AGENT'}
            <button
              onclick={() => (showAddCollaboratorModal = true)}
              class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              + Tambah
            </button>
          {/if}
        </div>

        <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
          <!-- Primary Agent -->
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                {selectedConv.assignedUser?.fullName?.charAt(0) || 'U'}
              </div>
              <div class="min-w-0">
                <p class="font-bold text-slate-900 dark:text-white truncate">{selectedConv.assignedUser?.fullName || 'Belum di-assign'}</p>
                <span class="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase">Agen Utama</span>
              </div>
            </div>
          </div>

          <!-- Collaborators -->
          {#if selectedConv.participants && selectedConv.participants.length > 0}
            {#each selectedConv.participants as participant}
              <div class="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {participant.fullName.charAt(0)}
                  </div>
                  <div class="min-w-0">
                    <p class="font-semibold text-slate-800 dark:text-slate-200 truncate">{participant.fullName}</p>
                    <span class="text-[9px] text-indigo-600 dark:text-indigo-400 font-medium">Kolaborator ({participant.role})</span>
                  </div>
                </div>

                {#if authStore.role !== 'AGENT'}
                  <button
                    onclick={() => removeCollaborator(participant.id)}
                    class="text-slate-400 hover:text-rose-500 p-1 shrink-0 cursor-pointer"
                    title="Keluarkan dari obrolan"
                  >
                    <X class="w-3 h-3" />
                  </button>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Customer CRM Attributes -->
      <div class="space-y-2">
        <h5 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Atribut Kontak</h5>
        
        <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500 dark:text-slate-400">Status Tiket:</span>
            <span class="{selectedConv.status === 'RESOLVED' ? 'text-purple-700 dark:text-purple-400 font-bold' : 'text-emerald-700 dark:text-emerald-400 font-bold'}">
              {selectedConv.status === 'RESOLVED' ? 'RESOLVED' : 'ACTIVE / OPEN'}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500 dark:text-slate-400">Member:</span>
            <span class="text-emerald-700 dark:text-emerald-400 font-semibold">{selectedConv.contact.customAttributes?.memberLevel || 'Regular'}</span>
          </div>
          {#if selectedConv.contact.customAttributes?.totalSpend}
            <div class="flex justify-between">
              <span class="text-slate-500 dark:text-slate-400">Total Spend:</span>
              <span class="text-slate-900 dark:text-white font-semibold">Rp {selectedConv.contact.customAttributes.totalSpend.toLocaleString('id-ID')}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Quick Tags -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <h5 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tags Kontak</h5>
          <button onclick={() => (showTagModal = true)} class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
            + Tambah
          </button>
        </div>

        <div class="flex flex-wrap gap-1.5">
          {#each customTags as t}
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
              {t}
              <button onclick={() => removeTag(t)} class="hover:text-rose-500 cursor-pointer">×</button>
            </span>
          {/each}
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <h5 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tindakan Cepat</h5>
        
        {#if authStore.role !== 'AGENT'}
          <button
            onclick={() => (showReassignModal = true)}
            class="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <User class="w-3.5 h-3.5 text-amber-500" />
            Pindahkan Agen Utama
          </button>

          <button
            onclick={() => (showAddCollaboratorModal = true)}
            class="w-full py-2 px-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <UserPlus class="w-3.5 h-3.5" />
            + Tambah Agen / SPV
          </button>
        {/if}

        <button
          onclick={() => (showTagModal = true)}
          class="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Tag class="w-3.5 h-3.5 text-emerald-500" />
          Kelola Tag Pelanggan
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- ─── 1. MODAL TAMBAH KOLABORATOR (MULTI-AGENT) ─── -->
{#if showAddCollaboratorModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:white flex items-center gap-2">
          <UserPlus class="w-4 h-4 text-indigo-500" />
          Tambah Agen / SPV ke Obrolan
        </h3>
        <button onclick={() => (showAddCollaboratorModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4">
        <p class="text-xs text-slate-600 dark:text-slate-400">
          Tambahkan agen atau supervisor lain untuk membantu menangani chat <strong>{selectedConv?.contact.name}</strong> secara bersamaan:
        </p>

        <div>
          <label for="collab_select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Pilih Anggota Tim</label>
          <select
            id="collab_select"
            bind:value={selectedCollaboratorId}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          >
            {#each availableAgents as agent}
              <option value={agent.id}>
                {agent.fullName} ({agent.role}) - {agent.email}
              </option>
            {/each}
          </select>
        </div>

        <div class="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-400">
          💡 Agen yang ditambahkan akan langsung melihat obrolan ini di menu Inbox miliknya.
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onclick={() => (showAddCollaboratorModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onclick={handleAddCollaborator}
            disabled={isActionLoading}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm cursor-pointer"
          >
            {isActionLoading ? 'Menambahkan...' : 'Gabungkan ke Chat'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ─── 2. MODAL RE-ASSIGN PERCAKAPAN ─── -->
{#if showReassignModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Pindahkan Agen Utama</h3>
        <button onclick={() => (showReassignModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4">
        <p class="text-xs text-slate-600 dark:text-slate-400">
          Ganti agen penanggung jawab utama tiket <strong>{selectedConv?.contact.name}</strong>:
        </p>

        <div>
          <label for="agent_select" class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Pilih Agen Utama Baru</label>
          <select
            id="agent_select"
            bind:value={selectedAgentId}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          >
            {#each availableAgents as agent}
              <option value={agent.id}>
                {agent.fullName} ({agent.role}) - {agent.email}
              </option>
            {/each}
          </select>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onclick={() => (showReassignModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onclick={handleReassign}
            disabled={isActionLoading}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm cursor-pointer"
          >
            {isActionLoading ? 'Memproses...' : 'Transfer Sekarang'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ─── 3. MODAL KELOLA TAG KONTAK ─── -->
{#if showTagModal}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Kelola Tag Pelanggan</h3>
        <button onclick={() => (showTagModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4">
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newTagInput}
            onkeydown={(e) => { if (e.key === 'Enter') addTag(); }}
            placeholder="Tambah tag baru (e.g. VIP, Follow Up)..."
            class="flex-1 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          />
          <button
            onclick={addTag}
            class="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
          >
            Tambah
          </button>
        </div>

        <div>
          <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2">Tag yang Aktif:</span>
          <div class="flex flex-wrap gap-2">
            {#each customTags as tag}
              <span class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                {tag}
                <button onclick={() => removeTag(tag)} class="text-slate-400 hover:text-rose-500 cursor-pointer">×</button>
              </span>
            {/each}
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button
            type="button"
            onclick={() => (showTagModal = false)}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ─── 4. DRAWER / MODAL TEMPLATE PICKER ─── -->
{#if showTemplatePicker}
  <div class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Pilih Template WhatsApp Resmi
        </h3>
        <button onclick={() => (showTemplatePicker = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
        {#if availableTemplates.length === 0}
          <div class="p-6 text-center text-xs text-slate-400">Tidak ada template tersedia.</div>
        {:else}
          {#each availableTemplates as tpl}
            <button
              onclick={() => pickTemplate(tpl)}
              class="w-full text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition cursor-pointer space-y-1.5"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-900 dark:text-white font-mono">{tpl.name}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  {tpl.category}
                </span>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                {tpl.components?.[0]?.text || 'Body template'}
              </p>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
