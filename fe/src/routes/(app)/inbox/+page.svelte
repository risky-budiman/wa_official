<script lang="ts">
  import { authStore } from "$lib/stores/auth.svelte";
  import { notificationStore } from "$lib/stores/notifications.svelte";
  import { apiRequest } from "$lib/api/client";
  import { onMount } from "svelte";
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
    Video,
    Loader2,
    ChevronLeft,
    PanelRightOpen,
    PanelRightClose,
  } from "lucide-svelte";
  import { formatWhatsAppMarkdown } from "$lib/utils/whatsapp-formatter";
  import SendSingleTemplateModal from "$lib/components/templates/SendSingleTemplateModal.svelte";

  let activeTab = $state<"ALL" | "MINE" | "UNASSIGNED">("ALL");
  let statusFilter = $state<"ALL" | "OPEN" | "RESOLVED">("ALL");
  let selectedConvId = $state<string | null>(null);
  let isInternalNote = $state(false);
  let messageText = $state("");
  let searchQuery = $state("");
  let isLoading = $state(false);
  let isActionLoading = $state(false);
  let isClaimingNext = $state(false);
  let unassignedQueueCount = $state(0);
  let myActiveCount = $state(0);
  let showTemplateSendModal = $state(false);

  // Modals & Drawers state
  let showReassignModal = $state(false);
  let showAddCollaboratorModal = $state(false);
  let showTagModal = $state(false);
  let showResolveConfirmModal = $state(false);
  let showAiModal = $state(false);
  let isAiGenerating = $state(false);
  let aiSuggestions = $state<{ title: string; text: string }[]>([]);
  let aiMode = $state<"SMART_REPLY" | "POLISH_DRAFT">("SMART_REPLY");
  import { getApiBaseUrl } from "$lib/api/client";

  let showEmojiPicker = $state(false);
  // Contact side panel: open by default only on wide screens
  let showContactPanel = $state(
    typeof window !== "undefined" ? window.innerWidth >= 1536 : true,
  );
  let messagesContainer = $state<HTMLDivElement | null>(null);
  let messageInputRef = $state<HTMLTextAreaElement | null>(null);

  // Attachment State
  let showAttachmentMenu = $state(false);
  // Must match the server whitelist in be/src/modules/media/media.routes.ts (WhatsApp-supported types)
  const ACCEPT_IMAGE = ".jpg,.jpeg,.png,.webp,.gif";
  const ACCEPT_VIDEO = ".mp4,.3gp";
  const ACCEPT_AUDIO = ".mp3,.ogg,.opus,.aac,.amr,.m4a";
  const ACCEPT_DOCUMENT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv";
  const ALLOWED_UPLOAD_EXT = new Set(
    [ACCEPT_IMAGE, ACCEPT_VIDEO, ACCEPT_AUDIO, ACCEPT_DOCUMENT].join(",").split(",").map((e) => e.slice(1)),
  );
  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
  let attachmentAccept = $state([ACCEPT_IMAGE, ACCEPT_VIDEO, ACCEPT_AUDIO, ACCEPT_DOCUMENT].join(","));
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let pendingAttachment = $state<{
    file: File;
    filename: string;
    size: number;
    mimeType: string;
    category: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";
    previewUrl?: string;
  } | null>(null);
  let isUploadingMedia = $state(false);

  function openFilePicker(acceptType: string) {
    attachmentAccept = acceptType;
    showAttachmentMenu = false;
    setTimeout(() => {
      fileInputRef?.click();
    }, 50);
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validate before uploading so the user gets a clear message immediately
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!file.name.includes(".") || !ALLOWED_UPLOAD_EXT.has(ext)) {
      alert(`Tipe file .${ext || "?"} tidak didukung WhatsApp. Gunakan gambar (JPG/PNG), video (MP4), audio (MP3/OGG/AAC/M4A), PDF, atau dokumen Office.`);
      input.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      alert(`Ukuran file ${formatFileSize(file.size)} melebihi batas 50 MB.`);
      input.value = "";
      return;
    }

    const mimeType = file.type || "application/octet-stream";
    let category: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO" = "DOCUMENT";

    if (mimeType.startsWith("image/")) category = "IMAGE";
    else if (mimeType.startsWith("video/")) category = "VIDEO";
    else if (mimeType.startsWith("audio/")) category = "AUDIO";

    let previewUrl: string | undefined;
    if (category === "IMAGE") {
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
      fileInputRef.value = "";
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
        mode: "SMART_REPLY" | "POLISH_DRAFT";
        suggestions: { title: string; text: string }[];
      }>("/messages/ai-suggest", {
        method: "POST",
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
      alert("Gagal mengambil rekomendasi AI.");
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
  let slashQuery = $state("");
  let selectedSlashIndex = $state(0);

  interface QuickReplyItem {
    id: string;
    shortcut: string;
    title: string;
    body: string;
  }

  let customQuickReplies = $state<QuickReplyItem[]>([]);
  let newQrShortcut = $state("");
  let newQrTitle = $state("");
  let newQrBody = $state("");
  let editingQrId = $state<string | null>(null);

  function loadQuickReplies() {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("wa_crm_quick_replies");
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
        id: "qr-salam",
        shortcut: "/salam",
        title: "Salam & Sapaan Pelanggan",
        body: "Halo, terima kasih telah menghubungi kami. Ada yang bisa kami bantu hari ini? 😊",
      },
      {
        id: "qr-terimakasih",
        shortcut: "/terimakasih",
        title: "Ucapan Terima Kasih",
        body: "Terima kasih banyak atas kepercayaan Anda. Jika ada pertanyaan lain, jangan ragu untuk menghubungi kami kembali! 🙏",
      },
      {
        id: "qr-jamkerja",
        shortcut: "/jam_kerja",
        title: "Jam Operasional Layanan",
        body: "Jam operasional layanan kami adalah Senin - Jumat (08.00 - 17.00 WIB) dan Sabtu (08.00 - 12.00 WIB).",
      },
      {
        id: "qr-rekening",
        shortcut: "/rekening",
        title: "Nomor Rekening Pembayaran",
        body: "Berikut nomor rekening resmi pembayaran kami:\nBCA: 1234567890 a.n. PT Official WA CRM\nMandiri: 0987654321 a.n. PT Official WA CRM",
      },
      {
        id: "qr-tunggu",
        shortcut: "/tunggu",
        title: "Konfirmasi Mohon Tunggu",
        body: "Mohon tunggu sebentar ya kak, tim kami sedang mengecek data Anda.",
      },
    ];
  }

  const canManageQuickReplies = $derived(
    ["SUPER_ADMIN", "ADMINISTRATOR", "SUPERVISOR"].includes(
      authStore.role || "",
    ),
  );

  function saveQuickReplies() {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "wa_crm_quick_replies",
        JSON.stringify(customQuickReplies),
      );
    }
  }

  function handleSaveQr() {
    if (!canManageQuickReplies) {
      alert(
        "Hanya Supervisor & Admin yang dapat menambah atau mengedit template balas cepat.",
      );
      return;
    }

    if (!newQrShortcut.trim() || !newQrTitle.trim() || !newQrBody.trim()) {
      alert("Harap isi shortcut, judul, dan isi balasan cepat.");
      return;
    }

    let shortcutClean = newQrShortcut.trim();
    if (!shortcutClean.startsWith("/")) {
      shortcutClean = "/" + shortcutClean;
    }

    if (editingQrId) {
      customQuickReplies = customQuickReplies.map((q) =>
        q.id === editingQrId
          ? {
              ...q,
              shortcut: shortcutClean,
              title: newQrTitle.trim(),
              body: newQrBody.trim(),
            }
          : q,
      );
      editingQrId = null;
    } else {
      customQuickReplies.push({
        id: "qr-" + Date.now(),
        shortcut: shortcutClean,
        title: newQrTitle.trim(),
        body: newQrBody.trim(),
      });
    }

    saveQuickReplies();
    newQrShortcut = "";
    newQrTitle = "";
    newQrBody = "";
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
    if (!confirm("Hapus balasan cepat ini?")) return;
    customQuickReplies = customQuickReplies.filter((q) => q.id !== id);
    saveQuickReplies();
  }

  function resetDefaultQr() {
    if (!canManageQuickReplies) return;
    if (!confirm("Kembalikan ke daftar balasan cepat bawaan awal?")) return;
    if (typeof window !== "undefined") {
      localStorage.removeItem("wa_crm_quick_replies");
    }
    loadQuickReplies();
  }

  function isUserNearBottom(): boolean {
    if (!messagesContainer) return true;
    const threshold = 150; // px from bottom
    const position =
      messagesContainer.scrollTop + messagesContainer.clientHeight;
    const height = messagesContainer.scrollHeight;
    return height - position <= threshold;
  }

  function scrollToBottom(force = false, smooth = false) {
    setTimeout(() => {
      if (messagesContainer) {
        if (force || isUserNearBottom()) {
          messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: smooth ? "smooth" : "auto",
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
    status: "OPEN" | "RESOLVED" | "UNASSIGNED" | "PENDING";
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

  // ─── Display helpers (chat list & thread) ───
  const AVATAR_TONES = [
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  ];
  function avatarTone(name?: string | null): string {
    const s = name || "?";
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_TONES[h % AVATAR_TONES.length];
  }
  function initials(name?: string | null): string {
    const clean = (name || "").replace(/\(.*?\)/g, "").trim();
    if (!clean) return "?";
    const parts = clean.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + second).toUpperCase() || "?";
  }
  function dayKey(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }
  function dayLabel(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(iso) === dayKey(today.toISOString())) return "Hari ini";
    if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Kemarin";
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
    });
  }
  function timeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  /** Time for the conversation list: clock today, "Kemarin", weekday this week, else short date */
  function listTimeLabel(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    if (dayKey(iso) === dayKey(now.toISOString())) return timeLabel(iso);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 2) return "Kemarin";
    if (diffDays < 7) return d.toLocaleDateString("id-ID", { weekday: "short" });
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }
  const MEDIA_PLACEHOLDERS = ["[Foto/Gambar]", "[Gambar]", "[Foto]", "[Stiker]", "[Pesan Suara / Audio]", "[Video]", "[DOCUMENT]", "[IMAGE]"];
  /** Hide placeholder bodies like "[Gambar]" when the media itself is shown */
  function hasRenderableBody(msg: MessageItem): boolean {
    if (!msg.body) return false;
    if (msg.mediaUrl && MEDIA_PLACEHOLDERS.includes(msg.body)) return false;
    if (msg.body.startsWith("[IMAGE]") || msg.body.startsWith("[Foto]") || msg.body.startsWith("[Gambar]")) return false;
    // Documents already show their name inside the file card
    if (msg.mediaUrl && !/^(image|audio|video)\//.test(msg.mediaMimeType || "") && !["image", "sticker", "audio", "voice", "video"].includes(msg.messageType || "") && !/\.(jpg|jpeg|png|webp|gif|mp3|ogg|wav|m4a|aac|mp4|webm|mov|avi)/i.test(msg.mediaUrl)) return false;
    return true;
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
    language: string;
    status: string;
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
        qr.body.toLowerCase().includes(slashQuery.toLowerCase()),
    ),
  );

  function autoResizeTextarea(target: HTMLTextAreaElement) {
    target.style.height = "auto";
    const newHeight = Math.min(Math.max(target.scrollHeight, 40), 180);
    target.style.height = `${newHeight}px`;
  }

  function resetTextareaHeight() {
    if (messageInputRef) {
      messageInputRef.style.height = "40px";
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    messageText = target.value;
    autoResizeTextarea(target);

    const lastWordMatch = messageText.match(/\/([a-zA-Z0-9_-]*)$/);
    if (lastWordMatch) {
      showSlashMenu = true;
      slashQuery = "/" + lastWordMatch[1];
      selectedSlashIndex = 0;
    } else {
      showSlashMenu = false;
      slashQuery = "";
    }
  }

  function selectQuickReply(qr: { shortcut: string; body: string }) {
    messageText = messageText.replace(/\/([a-zA-Z0-9_-]*)$/, qr.body);
    showSlashMenu = false;
    slashQuery = "";
    focusMessageInput();
    if (messageInputRef) {
      setTimeout(() => autoResizeTextarea(messageInputRef!), 50);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (showSlashMenu && filteredQuickReplies.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedSlashIndex =
          (selectedSlashIndex + 1) % filteredQuickReplies.length;
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedSlashIndex =
          (selectedSlashIndex - 1 + filteredQuickReplies.length) %
          filteredQuickReplies.length;
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectQuickReply(filteredQuickReplies[selectedSlashIndex]);
        return;
      }
      if (e.key === "Escape") {
        showSlashMenu = false;
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  let selectedAgentId = $state("");
  let selectedCollaboratorId = $state("");
  let newTagInput = $state("");
  let customTags = $state<string[]>(["VIP Member", "Hot Lead"]);

  const emojis = [
    "👋",
    "🙏",
    "✅",
    "📦",
    "💰",
    "⭐",
    "🔥",
    "❤️",
    "😊",
    "📞",
    "🎉",
    "🤝",
  ];

  const selectedConv = $derived(
    conversationList.find((c) => c.id === selectedConvId) || null,
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
      if (authStore.role === "AGENT") {
        const isAssignedToMe = c.assignedUser?.id === authStore.user?.id;
        const isMyCollaborator = c.participants?.some(
          (p) => p.id === authStore.user?.id,
        );
        if (!isAssignedToMe && !isMyCollaborator) {
          return false;
        }
      }

      // 3. Tab filter for Admin / Supervisor
      if (authStore.role !== "AGENT") {
        if (activeTab === "MINE") {
          const isMine =
            c.assignedUser?.id === authStore.user?.id ||
            c.participants?.some((p) => p.id === authStore.user?.id);
          if (!isMine) return false;
        }
        if (activeTab === "UNASSIGNED") {
          if (c.status === "RESOLVED") return false;
          if (c.status !== "UNASSIGNED" && c.assignedUser) return false;
        }
      }

      // 4. Status filter (All / Open / Resolved)
      if (statusFilter === "OPEN" && c.status === "RESOLVED") {
        return false;
      }
      if (statusFilter === "RESOLVED" && c.status !== "RESOLVED") {
        return false;
      }

      return true;
    }),
  );

  async function loadConversations(isSilent = false) {
    if (!isSilent && conversationList.length === 0) {
      isLoading = true;
    }
    try {
      const res = await apiRequest<{ items: ConversationItem[] }>(
        "/conversations",
      );
      if (res && res.success && Array.isArray(res.items)) {
        // Shallow diffing to prevent unnecessary Svelte reactive DOM re-renders
        const isDifferent =
          conversationList.length !== res.items.length ||
          conversationList.some((c, idx) => {
            const n = res.items[idx];
            return (
              !n ||
              c.id !== n.id ||
              c.status !== n.status ||
              c.lastMessageAt !== n.lastMessageAt ||
              c.assignedUser?.id !== n.assignedUser?.id
            );
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
      console.error("Failed to load conversations:", err);
    } finally {
      isLoading = false;
    }
  }

  async function loadMessages(convId: string, forceScroll = false) {
    try {
      const res = await apiRequest<{ items: MessageItem[] }>(
        `/messages/${convId}`,
      );
      if (res.success && res.items) {
        const prevCount = messageList.length;
        const sorted = [...res.items].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        const wasNearBottom = isUserNearBottom();

        const isDiff =
          sorted.length !== messageList.length ||
          (sorted.length > 0 &&
            messageList.length > 0 &&
            (sorted[sorted.length - 1].id !==
              messageList[messageList.length - 1].id ||
              sorted[sorted.length - 1].status !==
                messageList[messageList.length - 1].status));

        if (isDiff || forceScroll) {
          // If new inbound customer message arrived in active chat
          if (sorted.length > prevCount && prevCount > 0) {
            const latestMsg = sorted[sorted.length - 1];
            if (latestMsg.senderType === "CONTACT") {
              notificationStore.playChime();
              notificationStore.triggerDesktopNotification(
                `Pesan Baru: ${selectedConv?.contact.name || "Pelanggan"}`,
                latestMsg.body,
                convId,
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
      console.error("Failed to load messages:", err);
    }
  }

  async function loadAgents() {
    const res = await apiRequest<{ items: UserOption[] }>("/users");
    if (res.success && res.items) {
      availableAgents = res.items;
      if (availableAgents.length > 0) {
        selectedAgentId = availableAgents[0].id;
        selectedCollaboratorId = availableAgents[0].id;
      }
    }
  }

  async function loadTemplates() {
    const res = await apiRequest<{ items: TemplateItem[] }>("/templates");
    if (res.success && res.items) {
      availableTemplates = res.items;
    }
  }

  async function loadQueueStats() {
    const res = await apiRequest<{
      unassignedCount: number;
      myActiveCount: number;
    }>("/conversations/queue-stats");
    if (res.success) {
      unassignedQueueCount = res.unassignedCount || 0;
      myActiveCount = res.myActiveCount || 0;
    }
  }

  async function claimNextFromQueue() {
    if (isClaimingNext) return;
    isClaimingNext = true;
    const res = await apiRequest<{
      success: boolean;
      conversationId?: string;
      error?: string;
    }>("/conversations/claim-next", {
      method: "POST",
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
    if (targetConv?.status === "RESOLVED") return;

    isActionLoading = true;
    const res = await apiRequest(`/conversations/${targetId}/assign`, {
      method: "PATCH",
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
        conv.status = "OPEN";
      }

      if (targetId === selectedConvId) {
        messageList.push({
          id: "claim-" + Date.now(),
          senderType: authStore.role || "AGENT",
          senderId: authStore.user.id,
          body: `📥 Tiket obrolan diambil oleh ${authStore.user.fullName}`,
          isInternalNote: true,
          status: "SENT",
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
      method: "PATCH",
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    isActionLoading = false;

    if (res.success) {
      const conv = conversationList.find((c) => c.id === selectedConvId);
      if (conv) conv.status = "RESOLVED";

      // Mark all messages as READ
      messageList = messageList.map((m) => ({ ...m, status: "READ" }));

      messageList.push({
        id: "res-" + Date.now(),
        senderType: authStore.role || "AGENT",
        senderId: authStore.user?.id || null,
        body: `✅ Tiket diselesaikan (Resolved) & Terkunci oleh ${authStore.user?.fullName || "Agen"}`,
        isInternalNote: true,
        status: "SENT",
        createdAt: new Date().toISOString(),
      });

      await loadQueueStats();
    }
  }

  async function reopenConversation() {
    if (!selectedConvId || isActionLoading) return;

    isActionLoading = true;
    const res = await apiRequest(`/conversations/${selectedConvId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "OPEN" }),
    });
    isActionLoading = false;

    if (res.success) {
      const conv = conversationList.find((c) => c.id === selectedConvId);
      if (conv) conv.status = "OPEN";
      focusMessageInput();

      messageList.push({
        id: "reopen-" + Date.now(),
        senderType: authStore.role || "AGENT",
        senderId: authStore.user?.id || null,
        body: `🔄 Tiket dibuka kembali (Reopened) oleh ${authStore.user?.fullName || "Agen"}`,
        isInternalNote: true,
        status: "SENT",
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function handleReassign() {
    if (!selectedConvId || !selectedAgentId) return;

    isActionLoading = true;
    const res = await apiRequest(`/conversations/${selectedConvId}/assign`, {
      method: "PATCH",
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
        id: "reassign-" + Date.now(),
        senderType: authStore.role || "SUPERVISOR",
        senderId: authStore.user?.id || null,
        body: `👤 Agen Utama dipindahkan ke ${targetAgent?.fullName || "Agen Baru"} oleh ${authStore.user?.fullName || "Supervisor"}`,
        isInternalNote: true,
        status: "SENT",
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function handleAddCollaborator() {
    if (!selectedConvId || !selectedCollaboratorId) return;

    isActionLoading = true;
    const res = await apiRequest<{ user: UserOption }>(
      `/conversations/${selectedConvId}/participants`,
      {
        method: "POST",
        body: JSON.stringify({ userId: selectedCollaboratorId }),
      },
    );
    isActionLoading = false;

    if (res.success) {
      showAddCollaboratorModal = false;
      const targetUser = availableAgents.find(
        (a) => a.id === selectedCollaboratorId,
      );
      const conv = conversationList.find((c) => c.id === selectedConvId);

      if (conv && targetUser) {
        if (!conv.participants) conv.participants = [];
        if (!conv.participants.some((p) => p.id === targetUser.id)) {
          conv.participants.push({
            id: targetUser.id,
            fullName: targetUser.fullName,
            email: targetUser.email,
            role: targetUser.role,
            roleInChat: "COLLABORATOR",
          });
        }
      }

      messageList.push({
        id: "collab-" + Date.now(),
        senderType: "SYSTEM",
        senderId: authStore.user?.id || null,
        body: `👥 ${targetUser?.fullName} (${targetUser?.role}) ditambahkan ke obrolan oleh ${authStore.user?.fullName || "Tim"}`,
        isInternalNote: true,
        status: "SENT",
        createdAt: new Date().toISOString(),
      });
    }
  }

  async function removeCollaborator(userId: string) {
    if (!selectedConvId) return;
    if (!confirm("Hapus agen ini dari tim penanganan chat?")) return;

    const res = await apiRequest(
      `/conversations/${selectedConvId}/participants/${userId}`,
      {
        method: "DELETE",
      },
    );

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
    newTagInput = "";
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
        : selectedConv.lastMessageAt
          ? new Date(selectedConv.lastMessageAt).getTime() + 24 * 60 * 60 * 1000
          : 0;
      if (effExpires && effExpires - Date.now() <= 0) {
        alert(
          "Sesi 24 Jam Meta telah kadaluarsa (>24 Jam). Pesan balasan biasa tidak dapat dikirim.",
        );
        return;
      }
    }

    let mediaUrlToSend: string | undefined;
    let mediaMimeTypeToSend: string | undefined;
    let messageTypeToSend = "text";
    let filenameToSend: string | undefined;

    const currentAttachment = pendingAttachment;

    if (currentAttachment) {
      isUploadingMedia = true;
      try {
        const formData = new FormData();
        formData.append("file", currentAttachment.file);

        const token =
          authStore.token ||
          (typeof window !== "undefined" ? localStorage.getItem("wa_crm_token") : "");

        const uploadRes = await fetch(`${getApiBaseUrl()}/media/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        const rawText = await uploadRes.text();
        let uploadData: any = {};

        try {
          uploadData = JSON.parse(rawText);
        } catch (_) {
          if (uploadRes.status === 413) {
            uploadData = { error: "Ukuran file melebihi batas upload Nginx (413 Payload Too Large)." };
          } else {
            uploadData = { error: `Server error (HTTP ${uploadRes.status}): ${rawText.slice(0, 150)}` };
          }
        }

        if (!uploadRes.ok || !uploadData.success) {
          alert(`Gagal mengunggah file: ${uploadData.error || "Terjadi kesalahan pada server"}`);
          isUploadingMedia = false;
          return;
        }

        mediaUrlToSend = uploadData.mediaUrl;
        mediaMimeTypeToSend = uploadData.mimeType;
        messageTypeToSend = uploadData.category;
        filenameToSend = currentAttachment.filename;
      } catch (err: any) {
        alert(`Gagal mengunggah file: ${err.message || "Koneksi terputus"}`);
        isUploadingMedia = false;
        return;
      } finally {
        isUploadingMedia = false;
      }
    }

    const textToSend = messageText.trim();
    messageText = "";
    resetTextareaHeight();
    showEmojiPicker = false;
    pendingAttachment = null;
    if (fileInputRef) fileInputRef.value = "";
    focusMessageInput();

    if (isInternalNote) {
      const noteBody = textToSend || (currentAttachment ? `[File] ${currentAttachment.filename}` : "Catatan");
      const res = await apiRequest("/messages/internal-note", {
        method: "POST",
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
      const res = await apiRequest("/messages/send", {
        method: "POST",
        body: JSON.stringify({
          conversationId: selectedConvId,
          messageType: messageTypeToSend,
          body: textToSend || (currentAttachment && currentAttachment.category !== "IMAGE" ? `[${currentAttachment.category}] ${currentAttachment.filename}` : ""),
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
          conv.lastMessagePreview = textToSend || (currentAttachment ? `[${currentAttachment.category}]` : "");
          conv.status = "OPEN";
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
      if (isPolling || (typeof document !== "undefined" && document.hidden))
        return;
      isPolling = true;
      try {
        await Promise.all([
          loadQueueStats(),
          loadConversations(true),
          selectedConvId
            ? loadMessages(selectedConvId, false)
            : Promise.resolve(),
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

<div
  class="h-full flex overflow-hidden bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
>
<!-- Shared media renderer for chat bubbles (works on light, tinted and dark bubbles) -->
{#snippet messageMedia(msg: MessageItem)}
  {#if msg.mediaUrl}
    {#if msg.mediaMimeType?.startsWith("image/") || msg.messageType === "image" || msg.messageType === "sticker" || msg.mediaUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)}
      <button
        type="button"
        onclick={() => (activeLightboxUrl = msg.mediaUrl || null)}
        class="group -mx-1.5 mb-1 block cursor-zoom-in overflow-hidden rounded-xl text-left"
        aria-label="Perbesar gambar"
      >
        <img
          src={msg.mediaUrl}
          alt="Lampiran gambar"
          class="max-h-72 w-full max-w-xs rounded-xl object-cover transition duration-200 group-hover:opacity-95"
          loading="lazy"
        />
      </button>
    {:else if msg.mediaMimeType?.startsWith("audio/") || msg.messageType === "audio" || msg.messageType === "voice" || msg.mediaUrl.match(/\.(mp3|ogg|wav|m4a|aac)/i)}
      <!-- svelte-ignore a11y_media_has_caption -->
      <audio controls src={msg.mediaUrl} class="my-1 h-9 w-64 max-w-full"></audio>
    {:else if msg.mediaMimeType?.startsWith("video/") || msg.messageType === "video" || msg.mediaUrl.match(/\.(mp4|webm|mov|avi)/i)}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video controls src={msg.mediaUrl} class="-mx-1.5 mb-1 max-h-72 w-full max-w-xs rounded-xl object-cover">
        <track kind="captions" />
      </video>
    {:else}
      <a
        href={msg.mediaUrl}
        target="_blank"
        rel="noopener"
        download
        class="my-1 flex max-w-xs items-center gap-3 rounded-xl bg-black/[0.04] p-2.5 transition hover:bg-black/[0.07] dark:bg-white/5 dark:hover:bg-white/10"
      >
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-400">
          <FileText class="h-4.5 w-4.5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{msg.body || "Dokumen"}</span>
          <span class="block text-[11px] text-slate-500 dark:text-slate-400">Klik untuk mengunduh</span>
        </span>
      </a>
    {/if}
  {:else if msg.senderType === "CONTACT" && (msg.body === "[Gambar]" || msg.body === "[Foto/Gambar]" || msg.messageType === "image")}
    <div class="my-1 flex items-center gap-2 rounded-lg bg-black/[0.04] px-2.5 py-2 text-xs text-slate-500 dark:bg-white/5 dark:text-slate-400">
      <Image class="h-4 w-4 shrink-0" />
      <span>Gambar tidak tersedia (pesan lama)</span>
    </div>
  {/if}
{/snippet}
  <!-- 1. LEFT COLUMN: Conversation List -->
  <div
    class="w-full md:w-80 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 flex-col shrink-0 {selectedConvId ? 'hidden md:flex' : 'flex'}"
  >
    <!-- Search Bar & Filters -->
    <div
      class="p-3.5 border-b border-slate-200 dark:border-slate-800/80 space-y-3"
    >
      <!-- 🔔 Antrean Pesan Masuk (Khusus Role AGENT: Blind Queue Widget & 1-Click FIFO Claim) -->
      {#if authStore.role === "AGENT"}
        <div
          class="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-amber-950/40 dark:to-orange-950/20 border border-amber-500/25 space-y-2.5 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="relative">
                {#if unassignedQueueCount > 0}
                  <span
                    class="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -right-0.5 animate-ping"
                  ></span>
                  <span
                    class="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -right-0.5"
                  ></span>
                {/if}
                <Inbox class="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span
                class="text-xs font-extrabold text-amber-900 dark:text-amber-200 tracking-tight"
              >
                Antrean Masuk
              </span>
            </div>

            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-black font-mono {unassignedQueueCount >
              0
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
            >
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
              <UserPlus
                class="w-3.5 h-3.5 {isClaimingNext ? 'animate-spin' : ''}"
              />
              <span
                >{isClaimingNext
                  ? "Menarik Tiket..."
                  : "⚡ Ambil 1 Pesan dari Antrean"}</span
              >
            </button>
          {:else}
            <div
              class="text-[10px] text-amber-800/70 dark:text-amber-400/70 italic text-center py-0.5"
            >
              Semua pesan telah ditangani (Antrean kosong)
            </div>
          {/if}
        </div>
      {/if}

      <div class="relative">
        <Search
          class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Cari kontak / pesan..."
          class="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
        />
      </div>

      <!-- Role Tabs -->
      {#if authStore.role === "AGENT"}
        <div
          class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold"
        >
          <span class="flex items-center gap-1.5">
            <Lock class="w-3.5 h-3.5" />
            Chat & Kolaborasi Anda
          </span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px]">
            {filteredConversations.length}
          </span>
        </div>
      {:else}
        <div
          class="flex p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl text-[11px] font-semibold"
        >
          <button
            onclick={() => (activeTab = "ALL")}
            class="flex-1 py-1.5 text-center rounded-lg transition cursor-pointer {activeTab ===
            'ALL'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
          >
            Semua ({conversationList.length})
          </button>
          <button
            onclick={() => (activeTab = "MINE")}
            class="flex-1 py-1.5 text-center rounded-lg transition cursor-pointer {activeTab ===
            'MINE'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
          >
            Milik Saya
          </button>
          <button
            onclick={() => (activeTab = "UNASSIGNED")}
            class="flex-1 py-1.5 text-center rounded-lg transition cursor-pointer {activeTab ===
            'UNASSIGNED'
              ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
          >
            Antrean ({unassignedQueueCount})
          </button>
        </div>
      {/if}

      <!-- Status Filter Tabs: All | Open | Resolved -->
      <div class="flex items-center gap-1 text-[11px] font-semibold">
        <button
          onclick={() => (statusFilter = "ALL")}
          class="px-2.5 py-1 rounded-lg transition cursor-pointer {statusFilter ===
          'ALL'
            ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}"
        >
          Semua
        </button>
        <button
          onclick={() => (statusFilter = "OPEN")}
          class="px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer {statusFilter ===
          'OPEN'
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Aktif
        </button>
        <button
          onclick={() => (statusFilter = "RESOLVED")}
          class="px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer {statusFilter ===
          'RESOLVED'
            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}"
        >
          <CheckCircle2 class="w-3 h-3" />
          Selesai
        </button>
      </div>
    </div>

    <!-- Conversation List Scrollable -->
    <div
      class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40"
    >
      {#if isLoading && conversationList.length === 0}
        <div class="p-6 text-center text-xs text-slate-400">
          Memuat percakapan...
        </div>
      {:else if filteredConversations.length === 0}
        <div class="p-8 text-center text-xs text-slate-400">
          <Shield
            class="w-6 h-6 mx-auto mb-2 text-slate-300 dark:text-slate-600"
          />
          Tidak ada percakapan dengan filter ini.
        </div>
      {:else}
        {#each filteredConversations as conv}
          {@const convExpiresAt = conv.windowExpiresAt
            ? new Date(conv.windowExpiresAt).getTime()
            : conv.lastMessageAt
              ? new Date(conv.lastMessageAt).getTime() + 24 * 60 * 60 * 1000
              : 0}
          {@const isConvExpired = convExpiresAt > 0 && Date.now() > convExpiresAt}
          {@const isUnassigned = conv.status !== "RESOLVED" && (conv.status === "UNASSIGNED" || !conv.assignedUser)}
          {@const isSelected = selectedConvId === conv.id}

          <button
            onclick={() => selectConversation(conv.id)}
            class="relative flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors
              {isSelected
                ? 'bg-emerald-50/80 dark:bg-emerald-500/10'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}"
            aria-current={isSelected ? 'true' : undefined}
          >
            {#if isSelected}
              <span class="absolute inset-y-2 left-0 w-1 rounded-r-full bg-emerald-500" aria-hidden="true"></span>
            {/if}
            <div class="relative shrink-0">
              <div class="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold {avatarTone(conv.contact.name)}">
                {initials(conv.contact.name)}
              </div>
              {#if isUnassigned}
                <span class="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" title="Belum ditugaskan"></span>
              {:else if conv.status === "OPEN" && !isConvExpired}
                <span class="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" title="Aktif"></span>
              {/if}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <span class="truncate text-sm font-semibold text-slate-900 dark:text-white">{conv.contact.name}</span>
                <span class="shrink-0 text-[11px] {isUnassigned ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}">
                  {listTimeLabel(conv.lastMessageAt)}
                </span>
              </div>
              <p class="mt-0.5 truncate text-[13px] text-slate-500 dark:text-slate-400">
                {conv.lastMessagePreview || "Percakapan baru"}
              </p>

              {#if isUnassigned || conv.status === "RESOLVED" || isConvExpired || (conv.participants && conv.participants.length > 0)}
                <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {#if isUnassigned}
                    <span class="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20">Belum ditugaskan</span>
                  {:else if conv.status === "RESOLVED"}
                    <span class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"><CheckCircle2 class="h-3 w-3" /> Selesai</span>
                  {/if}
                  {#if isConvExpired && conv.status !== "RESOLVED"}
                    <span class="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20" title="Lewat 24 jam sejak pesan terakhir pelanggan, balas dengan template"><Clock class="h-3 w-3" /> Sesi 24 jam habis</span>
                  {/if}
                  {#if conv.participants && conv.participants.length > 0}
                    <span class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"><Users class="h-3 w-3" /> {1 + conv.participants.length} agen</span>
                  {/if}
                </div>
              {/if}
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>

  <!-- 2. MIDDLE COLUMN: Active Chat Thread -->
  <div class="flex-1 flex-col bg-white dark:bg-slate-950 min-w-0 {selectedConvId ? 'flex' : 'hidden md:flex'}">
    {#if selectedConv}
      <!-- Chat header -->
      <div
        class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <!-- Mobile: back to conversation list -->
          <button
            type="button"
            class="ui-icon-btn -ml-1 md:hidden"
            aria-label="Kembali ke daftar percakapan"
            onclick={() => {
              selectedConvId = null;
              messageList = [];
            }}
          >
            <ChevronLeft class="h-5 w-5" />
          </button>
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold {avatarTone(selectedConv.contact.name)}">
            {initials(selectedConv.contact.name)}
          </div>
          <div class="min-w-0">
            <div class="flex min-w-0 items-center gap-2">
              <h3 class="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
                {selectedConv.contact.name}
              </h3>
              {#if selectedConv.status === "RESOLVED"}
                <span class="hidden shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 sm:inline-flex dark:bg-slate-800 dark:text-slate-400"><Lock class="h-3 w-3" /> Selesai</span>
              {:else if selectedConv.status === "UNASSIGNED" || !selectedConv.assignedUser}
                <span class="hidden shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 sm:inline-flex dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20">Belum ditugaskan</span>
              {/if}
            </div>
            <p class="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
              <span class="tabular-nums">+{selectedConv.contact.waId}</span>
              <span class="hidden text-slate-300 sm:inline dark:text-slate-600" aria-hidden="true">·</span>
              <span class="hidden truncate sm:inline">{selectedConv.assignedUser?.fullName || "Belum ada agen"}</span>
            </p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          {#if selectedConv.status !== "RESOLVED" && (!selectedConv.assignedUser || selectedConv.status === "UNASSIGNED")}
            <button
              onclick={() => claimConversation()}
              disabled={isActionLoading}
              class="ui-btn-primary !px-3 !py-1.5 text-xs"
              title="Ambil dan tugaskan obrolan ini ke saya"
            >
              <UserPlus class="h-3.5 w-3.5" />
              <span>Ambil</span>
            </button>
          {/if}

          {#if selectedConv.status !== "RESOLVED"}
            <button
              onclick={promptResolveConversation}
              disabled={isActionLoading}
              class="ui-btn-secondary !px-3 !py-1.5 text-xs"
              title="Tandai tiket selesai"
            >
              <CheckCircle2 class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span class="hidden xl:inline">Selesaikan</span>
            </button>
          {/if}

          <button
            type="button"
            onclick={() => (showContactPanel = !showContactPanel)}
            class="ui-icon-btn hidden lg:inline-flex {showContactPanel ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : ''}"
            title={showContactPanel ? "Sembunyikan detail kontak" : "Tampilkan detail kontak"}
            aria-label="Detail kontak"
            aria-pressed={showContactPanel}
          >
            {#if showContactPanel}<PanelRightClose class="h-5 w-5" />{:else}<PanelRightOpen class="h-5 w-5" />{/if}
          </button>
        </div>
      </div>

      <!-- Messages thread -->
      <div
        bind:this={messagesContainer}
        class="chat-canvas flex-1 overflow-y-auto px-3 py-5 sm:px-6"
      >
        <div class="mx-auto flex max-w-3xl flex-col gap-1.5">
        {#each messageList as msg, i}
          {@const prev = i > 0 ? messageList[i - 1] : null}
          {@const newDay = !prev || dayKey(prev.createdAt) !== dayKey(msg.createdAt)}
          {@const grouped = !newDay && !!prev && !prev.isInternalNote && !msg.isInternalNote && prev.senderType === msg.senderType && (prev.senderName || '') === (msg.senderName || '')}

          {#if newDay}
            <div class="sticky top-0 z-10 my-3 flex justify-center">
              <span class="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80 backdrop-blur dark:bg-slate-800/90 dark:text-slate-300 dark:ring-slate-700">
                {dayLabel(msg.createdAt)}
              </span>
            </div>
          {/if}

          {#if msg.isInternalNote}
            <!-- Internal note: only visible to the team -->
            <div class="my-2 w-full max-w-xl self-center rounded-xl border border-dashed border-amber-300 bg-amber-50/90 px-4 py-3 dark:border-amber-700/60 dark:bg-amber-950/30">
              <div class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Eye class="h-3.5 w-3.5" />
                <span>Catatan internal</span>
                {#if msg.senderName}<span class="font-normal text-amber-700/80 dark:text-amber-400/80">· {msg.senderName}</span>{/if}
                <span class="ml-auto font-normal text-amber-700/70 dark:text-amber-400/70">{timeLabel(msg.createdAt)}</span>
              </div>
              <div class="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {@html formatWhatsAppMarkdown(msg.body)}
              </div>
              <p class="mt-1.5 text-[11px] text-amber-700/80 dark:text-amber-400/70">Hanya terlihat oleh tim, tidak dikirim ke pelanggan.</p>
            </div>
          {:else}
            {@const inbound = msg.senderType === "CONTACT"}
            {@const isBot = msg.senderType === "BOT"}
            <div class="flex {inbound ? 'justify-start' : 'justify-end'} {grouped ? '' : 'mt-2'}">
              <div
                class="bubble relative max-w-[85%] px-3.5 pt-2 pb-1.5 text-sm leading-relaxed shadow-sm sm:max-w-[70%]
                  {inbound
                    ? 'bubble-in rounded-2xl bg-white text-slate-800 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700/60'
                    : isBot
                      ? 'rounded-2xl bg-indigo-50 text-slate-800 ring-1 ring-indigo-200/70 dark:bg-indigo-950/50 dark:text-slate-100 dark:ring-indigo-800/50'
                      : 'rounded-2xl bg-emerald-50 text-slate-800 ring-1 ring-emerald-200/70 dark:bg-emerald-900/35 dark:text-slate-100 dark:ring-emerald-800/50'}
                  {!grouped ? (inbound ? 'rounded-tl-md' : 'rounded-tr-md') : ''}"
              >
                {#if !inbound && !grouped}
                  <div class="mb-0.5 flex items-center gap-1 text-xs font-semibold {isBot ? 'text-indigo-600 dark:text-indigo-300' : 'text-emerald-700 dark:text-emerald-400'}">
                    {#if isBot}<Bot class="h-3.5 w-3.5" /> Balasan otomatis{:else}{msg.senderName || "Customer Service"}{/if}
                  </div>
                {/if}

                {@render messageMedia(msg)}

                {#if hasRenderableBody(msg)}
                  <div class="break-words [overflow-wrap:anywhere]">
                    {@html formatWhatsAppMarkdown(msg.body)}
                  </div>
                {/if}

                <div class="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <span>{timeLabel(msg.createdAt)}</span>
                  {#if !inbound}
                    {#if msg.status === "FAILED"}
                      <span class="flex items-center gap-0.5 font-medium text-rose-500" title="Pesan gagal terkirim"><AlertTriangle class="h-3.5 w-3.5" /> Gagal</span>
                    {:else if msg.status === "READ"}
                      <CheckCheck class="h-3.5 w-3.5 text-sky-500" aria-label="Dibaca" />
                    {:else if msg.status === "DELIVERED"}
                      <CheckCheck class="h-3.5 w-3.5" aria-label="Terkirim" />
                    {:else if msg.status === "PENDING"}
                      <Clock class="h-3 w-3" aria-label="Mengirim" />
                    {:else}
                      <Check class="h-3.5 w-3.5" aria-label="Dikirim" />
                    {/if}
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        {/each}
        </div>
      </div>

      <!-- Quick Emoji Bar -->
      {#if showEmojiPicker}
        <div
          class="flex items-center gap-1 overflow-x-auto border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
        >
          {#each emojis as em}
            <button
              onclick={() => insertEmoji(em)}
              class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xl transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {em}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Bottom composer -->
      <div
        class="space-y-2 border-t border-slate-200 bg-white px-3 py-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900"
      >
        {#if selectedConv.status === "RESOLVED"}
          <div class="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
              <Lock class="h-4 w-4" />
            </span>
            <div class="min-w-0">
              <p class="font-medium text-slate-800 dark:text-slate-100">Percakapan ini sudah selesai</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Pesan baru dari pelanggan akan otomatis masuk antrean sebagai tiket baru.</p>
            </div>
          </div>
        {:else}
          {@const effectiveExpiresAtInput = selectedConv.windowExpiresAt
            ? new Date(selectedConv.windowExpiresAt).getTime()
            : selectedConv.lastMessageAt
              ? new Date(selectedConv.lastMessageAt).getTime() +
                24 * 60 * 60 * 1000
              : 0}
          {@const isExpiredInput = effectiveExpiresAtInput
            ? effectiveExpiresAtInput - Date.now() <= 0
            : false}

          {#if isExpiredInput && !isInternalNote}
            <!-- Session expired: only templates can be sent -->
            <div class="rounded-xl bg-rose-50/70 px-4 py-3 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/5 dark:ring-rose-500/20">
              <div class="flex items-start gap-3">
                <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 shadow-sm dark:bg-slate-900 dark:text-rose-400">
                  <Clock class="h-4 w-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-rose-900 dark:text-rose-200">Sesi 24 jam sudah habis</p>
                  <p class="mt-0.5 text-xs leading-relaxed text-rose-700/90 dark:text-rose-300/80">
                    Sudah lebih dari 24 jam sejak pesan terakhir pelanggan. Sesuai aturan Meta, balas dengan <strong class="font-semibold">template WhatsApp</strong>.
                  </p>
                </div>
              </div>
              <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button type="button" onclick={() => (isInternalNote = true)} class="ui-btn-ghost !px-3 !py-1.5 text-xs">
                  <Eye class="h-3.5 w-3.5" />
                  Tulis catatan internal
                </button>
                <a href="/broadcast" class="ui-btn-secondary !px-3 !py-1.5 text-xs">Broadcast</a>
                <button type="button" onclick={() => (showTemplateSendModal = true)} class="ui-btn-primary !px-3 !py-1.5 text-xs">
                  <Zap class="h-3.5 w-3.5" />
                  Kirim template
                </button>
              </div>
            </div>
          {:else}
            <!-- Quick Reply Autocomplete Popup Menu -->
            {#if showSlashMenu && filteredQuickReplies.length > 0}
              <div
                class="mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 z-30"
              >
                <div
                  class="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400"
                >
                  <span
                    class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
                  >
                    <Zap class="w-3.5 h-3.5" />
                    Balas Cepat Internal ({filteredQuickReplies.length})
                  </span>
                  <span class="text-[10px] text-slate-400"
                    >Gunakan ↑ ↓ lalu Enter / Tab</span
                  >
                </div>
                <div class="py-1">
                  {#each filteredQuickReplies as qr, idx}
                    <button
                      type="button"
                      onclick={() => selectQuickReply(qr)}
                      onmouseenter={() => (selectedSlashIndex = idx)}
                      class="w-full text-left px-3.5 py-2 flex items-start justify-between gap-3 transition cursor-pointer {idx ===
                      selectedSlashIndex
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-medium'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span
                            class="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20"
                          >
                            {qr.shortcut}
                          </span>
                          <span class="font-semibold text-xs truncate"
                            >{qr.title}</span
                          >
                        </div>
                        <p
                          class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-relaxed"
                        >
                          {qr.body}
                        </p>
                      </div>
                      <CornerDownLeft
                        class="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1"
                      />
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Mode / session indicator (session timer is in the header on large screens) -->
            {#if selectedConv}
              {@const effectiveExpiresAt = selectedConv.windowExpiresAt
                ? new Date(selectedConv.windowExpiresAt).getTime()
                : selectedConv.lastMessageAt
                  ? new Date(selectedConv.lastMessageAt).getTime() +
                    24 * 60 * 60 * 1000
                  : 0}
              {@const timeLeftMs = effectiveExpiresAt
                ? effectiveExpiresAt - Date.now()
                : 0}
              {@const hoursLeft = Math.floor(Math.max(0, timeLeftMs) / 3600000)}
              {@const minutesLeft = Math.floor((Math.max(0, timeLeftMs) % 3600000) / 60000)}

              {#if isInternalNote}
                <div class="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                  <span class="flex items-center gap-1.5 font-medium"><Eye class="h-3.5 w-3.5" /> Mode catatan internal: pesan hanya terlihat oleh tim</span>
                  <button type="button" class="cursor-pointer font-semibold hover:underline" onclick={() => (isInternalNote = false)}>Batal</button>
                </div>
              {:else if timeLeftMs > 0}
                <p class="flex items-center gap-1.5 px-1 text-xs text-slate-500 dark:text-slate-400" title="Sisa waktu jendela 24 jam Meta untuk membalas tanpa template">
                  <Clock class="h-3.5 w-3.5 text-emerald-500" />
                  Sesi 24 jam tersisa {hoursLeft}j {String(minutesLeft).padStart(2, "0")}m
                </p>
              {/if}
            {/if}

            <!-- WhatsApp Attachment Preview Bar -->
            {#if pendingAttachment}
              <div
                class="flex items-center justify-between gap-3 p-2.5 mb-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-2"
              >
                <div class="flex items-center gap-3 min-w-0">
                  {#if pendingAttachment.category === "IMAGE" && pendingAttachment.previewUrl}
                    <img
                      src={pendingAttachment.previewUrl}
                      alt="Preview"
                      class="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  {:else if pendingAttachment.category === "VIDEO"}
                    <div
                      class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0"
                    >
                      <Film class="w-6 h-6" />
                    </div>
                  {:else if pendingAttachment.category === "AUDIO"}
                    <div
                      class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0"
                    >
                      <Music class="w-6 h-6" />
                    </div>
                  {:else}
                    <div
                      class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0"
                    >
                      <FileText class="w-6 h-6" />
                    </div>
                  {/if}

                  {#if pendingAttachment.category !== "IMAGE"}
                    <div class="min-w-0 flex-1">
                      <p
                        class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                      >
                        {pendingAttachment.filename}
                      </p>
                      <p
                        class="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5"
                      >
                        {formatFileSize(pendingAttachment.size)} • {pendingAttachment.category}
                      </p>
                    </div>
                  {/if}
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
              accept={attachmentAccept}
              class="hidden"
            />

            <!-- Composer box -->
            <div
              class="flex items-end gap-1 rounded-2xl border bg-white p-1.5 transition focus-within:ring-4 dark:bg-slate-800/60
                {isInternalNote
                  ? 'border-amber-300 focus-within:border-amber-400 focus-within:ring-amber-500/10 dark:border-amber-600/60'
                  : 'border-slate-200 focus-within:border-emerald-500 focus-within:ring-emerald-500/10 dark:border-slate-700'}"
            >
              <div class="flex shrink-0 items-center text-slate-500 dark:text-slate-400">
                <!-- Attachment menu -->
                <div class="relative">
                  <button
                    type="button"
                    onclick={() => (showAttachmentMenu = !showAttachmentMenu)}
                    class="composer-tool {showAttachmentMenu ? 'bg-slate-100 text-emerald-600 dark:bg-slate-700 dark:text-emerald-400' : ''}"
                    title="Lampirkan foto, video, dokumen, atau audio"
                    aria-label="Lampirkan file"
                    aria-expanded={showAttachmentMenu}
                  >
                    <Paperclip class="h-5 w-5" />
                  </button>

                  {#if showAttachmentMenu}
                    <div
                      class="absolute bottom-full left-0 z-50 mb-3 flex w-44 flex-col gap-0.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                    >
                      <button type="button" onclick={() => openFilePicker(ACCEPT_IMAGE)} class="attach-item">
                        <span class="attach-icon bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><Image class="h-4 w-4" /></span>
                        Foto
                      </button>
                      <button type="button" onclick={() => openFilePicker(ACCEPT_VIDEO)} class="attach-item">
                        <span class="attach-icon bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"><Video class="h-4 w-4" /></span>
                        Video
                      </button>
                      <button type="button" onclick={() => openFilePicker(ACCEPT_DOCUMENT)} class="attach-item">
                        <span class="attach-icon bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"><FileText class="h-4 w-4" /></span>
                        Dokumen
                      </button>
                      <button type="button" onclick={() => openFilePicker(ACCEPT_AUDIO)} class="attach-item">
                        <span class="attach-icon bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"><Music class="h-4 w-4" /></span>
                        Audio
                      </button>
                    </div>
                  {/if}
                </div>

                <button
                  type="button"
                  onclick={() => (showEmojiPicker = !showEmojiPicker)}
                  class="composer-tool {showEmojiPicker ? 'bg-slate-100 text-emerald-600 dark:bg-slate-700 dark:text-emerald-400' : ''}"
                  title="Emoji"
                  aria-label="Emoji"
                >
                  <Smile class="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onclick={() => (isInternalNote = !isInternalNote)}
                  class="composer-tool {isInternalNote ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'hover:text-amber-600'}"
                  title={isInternalNote ? "Matikan mode catatan internal" : "Tulis catatan internal untuk tim"}
                  aria-label="Catatan internal"
                  aria-pressed={isInternalNote}
                >
                  <Eye class="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onclick={fetchAiSuggestions}
                  disabled={isAiGenerating}
                  class="composer-tool text-violet-500 hover:text-violet-600 disabled:opacity-60 dark:text-violet-400"
                  title="Saran balasan AI"
                  aria-label="Saran balasan AI"
                >
                  <Sparkles class="h-5 w-5 {isAiGenerating ? 'animate-spin' : ''}" />
                </button>
              </div>

              <textarea
                bind:this={messageInputRef}
                rows="1"
                value={messageText}
                oninput={handleInput}
                onkeydown={handleKeydown}
                placeholder={isInternalNote ? "Tulis catatan untuk tim…" : "Tulis pesan…"}
                aria-label={isInternalNote ? "Catatan internal" : "Pesan"}
                class="max-h-44 min-h-[40px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:outline-none dark:text-white dark:placeholder-slate-500"
              ></textarea>

              <button
                type="button"
                onclick={sendMessage}
                disabled={isUploadingMedia}
                class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl transition disabled:opacity-60
                  {isInternalNote
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400'}"
                title={isInternalNote ? "Simpan catatan" : "Kirim (Enter)"}
                aria-label={isInternalNote ? "Simpan catatan" : "Kirim pesan"}
              >
                {#if isUploadingMedia}
                  <Loader2 class="h-4.5 w-4.5 animate-spin" />
                {:else}
                  <Send class="h-4.5 w-4.5" />
                {/if}
              </button>
            </div>
            <p class="hidden px-1 text-[11px] text-slate-400 sm:block dark:text-slate-500">
              <kbd class="font-sans font-semibold">Enter</kbd> kirim · <kbd class="font-sans font-semibold">Shift + Enter</kbd> baris baru · <kbd class="font-sans font-semibold">/</kbd> balas cepat
            </p>
          {/if}
        {/if}
      </div>
    {:else}
      <div
        class="chat-canvas flex flex-1 flex-col items-center justify-center p-8 text-center"
      >
        <div
          class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-emerald-400 dark:ring-slate-800"
        >
          <MessageSquare class="w-8 h-8" />
        </div>
        <h3
          class="mb-1.5 text-base font-semibold text-slate-800 dark:text-slate-100"
        >
          Pilih percakapan
        </h3>
        <p
          class="max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400"
        >
          Pilih salah satu kontak dari daftar di sebelah kiri untuk membuka
          ruang obrolan dan melihat riwayat pesan.
        </p>
      </div>
    {/if}
  </div>

  <!-- 3. RIGHT COLUMN: Contact & Team Info -->
  {#if selectedConv}
    <aside
      class="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white xl:w-80 {showContactPanel ? 'lg:block' : ''} dark:border-slate-800 dark:bg-slate-900"
      aria-label="Detail kontak"
    >
      <!-- Profile -->
      <div class="flex flex-col items-center border-b border-slate-100 px-5 pt-6 pb-5 text-center dark:border-slate-800">
        <div class="mb-3 flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold {avatarTone(selectedConv.contact.name)}">
          {initials(selectedConv.contact.name)}
        </div>
        <h4 class="text-base font-semibold text-slate-900 dark:text-white">{selectedConv.contact.name}</h4>
        <p class="mt-0.5 text-sm tabular-nums text-slate-500 dark:text-slate-400">+{selectedConv.contact.waId}</p>
        <div class="mt-3 flex flex-wrap justify-center gap-1.5">
          {#if selectedConv.status === "RESOLVED"}
            <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"><CheckCircle2 class="h-3 w-3" /> Tiket selesai</span>
          {:else}
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Tiket aktif</span>
          {/if}
          <span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {selectedConv.contact.customAttributes?.memberLevel || "Regular"}
          </span>
        </div>
      </div>

      <div class="space-y-6 p-5">
        <!-- Team -->
        <section>
          <div class="mb-2.5 flex items-center justify-between">
            <h5 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tim penangan · {1 + (selectedConv.participants?.length || 0)}
            </h5>
            {#if authStore.role !== "AGENT"}
              <button
                onclick={() => (showAddCollaboratorModal = true)}
                class="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              >
                <Plus class="h-3.5 w-3.5" /> Tambah
              </button>
            {/if}
          </div>

          <ul class="space-y-1">
            <li class="flex items-center gap-3 rounded-xl px-2 py-2">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold {selectedConv.assignedUser ? avatarTone(selectedConv.assignedUser.fullName) : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}">
                {selectedConv.assignedUser ? initials(selectedConv.assignedUser.fullName) : "?"}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {selectedConv.assignedUser?.fullName || "Belum ada agen"}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Agen utama</p>
              </div>
            </li>

            {#if selectedConv.participants && selectedConv.participants.length > 0}
              {#each selectedConv.participants as participant}
                <li class="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold {avatarTone(participant.fullName)}">
                    {initials(participant.fullName)}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{participant.fullName}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Kolaborator · {participant.role}</p>
                  </div>
                  {#if authStore.role !== "AGENT"}
                    <button
                      onclick={() => removeCollaborator(participant.id)}
                      class="cursor-pointer rounded-md p-1 text-slate-400 opacity-70 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-500/10"
                      title="Keluarkan dari obrolan"
                      aria-label="Keluarkan {participant.fullName} dari obrolan"
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  {/if}
                </li>
              {/each}
            {/if}
          </ul>
        </section>

        <!-- Contact details -->
        <section>
          <h5 class="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Detail kontak</h5>
          <dl class="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
            <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <dt class="text-slate-500 dark:text-slate-400">Status tiket</dt>
              <dd class="font-medium text-slate-900 dark:text-white">{selectedConv.status === "RESOLVED" ? "Selesai" : "Aktif"}</dd>
            </div>
            <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <dt class="text-slate-500 dark:text-slate-400">Member</dt>
              <dd class="font-medium text-slate-900 dark:text-white">{selectedConv.contact.customAttributes?.memberLevel || "Regular"}</dd>
            </div>
            {#if selectedConv.contact.customAttributes?.totalSpend}
              <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <dt class="text-slate-500 dark:text-slate-400">Total belanja</dt>
                <dd class="font-medium tabular-nums text-slate-900 dark:text-white">Rp {selectedConv.contact.customAttributes.totalSpend.toLocaleString("id-ID")}</dd>
              </div>
            {/if}
          </dl>
        </section>

        <!-- Tags -->
        <section>
          <div class="mb-2.5 flex items-center justify-between">
            <h5 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tag</h5>
            <button
              onclick={() => (showTagModal = true)}
              class="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              <Plus class="h-3.5 w-3.5" /> Tambah
            </button>
          </div>
          {#if customTags.length > 0}
            <div class="flex flex-wrap gap-1.5">
              {#each customTags as t}
                <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pr-1 pl-2.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {t}
                  <button
                    onclick={() => removeTag(t)}
                    class="cursor-pointer rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-rose-600 dark:hover:bg-slate-700"
                    aria-label="Hapus tag {t}"
                  >
                    <X class="h-3 w-3" />
                  </button>
                </span>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-slate-400 dark:text-slate-500">Belum ada tag.</p>
          {/if}
        </section>

        <!-- Actions -->
        {#if authStore.role !== "AGENT"}
          <section class="space-y-2 border-t border-slate-100 pt-5 dark:border-slate-800">
            <button onclick={() => (showReassignModal = true)} class="ui-btn-secondary w-full justify-start">
              <User class="h-4 w-4 text-slate-400" />
              Pindahkan agen utama
            </button>
            <button onclick={() => (showAddCollaboratorModal = true)} class="ui-btn-secondary w-full justify-start">
              <UserPlus class="h-4 w-4 text-slate-400" />
              Undang agen / supervisor
            </button>
          </section>
        {/if}
      </div>
    </aside>
  {/if}
</div>

<!-- ─── 1. MODAL TAMBAH KOLABORATOR (MULTI-AGENT) ─── -->
{#if showAddCollaboratorModal}
  <div
    class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  >
    <div
      class="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4"
    >
      <div
        class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800"
      >
        <h3
          class="text-base font-bold text-slate-900 dark:white flex items-center gap-2"
        >
          <UserPlus class="w-4 h-4 text-indigo-500" />
          Tambah Agen / SPV ke Obrolan
        </h3>
        <button
          onclick={() => (showAddCollaboratorModal = false)}
          class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4">
        <p class="text-xs text-slate-600 dark:text-slate-400">
          Tambahkan agen atau supervisor lain untuk membantu menangani chat <strong
            >{selectedConv?.contact.name}</strong
          > secara bersamaan:
        </p>

        <div>
          <label
            for="collab_select"
            class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >Pilih Anggota Tim</label
          >
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

        <div
          class="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-400"
        >
          💡 Agen yang ditambahkan akan langsung melihat obrolan ini di menu
          Inbox miliknya.
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
            {isActionLoading ? "Menambahkan..." : "Gabungkan ke Chat"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ─── 2. MODAL RE-ASSIGN PERCAKAPAN ─── -->
{#if showReassignModal}
  <div
    class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  >
    <div
      class="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4"
    >
      <div
        class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800"
      >
        <h3 class="text-base font-bold text-slate-900 dark:text-white">
          Pindahkan Agen Utama
        </h3>
        <button
          onclick={() => (showReassignModal = false)}
          class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4">
        <p class="text-xs text-slate-600 dark:text-slate-400">
          Ganti agen penanggung jawab utama tiket <strong
            >{selectedConv?.contact.name}</strong
          >:
        </p>

        <div>
          <label
            for="agent_select"
            class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >Pilih Agen Utama Baru</label
          >
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
            {isActionLoading ? "Memproses..." : "Transfer Sekarang"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- ─── 3. MODAL KELOLA TAG KONTAK ─── -->
{#if showTagModal}
  <div
    class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
  >
    <div
      class="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4"
    >
      <div
        class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800"
      >
        <h3 class="text-base font-bold text-slate-900 dark:text-white">
          Kelola Tag Pelanggan
        </h3>
        <button
          onclick={() => (showTagModal = false)}
          class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4">
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newTagInput}
            onkeydown={(e) => {
              if (e.key === "Enter") addTag();
            }}
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
          <span
            class="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2"
            >Tag yang Aktif:</span
          >
          <div class="flex flex-wrap gap-2">
            {#each customTags as tag}
              <span
                class="px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5"
              >
                {tag}
                <button
                  onclick={() => removeTag(tag)}
                  class="text-slate-400 hover:text-rose-500 cursor-pointer"
                  >×</button
                >
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
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
  >
    <div
      class="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5 text-center"
    >
      <div
        class="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20 shadow-sm"
      >
        <CheckCircle2 class="w-7 h-7" />
      </div>

      <div class="space-y-1.5">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">
          Selesaikan Tiket Percakapan Ini?
        </h3>
        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Apakah Anda yakin ingin mengunci dan me-resolve tiket obrolan dengan <strong
            class="text-slate-900 dark:text-white"
            >{selectedConv?.contact.name || "Pelanggan"}</strong
          >?
        </p>
      </div>

      <div
        class="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-left text-xs text-purple-900 dark:text-purple-200 leading-relaxed flex items-start gap-2.5"
      >
        <Lock
          class="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5"
        />
        <div class="text-[11px] space-y-1">
          <p class="font-bold">Informasi Penyelesaian Tiket:</p>
          <p class="text-purple-700/90 dark:text-purple-300/90">
            Kolom pesan balasan akan dikunci secara permanen. Pesan baru
            berikutnya dari pelanggan ini di masa mendatang akan otomatis dibuat
            sebagai tiket percakapan antrean baru.
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
            <div
              class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
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
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
  >
    <div
      class="glass-panel w-full max-w-xl rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
    >
      <div
        class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
          >
            <Sparkles class="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3
              class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              Asisten Balasan Pintar AI
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {aiMode === "POLISH_DRAFT"
                ? "Variasi Poles Teks Draf Anda"
                : "Rekomendasi Balasan Kontekstual Berdasarkan Pesan Pelanggan"}
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
          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 hover:border-purple-300 dark:hover:border-purple-800/80 transition shadow-sm group"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800/60"
              >
                {suggestion.title}
              </span>
              <span class="text-[10px] text-slate-400 font-mono"
                >Opsi #{idx + 1}</span
              >
            </div>

            <p
              class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/70 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50"
            >
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

      <div
        class="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0"
      >
        <span class="text-[11px] text-slate-400"
          >💡 Anda masih bisa mengedit teks sebelum dikirim ke pelanggan.</span
        >
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

<!-- ─── 6. MODAL KIRIM TEMPLATE LANGSUNG DARI INBOX ─── -->
<SendSingleTemplateModal
  bind:isOpen={showTemplateSendModal}
  templates={availableTemplates}
  initialPhoneNumber={selectedConv?.contact.waId || ""}
  initialContactName={selectedConv?.contact.name || ""}
  onClose={() => {
    showTemplateSendModal = false;
  }}
  onSuccess={() => {
    if (selectedConvId) {
      loadMessages(selectedConvId, true);
      loadConversations();
    }
  }}
/>
