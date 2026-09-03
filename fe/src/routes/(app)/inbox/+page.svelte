<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import { notificationStore } from '$lib/stores/notifications.svelte';
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
    Bot,
    MessageSquare,
    AlertTriangle,
    Zap,
    CornerDownLeft,
    Pencil,
    Film,
    Music,
    Loader2
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
  let showResolveConfirmModal = $state(false);
  let showAiModal = $state(false);
  let isAiGenerating = $state(false);
  let aiSuggestions = $state<{ title: string; text: string }[]>([]);
  let aiMode = $state<'SMART_REPLY' | 'POLISH_DRAFT'>('SMART_REPLY');
  import { getApiBaseUrl } from '$lib/api/client';

  let showEmojiPicker = $state(false);
  let messagesContainer = $state<HTMLDivElement | null>(null);
  let messageInputRef = $state<HTMLTextAreaElement | null>(null);

  // Attachment State
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let pendingAttachment = $state<{
    file: File;
    filename: string;
    size: number;
    mimeType: string;
    category: 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO';
    previewUrl?: string;
  } | null>(null);
  let isUploadingMedia = $state(false);

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const mimeType = file.type || 'application/octet-stream';
    let category: 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' = 'DOCUMENT';

    if (mimeType.startsWith('image/')) category = 'IMAGE';
    else if (mimeType.startsWith('video/')) category = 'VIDEO';
    else if (mimeType.startsWith('audio/')) category = 'AUDIO';

    let previewUrl: string | undefined;
    if (category === 'IMAGE') {
      previewUrl = URL.createObjectURL(file);
    }

    pendingAttachment = {
      file,
      filename: file.name,
      size: file.size,
      mimeType,
      category,
      previewUrl,
    };
  }

  function removePendingAttachment() {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    pendingAttachment = null;
    if (fileInputRef) {
      fileInputRef.value = '';
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function fetchAiSuggestions() {
    if (!selectedConvId || isAiGenerating) return;
    isAiGenerating = true;
    try {
      const res = await apiRequest<{
        success: boolean;
        mode: 'SMART_REPLY' | 'POLISH_DRAFT';
        suggestions: { title: string; text: string }[];
      }>('/messages/ai-suggest', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedConvId,
          currentDraft: messageText,
        }),
      });

      if (res.success && res.suggestions) {
        aiSuggestions = res.suggestions;
        aiMode = res.mode;
        showAiModal = true;
      }
    } catch (_) {
      alert('Gagal mengambil rekomendasi AI.');
    } finally {
      isAiGenerating = false;
    }
  }

  function applyAiSuggestion(text: string) {
    messageText = text;
    showAiModal = false;
    if (messageInputRef) {
      messageInputRef.focus();
      setTimeout(() => autoResizeTextarea(messageInputRef!), 50);
    }
  }

  // Quick Reply Slash Menu (/nama_template)
  let showSlashMenu = $state(false);
  let slashQuery = $state('');
  let selectedSlashIndex = $state(0);

  interface QuickReplyItem {
    id: string;
    shortcut: string;
    title: string;
    body: string;
  }

  let customQuickReplies = $state<QuickReplyItem[]>([]);
  let newQrShortcut = $state('');
  let newQrTitle = $state('');
  let newQrBody = $state('');
  let editingQrId = $state<string | null>(null);

  function loadQuickReplies() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wa_crm_quick_replies');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            customQuickReplies = parsed;
            return;
          }
        } catch (e) {}
      }
    }
    // Default fallback
    customQuickReplies = [
      {
        id: 'qr-salam',
        shortcut: '/salam',
        title: 'Salam & Sapaan Pelanggan',
        body: 'Halo, terima kasih telah menghubungi kami. Ada yang bisa kami bantu hari ini? 😊',
      },
      {
        id: 'qr-terimakasih',
        shortcut: '/terimakasih',
        title: 'Ucapan Terima Kasih',
        body: 'Terima kasih banyak atas kepercayaan Anda. Jika ada pertanyaan lain, jangan ragu untuk menghubungi kami kembali! 🙏',
      },
      {
        id: 'qr-jamkerja',
        shortcut: '/jam_kerja',
        title: 'Jam Operasional Layanan',
        body: 'Jam operasional layanan kami adalah Senin - Jumat (08.00 - 17.00 WIB) dan Sabtu (08.00 - 12.00 WIB).',
      },
      {
        id: 'qr-rekening',
        shortcut: '/rekening',
        title: 'Nomor Rekening Pembayaran',
        body: 'Berikut nomor rekening resmi pembayaran kami:\nBCA: 1234567890 a.n. PT Official WA CRM\nMandiri: 0987654321 a.n. PT Official WA CRM',
      },
      {
        id: 'qr-tunggu',
        shortcut: '/tunggu',
        title: 'Konfirmasi Mohon Tunggu',
        body: 'Mohon tunggu sebentar ya kak, tim kami sedang mengecek data Anda.',
      },
    ];
  }

  const canManageQuickReplies = $derived(
    ['SUPER_ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'].includes(authStore.role || '')
  );

  function saveQuickReplies() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_crm_quick_replies', JSON.stringify(customQuickReplies));
    }
  }

  function handleSaveQr() {
    if (!canManageQuickReplies) {
      alert('Hanya Supervisor & Admin yang dapat menambah atau mengedit template balas cepat.');
      return;
    }

    if (!newQrShortcut.trim() || !newQrTitle.trim() || !newQrBody.trim()) {
      alert('Harap isi shortcut, judul, dan isi balasan cepat.');
      return;
    }

    let shortcutClean = newQrShortcut.trim();
    if (!shortcutClean.startsWith('/')) {
      shortcutClean = '/' + shortcutClean;
    }

    if (editingQrId) {
      customQuickReplies = customQuickReplies.map((q) =>
        q.id === editingQrId
          ? { ...q, shortcut: shortcutClean, title: newQrTitle.trim(), body: newQrBody.trim() }
          : q
      );
      editingQrId = null;
    } else {
      customQuickReplies.push({
        id: 'qr-' + Date.now(),
        shortcut: shortcutClean,
        title: newQrTitle.trim(),
        body: newQrBody.trim(),
      });
    }

    saveQuickReplies();
    newQrShortcut = '';
    newQrTitle = '';
    newQrBody = '';
  }

  function editQr(qr: QuickReplyItem) {
    if (!canManageQuickReplies) return;
    editingQrId = qr.id;
    newQrShortcut = qr.shortcut;
    newQrTitle = qr.title;
    newQrBody = qr.body;
  }

  function deleteQr(id: string) {
    if (!canManageQuickReplies) return;
    if (!confirm('Hapus balasan cepat ini?')) return;
    customQuickReplies = customQuickReplies.filter((q) => q.id !== id);
    saveQuickReplies();
  }

  function resetDefaultQr() {
    if (!canManageQuickReplies) return;
    if (!confirm('Kembalikan ke daftar balasan cepat bawaan awal?')) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wa_crm_quick_replies');
    }
    loadQuickReplies();
  }

  function isUserNearBottom(): boolean {
    if (!messagesContainer) return true;
    const threshold = 150; // px from bottom
    const position = messagesContainer.scrollTop + messagesContainer.clientHeight;
    const height = messagesContainer.scrollHeight;
    return height - position <= threshold;
  }

  function scrollToBottom(force = false, smooth = false) {
    setTimeout(() => {
      if (messagesContainer) {
        if (force || isUserNearBottom()) {
          messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto',
          });
        }
      }
    }, 60);
  }

  function focusMessageInput() {
    setTimeout(() => {
      if (messageInputRef) {
        messageInputRef.focus();
      }
    }, 80);
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
    messageType?: string;
    body: string;
    mediaUrl?: string | null;
    mediaMimeType?: string | null;
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
  let activeLightboxUrl = $state<string | null>(null);

  // Derived list of internal quick replies (/salam, /terimakasih, /rekening, etc.)
  let allQuickReplies = $derived(customQuickReplies);

  let filteredQuickReplies = $derived(
    allQuickReplies.filter(
      (qr: QuickReplyItem) =>
        qr.shortcut.toLowerCase().includes(slashQuery.toLowerCase()) ||
        qr.title.toLowerCase().includes(slashQuery.toLowerCase()) ||
        qr.body.toLowerCase().includes(slashQuery.toLowerCase())
    )
  );

  function autoResizeTextarea(target: HTMLTextAreaElement) {
    target.style.height = 'auto';
    const newHeight = Math.min(Math.max(target.scrollHeight, 40), 180);
    target.style.height = `${newHeight}px`;
  }

  function resetTextareaHeight() {
    if (messageInputRef) {
      messageInputRef.style.height = '40px';
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    messageText = target.value;
    autoResizeTextarea(target);

    const lastWordMatch = messageText.match(/\/([a-zA-Z0-9_-]*)$/);
    if (lastWordMatch) {
      showSlashMenu = true;
      slashQuery = '/' + lastWordMatch[1];
      selectedSlashIndex = 0;
    } else {
      showSlashMenu = false;
      slashQuery = '';
    }
  }

  function selectQuickReply(qr: { shortcut: string; body: string }) {
    messageText = messageText.replace(/\/([a-zA-Z0-9_-]*)$/, qr.body);
    showSlashMenu = false;
    slashQuery = '';
    focusMessageInput();
    if (messageInputRef) {
      setTimeout(() => autoResizeTextarea(messageInputRef!), 50);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (showSlashMenu && filteredQuickReplies.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSlashIndex = (selectedSlashIndex + 1) % filteredQuickReplies.length;
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSlashIndex = (selectedSlashIndex - 1 + filteredQuickReplies.length) % filteredQuickReplies.length;
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectQuickReply(filteredQuickReplies[selectedSlashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        showSlashMenu = false;
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

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
        if (activeTab === 'UNASSIGNED') {
          if (c.status === 'RESOLVED') return false;
          if (c.status !== 'UNASSIGNED' && c.assignedUser) return false;
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
        // Shallow diffing to prevent unnecessary Svelte reactive DOM re-renders
        const isDifferent =
          conversationList.length !== res.items.length ||
          conversationList.some((c, idx) => {
            const n = res.items[idx];
            return !n || c.id !== n.id || c.status !== n.status || c.lastMessageAt !== n.lastMessageAt || c.assignedUser?.id !== n.assignedUser?.id;
          });

        if (isDifferent) {
          conversationList = res.items;
        }

        // If a previously selected conversation no longer exists, reset selection
        if (selectedConvId && !res.items.some((c) => c.id === selectedConvId)) {
          selectedConvId = null;
          messageList = [];
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      isLoading = false;
    }
  }

  async function loadMessages(convId: string, forceScroll = false) {
    try {
      const res = await apiRequest<{ items: MessageItem[] }>(`/messages/${convId}`);
      if (res.success && res.items) {
        const prevCount = messageList.length;
        const sorted = [...res.items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const wasNearBottom = isUserNearBottom();

        const isDiff =
          sorted.length !== messageList.length ||
          (sorted.length > 0 && messageList.length > 0 && (
            sorted[sorted.length - 1].id !== messageList[messageList.length - 1].id ||
            sorted[sorted.length - 1].status !== messageList[messageList.length - 1].status
          ));

        if (isDiff || forceScroll) {
          // If new inbound customer message arrived in active chat
          if (sorted.length > prevCount && prevCount > 0) {
            const latestMsg = sorted[sorted.length - 1];
            if (latestMsg.senderType === 'CONTACT') {
              notificationStore.playChime();
              notificationStore.triggerDesktopNotification(
                `Pesan Baru: ${selectedConv?.contact.name || 'Pelanggan'}`,
                latestMsg.body,
                convId
              );
            }
          }

          messageList = sorted;
          if (forceScroll) {
            scrollToBottom(true, false);
          } else if (sorted.length > prevCount && wasNearBottom) {
            scrollToBottom(false, true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
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
    focusMessageInput();
  }

  async function claimConversation(convIdToClaim?: string) {
    const targetId = convIdToClaim || selectedConvId;
    if (!targetId || isActionLoading || !authStore.user) return;

    const targetConv = conversationList.find((c) => c.id === targetId);
    if (targetConv?.status === 'RESOLVED') return;

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
        focusMessageInput();
      }
    }
  }

  function promptResolveConversation() {
    if (!selectedConvId || isActionLoading) return;
    showResolveConfirmModal = true;
  }

  async function confirmResolveConversation() {
    if (!selectedConvId || isActionLoading) return;
    showResolveConfirmModal = false;

    isActionLoading = true;
    const res = await apiRequest(`/conversations/${selectedConvId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    isActionLoading = false;

    if (res.success) {
      const conv = conversationList.find((c) => c.id === selectedConvId);
      if (conv) conv.status = 'RESOLVED';

      // Mark all messages as READ
      messageList = messageList.map((m) => ({ ...m, status: 'READ' }));

      messageList.push({
        id: 'res-' + Date.now(),
        senderType: authStore.role || 'AGENT',
        senderId: authStore.user?.id || null,
        body: `✅ Tiket diselesaikan (Resolved) & Terkunci oleh ${authStore.user?.fullName || 'Agen'}`,
        isInternalNote: true,
        status: 'SENT',
        createdAt: new Date().toISOString(),
      });

      await loadQueueStats();
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
      focusMessageInput();

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
    showSlashMenu = false;
    focusMessageInput();
  }

  function insertEmoji(emoji: string) {
    messageText += emoji;
    focusMessageInput();
  }

  async function sendMessage() {
    if ((!messageText.trim() && !pendingAttachment) || !selectedConvId || isUploadingMedia) return;
    showSlashMenu = false;

    if (!isInternalNote && selectedConv) {
      const effExpires = selectedConv.windowExpiresAt 
        ? new Date(selectedConv.windowExpiresAt).getTime() 
        : (selectedConv.lastMessageAt ? new Date(selectedConv.lastMessageAt).getTime() + 24 * 60 * 60 * 1000 : 0);
      if (effExpires && effExpires - Date.now() <= 0) {
        alert('Sesi 24 Jam Meta telah kadaluarsa (>24 Jam). Pesan balasan biasa tidak dapat dikirim.');
        return;
      }
    }

    let mediaUrlToSend: string | undefined;
    let mediaMimeTypeToSend: string | undefined;
    let messageTypeToSend = 'text';
    let filenameToSend: string | undefined;

    const currentAttachment = pendingAttachment;

    if (currentAttachment) {
      isUploadingMedia = true;
      try {
        const formData = new FormData();
        formData.append('file', currentAttachment.file);

        const uploadRes = await fetch(`${getApiBaseUrl()}/media/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          alert(`Gagal mengunggah file: ${uploadData.error || 'Terjadi kesalahan'}`);
          isUploadingMedia = false;
          return;
        }

        mediaUrlToSend = uploadData.mediaUrl;
        mediaMimeTypeToSend = uploadData.mimeType;
        messageTypeToSend = uploadData.category;
        filenameToSend = currentAttachment.filename;
      } catch (err: any) {
        alert(`Gagal mengunggah file: ${err.message || 'Koneksi terputus'}`);
        isUploadingMedia = false;
        return;
      } finally {
        isUploadingMedia = false;
      }
    }

    const textToSend = messageText.trim();
    messageText = '';
    resetTextareaHeight();
    showEmojiPicker = false;
    pendingAttachment = null;
    if (fileInputRef) fileInputRef.value = '';
    focusMessageInput();

    if (isInternalNote) {
      const noteBody = textToSend || (currentAttachment ? `[File] ${currentAttachment.filename}` : 'Catatan');
      const res = await apiRequest('/messages/internal-note', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedConvId,
          body: noteBody,
        }),
      });
      if (res.success && res.note) {
        messageList.push(res.note);
        scrollToBottom(true);
        focusMessageInput();
      }
    } else {
      const res = await apiRequest('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedConvId,
          messageType: messageTypeToSend,
          body: textToSend || (currentAttachment ? `[${currentAttachment.category}] ${currentAttachment.filename}` : ''),
          mediaUrl: mediaUrlToSend,
          mediaMimeType: mediaMimeTypeToSend,
          filename: filenameToSend,
        }),
      });

      if (res.success && res.message) {
        messageList.push(res.message);
        scrollToBottom(true);
        focusMessageInput();
        const conv = conversationList.find((c) => c.id === selectedConvId);
        if (conv) {
          conv.lastMessagePreview = textToSend || (currentAttachment ? `[${currentAttachment.category}]` : '');
          conv.status = 'OPEN';
        }
      } else if (res.error) {
        alert(`Gagal mengirim pesan: ${res.error}`);
      }
    }
  }



  onMount(() => {
    selectedConvId = null;
    messageList = [];
    loadQuickReplies();

    // Parallel initial load for fastest render
    Promise.all([
      loadConversations(),
      loadAgents(),
      loadTemplates(),
      loadQueueStats(),
    ]);

    // Smart throttled auto-refresh (4 seconds, pauses when tab is in background)
    let isPolling = false;
    const refreshTimer = setInterval(async () => {
      if (isPolling || (typeof document !== 'undefined' && document.hidden)) return;
      isPolling = true;
      try {
        await Promise.all([
          loadQueueStats(),
          loadConversations(true),
          selectedConvId ? loadMessages(selectedConvId, false) : Promise.resolve(),
        ]);
      } catch (err) {
        // Silently ignore background polling errors
      } finally {
        isPolling = false;
      }
    }, 4000);

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
              {#if conv.status === 'RESOLVED'}
                <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-white dark:ring-slate-900" title="Selesai"></span>
              {:else if conv.status === 'UNASSIGNED' || !conv.assignedUser}
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

                {#if conv.status === 'RESOLVED'}
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 flex items-center gap-0.5">
                    <CheckCircle2 class="w-2.5 h-2.5" /> Selesai
                  </span>
                {:else if conv.status === 'UNASSIGNED' || !conv.assignedUser}
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                    Belum Ditugaskan
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
              
              {#if selectedConv.status === 'RESOLVED'}
                <span class="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30 shrink-0">
                  Selesai
                </span>
              {:else if selectedConv.status === 'UNASSIGNED' || !selectedConv.assignedUser}
                <span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30 shrink-0">
                  Belum Ditugaskan
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
              {#if selectedConv}
                {@const effectiveExpiresAt = selectedConv.windowExpiresAt 
                  ? new Date(selectedConv.windowExpiresAt).getTime() 
                  : (selectedConv.lastMessageAt ? new Date(selectedConv.lastMessageAt).getTime() + 24 * 60 * 60 * 1000 : 0)}
                {@const timeLeftMs = effectiveExpiresAt ? effectiveExpiresAt - Date.now() : 0}
                {@const hoursLeft = Math.floor(Math.max(0, timeLeftMs) / (1000 * 60 * 60))}
                {@const minutesLeft = Math.floor((Math.max(0, timeLeftMs) % (1000 * 60 * 60)) / (1000 * 60))}
                <span>•</span>
                {#if timeLeftMs > 0}
                  <span class="text-emerald-600 dark:text-emerald-400 font-bold font-mono" title="Jendela Sesi 24 Jam Meta Aktif">
                    Sesi Meta: {String(hoursLeft).padStart(2, '0')} jam {String(minutesLeft).padStart(2, '0')} menit
                  </span>
                {:else}
                  <span class="text-rose-600 dark:text-rose-400 font-bold font-mono bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20" title="Jendela Sesi 24 Jam Meta Kadaluarsa">
                    ⚠️ Sesi Meta Kadaluarsa (>24 Jam)
                  </span>
                {/if}
              {/if}
            </p>
          </div>
        </div>

        <!-- Right: Action Buttons -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Ambil Obrolan / Claim Button if unassigned -->
          {#if selectedConv.status !== 'RESOLVED' && (!selectedConv.assignedUser || selectedConv.status === 'UNASSIGNED')}
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

          <!-- Resolve Status Badge / Button -->
          {#if selectedConv.status === 'RESOLVED'}
            <div class="py-1.5 px-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-400 font-bold text-xs flex items-center gap-1.5 shadow-sm">
              <Lock class="w-3.5 h-3.5" />
              <span>Selesai & Terkunci</span>
            </div>
          {:else}
            <button
              onclick={promptResolveConversation}
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

                <!-- Media Display (Image / Audio / Video / Document) -->
                {#if msg.mediaUrl}
                  {#if msg.mediaMimeType?.startsWith('image/') || msg.messageType === 'image' || msg.messageType === 'sticker' || (msg.mediaUrl.match(/\.(jpg|jpeg|png|webp|gif)/i))}
                    <button
                      type="button"
                      onclick={() => (activeLightboxUrl = msg.mediaUrl || null)}
                      class="block rounded-xl overflow-hidden my-1 max-w-xs border border-slate-200 dark:border-slate-700 hover:opacity-90 transition shadow-sm group text-left cursor-zoom-in"
                    >
                      <img
                        src={msg.mediaUrl}
                        alt="Foto dari pelanggan"
                        class="w-full max-h-72 object-cover rounded-xl transition duration-200 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </button>
                  {:else if msg.mediaMimeType?.startsWith('audio/') || msg.messageType === 'audio' || msg.messageType === 'voice' || (msg.mediaUrl.match(/\.(mp3|ogg|wav|m4a|aac)/i))}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <div class="my-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-700/50 max-w-xs">
                      <audio controls src={msg.mediaUrl} class="w-full h-8"></audio>
                    </div>
                  {:else if msg.mediaMimeType?.startsWith('video/') || msg.messageType === 'video' || (msg.mediaUrl.match(/\.(mp4|webm|mov|avi)/i))}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <div class="my-1.5 rounded-xl overflow-hidden max-w-xs border border-slate-200 dark:border-slate-700 shadow-sm">
                      <video controls src={msg.mediaUrl} class="w-full max-h-72 object-cover rounded-xl">
                        <track kind="captions" />
                      </video>
                    </div>
                  {:else}
                    <a
                      href={msg.mediaUrl}
                      target="_blank"
                      download
                      class="flex items-center gap-2.5 p-2.5 my-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-600 max-w-xs text-slate-800 dark:text-slate-200"
                    >
                      <FileText class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div class="flex-1 min-w-0">
                        <p class="font-bold text-xs truncate">{msg.body || 'Unduh Dokumen'}</p>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400">Klik untuk mengunduh</p>
                      </div>
                    </a>
                  {/if}
                {/if}

                {#if !msg.mediaUrl && (msg.body === '[Gambar]' || msg.body === '[Foto/Gambar]' || msg.messageType === 'image')}
                  <div class="flex items-center gap-2 p-2.5 my-1 rounded-xl bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700">
                    <Image class="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Foto / Gambar WhatsApp (Pesan Lama)</span>
                  </div>
                {/if}

                {#if msg.body && (!msg.mediaUrl || !['[Foto/Gambar]', '[Gambar]', '[Foto]', '[Stiker]', '[Pesan Suara / Audio]', '[Video]', '[DOCUMENT]'].includes(msg.body)) && msg.body !== '[Gambar]' && msg.body !== '[Foto/Gambar]'}
                  <div class="text-slate-800 dark:text-slate-100 leading-relaxed font-sans mt-1">
                    {@html formatWhatsAppMarkdown(msg.body)}
                  </div>
                {/if}

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

                {#if msg.mediaUrl}
                  {#if msg.mediaMimeType?.startsWith('image/') || msg.messageType === 'image' || (msg.mediaUrl.match(/\.(jpg|jpeg|png|webp|gif)/i))}
                    <button type="button" onclick={() => (activeLightboxUrl = msg.mediaUrl || null)} class="block rounded-xl overflow-hidden my-1 max-w-xs border border-white/20 hover:opacity-90 transition text-left cursor-zoom-in">
                      <img src={msg.mediaUrl} alt="Foto AI" class="w-full max-h-72 object-cover rounded-xl" loading="lazy" />
                    </button>
                  {:else if msg.mediaMimeType?.startsWith('audio/') || msg.messageType === 'audio' || msg.messageType === 'voice' || (msg.mediaUrl.match(/\.(mp3|ogg|wav|m4a|aac)/i))}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <div class="my-1.5 p-1 rounded-xl bg-indigo-700/60 border border-indigo-400/40 max-w-xs">
                      <audio controls src={msg.mediaUrl} class="w-full h-8"></audio>
                    </div>
                  {:else if msg.mediaMimeType?.startsWith('video/') || msg.messageType === 'video' || (msg.mediaUrl.match(/\.(mp4|webm|mov|avi)/i))}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <div class="my-1.5 rounded-xl overflow-hidden max-w-xs border border-indigo-400/40 shadow-sm">
                      <video controls src={msg.mediaUrl} class="w-full max-h-72 object-cover rounded-xl">
                        <track kind="captions" />
                      </video>
                    </div>
                  {:else}
                    <a href={msg.mediaUrl} target="_blank" download class="flex items-center gap-2 p-2 my-1 rounded-xl bg-indigo-700/50 text-white border border-white/20">
                      <FileText class="w-4 h-4 shrink-0" />
                      <span class="truncate font-semibold text-xs">{msg.body || 'Dokumen'}</span>
                    </a>
                  {/if}
                {/if}

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

                {#if msg.mediaUrl}
                  {#if msg.mediaMimeType?.startsWith('image/') || msg.messageType === 'image' || (msg.mediaUrl.match(/\.(jpg|jpeg|png|webp|gif)/i))}
                    <button type="button" onclick={() => (activeLightboxUrl = msg.mediaUrl || null)} class="block rounded-xl overflow-hidden my-1 max-w-xs border border-white/20 hover:opacity-90 transition text-left cursor-zoom-in">
                      <img src={msg.mediaUrl} alt="Foto Agen" class="w-full max-h-72 object-cover rounded-xl" loading="lazy" />
                    </button>
                  {:else if msg.mediaMimeType?.startsWith('audio/') || msg.messageType === 'audio' || msg.messageType === 'voice' || (msg.mediaUrl.match(/\.(mp3|ogg|wav|m4a|aac)/i))}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <div class="my-1.5 p-1 rounded-xl bg-emerald-700/60 border border-emerald-400/40 max-w-xs">
                      <audio controls src={msg.mediaUrl} class="w-full h-8"></audio>
                    </div>
                  {:else if msg.mediaMimeType?.startsWith('video/') || msg.messageType === 'video' || (msg.mediaUrl.match(/\.(mp4|webm|mov|avi)/i))}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <div class="my-1.5 rounded-xl overflow-hidden max-w-xs border border-emerald-400/40 shadow-sm">
                      <video controls src={msg.mediaUrl} class="w-full max-h-72 object-cover rounded-xl">
                        <track kind="captions" />
                      </video>
                    </div>
                  {:else}
                    <a href={msg.mediaUrl} target="_blank" download class="flex items-center gap-2 p-2 my-1 rounded-xl bg-emerald-700/50 text-white border border-white/20">
                      <FileText class="w-4 h-4 shrink-0" />
                      <span class="truncate font-semibold text-xs">{msg.body || 'Dokumen'}</span>
                    </a>
                  {/if}
                {/if}

                {#if msg.body && (!msg.mediaUrl || !['[Foto/Gambar]', '[Gambar]', '[Foto]', '[Stiker]', '[Pesan Suara / Audio]', '[Video]', '[DOCUMENT]'].includes(msg.body))}
                  <div class="text-white/95 leading-relaxed font-sans">
                    {@html formatWhatsAppMarkdown(msg.body)}
                  </div>
                {/if}

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
          <div class="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl flex items-center gap-3 text-xs text-purple-900 dark:text-purple-200 shadow-sm">
            <div class="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
              <Lock class="w-4 h-4" />
            </div>
            <div>
              <p class="font-bold">Tiket Percakapan Ini Telah Selesai & Terkunci Permanen</p>
              <p class="text-[11px] text-purple-700/80 dark:text-purple-300/80">Pesan baru berikutnya dari pelanggan akan otomatis masuk ke antrean sebagai sesi tiket baru.</p>
            </div>
          </div>
        {:else}
          {@const effectiveExpiresAtInput = selectedConv.windowExpiresAt 
            ? new Date(selectedConv.windowExpiresAt).getTime() 
            : (selectedConv.lastMessageAt ? new Date(selectedConv.lastMessageAt).getTime() + 24 * 60 * 60 * 1000 : 0)}
          {@const isExpiredInput = effectiveExpiresAtInput ? (effectiveExpiresAtInput - Date.now() <= 0) : false}

          {#if isExpiredInput && !isInternalNote}
            <!-- LOCKED BANNER FOR EXPIRED SESSION -->
            <div class="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-3 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <Lock class="w-5 h-5" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-xs text-amber-900 dark:text-amber-200">Sesi 24 Jam Meta Telah Kadaluarsa (&gt;24 Jam)</p>
                  <p class="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed mt-0.5">
                    Pesan balasan biasa dikunci oleh Meta karena sudah lebih dari 24 jam sejak pesan terakhir pelanggan. Template Resmi Meta khusus digunakan untuk <strong>Broadcast Massal</strong>.
                  </p>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 pt-2.5 border-t border-amber-200/60 dark:border-amber-800/40">
                <button
                  type="button"
                  onclick={() => (isInternalNote = true)}
                  class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Eye class="w-3.5 h-3.5 text-amber-500" />
                  <span>Beri Catatan Tim Internal</span>
                </button>

                <a
                  href="/broadcast"
                  class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
                >
                  <Send class="w-4 h-4" />
                  <span>Ke Halaman Broadcast</span>
                </a>
              </div>
            </div>
          {:else}
            <!-- Quick Reply Autocomplete Popup Menu -->
            {#if showSlashMenu && filteredQuickReplies.length > 0}
              <div class="mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 z-30">
                <div class="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Zap class="w-3.5 h-3.5" />
                    Balas Cepat Internal ({filteredQuickReplies.length})
                  </span>
                  <span class="text-[10px] text-slate-400">Gunakan ↑ ↓ lalu Enter / Tab</span>
                </div>
                <div class="py-1">
                  {#each filteredQuickReplies as qr, idx}
                    <button
                      type="button"
                      onclick={() => selectQuickReply(qr)}
                      onmouseenter={() => (selectedSlashIndex = idx)}
                      class="w-full text-left px-3.5 py-2 flex items-start justify-between gap-3 transition cursor-pointer {idx === selectedSlashIndex
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-medium'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {qr.shortcut}
                          </span>
                          <span class="font-semibold text-xs truncate">{qr.title}</span>
                        </div>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-relaxed">
                          {qr.body}
                        </p>
                      </div>
                      <CornerDownLeft class="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Meta 24-Hour Session Status Bar (Above Input Form) -->
            {#if selectedConv}
              {@const effectiveExpiresAt = selectedConv.windowExpiresAt 
                ? new Date(selectedConv.windowExpiresAt).getTime() 
                : (selectedConv.lastMessageAt ? new Date(selectedConv.lastMessageAt).getTime() + 24 * 60 * 60 * 1000 : 0)}
              {@const timeLeftMs = effectiveExpiresAt ? effectiveExpiresAt - Date.now() : 0}
              {@const hoursLeft = Math.floor(Math.max(0, timeLeftMs) / (1000 * 60 * 60))}
              {@const minutesLeft = Math.floor((Math.max(0, timeLeftMs) % (1000 * 60 * 60)) / (1000 * 60))}

              <div class="flex items-center justify-between gap-2 px-1 mb-1.5 text-[11px]">
                {#if isInternalNote}
                  <div class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                    <FileText class="w-3.5 h-3.5" />
                    <span>Mode Catatan Internal Tim (Whisper Note)</span>
                  </div>
                {:else if timeLeftMs > 0}
                  <div class="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                    <Clock class="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    <span>Sesi 24 Jam Meta Aktif: <strong>{hoursLeft} jam {minutesLeft} menit</strong> tersisa</span>
                  </div>
                {:else}
                  <div class="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800/60">
                    <Clock class="w-3.5 h-3.5 text-rose-500" />
                    <span>⚠️ Sesi 24 Jam Meta Kadaluarsa (&gt;24 Jam)</span>
                  </div>
                {/if}

                {#if timeLeftMs > 0 && !isInternalNote}
                  <span class="text-[10px] text-slate-400 font-mono hidden sm:inline">Meta Open Session (24h)</span>
                {/if}
              </div>
            {/if}

            <!-- WhatsApp Attachment Preview Bar -->
            {#if pendingAttachment}
              <div class="flex items-center justify-between gap-3 p-2.5 mb-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div class="flex items-center gap-3 min-w-0">
                  {#if pendingAttachment.category === 'IMAGE' && pendingAttachment.previewUrl}
                    <img src={pendingAttachment.previewUrl} alt="Preview" class="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0" />
                  {:else if pendingAttachment.category === 'VIDEO'}
                    <div class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                      <Film class="w-6 h-6" />
                    </div>
                  {:else if pendingAttachment.category === 'AUDIO'}
                    <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                      <Music class="w-6 h-6" />
                    </div>
                  {:else}
                    <div class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                      <FileText class="w-6 h-6" />
                    </div>
                  {/if}

                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{pendingAttachment.filename}</p>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {formatFileSize(pendingAttachment.size)} • {pendingAttachment.category}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onclick={removePendingAttachment}
                  class="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition cursor-pointer shrink-0"
                  title="Hapus Lampiran"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            {/if}

            <!-- Hidden Input File Picker -->
            <input
              type="file"
              bind:this={fileInputRef}
              onchange={handleFileSelect}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
              class="hidden"
            />

            <!-- Input Box with Single Tight Horizontal Icon Row -->
            <div class="flex items-end gap-1.5">
              <!-- TIGHT HORIZONTAL TOOLBAR ICONS -->
              <div class="flex items-center gap-0.5 text-slate-500 dark:text-slate-400 shrink-0 pb-1">
                <!-- 1. Media Upload Icon -->
                <button
                  type="button"
                  onclick={() => fileInputRef?.click()}
                  class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Kirim Media (Foto / Dokumen / Video)"
                >
                  <Paperclip class="w-4 h-4" />
                </button>

                <!-- 2. Emoji Icon -->
                <button
                  type="button"
                  onclick={() => (showEmojiPicker = !showEmojiPicker)}
                  class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Pilih Emoji"
                >
                  <Smile class="w-4 h-4" />
                </button>

                <!-- 3. Catatan Tim (Document / Whisper Note) -->
                <button
                  type="button"
                  onclick={() => (isInternalNote = !isInternalNote)}
                  class="p-1 rounded-lg transition cursor-pointer {isInternalNote 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400'}"
                  title="{isInternalNote ? 'Catatan Internal Tim (Aktif)' : 'Beri Catatan Tim (Dokumen Internal)'}"
                >
                  <FileText class="w-4 h-4" />
                </button>

                <!-- 4. Saran Balasan AI (AI Emoticon / Sparkles) -->
                <button
                  type="button"
                  onclick={fetchAiSuggestions}
                  disabled={isAiGenerating}
                  class="p-1 rounded-lg transition cursor-pointer text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 disabled:opacity-60"
                  title="✨ Saran Balasan Pintar AI"
                >
                  <Sparkles class="w-4 h-4 text-purple-500 {isAiGenerating ? 'animate-spin' : ''}" />
                </button>
              </div>

              <!-- Textarea Input (Auto-expands on typing) -->
              <textarea
                bind:this={messageInputRef}
                rows="1"
                value={messageText}
                oninput={handleInput}
                onkeydown={handleKeydown}
                placeholder={isInternalNote 
                  ? 'Ketik catatan internal tim (Ketik / untuk balasan cepat • Shift+Enter baris baru • Enter kirim)...' 
                  : 'Ketik balasan (Ketik / untuk balasan cepat • Shift+Enter baris baru • Enter kirim)...'}
                class="flex-1 px-3.5 py-2.5 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition resize-none max-h-44 min-h-[40px] leading-relaxed overflow-y-auto {isInternalNote 
                  ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 focus:border-amber-500' 
                  : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500'}"
              ></textarea>

              <!-- Send Button -->
              <button
                type="button"
                onclick={sendMessage}
                disabled={isUploadingMedia}
                class="p-2.5 rounded-xl text-white font-bold transition shadow-sm shrink-0 mb-0.5 disabled:opacity-60 {isInternalNote 
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' 
                  : 'bg-emerald-600 hover:bg-emerald-500'} cursor-pointer"
              >
                {#if isUploadingMedia}
                  <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                  <Send class="w-4 h-4" />
                {/if}
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-950/50">
        <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm border border-emerald-500/20">
          <MessageSquare class="w-8 h-8" />
        </div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-100 mb-1.5">Pilih Percakapan Pelanggan</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
          Pilih salah satu kontak dari daftar di sebelah kiri untuk membuka ruang obrolan dan melihat riwayat pesan.
        </p>
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

<!-- ─── 4. MODAL KONFIRMASI RESOLVE TIKET PERCAKAPAN ─── -->
{#if showResolveConfirmModal}
  <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
    <div class="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5 text-center">
      <div class="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20 shadow-sm">
        <CheckCircle2 class="w-7 h-7" />
      </div>

      <div class="space-y-1.5">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">
          Selesaikan Tiket Percakapan Ini?
        </h3>
        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Apakah Anda yakin ingin mengunci dan me-resolve tiket obrolan dengan <strong class="text-slate-900 dark:text-white">{selectedConv?.contact.name || 'Pelanggan'}</strong>?
        </p>
      </div>

      <div class="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-left text-xs text-purple-900 dark:text-purple-200 leading-relaxed flex items-start gap-2.5">
        <Lock class="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <div class="text-[11px] space-y-1">
          <p class="font-bold">Informasi Penyelesaian Tiket:</p>
          <p class="text-purple-700/90 dark:text-purple-300/90">
            Kolom pesan balasan akan dikunci secara permanen. Pesan baru berikutnya dari pelanggan ini di masa mendatang akan otomatis dibuat sebagai tiket percakapan antrean baru.
          </p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2.5 pt-1">
        <button
          type="button"
          onclick={() => (showResolveConfirmModal = false)}
          class="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
        >
          Batal
        </button>

        <button
          type="button"
          onclick={confirmResolveConversation}
          disabled={isActionLoading}
          class="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/25 transition cursor-pointer disabled:opacity-60"
        >
          {#if isActionLoading}
            <div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Memproses...</span>
          {:else}
            <CheckCircle2 class="w-4 h-4" />
            <span>Ya, Selesaikan Tiket</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 🤖 MODAL SARAN BALASAN AI (AI SMART REPLY ASSISTANT) -->
{#if showAiModal}
  <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
    <div class="glass-panel w-full max-w-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Sparkles class="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Asisten Balasan Pintar AI
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {aiMode === 'POLISH_DRAFT' ? 'Variasi Poles Teks Draf Anda' : 'Rekomendasi Balasan Kontekstual Berdasarkan Pesan Pelanggan'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onclick={() => (showAiModal = false)}
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto space-y-3 pr-1">
        {#each aiSuggestions as suggestion, idx}
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 hover:border-purple-300 dark:hover:border-purple-800/80 transition shadow-sm group">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800/60">
                {suggestion.title}
              </span>
              <span class="text-[10px] text-slate-400 font-mono">Opsi #{idx + 1}</span>
            </div>

            <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
              {suggestion.text}
            </p>

            <div class="flex justify-end pt-1">
              <button
                type="button"
                onclick={() => applyAiSuggestion(suggestion.text)}
                class="py-1.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition cursor-pointer"
              >
                <span>Gunakan Balasan Ini</span>
                <Send class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        {/each}
      </div>

      <div class="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <span class="text-[11px] text-slate-400">💡 Anda masih bisa mengedit teks sebelum dikirim ke pelanggan.</span>
        <button
          type="button"
          onclick={() => (showAiModal = false)}
          class="py-1.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── 5. INLINE MEDIA LIGHTBOX MODAL ─── -->
{#if activeLightboxUrl}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
    onclick={() => (activeLightboxUrl = null)}
  >
    <button
      type="button"
      class="absolute top-4 right-4 text-white hover:text-slate-300 p-2 cursor-pointer transition"
      onclick={() => (activeLightboxUrl = null)}
    >
      <X class="w-7 h-7" />
    </button>
    <img
      src={activeLightboxUrl}
      alt="Preview Media WhatsApp"
      class="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
    />
  </div>
{/if}
