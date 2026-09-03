<script lang="ts">
  import { apiRequest } from "$lib/api/client";
  import { authStore } from "$lib/stores/auth.svelte";
  import { themeStore } from "$lib/stores/theme.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import RoleBadge from "$lib/components/layout/RoleBadge.svelte";
  import {
    Building2,
    Plus,
    Search,
    RefreshCw,
    Shield,
    Users,
    MessageSquare,
    Phone,
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    LogIn,
    MoreVertical,
    Edit3,
    Trash2,
    Lock,
    Unlock,
    ExternalLink,
    Sparkles,
    ShieldAlert,
    CreditCard,
    Key,
    X,
    UserCheck,
    Check,
    Radio,
    FileText,
    ArrowRight,
    Sun,
    Moon,
    LogOut,
    Bot,
    LayoutDashboard,
    Mail,
    Eye,
    EyeOff,
    Copy,
    Dices,
    User,
    Send,
    UserCog,
    Settings,
    Package,
    Wallet,
    Layers,
    Sliders,
    HelpCircle,
    CheckCircle,
    Zap,
    Gift,
    Network,
    Link2,
    Activity,
    Globe,
    ShieldCheck,
    Receipt,
    Menu,
    GitBranch,
    GitPullRequest,
    Terminal,
    ArrowUpCircle,
    PackagePlus,
    FolderGit2,
    AlertCircle,
    Database,
    Gauge,
  } from "lucide-svelte";

  interface TenantItem {
    id: string;
    name: string;
    status: "ACTIVE" | "SUSPENDED" | "TRIAL" | "EXPIRED";
    plan: string;
    maxAgents: number;
    maxBroadcastPerMonth: number;
    expiresAt: string | null;
    daysRemaining: number | null;
    isExpired: boolean;
    ownerName: string | null;
    ownerPhone: string | null;
    ownerEmail: string | null;
    notes: string | null;
    wabaId: string | null;
    appId: string | null;
    hasAccessToken: boolean;
    maskedToken?: string | null;
    createdAt: string;
    updatedAt: string;
    users?: Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      status: string;
      isOnline?: boolean;
    }>;
    phoneNumbers?: Array<{
      id: string;
      phoneNumberId?: string;
      phoneNumber?: string;
      displayPhoneNumber?: string;
      displayName?: string;
      qualityRating?: string;
      verifiedName?: string;
      codeVerificationStatus?: string;
    }>;
    stats?: {
      userCount: number;
      agentCount: number;
      conversationCount: number;
      contactCount: number;
    };
  }

  interface PlatformStaffItem {
    id: string;
    fullName: string;
    email: string;
    role: "SUPER_ADMIN" | "CO_SUPER_ADMIN" | "ADMIN_FINANCE" | "ADMIN_SUPPORT";
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    isOnline?: boolean;
    isPrimaryAdmin?: boolean;
    createdAt: string;
    updatedAt?: string;
  }

  interface PlatformOverview {
    totalOrganizations: number;
    activeOrganizations: number;
    trialOrganizations: number;
    suspendedOrganizations: number;
    expiredOrganizations: number;
    totalUsers: number;
    totalAgents: number;
    totalConversations: number;
    totalMessages: number;
    totalContacts: number;
    expiringSoonCount: number;
    expiringSoonTenants: Array<{
      id: string;
      name: string;
      plan: string;
      expiresAt: string;
      ownerPhone?: string;
      ownerEmail?: string;
    }>;
  }

  interface SaaSPlan {
    id: string;
    name: string;
    code: string; // Bebas / custom, e.g. "STARTER", "PROMO14", "UMKM_GOLD"
    price: number;
    period: string;
    durationType?: "PERMANENT" | "MONTHLY" | "DAYS";
    durationDays?: number;
    maxAgents: number;
    maxBroadcastPerMonth: number;
    description: string;
    features: string[];
    isPopular?: boolean;
    isPublic?: boolean; // true: Tampil di katalog tenant, false: Khusus Super Admin
    isActive: boolean;
  }

  interface MidtransSetting {
    isEnabled: boolean;
    environment: "sandbox" | "production";
    serverKey: string;
    clientKey: string;
    merchantId?: string;
  }

  // Active Tab
  let activeTab = $state<
    "tenants" | "plans" | "transactions" | "midtrans" | "staff" | "system_update"
  >("tenants");
  let mobileSidebarOpen = $state(false);

  // Main Data States
  let organizationsList = $state<TenantItem[]>([]);
  let overview = $state<PlatformOverview | null>(null);
  let saasPlans = $state<SaaSPlan[]>([]);
  let midtrans = $state<MidtransSetting>({
    isEnabled: false,
    environment: "sandbox",
    serverKey: "",
    clientKey: "",
    merchantId: "",
  });

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let feedbackMessage = $state<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  let copiedText = $state<string | null>(null);

  // Super Admin Login Gate state
  let loginEmail = $state("admin@perusahaan.com");
  let loginPassword = $state("");
  let loginLoading = $state(false);
  let loginError = $state<string | null>(null);
  let showPassword = $state(false);

  // Super Admin Profile Edit Modal state
  let showProfileModal = $state(false);
  let profileFullName = $state("");
  let profileEmail = $state("");
  let profileCurrentPassword = $state("");
  let profileNewPassword = $state("");
  let profileLoading = $state(false);

  // Meta Integration Wizard Modal state
  let showMetaModal = $state(false);
  let metaOrg = $state<TenantItem | null>(null);
  let metaWabaId = $state("");
  let metaPhoneId = $state("");
  let metaDisplayPhone = $state("");
  let metaVerifiedName = $state("");
  let metaAccessToken = $state("");
  let metaAppId = $state("");
  let metaTestResult = $state<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  } | null>(null);
  let isTestingMeta = $state(false);

  // SaaS Plan Edit/Create Modal state
  let showPlanModal = $state(false);
  let editingPlan = $state<SaaSPlan | null>(null);
  let planName = $state("");
  let planCode = $state<string>("STARTER");
  let planPrice = $state(199000);
  let planPeriod = $state("bulan");
  let planDurationType = $state<"PERMANENT" | "MONTHLY" | "DAYS">("MONTHLY");
  let planDurationDays = $state(30);
  let planMaxAgents = $state(5);
  let planMaxBroadcast = $state(5000);
  let planDescription = $state("");
  let planFeaturesText = $state("");
  let planIsPopular = $state(false);
  let planIsPublic = $state(true);
  let planIsActive = $state(true);

  // Midtrans Key Visibility
  let showMidtransServerKey = $state(false);

  // Check if authenticated as Platform Staff (Super Admin, Finance, Support)
  const isSuperAdminLoggedIn = $derived(
    !!authStore.token && authStore.isPlatformStaff,
  );

  // Filters & Search for Tenants
  let searchQuery = $state("");
  let selectedStatus = $state<string>("ALL");
  let selectedPlan = $state<string>("ALL");

  // Modals state for Tenants
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showExtendModal = $state(false);
  let showResetPasswordModal = $state(false);
  let showUsersModal = $state(false);
  let activeTenant = $state<TenantItem | null>(null);

  // Form Fields: Create Organization
  let newOrgName = $state("");
  let newOrgPlan = $state<string>("STARTER");
  let newOrgMaxAgents = $state(5);
  let newOrgDurationDays = $state(30);
  let newOrgOwnerName = $state("");
  let newOrgAdminEmail = $state("");
  let newOrgAdminPassword = $state("");
  let newOrgOwnerPhone = $state("");
  let newOrgNotes = $state("");
  let newOrgWabaId = $state("");
  let newOrgPhoneNumberId = $state("");
  let newOrgDisplayPhone = $state("");
  let newOrgAccessToken = $state("");

  // Form Fields: Edit Organization
  let editName = $state("");
  let editPlan = $state<string>("STARTER");
  let editStatus = $state<"ACTIVE" | "SUSPENDED" | "TRIAL" | "EXPIRED">(
    "ACTIVE",
  );
  let editMaxAgents = $state(5);
  let editMaxBroadcast = $state(10000);
  let editExpiresAt = $state<string>("");
  let editOwnerName = $state("");
  let editOwnerPhone = $state("");
  let editOwnerEmail = $state("");
  let editNotes = $state("");
  let editWabaId = $state("");
  let editAppId = $state("");
  let editAccessToken = $state("");

  // Form Fields: Extend Subscription
  let extendDays = $state(30);

  // Form Fields: Reset Admin Password
  let resetUserId = $state<string>("");
  let resetPasswordNew = $state("");
  let resetSuccessInfo = $state<{ email: string; pass: string } | null>(null);

  // Platform Staff Management State
  let staffList = $state<PlatformStaffItem[]>([]);
  let staffLoading = $state(false);
  let staffSearchQuery = $state("");
  let staffSelectedRole = $state<string>("ALL");

  // Modals for Staff
  let showCreateStaffModal = $state(false);
  let showEditStaffModal = $state(false);
  let showResetStaffPasswordModal = $state(false);
  let showDeleteStaffModal = $state(false);
  let activeStaff = $state<PlatformStaffItem | null>(null);

  // Form Fields for Create/Edit Staff
  let newStaffName = $state("");
  let newStaffEmail = $state("");
  let newStaffPassword = $state("");
  let newStaffRole = $state<"SUPER_ADMIN" | "CO_SUPER_ADMIN" | "ADMIN_FINANCE" | "ADMIN_SUPPORT">(
    "CO_SUPER_ADMIN",
  );

  let editStaffName = $state("");
  let editStaffEmail = $state("");
  let editStaffRole = $state<"SUPER_ADMIN" | "CO_SUPER_ADMIN" | "ADMIN_FINANCE" | "ADMIN_SUPPORT">(
    "CO_SUPER_ADMIN",
  );
  let editStaffStatus = $state<"ACTIVE" | "INACTIVE" | "SUSPENDED">("ACTIVE");
  let editStaffPassword = $state("");

  let resetStaffNewPassword = $state("");

  // Transactions States
  interface AdminTransactionItem {
    id: string;
    orderNumber: string;
    organizationId: string;
    organizationName: string | null;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    planCode: string;
    planName: string;
    amount: number;
    durationDays: number;
    paymentStatus: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
    paymentMethod: string | null;
    snapToken: string | null;
    snapRedirectUrl: string | null;
    paidAt: string | null;
    activatedAt: string | null;
    createdAt: string;
  }

  interface TransactionSummary {
    totalRevenue: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    totalOrders: number;
  }

  let transactionsList = $state<AdminTransactionItem[]>([]);
  let transactionSummary = $state<TransactionSummary>({
    totalRevenue: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    totalOrders: 0,
  });
  let transactionsLoading = $state(false);
  let transactionStatusFilter = $state<string>("ALL");
  let transactionSearchQuery = $state<string>("");
  let orderToConfirmManual = $state<AdminTransactionItem | null>(null);
  let showConfirmPaymentModal = $state(false);

  let filteredTransactions = $derived(
    transactionsList.filter((tx) => {
      const q = transactionSearchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (tx.orderNumber && tx.orderNumber.toLowerCase().includes(q)) ||
        (tx.organizationName &&
          tx.organizationName.toLowerCase().includes(q)) ||
        (tx.planName && tx.planName.toLowerCase().includes(q)) ||
        (tx.userEmail && tx.userEmail.toLowerCase().includes(q));
      const matchesStatus =
        transactionStatusFilter === "ALL" ||
        tx.paymentStatus === transactionStatusFilter;
      return matchesSearch && matchesStatus;
    }),
  );

  async function loadTransactions() {
    transactionsLoading = true;
    try {
      const res = await apiRequest<any>("/super-admin/transactions");
      if (res && res.success) {
        transactionsList = res.data || [];
        if (res.summary) {
          transactionSummary = res.summary;
        }
      }
    } catch (_) {
    } finally {
      transactionsLoading = false;
    }
  }

  async function handleConfirmManualPayment(order: AdminTransactionItem) {
    isSubmitting = true;
    try {
      const res = await apiRequest<any>(
        `/super-admin/transactions/${order.id}/confirm-manual`,
        {
          method: "POST",
        },
      );
      if (res && res.success) {
        feedbackMessage = {
          text: `Pembayaran ${order.orderNumber} (${order.organizationName}) berhasil dikonfirmasi! Paket telah aktif.`,
          type: "success",
        };
        showConfirmPaymentModal = false;
        orderToConfirmManual = null;
        await Promise.all([loadTransactions(), loadData()]);
      } else {
        feedbackMessage = {
          text: res?.error || "Gagal mengonfirmasi pembayaran",
          type: "error",
        };
      }
    } catch (e: any) {
      feedbackMessage = {
        text: e?.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      isSubmitting = false;
    }
  }

  async function handleCancelTransaction(order: AdminTransactionItem) {
    if (!confirm(`Batalkan transaksi ${order.orderNumber}?`)) return;
    try {
      const res = await apiRequest<any>(
        `/super-admin/transactions/${order.id}/cancel`,
        {
          method: "POST",
        },
      );
      if (res && res.success) {
        feedbackMessage = {
          text: `Transaksi ${order.orderNumber} berhasil dibatalkan.`,
          type: "success",
        };
        await loadTransactions();
      } else {
        feedbackMessage = {
          text: res?.error || "Gagal membatalkan transaksi",
          type: "error",
        };
      }
    } catch (e: any) {
      feedbackMessage = {
        text: e?.message || "Terjadi kesalahan",
        type: "error",
      };
    }
  }

  // ─── CHANGE PLAN STATE & HANDLERS ─────────────────────────
  let showChangePlanModal = $state(false);
  let selectedOrgForPlanChange = $state<TenantItem | null>(null);
  let planChangeForm = $state({
    planCode: "PRO",
    durationType: "30_DAYS", // '30_DAYS' | '90_DAYS' | '365_DAYS' | 'LIFETIME' | 'CUSTOM'
    durationDays: 30,
    customExpiresAt: "",
    isLifetime: false,
    customMaxAgents: 5,
    customMaxBroadcast: 10000,
    notes: "",
  });
  let isChangingPlan = $state(false);

  function onPlanSelectChange(newPlanCode: string) {
    planChangeForm.planCode = newPlanCode;
    const p = saasPlans.find(
      (item) => item.code.toUpperCase() === newPlanCode.toUpperCase(),
    );
    if (p) {
      planChangeForm.customMaxAgents = p.maxAgents ?? 5;
      planChangeForm.customMaxBroadcast = p.maxBroadcastPerMonth ?? 10000;
    }
  }

  function openChangePlanModal(org: TenantItem) {
    selectedOrgForPlanChange = org;
    const initialPlanCode = org.plan || "PRO";
    const foundPlan = saasPlans.find(
      (p) => p.code.toUpperCase() === initialPlanCode.toUpperCase(),
    );
    planChangeForm = {
      planCode: initialPlanCode,
      durationType: "30_DAYS",
      durationDays: 30,
      customExpiresAt: "",
      isLifetime: false,
      customMaxAgents: foundPlan?.maxAgents ?? org.maxAgents ?? 5,
      customMaxBroadcast:
        foundPlan?.maxBroadcastPerMonth ?? org.maxBroadcastPerMonth ?? 10000,
      notes: "",
    };
    showChangePlanModal = true;
  }

  async function handleExecuteChangePlan(e: Event) {
    e.preventDefault();
    if (!selectedOrgForPlanChange) return;

    isChangingPlan = true;
    try {
      let durationDays: number | undefined = undefined;
      let isLifetime: boolean = false;
      let customExpiresAt: string | undefined = undefined;

      if (planChangeForm.durationType === "30_DAYS") {
        durationDays = 30;
      } else if (planChangeForm.durationType === "90_DAYS") {
        durationDays = 90;
      } else if (planChangeForm.durationType === "365_DAYS") {
        durationDays = 365;
      } else if (planChangeForm.durationType === "LIFETIME") {
        isLifetime = true;
        durationDays = 0;
      } else if (planChangeForm.durationType === "CUSTOM") {
        if (planChangeForm.customExpiresAt) {
          customExpiresAt = planChangeForm.customExpiresAt;
        } else {
          durationDays = Number(planChangeForm.durationDays) || 30;
        }
      }

      const res = await apiRequest<any>(
        `/super-admin/organizations/${selectedOrgForPlanChange.id}/change-plan`,
        {
          method: "PUT",
          body: JSON.stringify({
            planCode: planChangeForm.planCode,
            durationDays,
            isLifetime,
            customExpiresAt,
            customMaxAgents: Number(planChangeForm.customMaxAgents) || undefined,
            customMaxBroadcast:
              Number(planChangeForm.customMaxBroadcast) || undefined,
            notes: planChangeForm.notes || undefined,
          }),
        },
      );

      if (res && res.success) {
        feedbackMessage = {
          text:
            res.message ||
            `Paket organisasi "${selectedOrgForPlanChange.name}" berhasil diubah!`,
          type: "success",
        };
        showChangePlanModal = false;
        selectedOrgForPlanChange = null;
        await loadData();
      } else {
        feedbackMessage = {
          text: res?.error || "Gagal mengubah paket organisasi",
          type: "error",
        };
      }
    } catch (err: any) {
      feedbackMessage = {
        text: err?.message || "Terjadi kesalahan saat mengubah paket",
        type: "error",
      };
    } finally {
      isChangingPlan = false;
    }
  }

  // ─── GIT SYSTEM UPDATE STATE & HANDLERS ───────────────────
  interface GitStatusData {
    currentBranch: string;
    commitHash: string;
    shortHash: string;
    commitMessage: string;
    author: string;
    authorEmail: string;
    commitDate: string;
    remoteUrl: string;
    hasLocalChanges: boolean;
  }

  let gitStatus = $state<GitStatusData | null>(null);
  let gitLoading = $state(false);
  let gitChecking = $state(false);
  let gitPulling = $state(false);
  let gitUpdateResult = $state<{
    currentBranch: string;
    behindCount: number;
    isUpToDate: boolean;
    incomingCommits: Array<{
      hash: string;
      message: string;
      author: string;
      date: string;
    }>;
  } | null>(null);
  let gitTerminalLogs = $state<string[]>([
    "WA CRM Engine Git Manager ready.",
    "Siap memeriksa pembaruan dari repository GitHub resmi.",
  ]);
  let showConfirmGitPullModal = $state(false);

  async function loadGitStatus() {
    if (!authStore.isSuperAdmin) return;
    gitLoading = true;
    try {
      const res = await apiRequest<any>("/super-admin/system/git-status");
      if (res && res.success) {
        gitStatus = res.data;
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Git branch: ${res.data.currentBranch} (${res.data.shortHash})`,
        );
      }
    } catch (e: any) {
      gitTerminalLogs.push(
        `[${new Date().toLocaleTimeString()}] Gagal membaca status git: ${e?.message}`,
      );
    } finally {
      gitLoading = false;
    }
  }

  async function handleGitCheckUpdate() {
    if (!authStore.isSuperAdmin) return;
    gitChecking = true;
    gitTerminalLogs.push(
      `[${new Date().toLocaleTimeString()}] Menghubungi GitHub dan memeriksa commit terbaru...`,
    );
    try {
      const res = await apiRequest<any>("/super-admin/system/git-check-update", {
        method: "POST",
      });
      if (res && res.success) {
        gitUpdateResult = res.data;
        if (res.data.behindCount > 0) {
          gitTerminalLogs.push(
            `[${new Date().toLocaleTimeString()}] Ditemukan ${res.data.behindCount} commit baru dari GitHub!`,
          );
          feedbackMessage = {
            text: `Ditemukan ${res.data.behindCount} commit pembaruan baru di GitHub yang siap diterapkan!`,
            type: "success",
          };
        } else {
          gitTerminalLogs.push(
            `[${new Date().toLocaleTimeString()}] Codebase sudah versi terbaru (up-to-date dengan origin/${res.data.currentBranch}).`,
          );
          feedbackMessage = {
            text: "Codebase sistem sudah menggunakan versi paling mutakhir dari GitHub!",
            type: "success",
          };
        }
      } else {
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Gagal cek update: ${res?.error}`,
        );
        feedbackMessage = {
          text: res?.error || "Gagal memeriksa pembaruan di GitHub",
          type: "error",
        };
      }
    } catch (e: any) {
      gitTerminalLogs.push(
        `[${new Date().toLocaleTimeString()}] Error: ${e?.message}`,
      );
      feedbackMessage = {
        text: e?.message || "Terjadi kesalahan jaringan saat mengecek GitHub",
        type: "error",
      };
    } finally {
      gitChecking = false;
    }
  }

  async function handleGitPull() {
    if (!authStore.isSuperAdmin) return;
    showConfirmGitPullModal = false;
    gitPulling = true;
    gitTerminalLogs.push(
      `[${new Date().toLocaleTimeString()}] Menjalankan git pull origin ${gitStatus?.currentBranch || "main"}...`,
    );
    try {
      const res = await apiRequest<any>("/super-admin/system/git-pull", {
        method: "POST",
      });
      if (res && res.success) {
        gitTerminalLogs.push(`[${new Date().toLocaleTimeString()}] Output git pull:`);
        gitTerminalLogs.push(res.output || "Already up to date.");
        feedbackMessage = {
          text:
            res.message || "Pembaruan GitHub berhasil ditarik dan diterapkan!",
          type: "success",
        };
        await Promise.all([loadGitStatus(), handleGitCheckUpdate()]);
      } else {
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Gagal pull: ${res?.error}`,
        );
        if (res?.output) gitTerminalLogs.push(res.output);
        feedbackMessage = {
          text: res?.error || "Gagal menarik update dari GitHub",
          type: "error",
        };
      }
    } catch (e: any) {
      gitTerminalLogs.push(
        `[${new Date().toLocaleTimeString()}] Error: ${e?.message}`,
      );
      feedbackMessage = {
        text: e?.message || "Terjadi kesalahan saat mengeksekusi git pull",
        type: "error",
      };
    } finally {
      gitPulling = false;
    }
  }

  let isDbSyncing = $state(false);

  async function handleDbSync() {
    if (!authStore.isSuperAdmin) return;
    isDbSyncing = true;
    gitTerminalLogs.push(
      `[${new Date().toLocaleTimeString()}] Menjalankan sinkronisasi skema & relasi database non-destructive...`,
    );
    try {
      const res = await apiRequest<any>("/super-admin/system/db-sync", {
        method: "POST",
      });
      if (res && res.success) {
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Output sinkronisasi database:`,
        );
        gitTerminalLogs.push(res.output || "Database schema up-to-date.");
        feedbackMessage = {
          text:
            res.message ||
            "Skema database terbaru berhasil disinkronkan aman tanpa menghapus data!",
          type: "success",
        };
      } else {
        gitTerminalLogs.push(
          `[${new Date().toLocaleTimeString()}] Gagal sinkronisasi DB: ${res?.error}`,
        );
        feedbackMessage = {
          text: res?.error || "Gagal sinkronisasi database",
          type: "error",
        };
      }
    } catch (e: any) {
      gitTerminalLogs.push(
        `[${new Date().toLocaleTimeString()}] Error: ${e?.message}`,
      );
      feedbackMessage = {
        text: e?.message || "Terjadi kesalahan saat sinkronisasi database",
        type: "error",
      };
    } finally {
      isDbSyncing = false;
    }
  }

  onMount(async () => {
    if (authStore.token) {
      await authStore.fetchFreshProfile();
      if (authStore.isPlatformStaff) {
        await loadData();
      } else {
        goto("/administrator/login");
      }
    } else {
      goto("/administrator/login");
    }
  });

  function openSuperAdminProfile() {
    profileFullName = authStore.user?.fullName || "Master Administrator";
    profileEmail = authStore.user?.email || "admin@perusahaan.com";
    profileCurrentPassword = "";
    profileNewPassword = "";
    showProfileModal = true;
  }

  async function handleUpdateProfile(e: Event) {
    e.preventDefault();
    if (!profileEmail.trim()) {
      feedbackMessage = { text: "Email tidak boleh kosong!", type: "error" };
      return;
    }

    profileLoading = true;
    const res = await apiRequest<any>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({
        fullName: profileFullName.trim(),
        email: profileEmail.trim(),
        currentPassword: profileCurrentPassword.trim() || undefined,
        newPassword: profileNewPassword.trim() || undefined,
      }),
    });
    profileLoading = false;

    if (res.success) {
      showProfileModal = false;
      feedbackMessage = {
        text: res.message || "Profil & Data Login Anda Berhasil Diperbarui!",
        type: "success",
      };
      if (res.token && res.user) {
        authStore.setAuth(res.token, {
          ...authStore.user!,
          ...res.user,
        });
      }
      await authStore.fetchFreshProfile();
    } else {
      feedbackMessage = {
        text: res.error || "Gagal memperbarui profil login",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleSuperAdminLogin(e: Event) {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      loginError = "Harap isi email dan password super admin";
      return;
    }

    loginLoading = true;
    loginError = null;

    const res = await authStore.login({
      email: loginEmail,
      password: loginPassword,
    });
    loginLoading = false;

    if (res.success) {
      await authStore.fetchFreshProfile();
      if (!authStore.isPlatformStaff) {
        authStore.logout();
        loginError =
          "Akses Ditolak: Halaman Master Control Administrator ini khusus untuk Pemilik Platform & Staf Administrator. Akun staf/admin penyewa (tenant) silakan login melalui halaman login utama (/login).";
        return;
      }
      await loadData();
    } else {
      loginError =
        res.error || "Login gagal. Periksa kembali email dan kata sandi Anda.";
    }
  }

  async function loadData() {
    if (!authStore.token || !authStore.isPlatformStaff) return;
    isLoading = true;
    try {
      const [overviewRes, orgsRes, settingsRes, staffRes, txRes] =
        await Promise.all([
          apiRequest<any>("/super-admin/overview"),
          apiRequest<any>("/super-admin/organizations"),
          apiRequest<any>("/super-admin/settings"),
          apiRequest<any>("/super-admin/staff"),
          apiRequest<any>("/super-admin/transactions"),
        ]);

      if (overviewRes && overviewRes.success) {
        overview = overviewRes.data || overviewRes;
      }
      if (orgsRes && orgsRes.success) {
        organizationsList =
          orgsRes.items ||
          (orgsRes.data && orgsRes.data.items) ||
          (Array.isArray(orgsRes.data) ? orgsRes.data : []);
      }
      if (settingsRes && settingsRes.success && settingsRes.data) {
        saasPlans = settingsRes.data.plans || [];
        if (settingsRes.data.paymentGateway) {
          midtrans = settingsRes.data.paymentGateway;
        }
      }
      if (staffRes && staffRes.success) {
        staffList = staffRes.data || [];
      }
      if (txRes && txRes.success) {
        transactionsList = txRes.data || [];
        if (txRes.summary) {
          transactionSummary = txRes.summary;
        }
      }
    } catch (e: any) {
      feedbackMessage = {
        text: e?.message || "Gagal memuat data pengaturan",
        type: "error",
      };
    } finally {
      isLoading = false;
    }
  }

  // ==========================================
  // PLATFORM STAFF MANAGEMENT HANDLERS
  // ==========================================
  async function loadStaff() {
    staffLoading = true;
    try {
      const res = await apiRequest<any>("/super-admin/staff");
      if (res && res.success) {
        staffList = res.data || [];
      }
    } catch (e) {
      console.error("Gagal memuat daftar staf:", e);
    } finally {
      staffLoading = false;
    }
  }

  function openCreateStaff() {
    newStaffName = "";
    newStaffEmail = "";
    newStaffPassword = "";
    newStaffRole = "ADMIN_FINANCE";
    showCreateStaffModal = true;
  }

  async function handleCreateStaff(e: Event) {
    e.preventDefault();
    if (
      !newStaffName.trim() ||
      !newStaffEmail.trim() ||
      !newStaffPassword.trim()
    ) {
      feedbackMessage = {
        text: "Harap lengkapi semua kolom yang wajib diisi!",
        type: "error",
      };
      return;
    }

    isSubmitting = true;
    try {
      const res = await apiRequest<any>("/super-admin/staff", {
        method: "POST",
        body: JSON.stringify({
          fullName: newStaffName.trim(),
          email: newStaffEmail.toLowerCase().trim(),
          password: newStaffPassword.trim(),
          role: newStaffRole,
        }),
      });

      if (res && res.success) {
        showCreateStaffModal = false;
        feedbackMessage = {
          text: res.message || "Akun staf platform berhasil ditambahkan!",
          type: "success",
        };
        await loadStaff();
      } else {
        feedbackMessage = {
          text: res?.error || "Gagal menambahkan staf platform",
          type: "error",
        };
      }
    } catch (err: any) {
      feedbackMessage = {
        text: err.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      isSubmitting = false;
      setTimeout(() => (feedbackMessage = null), 5000);
    }
  }

  function openEditStaff(staff: PlatformStaffItem) {
    activeStaff = staff;
    editStaffName = staff.fullName;
    editStaffEmail = staff.email;
    editStaffRole = staff.role;
    editStaffStatus = staff.status;
    editStaffPassword = "";
    showEditStaffModal = true;
  }

  async function handleUpdateStaff(e: Event) {
    e.preventDefault();
    if (!activeStaff) return;

    isSubmitting = true;
    try {
      const payload: Record<string, any> = {
        fullName: editStaffName.trim(),
        email: editStaffEmail.toLowerCase().trim(),
        role: editStaffRole,
        status: editStaffStatus,
      };
      if (editStaffPassword.trim()) {
        payload.password = editStaffPassword.trim();
      }

      const res = await apiRequest<any>(
        `/super-admin/staff/${activeStaff.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );

      if (res && res.success) {
        showEditStaffModal = false;
        feedbackMessage = {
          text: res.message || "Data staf platform berhasil diperbarui!",
          type: "success",
        };
        await loadStaff();
      } else {
        feedbackMessage = {
          text: res?.error || "Gagal memperbarui data staf",
          type: "error",
        };
      }
    } catch (err: any) {
      feedbackMessage = {
        text: err.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      isSubmitting = false;
      setTimeout(() => (feedbackMessage = null), 5000);
    }
  }

  function openResetStaffPassword(staff: PlatformStaffItem) {
    activeStaff = staff;
    resetStaffNewPassword = "";
    showResetStaffPasswordModal = true;
  }

  async function handleResetStaffPassword(e: Event) {
    e.preventDefault();
    if (!activeStaff || !resetStaffNewPassword.trim()) return;

    isSubmitting = true;
    try {
      const res = await apiRequest<any>(
        `/super-admin/staff/${activeStaff.id}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ newPassword: resetStaffNewPassword.trim() }),
        },
      );

      if (res && res.success) {
        showResetStaffPasswordModal = false;
        feedbackMessage = {
          text: res.message || "Password staf platform berhasil direset!",
          type: "success",
        };
      } else {
        feedbackMessage = {
          text: res?.error || "Gagal mereset password staf",
          type: "error",
        };
      }
    } catch (err: any) {
      feedbackMessage = {
        text: err.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      isSubmitting = false;
      setTimeout(() => (feedbackMessage = null), 5000);
    }
  }

  function openDeleteStaff(staff: PlatformStaffItem) {
    activeStaff = staff;
    showDeleteStaffModal = true;
  }

  async function handleDeleteStaff() {
    if (!activeStaff) return;

    isSubmitting = true;
    try {
      const res = await apiRequest<any>(
        `/super-admin/staff/${activeStaff.id}`,
        {
          method: "DELETE",
        },
      );

      if (res && res.success) {
        showDeleteStaffModal = false;
        feedbackMessage = {
          text: res.message || "Akun staf platform berhasil dihapus!",
          type: "success",
        };
        await loadStaff();
      } else {
        feedbackMessage = {
          text: res?.error || "Gagal menghapus staf platform",
          type: "error",
        };
      }
    } catch (err: any) {
      feedbackMessage = {
        text: err.message || "Terjadi kesalahan sistem",
        type: "error",
      };
    } finally {
      isSubmitting = false;
      setTimeout(() => (feedbackMessage = null), 5000);
    }
  }

  const filteredStaff = $derived(
    staffList.filter((s) => {
      const q = staffSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);

      const matchesRole =
        staffSelectedRole === "ALL" || s.role === staffSelectedRole;

      return matchesSearch && matchesRole;
    }),
  );

  // ==========================================
  // META CLOUD API INTEGRATION WIZARD HANDLERS
  // ==========================================
  function openMetaWizard(tenant: TenantItem) {
    metaOrg = tenant;
    metaWabaId = tenant.wabaId || "";
    
    // Only use numeric Phone Number IDs (Meta Phone IDs are numeric digits, dummy IDs are alphanumeric nanoids)
    const rawPhoneId = tenant.phoneNumbers?.[0]?.phoneNumberId || "";
    metaPhoneId = /^\d+$/.test(rawPhoneId) ? rawPhoneId : "";

    metaDisplayPhone = tenant.phoneNumbers?.[0]?.displayPhoneNumber || "";
    metaVerifiedName = tenant.phoneNumbers?.[0]?.verifiedName || tenant.name;
    metaAccessToken = "";
    metaAppId = tenant.appId || "";
    metaTestResult = null;
    showMetaModal = true;
  }

  async function handleTestMetaConnection() {
    if (!metaOrg) return;
    isTestingMeta = true;
    metaTestResult = null;

    const res = await apiRequest<any>(
      `/super-admin/organizations/${metaOrg.id}/test-meta`,
      {
        method: "POST",
        body: JSON.stringify({
          wabaId: metaWabaId.trim() || undefined,
          phoneNumberId: metaPhoneId.trim() || undefined,
          accessToken: metaAccessToken.trim() || undefined,
        }),
      },
    );
    isTestingMeta = false;

    if (res.success) {
      metaTestResult = {
        success: true,
        message: res.message || "Koneksi ke Meta Cloud API Berhasil!",
        data: res.data,
      };
      if (res.data?.phoneNumber?.display_phone_number) {
        metaDisplayPhone = res.data.phoneNumber.display_phone_number;
      }
      if (res.data?.phoneNumber?.verified_name) {
        metaVerifiedName = res.data.phoneNumber.verified_name;
      }
    } else {
      metaTestResult = {
        success: false,
        message: res.error || "Gagal menghubungkan ke Meta API",
        error: res.error,
      };
    }
  }

  async function handleSaveMetaConfig(e: Event) {
    e.preventDefault();
    if (!metaOrg) return;

    isSubmitting = true;
    const res = await apiRequest(
      `/super-admin/organizations/${metaOrg.id}/meta-config`,
      {
        method: "PUT",
        body: JSON.stringify({
          wabaId: metaWabaId.trim() || undefined,
          phoneNumberId: metaPhoneId.trim() || undefined,
          displayPhoneNumber: metaDisplayPhone.trim() || undefined,
          verifiedName: metaVerifiedName.trim() || undefined,
          accessToken: metaAccessToken.trim() || undefined,
          appId: metaAppId.trim() || undefined,
          qualityRating:
            metaTestResult?.data?.phoneNumber?.quality_rating || undefined,
        }),
      },
    );
    isSubmitting = false;

    if (res.success) {
      showMetaModal = false;
      feedbackMessage = {
        text: "Integrasi Meta WhatsApp Cloud API berhasil disimpan!",
        type: "success",
      };
      loadData();
    } else {
      feedbackMessage = {
        text: res.error || "Gagal menyimpan konfigurasi Meta",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  // ==========================================
  // PLANS MANAGEMENT HANDLERS
  // ==========================================
  function openCreatePlan(isPromo = false) {
    editingPlan = null;
    if (isPromo) {
      planName = "Promo Spesial";
      planCode = "PROMO";
      planPrice = 0;
      planPeriod = "14 hari";
      planDurationType = "DAYS";
      planDurationDays = 14;
      planMaxAgents = 3;
      planMaxBroadcast = 1000;
      planDescription = "Paket promo khusus dari Super Admin.";
      planFeaturesText =
        "3 Kursi Agen CS\n1.000 Broadcast / Bulan\nLive Inbox & Kontak\nTemplate Pesan";
      planIsPopular = false;
      planIsPublic = false; // Default: Khusus Super Admin
      planIsActive = true;
    } else {
      planName = "";
      planCode = "STARTER";
      planPrice = 299000;
      planPeriod = "bulan";
      planDurationType = "MONTHLY";
      planDurationDays = 30;
      planMaxAgents = 10;
      planMaxBroadcast = 15000;
      planDescription = "";
      planFeaturesText =
        "10 Kursi Agen CS\n15.000 Broadcast / Bulan\nLive Chat & SLA Report\nAPI Key Webhook";
      planIsPopular = false;
      planIsPublic = true; // Default: Publik
      planIsActive = true;
    }
    showPlanModal = true;
  }

  function openEditPlan(plan: SaaSPlan) {
    editingPlan = plan;
    planName = plan.name;
    planCode = plan.code;
    planPrice = plan.price;
    planPeriod = plan.period || "bulan";
    planDurationType =
      plan.durationType ||
      (plan.price === 0
        ? plan.durationDays === 0
          ? "PERMANENT"
          : "DAYS"
        : "MONTHLY");
    planDurationDays =
      plan.durationDays !== undefined
        ? plan.durationDays
        : planDurationType === "PERMANENT"
          ? 0
          : 30;
    planMaxAgents = plan.maxAgents;
    planMaxBroadcast = plan.maxBroadcastPerMonth;
    planDescription = plan.description;
    planFeaturesText = (plan.features || []).join("\n");
    planIsPopular = !!plan.isPopular;
    planIsPublic = plan.isPublic !== false;
    planIsActive = plan.isActive !== false;
    showPlanModal = true;
  }

  async function handleSavePlan(e: Event) {
    e.preventDefault();
    if (!planName.trim()) {
      feedbackMessage = { text: "Nama paket wajib diisi!", type: "error" };
      return;
    }

    const featuresArray = planFeaturesText
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const actualDurationDays =
      planDurationType === "PERMANENT" ? 0 : Number(planDurationDays);
    const actualPeriod =
      planDurationType === "PERMANENT"
        ? "selamanya"
        : planDurationType === "DAYS"
          ? `${actualDurationDays} hari`
          : "bulan";

    let updatedPlans = [...saasPlans];

    if (editingPlan) {
      // Update existing
      updatedPlans = updatedPlans.map((p) =>
        p.id === editingPlan!.id
          ? {
              ...p,
              name: planName.trim(),
              code: planCode,
              price: Number(planPrice),
              period: actualPeriod,
              durationType: planDurationType,
              durationDays: actualDurationDays,
              maxAgents: Number(planMaxAgents),
              maxBroadcastPerMonth: Number(planMaxBroadcast),
              description: planDescription.trim(),
              features: featuresArray,
              isPopular: planIsPopular,
              isPublic: planIsPublic,
              isActive: planIsActive,
            }
          : p,
      );
    } else {
      // Add new
      const newPlan: SaaSPlan = {
        id: `plan_${Date.now()}`,
        name: planName.trim(),
        code: planCode,
        price: Number(planPrice),
        period: actualPeriod,
        durationType: planDurationType,
        durationDays: actualDurationDays,
        maxAgents: Number(planMaxAgents),
        maxBroadcastPerMonth: Number(planMaxBroadcast),
        description: planDescription.trim(),
        features: featuresArray,
        isPopular: planIsPopular,
        isPublic: planIsPublic,
        isActive: planIsActive,
      };
      updatedPlans.push(newPlan);
    }

    isSubmitting = true;
    const res = await apiRequest("/super-admin/settings/plans", {
      method: "PUT",
      body: JSON.stringify({ plans: updatedPlans }),
    });
    isSubmitting = false;

    if (res.success) {
      saasPlans = updatedPlans;
      showPlanModal = false;
      feedbackMessage = {
        text: "Daftar paket & harga SaaS berhasil disimpan!",
        type: "success",
      };
    } else {
      feedbackMessage = {
        text: res.error || "Gagal menyimpan paket",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 4000);
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus paket sewa ini?")) return;

    const updatedPlans = saasPlans.filter((p) => p.id !== planId);
    isSubmitting = true;
    const res = await apiRequest("/super-admin/settings/plans", {
      method: "PUT",
      body: JSON.stringify({ plans: updatedPlans }),
    });
    isSubmitting = false;

    if (res.success) {
      saasPlans = updatedPlans;
      feedbackMessage = { text: "Paket berhasil dihapus!", type: "success" };
    } else {
      feedbackMessage = {
        text: res.error || "Gagal menghapus paket",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 4000);
  }

  // ==========================================
  // MIDTRANS PAYMENT GATEWAY HANDLERS
  // ==========================================
  async function handleSaveMidtrans(e: Event) {
    e.preventDefault();
    isSubmitting = true;
    const res = await apiRequest("/super-admin/settings/payment", {
      method: "PUT",
      body: JSON.stringify(midtrans),
    });
    isSubmitting = false;

    if (res.success) {
      feedbackMessage = {
        text: "Konfigurasi pembayaran Midtrans berhasil disimpan!",
        type: "success",
      };
    } else {
      feedbackMessage = {
        text: res.error || "Gagal menyimpan konfigurasi Midtrans",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  // ==========================================
  // TENANTS MANAGEMENT HANDLERS
  // ==========================================
  function openCreate() {
    newOrgName = "";
    const defaultPlan = saasPlans[0];
    newOrgPlan = defaultPlan?.name || "STARTER";
    newOrgMaxAgents = defaultPlan?.maxAgents || 5;
    newOrgDurationDays =
      defaultPlan?.durationType === "PERMANENT"
        ? 0
        : defaultPlan?.durationDays || 30;
    newOrgOwnerName = "";
    newOrgAdminEmail = "";
    newOrgAdminPassword = "";
    newOrgOwnerPhone = "";
    newOrgNotes = "";
    newOrgWabaId = "";
    newOrgPhoneNumberId = "";
    newOrgDisplayPhone = "";
    newOrgAccessToken = "";
    showCreateModal = true;
  }

  function onSelectCreatePlan(planNameOrCode: string) {
    newOrgPlan = planNameOrCode;
    const found = saasPlans.find(
      (p) => p.name === planNameOrCode || p.code === planNameOrCode,
    );
    if (found) {
      newOrgMaxAgents = found.maxAgents;
      if (found.durationType === "PERMANENT") {
        newOrgDurationDays = 0;
      } else if (found.durationDays) {
        newOrgDurationDays = found.durationDays;
      }
    }
  }

  function onSelectEditPlan(planNameOrCode: string) {
    editPlan = planNameOrCode;
    const found = saasPlans.find(
      (p) => p.name === planNameOrCode || p.code === planNameOrCode,
    );
    if (found) {
      editMaxAgents = found.maxAgents;
      editMaxBroadcast = found.maxBroadcastPerMonth;
    }
  }

  function openEdit(tenant: TenantItem) {
    activeTenant = tenant;
    editName = tenant.name;
    editPlan = tenant.plan;
    editStatus = tenant.status;
    editMaxAgents = tenant.maxAgents || 5;
    editMaxBroadcast = tenant.maxBroadcastPerMonth || 10000;
    editExpiresAt = tenant.expiresAt ? tenant.expiresAt.substring(0, 10) : "";
    editOwnerName = tenant.ownerName || "";
    editOwnerPhone = tenant.ownerPhone || "";
    editOwnerEmail = tenant.ownerEmail || "";
    editNotes = tenant.notes || "";
    editWabaId = tenant.wabaId || "";
    editAppId = tenant.appId || "";
    editAccessToken = "";
    showEditModal = true;
  }

  function openExtend(tenant: TenantItem) {
    activeTenant = tenant;
    extendDays = 30;
    showExtendModal = true;
  }

  function openUsersList(tenant: TenantItem) {
    activeTenant = tenant;
    showUsersModal = true;
  }

  function openResetPassword(tenant: TenantItem, specificUserId?: string) {
    activeTenant = tenant;
    const adminUser =
      tenant.users?.find((u) => u.role === "ADMINISTRATOR") ||
      tenant.users?.[0];
    resetUserId = specificUserId || adminUser?.id || "";
    resetPasswordNew = generateRandomPassword();
    resetSuccessInfo = null;
    showResetPasswordModal = true;
  }

  function generateRandomPassword() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
    let result = "";
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function copyToClipboard(text: string, label: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      copiedText = label;
      setTimeout(() => (copiedText = null), 2500);
    }
  }

  async function handleCreateTenant(e: Event) {
    e.preventDefault();
    if (
      !newOrgName.trim() ||
      !newOrgAdminEmail.trim() ||
      !newOrgAdminPassword.trim()
    ) {
      feedbackMessage = {
        text: "Mohon lengkapi nama organisasi, email, dan password admin!",
        type: "error",
      };
      return;
    }

    isSubmitting = true;
    const res = await apiRequest<any>("/super-admin/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: newOrgName.trim(),
        plan: newOrgPlan,
        maxAgents: Number(newOrgMaxAgents),
        durationDays: Number(newOrgDurationDays),
        ownerName: newOrgOwnerName.trim() || newOrgName.trim(),
        ownerPhone: newOrgOwnerPhone.trim(),
        adminName: newOrgOwnerName.trim() || `${newOrgName.trim()} Admin`,
        adminEmail: newOrgAdminEmail.trim(),
        adminPassword: newOrgAdminPassword.trim(),
        notes: newOrgNotes.trim(),
        wabaId: newOrgWabaId.trim() || undefined,
        phoneNumberId: newOrgPhoneNumberId.trim() || undefined,
        displayPhoneNumber: newOrgDisplayPhone.trim() || undefined,
        accessToken: newOrgAccessToken.trim() || undefined,
      }),
    });
    isSubmitting = false;

    if (res.success) {
      showCreateModal = false;
      feedbackMessage = {
        text: res.message || "Organisasi baru berhasil didaftarkan!",
        type: "success",
      };
      loadData();
    } else {
      feedbackMessage = {
        text: res.error || "Gagal mendaftarkan organisasi",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleEditTenant(e: Event) {
    e.preventDefault();
    if (!activeTenant) return;

    isSubmitting = true;
    const res = await apiRequest(
      `/super-admin/organizations/${activeTenant.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          plan: editPlan,
          status: editStatus,
          maxAgents: Number(editMaxAgents),
          maxBroadcastPerMonth: Number(editMaxBroadcast),
          expiresAt: editExpiresAt
            ? new Date(editExpiresAt).toISOString()
            : null,
          ownerName: editOwnerName.trim(),
          ownerPhone: editOwnerPhone.trim(),
          ownerEmail: editOwnerEmail.trim(),
          notes: editNotes.trim(),
          wabaId: editWabaId.trim(),
          appId: editAppId.trim(),
          accessToken: editAccessToken.trim()
            ? editAccessToken.trim()
            : undefined,
        }),
      },
    );
    isSubmitting = false;

    if (res.success) {
      showEditModal = false;
      feedbackMessage = {
        text: res.message || "Data organisasi berhasil diperbarui!",
        type: "success",
      };
      loadData();
    } else {
      feedbackMessage = {
        text: res.error || "Gagal memperbarui organisasi",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleExtend(e: Event) {
    e.preventDefault();
    if (!activeTenant) return;

    isSubmitting = true;
    const res = await apiRequest<any>(
      `/super-admin/organizations/${activeTenant.id}/extend`,
      {
        method: "POST",
        body: JSON.stringify({ days: Number(extendDays) }),
      },
    );
    isSubmitting = false;

    if (res.success) {
      showExtendModal = false;
      feedbackMessage = {
        text: res.message || "Masa aktif sewa berhasil diperpanjang!",
        type: "success",
      };
      loadData();
    } else {
      feedbackMessage = {
        text: res.error || "Gagal memperpanjang masa aktif sewa",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleToggleStatus(tenant: TenantItem) {
    const nextStatus = tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const actionName =
      nextStatus === "ACTIVE"
        ? "mengaktifkan kembali"
        : "menangguhkan (suspend)";

    if (
      !confirm(
        `Apakah Anda yakin ingin ${actionName} organisasi "${tenant.name}"?`,
      )
    )
      return;

    const res = await apiRequest(
      `/super-admin/organizations/${tenant.id}/status`,
      {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      },
    );

    if (res.success) {
      feedbackMessage = {
        text: res.message || `Status berhasil diubah`,
        type: "success",
      };
      loadData();
    } else {
      feedbackMessage = {
        text: res.error || "Gagal mengubah status organisasi",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 4000);
  }

  async function handleImpersonate(tenant: TenantItem) {
    if (
      !confirm(
        `Anda akan masuk ke dashboard sebagai Admin dari "${tenant.name}". Lanjutkan?`,
      )
    )
      return;

    const res = await apiRequest<any>(
      `/super-admin/organizations/${tenant.id}/impersonate`,
      {
        method: "POST",
      },
    );

    if (res.success && res.data?.token && res.data?.user) {
      authStore.impersonate(res.data.token, res.data.user);
      window.location.href = "/inbox";
    } else {
      feedbackMessage = {
        text: res.error || "Gagal masuk ke akun tenant",
        type: "error",
      };
      setTimeout(() => (feedbackMessage = null), 4000);
    }
  }

  async function handleResetPassword(e: Event) {
    e.preventDefault();
    if (!activeTenant || !resetPasswordNew.trim()) return;

    isSubmitting = true;
    const res = await apiRequest<any>(
      `/super-admin/organizations/${activeTenant.id}/reset-admin-password`,
      {
        method: "POST",
        body: JSON.stringify({
          userId: resetUserId || undefined,
          newPassword: resetPasswordNew.trim(),
        }),
      },
    );
    isSubmitting = false;

    if (res.success) {
      const targetUser =
        activeTenant.users?.find((u) => u.id === resetUserId) ||
        activeTenant.users?.[0];
      resetSuccessInfo = {
        email: targetUser?.email || activeTenant.ownerEmail || "admin",
        pass: resetPasswordNew.trim(),
      };
      feedbackMessage = {
        text: res.message || "Password berhasil direset!",
        type: "success",
      };
    } else {
      feedbackMessage = {
        text: res.error || "Gagal mereset password",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleDeleteTenant(tenant: TenantItem) {
    const confirmation = prompt(
      `PERINGATAN: Menghapus organisasi akan menghapus SELURUH chat, kontak, agen, dan data template di dalamnya.\n\nKetik nama organisasi "${tenant.name}" untuk konfirmasi:`,
    );

    if (confirmation !== tenant.name) {
      if (confirmation !== null)
        alert("Nama organisasi tidak cocok. Penghapusan dibatalkan.");
      return;
    }

    const res = await apiRequest(`/super-admin/organizations/${tenant.id}`, {
      method: "DELETE",
    });
    if (res.success) {
      feedbackMessage = {
        text: res.message || `Organisasi ${tenant.name} berhasil dihapus`,
        type: "success",
      };
      loadData();
    } else {
      feedbackMessage = {
        text: res.error || "Gagal menghapus organisasi",
        type: "error",
      };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  function getPrimaryAdmin(org: TenantItem) {
    return org.users?.find((u) => u.role === "ADMINISTRATOR") || org.users?.[0];
  }

  // Filtered List
  const filteredOrganizations = $derived(
    organizationsList.filter((org) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (org.name && org.name.toLowerCase().includes(q)) ||
        (org.ownerName && org.ownerName.toLowerCase().includes(q)) ||
        (org.ownerEmail && org.ownerEmail.toLowerCase().includes(q)) ||
        (org.ownerPhone && org.ownerPhone.includes(q)) ||
        (org.wabaId && org.wabaId.includes(q)) ||
        (org.users &&
          org.users.some(
            (u) =>
              (u?.email && u.email.toLowerCase().includes(q)) ||
              (u?.fullName && u.fullName.toLowerCase().includes(q)),
          ));

      const matchStatus =
        selectedStatus === "ALL" || org.status === selectedStatus;
      const matchPlan = selectedPlan === "ALL" || org.plan === selectedPlan;

      return matchSearch && matchStatus && matchPlan;
    }),
  );

  const allDistinctPlans = $derived.by(() => {
    const plansSet = new Set<string>();
    for (const p of saasPlans) if (p.name) plansSet.add(p.name);
    for (const o of organizationsList) if (o.plan) plansSet.add(o.plan);
    return Array.from(plansSet);
  });

  function getPlanBadgeClass(plan: string) {
    const upper = (plan || "").toUpperCase();
    if (
      upper.includes("ENTERPRISE") ||
      upper.includes("VIP") ||
      upper.includes("PLATINUM")
    ) {
      return "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    }
    if (
      upper.includes("BUSINESS") ||
      upper.includes("PRO") ||
      upper.includes("GOLD")
    ) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
    if (
      upper.includes("STARTER") ||
      upper.includes("BASIC") ||
      upper.includes("STANDARD")
    ) {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    }
    if (
      upper.includes("TRIAL") ||
      upper.includes("PROMO") ||
      upper.includes("GRATIS") ||
      upper.includes("FREE")
    ) {
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }
    return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "SUSPENDED":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "EXPIRED":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "TRIAL":
        return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  }

  function formatRupiah(amount: number) {
    if (amount === 0) return "Gratis (Rp 0)";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  }
</script>

<svelte:head>
  <title>Portal Master Administrator — WhatsApp CRM SaaS</title>
</svelte:head>

<div
  class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200"
>
  {#if !isSuperAdminLoggedIn}
    <!-- Top Master Navigation Bar for Login -->
    <header
      class="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs"
    >
      <div class="flex items-center gap-3.5">
        <div
          class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25"
        >
          <Shield class="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h1
            class="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase"
          >
            Portal Kontrol Master SaaS
          </h1>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">
            Pusat Manajemen Seluruh Organisasi, Paket Sewa, & Integrasi WhatsApp
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <button
          onclick={() => themeStore.toggle()}
          class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          title="Ubah Tema Light / Dark"
        >
          {#if themeStore.current === "dark"}
            <Sun class="w-4 h-4 text-amber-400" />
          {:else}
            <Moon class="w-4 h-4 text-indigo-600" />
          {/if}
        </button>
      </div>
    </header>
  {/if}

  <!-- Content Area -->
  {#if !isSuperAdminLoggedIn}
    <!-- ========================================================= -->
    <!-- DEDICATED SUPER ADMIN LOGIN GATE                          -->
    <!-- ========================================================= -->
    <div
      class="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
    >
      <!-- Glow effects -->
      <div
        class="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"
      ></div>

      <div class="w-full max-w-md relative z-10 my-8">
        <!-- Logo & Title -->
        <div class="text-center mb-6">
          <div
            class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 items-center justify-center shadow-xl shadow-indigo-500/25 text-white mb-3"
          >
            <Shield class="w-7 h-7 stroke-[2.5]" />
          </div>
          <h2
            class="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white"
          >
            Autentikasi Master Super Admin
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Masuk untuk mengelola seluruh organisasi & kontrol sewa SaaS
          </p>
        </div>

        <!-- Login Card -->
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5"
        >
          {#if loginError}
            <div
              class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{loginError}</span>
            </div>
          {/if}

          <form onsubmit={handleSuperAdminLogin} class="space-y-4">
            <div>
              <label
                for="super_email"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >Email Super Admin</label
              >
              <div class="relative">
                <Mail
                  class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="super_email"
                  type="email"
                  bind:value={loginEmail}
                  placeholder="admin@perusahaan.com"
                  class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                  required
                />
              </div>
            </div>

            <div>
              <label
                for="super_pwd"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >Password Super Admin</label
              >
              <div class="relative">
                <Lock
                  class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="super_pwd"
                  type={showPassword ? "text" : "password"}
                  bind:value={loginPassword}
                  placeholder="Masukkan password admin..."
                  class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                  required
                />
                <button
                  type="button"
                  onclick={() => (showPassword = !showPassword)}
                  class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {#if showPassword}
                    <EyeOff class="w-4 h-4" />
                  {:else}
                    <Eye class="w-4 h-4" />
                  {/if}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              class="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 cursor-pointer"
            >
              {#if loginLoading}
                <div
                  class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"
                ></div>
                <span>Memverifikasi Akses...</span>
              {:else}
                <span>Masuk ke Portal Master</span>
                <ArrowRight class="w-4 h-4" />
              {/if}
            </button>
          </form>

          <div
            class="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center"
          >
            <p class="text-[11px] text-slate-400">
              Kredensial Default: <span class="font-mono text-indigo-500"
                >admin@perusahaan.com</span
              >
              / <span class="font-mono text-indigo-500">admin12345</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- ========================================================= -->
    <!-- MASTER SUPER ADMIN DASHBOARD: SIDEBAR + CONTENT           -->
    <!-- ========================================================= -->
    <div class="flex-1 flex flex-col md:flex-row min-h-screen w-full relative">
      <!-- Backdrop overlay on Mobile when sidebar is open -->
      {#if mobileSidebarOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40"
          onclick={() => (mobileSidebarOpen = false)}
        ></div>
      {/if}

      <!-- Enterprise Left Sidebar -->
      <aside
        class="fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 h-screen {mobileSidebarOpen
          ? 'translate-x-0 shadow-2xl'
          : '-translate-x-full md:translate-x-0'}"
      >
        <!-- Top Section: Brand & User Info -->
        <div
          class="p-5 border-b border-slate-100 dark:border-slate-800/80 shrink-0"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20"
              >
                <Shield class="w-5 h-5 stroke-[2.5]" />
              </div>
              <div class="min-w-0">
                <h1
                  class="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white truncate"
                >
                  WA CRM Master
                </h1>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span
                    class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                  ></span>
                  <span
                    class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                    >Super Administrator</span
                  >
                </div>
              </div>
            </div>

            <!-- Close button for mobile -->
            <button
              onclick={() => (mobileSidebarOpen = false)}
              class="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Staff User Status Card -->
          <div
            class="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                >{authStore.user?.fullName || "Super Admin"}</span
              >
              <span
                class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 shrink-0"
              >
                {authStore.user?.role || "SUPER_ADMIN"}
              </span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono truncate">
              {authStore.user?.email || "admin@perusahaan.com"}
            </div>
          </div>
        </div>

        <!-- Middle Section: Navigation Menu Items -->
        <div class="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          <!-- Group 1: MANAJEMEN SAAS -->
          <div class="space-y-1">
            <div
              class="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2"
            >
              Manajemen SaaS
            </div>
            <button
              onclick={() => {
                activeTab = "tenants";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {activeTab ===
              'tenants'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <Building2
                  class="w-4 h-4 {activeTab === 'tenants'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Organisasi Klien</span>
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-bold {activeTab ===
                'tenants'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
              >
                {organizationsList.length}
              </span>
            </button>

            <button
              onclick={() => {
                activeTab = "plans";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {activeTab ===
              'plans'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <Package
                  class="w-4 h-4 {activeTab === 'plans'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Paket & Promo SaaS</span>
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-bold {activeTab ===
                'plans'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
              >
                {saasPlans.length}
              </span>
            </button>
          </div>

          <!-- Group 2: BILLING & KEUANGAN -->
          <div class="space-y-1">
            <div
              class="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2"
            >
              Billing & Keuangan
            </div>
            <button
              onclick={() => {
                activeTab = "transactions";
                loadTransactions();
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {activeTab ===
              'transactions'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <Receipt
                  class="w-4 h-4 {activeTab === 'transactions'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Transaksi & Omset</span>
              </div>
              {#if transactionSummary.pendingCount > 0}
                <span
                  class="text-[9px] px-1.5 py-0.5 rounded-full font-extrabold bg-amber-500 text-slate-950 animate-pulse"
                >
                  {transactionSummary.pendingCount} Pending
                </span>
              {:else}
                <span
                  class="text-[10px] px-2 py-0.5 rounded-full font-bold {activeTab ===
                  'transactions'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
                >
                  {transactionsList.length}
                </span>
              {/if}
            </button>

            <button
              onclick={() => {
                activeTab = "midtrans";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {activeTab ===
              'midtrans'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <Wallet
                  class="w-4 h-4 {activeTab === 'midtrans'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Gateway Midtrans</span>
              </div>
              {#if midtrans.isEnabled}
                <span
                  class="w-2 h-2 rounded-full bg-emerald-400 shadow-sm animate-pulse"
                ></span>
              {/if}
            </button>
          </div>

          <!-- Group 3: ADMINISTRASI & STAF -->
          <div class="space-y-1">
            <div
              class="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2"
            >
              Administrasi & Tim
            </div>
            <button
              onclick={() => {
                activeTab = "staff";
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {activeTab ===
              'staff'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <ShieldCheck
                  class="w-4 h-4 {activeTab === 'staff'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Tim & Staf Admin</span>
              </div>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-bold {activeTab ===
                'staff'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}"
              >
                {staffList.length}
              </span>
            </button>

            <!-- Menu Update Sistem (GitHub) — HANYA Administrator Utama -->
            {#if authStore.isPrimaryAdmin}
            <button
              onclick={() => {
                activeTab = "system_update";
                loadGitStatus();
                mobileSidebarOpen = false;
              }}
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer {activeTab ===
              'system_update'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}"
            >
              <div class="flex items-center gap-2.5">
                <GitBranch
                  class="w-4 h-4 {activeTab === 'system_update'
                    ? 'text-white'
                    : 'text-slate-400'}"
                />
                <span>Update Sistem (GitHub)</span>
              </div>
              <span
                class="text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider {activeTab ===
                'system_update'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'}"
              >
                Root Only
              </span>
            </button>
            {/if}
          </div>
        </div>

        <!-- Bottom Section: System Status Indicator -->
        <div class="p-4 border-t border-slate-100 dark:border-slate-800/80 shrink-0">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-bold text-slate-700 dark:text-slate-300">Engine Platform</span>
              <span class="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-[10px]">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                v2.4 Online
              </span>
            </div>
            <div class="text-[10px] text-slate-400">
              Administrator Platform Independen
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content Container with Top Executive Navbar -->
      <div class="flex-1 flex flex-col min-w-0 min-h-screen">
        <!-- Top Executive Navbar -->
        <header
          class="sticky top-0 z-30 h-16 px-4 sm:px-8 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 shrink-0"
        >
          <!-- Left: Mobile Menu Toggle & Breadcrumb -->
          <div class="flex items-center gap-3">
            <button
              onclick={() => (mobileSidebarOpen = !mobileSidebarOpen)}
              class="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              title="Menu Navigasi"
            >
              <Menu class="w-4 h-4" />
            </button>

            <!-- Breadcrumb / Section Badge -->
            <div class="flex items-center gap-2 text-xs">
              <span class="font-bold text-slate-400 dark:text-slate-500 hidden sm:inline">
                Portal Master
              </span>
              <span class="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
              <span class="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                {#if activeTab === "tenants"}
                  <Building2 class="w-4 h-4 text-indigo-500" />
                  <span>Manajemen Organisasi Klien</span>
                {:else if activeTab === "plans"}
                  <Package class="w-4 h-4 text-indigo-500" />
                  <span>Pengaturan Paket & Promo SaaS</span>
                {:else if activeTab === "transactions"}
                  <Receipt class="w-4 h-4 text-indigo-500" />
                  <span>Pusat Transaksi & Omset</span>
                {:else if activeTab === "midtrans"}
                  <Wallet class="w-4 h-4 text-indigo-500" />
                  <span>Channel Pembayaran Midtrans</span>
                {:else if activeTab === "staff"}
                  <ShieldCheck class="w-3.5 h-3.5 text-indigo-500" />
                  <span>Tim & Staf Administrator</span>
                {:else if activeTab === "system_update"}
                  <GitBranch class="w-3.5 h-3.5 text-indigo-500" />
                  <span>Pusat Update Sistem (GitHub)</span>
                {/if}
              </span>
            </div>
          </div>

          <!-- Right: Theme Switcher, Account Profile Pill, Logout -->
          <div class="flex items-center gap-2 sm:gap-3">
            <!-- Theme Switcher -->
            <button
              onclick={() => themeStore.toggle()}
              class="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 transition cursor-pointer"
              title="Ubah Tema Mode Terang / Gelap"
            >
              {#if themeStore.current === "dark"}
                <Sun class="w-4 h-4 text-amber-400" />
              {:else}
                <Moon class="w-4 h-4 text-indigo-600" />
              {/if}
            </button>

            <!-- Separator -->
            <div class="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

            <!-- Profile & Account Settings Action Pill -->
            <button
              onclick={openSuperAdminProfile}
              class="flex items-center gap-2.5 py-1.5 pl-1.5 pr-3 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 transition cursor-pointer"
              title="Ubah Profil Akun, Email & Password Saya"
            >
              <div
                class="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs"
              >
                {(authStore.user?.fullName || "A")[0].toUpperCase()}
              </div>
              <div class="text-left hidden md:block">
                <div class="text-xs font-bold leading-tight truncate max-w-[120px]">
                  {authStore.user?.fullName || "Super Admin"}
                </div>
                <div class="text-[9px] text-slate-400 font-semibold leading-tight">
                  {authStore.user?.role || "SUPER_ADMIN"}
                </div>
              </div>
              <UserCog class="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            </button>

            <!-- Logout Button -->
            <button
              onclick={() => {
                authStore.logout();
                goto("/administrator/login");
              }}
              class="p-2 sm:p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
              title="Keluar / Logout"
            >
              <LogOut class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- Main Content Area -->
        <main
          class="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-8 space-y-6 overflow-y-auto"
        >

      <!-- Feedback Banner -->
      {#if feedbackMessage}
        <div
          class="p-4 rounded-2xl flex items-center gap-3 border text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 {feedbackMessage.type ===
          'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'}"
        >
          {#if feedbackMessage.type === "success"}
            <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
          {:else}
            <AlertTriangle class="w-4 h-4 text-rose-500 shrink-0" />
          {/if}
          <span class="flex-1">{feedbackMessage.text}</span>
          <button
            onclick={() => (feedbackMessage = null)}
            class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 1: MANAJEMEN TENANT & ORGANISASI                      -->
      <!-- ========================================================= -->
      {#if activeTab === "tenants"}
        <!-- Top Action Banner -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <div class="space-y-1">
            <h2
              class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <span>Manajemen Organisasi Klien</span>
              <span
                class="text-xs font-normal text-slate-500 dark:text-slate-400"
                >({filteredOrganizations.length} Terdaftar)</span
              >
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Kelola aktivasi sewa, integrasi Meta WhatsApp API, akun admin
              login, dan reset password user.
            </p>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              onclick={loadData}
              disabled={isLoading}
              class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw class="w-4 h-4 {isLoading ? 'animate-spin' : ''}" />
              <span>Refresh</span>
            </button>

            <button
              onclick={openCreate}
              class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              <Plus class="w-4 h-4 stroke-[3]" />
              <span>+ Daftarkan Organisasi Baru</span>
            </button>
          </div>
        </div>

        <!-- Platform Overview KPI Cards -->
        {#if overview}
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Card 1: Total Tenants -->
            <div
              class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
            >
              <div
                class="flex items-center justify-between text-slate-500 dark:text-slate-400"
              >
                <span class="text-xs font-bold uppercase tracking-wider"
                  >Total Klien / Tenant</span
                >
                <div
                  class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                >
                  <Building2 class="w-4 h-4" />
                </div>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-slate-900 dark:text-white"
                  >{overview.totalOrganizations}</span
                >
                <span
                  class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  {overview.activeOrganizations} Aktif
                </span>
              </div>
              <div
                class="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80"
              >
                <span>{overview.trialOrganizations} Trial</span>
                <span>•</span>
                <span class="text-rose-500 dark:text-rose-400 font-medium"
                  >{overview.suspendedOrganizations} Suspend</span
                >
                <span>•</span>
                <span class="text-amber-500 dark:text-amber-400 font-medium"
                  >{overview.expiredOrganizations} Expired</span
                >
              </div>
            </div>

            <!-- Card 2: Platform Agents -->
            <div
              class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
            >
              <div
                class="flex items-center justify-between text-slate-500 dark:text-slate-400"
              >
                <span class="text-xs font-bold uppercase tracking-wider"
                  >Total Kursi Agen CS</span
                >
                <div
                  class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <Users class="w-4 h-4" />
                </div>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-slate-900 dark:text-white"
                  >{overview.totalAgents}</span
                >
                <span class="text-[11px] text-slate-500 dark:text-slate-400"
                  >dari {overview.totalUsers} akun</span
                >
              </div>
              <div
                class="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80"
              >
                Agen aktif menangani chat di seluruh tenant
              </div>
            </div>

            <!-- Card 3: Platform Chats -->
            <div
              class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
            >
              <div
                class="flex items-center justify-between text-slate-500 dark:text-slate-400"
              >
                <span class="text-xs font-bold uppercase tracking-wider"
                  >Total Pesan Platform</span
                >
                <div
                  class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400"
                >
                  <MessageSquare class="w-4 h-4" />
                </div>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-slate-900 dark:text-white"
                  >{overview.totalMessages.toLocaleString("id-ID")}</span
                >
                <span class="text-[11px] text-slate-500 dark:text-slate-400"
                  >pesan</span
                >
              </div>
              <div
                class="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80"
              >
                Dari {overview.totalConversations.toLocaleString("id-ID")} sesi chat
              </div>
            </div>

            <!-- Card 4: Expiring Alert -->
            <div
              class="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-indigo-500/30 shadow-md space-y-2"
            >
              <div class="flex items-center justify-between text-slate-300">
                <span class="text-xs font-bold uppercase tracking-wider"
                  >Segera Habis (&le; 7 Hari)</span
                >
                <div class="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Clock class="w-4 h-4" />
                </div>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-amber-400"
                  >{overview.expiringSoonCount}</span
                >
                <span class="text-[11px] text-slate-300">organisasi</span>
              </div>
              <div
                class="text-[10px] text-slate-400 pt-1 border-t border-slate-800"
              >
                {overview.expiringSoonCount > 0
                  ? "Perlu follow-up pembayaran sewa"
                  : "Semua sewa tenant aman"}
              </div>
            </div>
          </div>
        {/if}

        <!-- Search & Filter Controls -->
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3"
        >
          <!-- Search Bar -->
          <div class="relative flex-1 w-full">
            <Search
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Cari organisasi, email admin login, nama PIC, no WhatsApp, atau WABA ID..."
              class="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <!-- Filters -->
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <select
              bind:value={selectedStatus}
              class="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif (Active)</option>
              <option value="TRIAL">Masa Uji Coba (Trial)</option>
              <option value="SUSPENDED">Ditangguhkan (Suspended)</option>
              <option value="EXPIRED">Sewa Kadaluarsa (Expired)</option>
            </select>

            <select
              bind:value={selectedPlan}
              class="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-full sm:w-auto font-semibold"
            >
              <option value="ALL"
                >Semua Paket ({allDistinctPlans.length})</option
              >
              {#each allDistinctPlans as pName}
                <option value={pName}>{pName}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Organizations Table -->
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
        >
          <div class="overflow-x-auto">
            <table
              class="w-full text-left text-xs text-slate-700 dark:text-slate-300"
            >
              <thead
                class="bg-slate-50 dark:bg-slate-950/90 font-bold text-[11px] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider"
              >
                <tr>
                  <th class="py-3.5 px-4">Organisasi & Akun Admin Login</th>
                  <th class="py-3.5 px-4">Integrasi Meta WABA</th>
                  <th class="py-3.5 px-4">Paket & Tim</th>
                  <th class="py-3.5 px-4">Masa Sewa</th>
                  <th class="py-3.5 px-4">Status</th>
                  <th class="py-3.5 px-4 text-right">Tindakan Super Admin</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                {#if isLoading}
                  <tr>
                    <td colspan="6" class="py-12 text-center text-slate-400">
                      <RefreshCw
                        class="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500"
                      />
                      <span>Memuat data organisasi penyewa...</span>
                    </td>
                  </tr>
                {:else if filteredOrganizations.length === 0}
                  <tr>
                    <td colspan="6" class="py-12 text-center text-slate-400">
                      <Building2
                        class="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400"
                      />
                      <p class="font-bold text-slate-700 dark:text-slate-300">
                        Tidak ada organisasi yang sesuai filter
                      </p>
                      <p class="text-[11px] text-slate-400 mt-0.5">
                        Coba ubah kata kunci pencarian atau daftarkan tenant
                        baru.
                      </p>
                    </td>
                  </tr>
                {:else}
                  {#each filteredOrganizations as org (org.id)}
                    {@const primaryAdmin = getPrimaryAdmin(org)}
                    {@const phoneItem = org.phoneNumbers?.[0]}
                    <tr
                      class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <!-- Org Info & PIC & Admin Login Account -->
                      <td class="py-3.5 px-4">
                        <div class="flex items-start gap-3">
                          <div
                            class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs mt-0.5"
                          >
                            {org.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div class="space-y-1.5 min-w-0">
                            <div
                              class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate"
                            >
                              <span>{org.name}</span>
                              {#if org.hasAccessToken}
                                <span
                                  class="w-2 h-2 rounded-full bg-emerald-500 inline-block"
                                  title="Access Token Terhubung"
                                ></span>
                              {/if}
                            </div>

                            <!-- Primary Admin Account Box -->
                            <div
                              class="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1"
                            >
                              <div
                                class="flex items-center justify-between gap-2"
                              >
                                <span
                                  class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1"
                                >
                                  <Shield class="w-3 h-3" />
                                  Admin Login:
                                </span>
                                {#if primaryAdmin}
                                  <button
                                    type="button"
                                    onclick={() =>
                                      copyToClipboard(
                                        primaryAdmin.email,
                                        `email_${primaryAdmin.id}`,
                                      )}
                                    class="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer font-medium"
                                    title="Salin Email Admin"
                                  >
                                    {#if copiedText === `email_${primaryAdmin.id}`}
                                      <Check class="w-3 h-3 text-emerald-500" />
                                      <span class="text-emerald-500"
                                        >Tersalin</span
                                      >
                                    {:else}
                                      <Copy class="w-3 h-3" />
                                      <span>Salin</span>
                                    {/if}
                                  </button>
                                {/if}
                              </div>
                              <div
                                class="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 truncate"
                              >
                                <Mail
                                  class="w-3.5 h-3.5 text-slate-400 shrink-0"
                                />
                                <span class="truncate"
                                  >{primaryAdmin?.email ||
                                    org.ownerEmail ||
                                    "Belum ada akun admin"}</span
                                >
                              </div>
                              <div
                                class="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
                              >
                                <span
                                  >PIC: <strong
                                    >{primaryAdmin?.fullName ||
                                      org.ownerName ||
                                      "Admin"}</strong
                                  ></span
                                >
                                {#if org.ownerPhone}
                                  <span>•</span>
                                  <span class="font-mono">{org.ownerPhone}</span
                                  >
                                {/if}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      <!-- Meta Integration Column -->
                      <td class="py-3.5 px-4">
                        <div class="space-y-1.5">
                          <button
                            type="button"
                            onclick={() => openMetaWizard(org)}
                            class="py-1.5 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer {org.hasAccessToken &&
                            org.wabaId
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'}"
                          >
                            <Link2 class="w-3.5 h-3.5" />
                            <span
                              >{org.hasAccessToken && org.wabaId
                                ? "Meta Terhubung"
                                : "Hubungkan Meta"}</span
                            >
                          </button>

                          {#if phoneItem?.displayPhoneNumber}
                            <div
                              class="text-[11px] font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1"
                            >
                              <Phone class="w-3 h-3 text-slate-400" />
                              <span>{phoneItem.displayPhoneNumber}</span>
                            </div>
                          {/if}

                          {#if org.wabaId}
                            <div
                              class="text-[10px] font-mono text-slate-400 truncate max-w-[160px]"
                              title="Meta WABA Account ID: {org.wabaId}"
                            >
                              WABA ID: {org.wabaId}
                            </div>
                          {/if}

                          {#if phoneItem?.phoneNumberId}
                            <div
                              class="text-[10px] font-mono text-slate-400 truncate max-w-[160px]"
                              title="Phone Number ID: {phoneItem.phoneNumberId}"
                            >
                              Phone ID: {phoneItem.phoneNumberId}
                            </div>
                          {/if}
                        </div>
                      </td>

                      <!-- Plan & Users Team Count -->
                      <td class="py-3.5 px-4">
                        <div class="space-y-1.5">
                          <span
                            class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border {getPlanBadgeClass(
                              org.plan,
                            )}"
                          >
                            {org.plan}
                          </span>

                          <button
                            type="button"
                            onclick={() => openUsersList(org)}
                            class="w-full text-left p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center justify-between gap-1 font-semibold transition cursor-pointer"
                            title="Lihat seluruh daftar user / agen di organisasi ini"
                          >
                            <div class="flex items-center gap-1">
                              <Users class="w-3.5 h-3.5 text-slate-400" />
                              <span
                                >{org.users?.length || 0} / {org.maxAgents} User</span
                              >
                            </div>
                            <ArrowRight class="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      <!-- Subscription Expiry -->
                      <td class="py-3.5 px-4">
                        <div class="space-y-1">
                          {#if org.expiresAt}
                            <div
                              class="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200"
                            >
                              {new Date(org.expiresAt).toLocaleDateString(
                                "id-ID",
                                { dateStyle: "medium" },
                              )}
                            </div>
                            <div>
                              {#if org.isExpired || (org.daysRemaining !== null && org.daysRemaining < 0)}
                                <span
                                  class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                >
                                  Kadaluarsa
                                </span>
                              {:else if org.daysRemaining !== null && org.daysRemaining <= 7}
                                <span
                                  class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                                >
                                  Sisa {org.daysRemaining} Hari
                                </span>
                              {:else if org.daysRemaining !== null}
                                <span
                                  class="text-[10px] text-slate-400 font-mono"
                                >
                                  Sisa {org.daysRemaining} hari
                                </span>
                              {/if}
                            </div>
                          {:else}
                            <span class="text-[11px] text-slate-400 italic"
                              >Tanpa Batas</span
                            >
                          {/if}
                        </div>
                      </td>

                      <!-- Status -->
                      <td class="py-3.5 px-4">
                        <span
                          class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border {getStatusBadgeClass(
                            org.status,
                          )}"
                        >
                          {org.status}
                        </span>
                      </td>

                      <!-- Actions -->
                      <td class="py-3.5 px-4 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          <!-- Impersonate Button -->
                          <button
                            onclick={() => handleImpersonate(org)}
                            class="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                            title="Masuk ke Dashboard Organisasi Ini (Impersonate)"
                          >
                            <LogIn class="w-4 h-4" />
                          </button>

                          <!-- Meta Integration Wizard Button -->
                          <button
                            onclick={() => openMetaWizard(org)}
                            class="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                            title="Integrasi & Uji Meta WhatsApp API"
                          >
                            <Network class="w-4 h-4" />
                          </button>

                          <!-- View Users & Reset Password Button -->
                          <button
                            onclick={() => openUsersList(org)}
                            class="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                            title="Lihat Akun & Reset Password User Tenant"
                          >
                            <Key class="w-4 h-4" />
                          </button>

                          <!-- Extend Subscription Button -->
                          <button
                            onclick={() => openExtend(org)}
                            class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            title="Perpanjang Masa Aktif Sewa"
                          >
                            <Calendar class="w-4 h-4" />
                          </button>

                          <!-- Change / Upgrade Plan Button -->
                          <button
                            onclick={() => openChangePlanModal(org)}
                            class="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                            title="Ganti / Upgrade Paket SaaS Organisasi Ini"
                          >
                            <PackagePlus class="w-4 h-4" />
                          </button>

                          <!-- Edit Details Button -->
                          <button
                            onclick={() => openEdit(org)}
                            class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                            title="Edit Profil Organisasi"
                          >
                            <Edit3 class="w-4 h-4" />
                          </button>

                          <!-- Toggle Suspend Button -->
                          <button
                            onclick={() => handleToggleStatus(org)}
                            class="p-2 rounded-lg {org.status === 'ACTIVE'
                              ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'} transition cursor-pointer"
                            title={org.status === "ACTIVE"
                              ? "Tangguhkan / Suspend Organisasi Ini"
                              : "Aktifkan Kembali Organisasi Ini"}
                          >
                            {#if org.status === "ACTIVE"}
                              <Lock class="w-4 h-4" />
                            {:else}
                              <Unlock class="w-4 h-4" />
                            {/if}
                          </button>

                          <!-- Delete Button -->
                          <button
                            onclick={() => handleDeleteTenant(org)}
                            class="p-2 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                            title="Hapus Organisasi"
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 2: PENGATURAN PAKET & HARGA SEWA SAAS                 -->
      <!-- ========================================================= -->
      {#if activeTab === "plans"}
        <div class="space-y-6">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div>
              <h2
                class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <Package class="w-5 h-5 text-indigo-500" />
                <span>Katalog Paket Sewa & Paket Promosi SaaS</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Atur harga langganan bulanan, paket promosi gratis (Rp 0), kuota
                agen CS, limit broadcast, dan benefit klien.
              </p>
            </div>

            <div class="flex items-center gap-2.5">
              <button
                onclick={() => openCreatePlan(true)}
                class="py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
              >
                <Gift class="w-4 h-4" />
                <span>+ Buat Paket Promo (Gratis)</span>
              </button>

              <button
                onclick={() => openCreatePlan(false)}
                class="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition cursor-pointer"
              >
                <Plus class="w-4 h-4 stroke-[3]" />
                <span>+ Buat Paket Sewa Baru</span>
              </button>
            </div>
          </div>

          <!-- Plans Grid Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {#each saasPlans as plan (plan.id)}
              <div
                class="bg-white dark:bg-slate-900 rounded-2xl border transition relative flex flex-col p-6 shadow-sm {plan.isPopular
                  ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}"
              >
                {#if plan.isPopular}
                  <span
                    class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-md"
                  >
                    Paling Populer
                  </span>
                {/if}

                {#if plan.price === 0}
                  <span
                    class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 shadow-md flex items-center gap-1"
                  >
                    <Gift class="w-3 h-3" />
                    Promo / Gratis
                  </span>
                {/if}

                <!-- Card Header -->
                <div
                  class="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4"
                >
                  <div
                    class="flex items-center justify-between gap-2 flex-wrap"
                  >
                    <span
                      class="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border {getPlanBadgeClass(
                        plan.code,
                      )}"
                    >
                      {plan.code}
                    </span>
                    <div class="flex items-center gap-1.5">
                      {#if plan.isPublic === false}
                        <span
                          class="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1"
                          title="Hanya tampil untuk Super Admin (Tidak muncul di katalog tenant)"
                        >
                          <Lock class="w-3 h-3 text-amber-500" />
                          Khusus Admin
                        </span>
                      {:else}
                        <span
                          class="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1"
                          title="Tampil di menu langganan seluruh tenant"
                        >
                          <Globe class="w-3 h-3 text-emerald-500" />
                          Publik
                        </span>
                      {/if}

                      {#if !plan.isActive}
                        <span
                          class="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded"
                          >Nonaktif</span
                        >
                      {/if}
                    </div>
                  </div>
                  <h3 class="text-lg font-black text-slate-900 dark:text-white">
                    {plan.name}
                  </h3>
                  <p
                    class="text-xs text-slate-500 dark:text-slate-400 min-h-[36px] line-clamp-2"
                  >
                    {plan.description || "Tidak ada deskripsi"}
                  </p>
                </div>

                <!-- Price -->
                <div class="mb-5">
                  <div class="flex items-baseline gap-1">
                    <span
                      class="text-2xl font-black text-slate-900 dark:text-white"
                      >{formatRupiah(plan.price)}</span
                    >
                    <span class="text-xs text-slate-400"
                      >/{plan.period || "bulan"}</span
                    >
                  </div>
                  <div
                    class="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"
                  >
                    <Users class="w-3.5 h-3.5" />
                    <span>Maksimal {plan.maxAgents} Kursi Agen CS</span>
                  </div>
                  <div
                    class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5"
                  >
                    <Radio class="w-3.5 h-3.5" />
                    <span
                      >{plan.maxBroadcastPerMonth.toLocaleString("id-ID")} Broadcast
                      / Bulan</span
                    >
                  </div>
                </div>

                <!-- Feature List -->
                <div class="space-y-2.5 flex-1 mb-6">
                  <span
                    class="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                    >Fitur Termasuk:</span
                  >
                  {#each plan.features as feat}
                    <div
                      class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <CheckCircle
                        class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"
                      />
                      <span>{feat}</span>
                    </div>
                  {/each}
                </div>

                <!-- Card Footer Actions -->
                <div
                  class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
                >
                  <button
                    onclick={() => openEditPlan(plan)}
                    class="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                    <span>Edit Paket</span>
                  </button>
                  <button
                    onclick={() => handleDeletePlan(plan.id)}
                    class="p-2 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Hapus Paket"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 3: RIWAYAT TRANSAKSI & OMSET PEMBAYARAN SAAS          -->
      <!-- ========================================================= -->
      {#if activeTab === "transactions"}
        <!-- Top Action Banner -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h2
                class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <Receipt class="w-5 h-5 text-indigo-500" />
                <span>Pusat Transaksi & Pembayaran Langganan SaaS</span>
                <span class="text-xs font-normal text-slate-500"
                  >({transactionsList.length} Transaksi)</span
                >
              </h2>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Pencatatan riwayat pesanan paket seluruh penyewa (tenant),
              monitoring omset, dan konfirmasi manual transfer bank.
            </p>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              onclick={loadTransactions}
              disabled={transactionsLoading}
              class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                class="w-4 h-4 {transactionsLoading ? 'animate-spin' : ''}"
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- Financial Summary KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
          >
            <div
              class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"
            >
              <Wallet class="w-5 h-5" />
            </div>
            <div>
              <div
                class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Total Omset (Lunas)
              </div>
              <div
                class="text-base font-extrabold text-slate-900 dark:text-white font-mono"
              >
                {formatRupiah(transactionSummary.totalRevenue)}
              </div>
            </div>
          </div>

          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
          >
            <div
              class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
            >
              <CheckCircle class="w-5 h-5" />
            </div>
            <div>
              <div
                class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Transaksi Lunas (PAID)
              </div>
              <div
                class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
              >
                {transactionSummary.paidCount}
              </div>
            </div>
          </div>

          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
          >
            <div
              class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"
            >
              <Clock class="w-5 h-5" />
            </div>
            <div>
              <div
                class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Menunggu Bayar (PENDING)
              </div>
              <div
                class="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono"
              >
                {transactionSummary.pendingCount}
              </div>
            </div>
          </div>

          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
          >
            <div
              class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"
            >
              <XCircle class="w-5 h-5" />
            </div>
            <div>
              <div
                class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Gagal / Kadaluarsa
              </div>
              <div
                class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
              >
                {transactionSummary.failedCount}
              </div>
            </div>
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
        >
          <div class="relative w-full sm:w-80">
            <Search
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              bind:value={transactionSearchQuery}
              placeholder="Cari no invoice, tenant, atau paket..."
              class="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <label
              for="tx_status_filter"
              class="text-xs font-semibold text-slate-500 shrink-0"
              >Status:</label
            >
            <select
              id="tx_status_filter"
              bind:value={transactionStatusFilter}
              class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="ALL"
                >Semua Status ({transactionsList.length})</option
              >
              <option value="PENDING">PENDING (Menunggu Pembayaran)</option>
              <option value="PAID">PAID (Lunas & Aktif)</option>
              <option value="EXPIRED">EXPIRED (Kadaluarsa)</option>
              <option value="FAILED">FAILED (Gagal)</option>
              <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
            </select>
          </div>
        </div>

        <!-- Transaction Table -->
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
        >
          {#if transactionsLoading && transactionsList.length === 0}
            <div class="p-12 text-center space-y-3">
              <div
                class="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"
              ></div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Memuat data transaksi platform...
              </p>
            </div>
          {:else if filteredTransactions.length === 0}
            <div class="p-12 text-center space-y-3">
              <div
                class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto"
              >
                <Receipt class="w-6 h-6" />
              </div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                Tidak Ada Transaksi Ditemukan
              </h3>
              <p
                class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto"
              >
                {transactionSearchQuery
                  ? "Tidak ada transaksi yang cocok dengan kriteria pencarian."
                  : "Belum ada transaksi pemesanan paket dari tenant."}
              </p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead
                  class="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]"
                >
                  <tr>
                    <th class="px-5 py-3.5">No. Invoice & Waktu</th>
                    <th class="px-4 py-3.5">Organisasi Klien</th>
                    <th class="px-4 py-3.5">Paket & Durasi</th>
                    <th class="px-4 py-3.5">Nominal Tagihan</th>
                    <th class="px-4 py-3.5">Metode Bayar</th>
                    <th class="px-4 py-3.5">Status</th>
                    <th class="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                  {#each filteredTransactions as tx (tx.id)}
                    <tr
                      class="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition"
                    >
                      <td class="px-5 py-3.5">
                        <div
                          class="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5"
                        >
                          <Receipt
                            class="w-3.5 h-3.5 text-slate-400 shrink-0"
                          />
                          <span>{tx.orderNumber}</span>
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">
                          {new Date(tx.createdAt).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                      </td>

                      <td class="px-4 py-3.5">
                        <div class="font-bold text-slate-900 dark:text-white">
                          {tx.organizationName || "Organisasi Terhapus"}
                        </div>
                        <div
                          class="text-[11px] text-slate-500 dark:text-slate-400 font-mono"
                        >
                          {tx.userEmail || tx.userName || "-"}
                        </div>
                      </td>

                      <td class="px-4 py-3.5">
                        <div class="font-bold text-slate-900 dark:text-white">
                          {tx.planName}
                        </div>
                        <span
                          class="inline-block px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider border {getPlanBadgeClass(
                            tx.planCode,
                          )}"
                        >
                          {tx.planCode} ({tx.durationDays === 0
                            ? "Permanen"
                            : `${tx.durationDays} Hari`})
                        </span>
                      </td>

                      <td
                        class="px-4 py-3.5 font-bold font-mono text-slate-900 dark:text-white"
                      >
                        {formatRupiah(tx.amount)}
                      </td>

                      <td
                        class="px-4 py-3.5 text-slate-600 dark:text-slate-300 capitalize text-[11px]"
                      >
                        {tx.paymentMethod
                          ? tx.paymentMethod.replace(/_/g, " ")
                          : "Online / Midtrans"}
                      </td>

                      <td class="px-4 py-3.5">
                        {#if tx.paymentStatus === "PAID"}
                          <span
                            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          >
                            <CheckCircle class="w-3.5 h-3.5" />
                            <span>LUNAS (Aktif)</span>
                          </span>
                        {:else if tx.paymentStatus === "PENDING"}
                          <span
                            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                          >
                            <Clock class="w-3.5 h-3.5" />
                            <span>Menunggu Pembayaran</span>
                          </span>
                        {:else if tx.paymentStatus === "CANCELLED"}
                          <span
                            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                          >
                            <span>Dibatalkan</span>
                          </span>
                        {:else}
                          <span
                            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          >
                            <XCircle class="w-3.5 h-3.5" />
                            <span>{tx.paymentStatus}</span>
                          </span>
                        {/if}
                      </td>

                      <td class="px-5 py-3.5 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          {#if tx.paymentStatus === "PENDING"}
                            <button
                              type="button"
                              onclick={() => {
                                orderToConfirmManual = tx;
                                showConfirmPaymentModal = true;
                              }}
                              class="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition cursor-pointer"
                              title="Konfirmasi Pembayaran Manual & Aktifkan Paket"
                            >
                              <Check class="w-3.5 h-3.5 stroke-[3]" />
                              <span>Konfirmasi Lunas</span>
                            </button>

                            <button
                              type="button"
                              onclick={() => handleCancelTransaction(tx)}
                              class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
                              title="Batalkan Pesanan"
                            >
                              <Trash2 class="w-3.5 h-3.5" />
                            </button>
                          {:else if tx.paymentStatus === "PAID"}
                            <span
                              class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                            >
                              <Check class="w-3.5 h-3.5 stroke-[3]" />
                              <span>Lunas</span>
                            </span>
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 4: CHANNEL PEMBAYARAN MIDTRANS                        -->
      <!-- ========================================================= -->
      {#if activeTab === "midtrans"}
        <div class="space-y-6 max-w-4xl">
          <div
            class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
          >
            <div
              class="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5"
            >
              <div>
                <h2
                  class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <Wallet class="w-5 h-5 text-indigo-500" />
                  <span>Integrasi Payment Gateway Midtrans</span>
                </h2>
                <p
                  class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed"
                >
                  Hubungkan akun Midtrans Snap Anda untuk menerima pembayaran
                  otomatis QRIS, Virtual Account (BCA, Mandiri, BNI, BRI), Kartu
                  Kredit, dan e-Wallet dari klien saat berlangganan sewa.
                </p>
              </div>

              <!-- Enable/Disable Switch -->
              <label
                class="flex items-center gap-2 cursor-pointer shrink-0 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <input
                  type="checkbox"
                  bind:checked={midtrans.isEnabled}
                  class="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span
                  class="text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {midtrans.isEnabled ? "Channel Aktif" : "Nonaktif"}
                </span>
              </label>
            </div>

            <form onsubmit={handleSaveMidtrans} class="space-y-5">
              <!-- Environment Selection -->
              <div>
                <span
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2"
                  >Mode Lingkungan Midtrans</span
                >
                <div class="grid grid-cols-2 gap-4">
                  <label
                    class="p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition {midtrans.environment ===
                    'sandbox'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}"
                  >
                    <input
                      type="radio"
                      name="midtrans_env"
                      value="sandbox"
                      bind:group={midtrans.environment}
                      class="text-amber-500"
                    />
                    <div>
                      <div class="text-xs font-bold">
                        Sandbox (Testing / Simulasi)
                      </div>
                      <div class="text-[11px] opacity-80">
                        Untuk pengujian simulasi transaksi tanpa uang sungguhan
                      </div>
                    </div>
                  </label>

                  <label
                    class="p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition {midtrans.environment ===
                    'production'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}"
                  >
                    <input
                      type="radio"
                      name="midtrans_env"
                      value="production"
                      bind:group={midtrans.environment}
                      class="text-emerald-600"
                    />
                    <div>
                      <div class="text-xs font-bold">
                        Production (Resmi / Live)
                      </div>
                      <div class="text-[11px] opacity-80">
                        Untuk menerima pembayaran uang riil dari klien penyewa
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Server Key -->
              <div>
                <label
                  for="mt_server_key"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Midtrans Server Key *
                </label>
                <div class="relative">
                  <Key
                    class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="mt_server_key"
                    type={showMidtransServerKey ? "text" : "password"}
                    bind:value={midtrans.serverKey}
                    placeholder={midtrans.environment === "sandbox"
                      ? "SB-Mid-server-..."
                      : "Mid-server-..."}
                    class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onclick={() =>
                      (showMidtransServerKey = !showMidtransServerKey)}
                    class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {#if showMidtransServerKey}
                      <EyeOff class="w-4 h-4" />
                    {:else}
                      <Eye class="w-4 h-4" />
                    {/if}
                  </button>
                </div>
                <span class="text-[11px] text-slate-400 mt-1 block"
                  >Didapatkan dari menu: Midtrans Dashboard &rarr; Settings
                  &rarr; Access Keys</span
                >
              </div>

              <!-- Client Key -->
              <div>
                <label
                  for="mt_client_key"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Midtrans Client Key *
                </label>
                <div class="relative">
                  <Shield
                    class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="mt_client_key"
                    type="text"
                    bind:value={midtrans.clientKey}
                    placeholder={midtrans.environment === "sandbox"
                      ? "SB-Mid-client-..."
                      : "Mid-client-..."}
                    class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <!-- Merchant ID -->
              <div>
                <label
                  for="mt_merchant_id"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Midtrans Merchant ID (Opsional)
                </label>
                <input
                  id="mt_merchant_id"
                  type="text"
                  bind:value={midtrans.merchantId}
                  placeholder="G123456789"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <!-- Webhook URL Display Card -->
              <div
                class="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-2"
              >
                <div class="flex items-center justify-between">
                  <span
                    class="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5"
                  >
                    <Zap class="w-4 h-4 text-indigo-500" />
                    Midtrans Payment Notification URL (Webhook)
                  </span>
                  <button
                    type="button"
                    onclick={() =>
                      copyToClipboard(
                        `${window.location.origin}/api/v1/billing/midtrans-webhook`,
                        "webhook_url",
                      )}
                    class="py-1 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    {#if copiedText === "webhook_url"}
                      <Check class="w-3 h-3" />
                      <span>URL Tersalin!</span>
                    {:else}
                      <Copy class="w-3 h-3" />
                      <span>Salin Webhook URL</span>
                    {/if}
                  </button>
                </div>
                <div
                  class="font-mono text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900 text-slate-700 dark:text-slate-200 break-all select-all"
                >
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/api/v1/billing/midtrans-webhook`
                    : "https://domain-anda.com/api/v1/billing/midtrans-webhook"}
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                  Tempel URL di atas pada dashboard Midtrans (<strong
                    >Settings &rarr; Configuration &rarr; Payment Notification
                    URL</strong
                  >) agar sistem otomatis memperpanjang masa aktif tenant saat
                  pembayaran berhasil.
                </p>
              </div>

              <div
                class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end"
              >
                <button
                  type="submit"
                  disabled={isSubmitting}
                  class="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-60"
                >
                  <Check class="w-4 h-4 stroke-[3]" />
                  <span
                    >{isSubmitting
                      ? "Menyimpan..."
                      : "Simpan Konfigurasi Midtrans"}</span
                  >
                </button>
              </div>
            </form>
          </div>
        </div>
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 4: TIM & STAF ADMINISTRATOR (BERDIRI SENDIRI)         -->
      <!-- ========================================================= -->
      {#if activeTab === "staff"}
        <!-- Top Action Banner -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h2
                class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <span>Tim & Staf Administrator Platform</span>
                <span
                  class="text-xs font-normal text-slate-500 dark:text-slate-400"
                  >({staffList.length} Akun)</span
                >
              </h2>
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25"
              >
                Berdiri Sendiri (organization_id = NULL)
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Akun-akun di bawah ini adalah staf pengelola platform utama (Super
              Admin, Finance, Support). Akun ini <strong
                >benar-benar berdiri sendiri</strong
              > dan tidak terikat pada organisasi klien mana pun.
            </p>
          </div>

          <div class="flex items-center gap-2.5">
            <button
              onclick={loadStaff}
              disabled={staffLoading}
              class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw class="w-4 h-4 {staffLoading ? 'animate-spin' : ''}" />
              <span>Refresh</span>
            </button>

            {#if authStore.isSuperAdmin}
              <button
                onclick={openCreateStaff}
                class="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition cursor-pointer"
              >
                <Plus class="w-4 h-4 stroke-[3]" />
                <span>+ Tambah Staf Baru</span>
              </button>
            {/if}
          </div>
        </div>

        <!-- Info Highlights Card -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
          >
            <div
              class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0"
            >
              <Users class="w-5 h-5" />
            </div>
            <div>
              <div
                class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Total Staf Platform
              </div>
              <div
                class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
              >
                {staffList.length}
              </div>
            </div>
          </div>

          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
          >
            <div
              class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0"
            >
              <Shield class="w-5 h-5" />
            </div>
            <div>
              <div
                class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Master Super Admin
              </div>
              <div
                class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
              >
                {staffList.filter((s) => s.role === "SUPER_ADMIN").length}
              </div>
            </div>
          </div>

          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
          >
            <div
              class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"
            >
              <Wallet class="w-5 h-5" />
            </div>
            <div>
              <div
                class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Finance Staff
              </div>
              <div
                class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
              >
                {staffList.filter((s) => s.role === "ADMIN_FINANCE").length}
              </div>
            </div>
          </div>

          <div
            class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5"
          >
            <div
              class="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0"
            >
              <Network class="w-5 h-5" />
            </div>
            <div>
              <div
                class="text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Support / Teknis
              </div>
              <div
                class="text-lg font-extrabold text-slate-900 dark:text-white font-mono"
              >
                {staffList.filter((s) => s.role === "ADMIN_SUPPORT").length}
              </div>
            </div>
          </div>
        </div>

        <!-- Filter & Search Bar -->
        <div
          class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
        >
          <div class="relative w-full sm:w-80">
            <Search
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              bind:value={staffSearchQuery}
              placeholder="Cari nama atau email staf..."
              class="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <label
              for="staff_role_filter"
              class="text-xs font-semibold text-slate-500 shrink-0">Role:</label
            >
            <select
              id="staff_role_filter"
              bind:value={staffSelectedRole}
              class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="ALL">Semua Peran ({staffList.length})</option>
              <option value="SUPER_ADMIN">Master Super Admin (Utama)</option>
              <option value="CO_SUPER_ADMIN">Co-Super Administrator</option>
              <option value="ADMIN_FINANCE">Finance (Keuangan)</option>
              <option value="ADMIN_SUPPORT">Support / Teknis</option>
            </select>
          </div>
        </div>

        <!-- Staff List Table -->
        <div
          class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
        >
          {#if staffLoading && staffList.length === 0}
            <div class="p-12 text-center space-y-3">
              <div
                class="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto"
              ></div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Memuat daftar staf platform...
              </p>
            </div>
          {:else if filteredStaff.length === 0}
            <div class="p-12 text-center space-y-3">
              <div
                class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto"
              >
                <Users class="w-6 h-6" />
              </div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                Tidak Ada Staf Platform
              </h3>
              <p
                class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto"
              >
                {staffSearchQuery
                  ? "Tidak ada akun staf yang cocok dengan pencarian."
                  : "Belum ada staf platform yang ditambahkan."}
              </p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead
                  class="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]"
                >
                  <tr>
                    <th class="px-5 py-3.5">Nama & Email</th>
                    <th class="px-4 py-3.5">Peran / Jabatan</th>
                    <th class="px-4 py-3.5">Status Akun</th>
                    <th class="px-4 py-3.5">Tipe Akun</th>
                    <th class="px-4 py-3.5">Tanggal Dibuat</th>
                    <th class="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                  {#each filteredStaff as staff (staff.id)}
                    <tr
                      class="hover:bg-slate-50/75 dark:hover:bg-slate-800/40 transition"
                    >
                      <td class="px-5 py-3.5">
                        <div class="flex items-center gap-3">
                          <div
                            class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 {staff.role ===
                            'SUPER_ADMIN'
                              ? 'bg-indigo-600 text-white'
                              : staff.role === 'CO_SUPER_ADMIN'
                                ? 'bg-violet-600 text-white'
                                : staff.role === 'ADMIN_FINANCE'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-cyan-600 text-white'}"
                          >
                            {staff.fullName.charAt(0)}
                          </div>
                          <div>
                            <div
                              class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5"
                            >
                              <span>{staff.fullName}</span>
                              {#if staff.id === authStore.user?.id}
                                <span
                                  class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                                >
                                  (Anda)
                                </span>
                              {/if}
                            </div>
                            <div
                              class="font-mono text-[11px] text-slate-500 dark:text-slate-400"
                            >
                              {staff.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td class="px-4 py-3.5">
                        <RoleBadge role={staff.role} isPrimaryAdmin={Boolean(staff.isPrimaryAdmin || (staff.role === 'SUPER_ADMIN' && staff.email === 'admin@perusahaan.com'))} />
                      </td>

                      <td class="px-4 py-3.5">
                        <span
                          class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold {staff.status ===
                          'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : staff.status === 'SUSPENDED'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'}"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full {staff.status ===
                            'ACTIVE'
                              ? 'bg-emerald-500'
                              : staff.status === 'SUSPENDED'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'}"
                          ></span>
                          <span>{staff.status}</span>
                        </span>
                      </td>

                      <td class="px-4 py-3.5">
                        <span
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          <ShieldCheck class="w-3 h-3 text-indigo-500" />
                          <span>Platform Independen</span>
                        </span>
                      </td>

                      <td
                        class="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]"
                      >
                        {new Date(staff.createdAt).toLocaleDateString("id-ID", {
                          dateStyle: "medium",
                        })}
                      </td>

                      <td class="px-5 py-3.5 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          {#if authStore.isSuperAdmin}
                            <button
                              type="button"
                              onclick={() => openResetStaffPassword(staff)}
                              class="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition cursor-pointer"
                              title="Reset Password Staf"
                            >
                              <Key class="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onclick={() => openEditStaff(staff)}
                              class="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition cursor-pointer"
                              title="Edit Data Staf"
                            >
                              <Edit3 class="w-3.5 h-3.5" />
                            </button>

                            {#if staff.id !== authStore.user?.id}
                              <button
                                type="button"
                                onclick={() => openDeleteStaff(staff)}
                                class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
                                title="Hapus Staf"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </button>
                            {/if}
                          {:else}
                            <span class="text-[11px] text-slate-400 italic"
                              >Hanya Baca</span
                            >
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 6: PUSAT PEMBARUAN SISTEM (GIT / GITHUB UPDATE)       -->
      <!-- ========================================================= -->
      {#if activeTab === "system_update"}
        <div class="space-y-6 max-w-5xl">
          <!-- Role Guard Check: Role must be Administrator Utama (Primary Super Admin) -->
          {#if !authStore.isPrimaryAdmin}
            <div
              class="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm"
            >
              <div
                class="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto"
              >
                <Lock class="w-8 h-8 stroke-[2.2]" />
              </div>
              <div class="space-y-1.5 max-w-md mx-auto">
                <h3 class="text-base font-bold text-slate-900 dark:text-white">
                  Akses Terbatas: Khusus Administrator Utama
                </h3>
                <p
                  class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed"
                >
                  Fitur penarikan kode dan pembaruan sistem langsung dari GitHub
                  hanya dapat diakses dan dieksekusi oleh <strong>Administrator Utama</strong> demi menjaga stabilitas dan
                  keamanan server. Co-Super Administrator dan staf lainnya tidak memiliki hak akses ini.
                </p>
              </div>
              <div class="pt-2">
                <button
                  onclick={() => (activeTab = "tenants")}
                  class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Kembali ke Manajemen Organisasi
                </button>
              </div>
            </div>
          {:else}
            <!-- Top Action Banner -->
            <div
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <div
                    class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  >
                    <GitBranch class="w-5 h-5" />
                  </div>
                  <h2
                    class="text-base font-bold text-slate-900 dark:text-white"
                  >
                    Pusat Pembaruan Sistem (GitHub Sync)
                  </h2>
                  <span
                    class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 uppercase tracking-wider"
                  >
                    Role SUPER_ADMIN
                  </span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Periksa komit terbaru dari repositori GitHub resmi, unduh
                  patch/fitur terbaru, dan sinkronkan codebase server secara
                  aman tanpa perlu login terminal SSH manual.
                </p>
              </div>

              <div class="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onclick={handleGitCheckUpdate}
                  disabled={gitChecking || gitPulling}
                  class="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    class="w-4 h-4 {gitChecking ? 'animate-spin' : ''}"
                  />
                  <span
                    >{gitChecking
                      ? "Memeriksa GitHub..."
                      : "Cek Pembaruan di GitHub"}</span
                  >
                </button>

                <!-- Button Sinkronkan Skema Database -->
                <button
                  type="button"
                  onclick={handleDbSync}
                  disabled={isDbSyncing || gitPulling}
                  class="py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer disabled:opacity-50"
                  title="Sinkronkan struktur tabel, relasi, dan kolom baru secara aman tanpa menghapus data"
                >
                  <Database
                    class="w-4 h-4 {isDbSyncing ? 'animate-spin' : ''}"
                  />
                  <span
                    >{isDbSyncing
                      ? "Menyinkronkan DB..."
                      : "Sinkronkan Skema Database"}</span
                  >
                </button>

                <button
                  type="button"
                  onclick={() => (showConfirmGitPullModal = true)}
                  disabled={gitPulling || gitChecking}
                  class="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  <ArrowUpCircle
                    class="w-4 h-4 {gitPulling ? 'animate-bounce' : ''}"
                  />
                  <span
                    >{gitPulling
                      ? "Menerapkan Update..."
                      : "Terapkan Update Sekarang"}</span
                  >
                </button>
              </div>
            </div>

            <!-- Repository & Branch KPI Info Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Branch -->
              <div
                class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5"
              >
                <div
                  class="flex items-center justify-between text-slate-400 text-xs"
                >
                  <span class="font-semibold">Branch Aktif</span>
                  <GitBranch class="w-4 h-4 text-indigo-500" />
                </div>
                <div
                  class="text-base font-extrabold text-slate-900 dark:text-white font-mono flex items-center gap-1.5"
                >
                  <span>{gitStatus?.currentBranch || "main"}</span>
                  <span
                    class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                  ></span>
                </div>
                <div class="text-[10px] text-slate-400 truncate font-mono">
                  origin/{gitStatus?.currentBranch || "main"}
                </div>
              </div>

              <!-- Commit Hash -->
              <div
                class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5"
              >
                <div
                  class="flex items-center justify-between text-slate-400 text-xs"
                >
                  <span class="font-semibold">Commit Saat Ini</span>
                  <GitPullRequest class="w-4 h-4 text-purple-500" />
                </div>
                <div
                  class="text-base font-extrabold text-slate-900 dark:text-white font-mono"
                >
                  #{gitStatus?.shortHash || "Loading..."}
                </div>
                <div class="text-[10px] text-slate-400 truncate">
                  Oleh: {gitStatus?.author || "Author"}
                </div>
              </div>

              <!-- Remote Sync Status -->
              <div
                class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5"
              >
                <div
                  class="flex items-center justify-between text-slate-400 text-xs"
                >
                  <span class="font-semibold">Status Update</span>
                  <Activity class="w-4 h-4 text-emerald-500" />
                </div>
                <div class="text-base font-extrabold">
                  {#if gitUpdateResult}
                    {#if gitUpdateResult.behindCount > 0}
                      <span class="text-amber-500 font-mono"
                        >{gitUpdateResult.behindCount} Commit Baru</span
                      >
                    {:else}
                      <span class="text-emerald-500">Up to Date</span>
                    {/if}
                  {:else}
                    <span
                      class="text-slate-700 dark:text-slate-300 text-sm font-semibold"
                      >Siap Diperiksa</span
                    >
                  {/if}
                </div>
                <div class="text-[10px] text-slate-400">
                  {#if gitUpdateResult?.behindCount}
                    Pembaruan siap ditarik dari GitHub
                  {:else}
                    Codebase sinkron dengan GitHub
                  {/if}
                </div>
              </div>

              <!-- Remote Repository -->
              <div
                class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5"
              >
                <div
                  class="flex items-center justify-between text-slate-400 text-xs"
                >
                  <span class="font-semibold">Remote GitHub</span>
                  <Globe class="w-4 h-4 text-blue-500" />
                </div>
                <div
                  class="text-sm font-bold text-slate-900 dark:text-white truncate font-mono"
                  title={gitStatus?.remoteUrl}
                >
                  {gitStatus?.remoteUrl
                    ? gitStatus.remoteUrl
                        .split("/")
                        .slice(-1)[0]
                        .replace(".git", "")
                    : "wa_official"}
                </div>
                <div class="text-[10px] text-slate-400 truncate">
                  {gitStatus?.remoteUrl || "https://github.com/..."}
                </div>
              </div>
            </div>

            <!-- Current Commit Message Details Card -->
            {#if gitStatus}
              <div
                class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                <div class="flex items-center justify-between text-xs">
                  <span
                    class="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <FolderGit2 class="w-4 h-4 text-indigo-500" />
                    <span>Catatan Commit Terakhir yang Berjalan di Server</span>
                  </span>
                  <span class="text-[11px] text-slate-400 font-mono">
                    {gitStatus.commitDate}
                  </span>
                </div>
                <div
                  class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 leading-relaxed break-words"
                >
                  {gitStatus.commitMessage}
                </div>
              </div>
            {/if}

            <!-- Incoming Commits Preview (if behind) -->
            {#if gitUpdateResult && gitUpdateResult.behindCount > 0}
              <div
                class="p-5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/30 shadow-xs space-y-4"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span
                      class="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"
                    ></span>
                    <h3
                      class="text-sm font-extrabold text-slate-900 dark:text-white"
                    >
                      Pembaruan Tersedia ({gitUpdateResult.behindCount} Komit di
                      Belakang)
                    </h3>
                  </div>
                  <button
                    onclick={() => (showConfirmGitPullModal = true)}
                    class="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                  >
                    Terapkan Sekarang
                  </button>
                </div>

                <div class="space-y-2">
                  {#each gitUpdateResult.incomingCommits as commit}
                    <div
                      class="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                    >
                      <div class="space-y-0.5">
                        <div class="font-bold text-slate-900 dark:text-white">
                          {commit.message}
                        </div>
                        <div class="text-[10px] text-slate-400">
                          Oleh: {commit.author} • {commit.date}
                        </div>
                      </div>
                      <span
                        class="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shrink-0"
                      >
                        {commit.hash}
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Terminal Output Log Console -->
            <div
              class="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg"
            >
              <div
                class="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between"
              >
                <div
                  class="flex items-center gap-2 text-xs font-mono text-slate-300"
                >
                  <Terminal class="w-4 h-4 text-emerald-400" />
                  <span>Terminal Konsol Eksekusi Git</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                </div>
              </div>

              <div
                class="p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-64 overflow-y-auto"
              >
                {#each gitTerminalLogs as log}
                  <div class="leading-relaxed whitespace-pre-wrap">{log}</div>
                {/each}
                {#if gitChecking}
                  <div class="text-amber-400 animate-pulse">
                    $ git fetch origin {gitStatus?.currentBranch || "main"}...
                  </div>
                {:else if gitPulling}
                  <div class="text-indigo-400 animate-pulse">
                    $ git pull origin {gitStatus?.currentBranch || "main"}...
                    (menarik data codebase)
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/if}
      </main>
    </div>
  </div>
  {/if}
</div>

<!-- ========================================================= -->
<!-- MODAL: WIZARD INTEGRASI META WHATSAPP CLOUD API           -->
<!-- ========================================================= -->
{#if showMetaModal && metaOrg}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showMetaModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-2xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <!-- Modal Header -->
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <Network class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Integrasi Meta WhatsApp Cloud API
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Organisasi: <strong>{metaOrg.name}</strong>
            </p>
          </div>
        </div>
        <button
          onclick={() => (showMetaModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Form Body -->
      <form
        onsubmit={handleSaveMetaConfig}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                for="meta_waba"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Meta WABA Account ID (ID Akun Bisnis Meta) *
              </label>
              <input
                id="meta_waba"
                type="text"
                bind:value={metaWabaId}
                placeholder="cth: 1461623865804185"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
              <p class="text-[10px] text-slate-400 mt-1">ID Akun WhatsApp Business dari Meta Business Suite.</p>
            </div>

            <div>
              <label
                for="meta_phone_id"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Phone Number ID (ID Nomor WhatsApp Meta) *
              </label>
              <input
                id="meta_phone_id"
                type="text"
                bind:value={metaPhoneId}
                placeholder="cth: 109283749283749"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
              <p class="text-[10px] text-slate-400 mt-1">ID Nomor Telepon spesifik dari WhatsApp Manager.</p>
            </div>

            <div class="sm:col-span-2">
              <div class="flex items-center justify-between mb-1">
                <label
                  for="meta_token"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Permanent System User Access Token *
                </label>
                {#if metaOrg?.hasAccessToken}
                  <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    🟢 Token Terpasang ({metaOrg.maskedToken || 'Aktif'})
                  </span>
                {:else}
                  <span class="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    🔴 Token Belum Diisi
                  </span>
                {/if}
              </div>
              <input
                id="meta_token"
                type="password"
                bind:value={metaAccessToken}
                placeholder={metaOrg?.hasAccessToken ? "Token sudah tersimpan. Biarkan kosong jika tidak ingin mengganti token." : "Tempelkan System User Access Token (EAAGm...)"}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <p class="text-[10px] text-slate-400 mt-1">
                Token permanen dari Meta Business Manager System User dengan izin <code class="bg-slate-200 dark:bg-slate-800 px-1 rounded">whatsapp_business_messaging</code>.
              </p>
            </div>

            <div>
              <label
                for="meta_disp_phone"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Nomor Tampilan WhatsApp
              </label>
              <input
                id="meta_disp_phone"
                type="text"
                bind:value={metaDisplayPhone}
                placeholder="e.g. +62 812-3456-7890"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                for="meta_verif_name"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Nama Bisnis Terverifikasi (Verified Name)
              </label>
              <input
                id="meta_verif_name"
                type="text"
                bind:value={metaVerifiedName}
                placeholder="e.g. Toko Resmi Official"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <!-- Live Connection Test Trigger & Result -->
          <div
            class="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300"
                >Uji Validasi Koneksi API Meta</span
              >
              <button
                type="button"
                onclick={handleTestMetaConnection}
                disabled={isTestingMeta}
                class="py-2 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
              >
                <Zap
                  class="w-3.5 h-3.5 {isTestingMeta
                    ? 'animate-spin'
                    : 'text-emerald-500'}"
                />
                <span
                  >{isTestingMeta
                    ? "Menguji ke Meta..."
                    : "⚡ Uji Koneksi Meta"}</span
                >
              </button>
            </div>

            {#if metaTestResult}
              <div
                class="p-4 rounded-xl border text-xs space-y-2 animate-in fade-in {metaTestResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-300'}"
              >
                <div class="flex items-center gap-2 font-bold">
                  {#if metaTestResult.success}
                    <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
                  {:else}
                    <AlertTriangle class="w-4 h-4 text-rose-500 shrink-0" />
                  {/if}
                  <span>{metaTestResult.message}</span>
                </div>

                {#if metaTestResult.data?.phoneNumber}
                  <div
                    class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-emerald-200 dark:border-emerald-900 text-[11px] font-mono"
                  >
                    <div>
                      Nomor: <strong>{metaTestResult.data.phoneNumber.display_phone_number || '-'}</strong>
                    </div>
                    <div>
                      Nama Bisnis: <strong>{metaTestResult.data.phoneNumber.verified_name || metaOrg?.name}</strong>
                    </div>
                    <div>
                      Kualitas: <strong class="uppercase text-emerald-600 dark:text-emerald-400">{metaTestResult.data.phoneNumber.quality_rating || 'GREEN'}</strong>
                    </div>
                    <div>
                      Status Verif: <strong>{metaTestResult.data.phoneNumber.code_verification_status || 'VERIFIED'}</strong>
                    </div>
                    <div class="sm:col-span-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 flex items-center justify-between font-sans">
                      <span class="font-bold flex items-center gap-1.5">
                        <Gauge class="w-3.5 h-3.5 text-emerald-500" />
                        Batas Quota Meta (Messaging Limit):
                      </span>
                      <strong class="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">
                        {metaTestResult.data.phoneNumber.messaging_limit_tier === 'TIER_1K' ? '1,000 Pesan / 24 Jam' : metaTestResult.data.phoneNumber.messaging_limit_tier === 'TIER_10K' ? '10,000 Pesan / 24 Jam' : metaTestResult.data.phoneNumber.messaging_limit_tier === 'TIER_100K' ? '100,000 Pesan / 24 Jam' : metaTestResult.data.phoneNumber.messaging_limit_tier === 'TIER_UNLIMITED' ? '♾️ Unlimited / 24 Jam' : '250 Pesan / 24 Jam (Tier 250)'}
                      </strong>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Sticky Footer -->
        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            type="button"
            onclick={() => (showMetaModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span
              >{isSubmitting ? "Menyimpan..." : "Simpan & Aktifkan Meta"}</span
            >
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: TAMBAH / EDIT PAKET SEWA SAAS                      -->
<!-- ========================================================= -->
{#if showPlanModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showPlanModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <Package class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              {editingPlan ? "Ubah Pengaturan Paket" : "Buat Paket Sewa Baru"}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Tentukan harga, kapasitas agen CS, dan benefit untuk klien
            </p>
          </div>
        </div>
        <button
          onclick={() => (showPlanModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form
        onsubmit={handleSavePlan}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                for="plan_name"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Nama Paket *</label
              >
              <input
                id="plan_name"
                type="text"
                bind:value={planName}
                placeholder="e.g. Starter Bisnis / Promo Launching"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label
                for="plan_code"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Kode / Label Paket <span class="text-slate-400 font-normal"
                  >(Bebas, e.g. PROMO14, STARTER, VIP)</span
                >
              </label>
              <input
                id="plan_code"
                type="text"
                bind:value={planCode}
                placeholder="e.g. PROMO14 / UMKM / GOLD"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold uppercase text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <!-- Model Durasi / Masa Berlaku Paket -->
            <div
              class="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <span
                class="block text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                Masa Berlaku / Skema Durasi Paket *
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType ===
                  'PERMANENT'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_duration_type"
                    value="PERMANENT"
                    bind:group={planDurationType}
                    onchange={() => {
                      planPrice = 0;
                      planPeriod = "selamanya";
                      planDurationDays = 0;
                    }}
                    class="text-amber-500 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Gift class="w-3.5 h-3.5 text-amber-500" />
                      <span>Gratis Selamanya</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      Tanpa kadaluarsa / no expiry (Tidak perlu perpanjangan)
                    </div>
                  </div>
                </label>

                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType ===
                  'MONTHLY'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-900 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_duration_type"
                    value="MONTHLY"
                    bind:group={planDurationType}
                    onchange={() => {
                      if (planPrice === 0) planPrice = 199000;
                      planPeriod = "bulan";
                      planDurationDays = 30;
                    }}
                    class="text-indigo-600 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Clock class="w-3.5 h-3.5 text-indigo-500" />
                      <span>Bulanan (30 Hari)</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      Perpanjangan sewa rutin setiap bulan
                    </div>
                  </div>
                </label>

                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType ===
                  'DAYS'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_duration_type"
                    value="DAYS"
                    bind:group={planDurationType}
                    onchange={() => {
                      if (planDurationDays === 0 || planDurationDays === 30)
                        planDurationDays = 14;
                      planPeriod = `${planDurationDays} hari`;
                    }}
                    class="text-emerald-600 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Calendar class="w-3.5 h-3.5 text-emerald-500" />
                      <span>Batas Hari Khusus</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      Promo berbatas waktu (misal 7, 14, atau 60 hari)
                    </div>
                  </div>
                </label>
              </div>

              {#if planDurationType === "DAYS"}
                <div
                  class="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
                >
                  <label
                    for="plan_custom_days"
                    class="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0"
                  >
                    Jumlah Hari Masa Aktif:
                  </label>
                  <input
                    id="plan_custom_days"
                    type="number"
                    min="1"
                    max="365"
                    bind:value={planDurationDays}
                    oninput={() => (planPeriod = `${planDurationDays} hari`)}
                    class="w-24 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                  <span class="text-xs text-slate-400"
                    >hari (Setelah lewat, status tenant otomatis EXPIRED)</span
                  >
                </div>
              {/if}
            </div>

            <div>
              <label
                for="plan_price"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Harga Sewa (IDR) * <span class="text-amber-500 font-normal"
                  >(Isi 0 untuk Gratis/Promo)</span
                >
              </label>
              <input
                id="plan_price"
                type="number"
                min="0"
                step="1000"
                bind:value={planPrice}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label
                for="plan_period"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Label Periode Tagihan</label
              >
              <input
                id="plan_period"
                type="text"
                bind:value={planPeriod}
                placeholder="e.g. bulan / 14 hari / selamanya"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                for="plan_agents"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Maksimal Kursi Agen (CS)</label
              >
              <input
                id="plan_agents"
                type="number"
                min="1"
                max="500"
                bind:value={planMaxAgents}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                for="plan_bcast"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Kuota Broadcast Pesan / Bulan</label
              >
              <input
                id="plan_bcast"
                type="number"
                min="0"
                step="500"
                bind:value={planMaxBroadcast}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                for="plan_desc"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Deskripsi Singkat</label
              >
              <input
                id="plan_desc"
                type="text"
                bind:value={planDescription}
                placeholder="e.g. Solusi ideal untuk UMKM dan tim kecil"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                for="plan_features"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Daftar Fitur / Benefit (1 Baris = 1 Fitur)
              </label>
              <textarea
                id="plan_features"
                rows="4"
                bind:value={planFeaturesText}
                placeholder="5 Kursi Agen CS&#10;5.000 Broadcast / Bulan&#10;Live Chat Terpadu"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              ></textarea>
            </div>

            <!-- Pengaturan Visibilitas Paket (Publik vs Khusus Admin) -->
            <div
              class="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
            >
              <span
                class="block text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                Visibilitas & Hak Akses Order Paket *
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planIsPublic
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_visibility"
                    value={true}
                    checked={planIsPublic}
                    onchange={() => (planIsPublic = true)}
                    class="text-emerald-600 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Globe class="w-3.5 h-3.5 text-emerald-500" />
                      <span>Publik (Klien Bisa Order Mandiri)</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      Tampil di menu <em>Paket & Langganan</em> seluruh tenant sehingga
                      mereka bisa memilih dan mengajukan perpanjangan/upgrade secara
                      langsung.
                    </div>
                  </div>
                </label>

                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {!planIsPublic
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_visibility"
                    value={false}
                    checked={!planIsPublic}
                    onchange={() => (planIsPublic = false)}
                    class="text-amber-500 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Lock class="w-3.5 h-3.5 text-amber-500" />
                      <span>Khusus / Spesial Administrator</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">
                      <strong>Paket Khusus/Rahasia</strong>: Tidak muncul di
                      katalog tenant. Hanya dapat diberikan secara manual oleh
                      Super Admin dari portal administrator.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div
              class="sm:col-span-2 flex items-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-800"
            >
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={planIsPopular}
                  class="w-4 h-4 text-indigo-600 rounded"
                />
                <span
                  class="text-xs font-bold text-slate-800 dark:text-slate-200"
                  >Tandai sebagai Paket Paling Populer</span
                >
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={planIsActive}
                  class="w-4 h-4 text-emerald-600 rounded"
                />
                <span
                  class="text-xs font-bold text-slate-800 dark:text-slate-200"
                  >Paket Aktif (Bisa Dipilih)</span
                >
              </label>
            </div>
          </div>
        </div>

        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            type="button"
            onclick={() => (showPlanModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? "Menyimpan..." : "Simpan Paket"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: EDIT AKUN LOGIN SUPER ADMIN SAYA                   -->
<!-- ========================================================= -->
{#if showProfileModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    onclick={(e) => {
      if (e.target === e.currentTarget) showProfileModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6"
    >
      <div
        class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <UserCog class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Pengaturan Akun Super Admin Saya
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Ubah email login, nama profil, dan kata sandi akses portal
            </p>
          </div>
        </div>
        <button
          onclick={() => (showProfileModal = false)}
          class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleUpdateProfile} class="p-6 space-y-4">
        <div>
          <label
            for="prof_name"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Nama Lengkap Super Admin
          </label>
          <input
            id="prof_name"
            type="text"
            bind:value={profileFullName}
            placeholder="e.g. Master Administrator"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            required
          />
        </div>

        <div>
          <label
            for="prof_email"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Email Login Super Admin *
          </label>
          <input
            id="prof_email"
            type="email"
            bind:value={profileEmail}
            placeholder="admin@perusahaan.com"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            required
          />
          <span class="text-[10px] text-slate-400 mt-1 block"
            >Email ini digunakan untuk login ke portal /administrator</span
          >
        </div>

        <div
          class="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3"
        >
          <h4
            class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
          >
            <Lock class="w-3.5 h-3.5 text-indigo-500" />
            Ubah Kata Sandi (Opsional)
          </h4>

          <div>
            <label
              for="prof_cur_pwd"
              class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
            >
              Password Lama (Opsional / Jika ingin mengganti)
            </label>
            <input
              id="prof_cur_pwd"
              type="password"
              bind:value={profileCurrentPassword}
              placeholder="Masukkan password saat ini..."
              class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label
              for="prof_new_pwd"
              class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
            >
              Password Baru (Minimal 6 karakter)
            </label>
            <input
              id="prof_new_pwd"
              type="password"
              bind:value={profileNewPassword}
              placeholder="Kosongkan jika tidak ingin mengganti password..."
              minlength="6"
              class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
        >
          <button
            type="button"
            onclick={() => (showProfileModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={profileLoading}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span
              >{profileLoading ? "Menyimpan..." : "Simpan Perubahan Akun"}</span
            >
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: DAFTAR AKUN PENGGUNA TENANT & BANTU RESET PASSWORD -->
<!-- ========================================================= -->
{#if showUsersModal && activeTenant}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showUsersModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <!-- Modal Header -->
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400"
          >
            <Users class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Daftar Akun User & Bantuan Login
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Organisasi: <strong>{activeTenant.name}</strong> ({activeTenant
                .users?.length || 0} Akun)
            </p>
          </div>
        </div>
        <button
          type="button"
          onclick={() => (showUsersModal = false)}
          class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Users List -->
      <div class="p-6 overflow-y-auto flex-1 space-y-3">
        {#if !activeTenant.users || activeTenant.users.length === 0}
          <div class="text-center py-8 text-slate-400">
            <Users class="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p class="text-xs font-semibold">
              Belum ada akun user terdaftar untuk organisasi ini.
            </p>
          </div>
        {:else}
          {#each activeTenant.users as u (u.id)}
            <div
              class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-900 dark:text-white text-xs"
                    >{u.fullName}</span
                  >
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider {u.role ===
                    'ADMINISTRATOR'
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                      : u.role === 'SUPERVISOR'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'}"
                  >
                    {u.role}
                  </span>
                  {#if u.isOnline}
                    <span
                      class="w-2 h-2 rounded-full bg-emerald-500"
                      title="Online"
                    ></span>
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300"
                    >{u.email}</span
                  >
                  <button
                    type="button"
                    onclick={() => copyToClipboard(u.email, `u_email_${u.id}`)}
                    class="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                    title="Salin Email Login"
                  >
                    {#if copiedText === `u_email_${u.id}`}
                      <Check class="w-3 h-3 text-emerald-500" />
                      <span class="text-emerald-500 font-bold">Tersalin</span>
                    {:else}
                      <Copy class="w-3 h-3" />
                      <span>Salin Email</span>
                    {/if}
                  </button>
                </div>
              </div>

              <!-- Quick Action: Reset Password -->
              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onclick={() => {
                    showUsersModal = false;
                    openResetPassword(activeTenant!, u.id);
                  }}
                  class="py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Key class="w-3.5 h-3.5 text-amber-500" />
                  <span>Reset Password</span>
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Modal Footer -->
      <div
        class="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0"
      >
        <span class="text-[11px] text-slate-400"
          >Gunakan tombol <strong>Reset Password</strong> jika user lupa kata sandi.</span
        >
        <button
          type="button"
          onclick={() => (showUsersModal = false)}
          class="py-1.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL 1: DAFTARKAN ORGANISASI BARU                        -->
<!-- ========================================================= -->
{#if showCreateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showCreateModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-3xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <!-- Sticky Header -->
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0 sticky top-0 z-10"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <Plus class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Daftarkan Organisasi Klien Baru
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Buat workspace tenant baru, akun admin utama, dan tentukan paket
              sewa.
            </p>
          </div>
        </div>
        <button
          type="button"
          onclick={() => (showCreateModal = false)}
          class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Scrollable Form Body -->
      <form
        onsubmit={handleCreateTenant}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-6 max-h-[calc(92vh-140px)]"
        >
          <!-- Section 1: Profil Organisasi Klien -->
          <div class="space-y-4">
            <h4
              class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"
            >
              <Building2 class="w-4 h-4" />
              1. Informasi Bisnis & Pemilik Tenant
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  for="new_org_name"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Nama Organisasi / Brand *</label
                >
                <input
                  id="new_org_name"
                  type="text"
                  bind:value={newOrgName}
                  placeholder="e.g. Toko Fashion Cantik / PT Maju Jaya"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label
                  for="new_owner_name"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Nama PIC Pemilik Bisnis</label
                >
                <input
                  id="new_owner_name"
                  type="text"
                  bind:value={newOrgOwnerName}
                  placeholder="e.g. Budi Santoso"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  for="new_admin_email"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Email Login Admin Klien *</label
                >
                <input
                  id="new_admin_email"
                  type="email"
                  bind:value={newOrgAdminEmail}
                  placeholder="e.g. admin@tokofashion.com"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label
                  for="new_admin_password"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Password Awal Login *</label
                >
                <input
                  id="new_admin_password"
                  type="text"
                  bind:value={newOrgAdminPassword}
                  placeholder="e.g. Rahasia123!"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label
                  for="new_owner_phone"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >No. WhatsApp Pemilik (Untuk Tagihan)</label
                >
                <input
                  id="new_owner_phone"
                  type="text"
                  bind:value={newOrgOwnerPhone}
                  placeholder="e.g. 081234567890"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  for="new_notes"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Catatan Internal Super Admin</label
                >
                <input
                  id="new_notes"
                  type="text"
                  bind:value={newOrgNotes}
                  placeholder="e.g. Pembayaran transfer BCA bulanan"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <!-- Section 2: Paket Sewa & Batas Kuota -->
          <div
            class="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800"
          >
            <h4
              class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
            >
              <CreditCard class="w-4 h-4" />
              2. Paket Sewa & Masa Aktif
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  for="new_plan"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Pilihan Paket Sewa</label
                >
                <select
                  id="new_plan"
                  bind:value={newOrgPlan}
                  onchange={(e) =>
                    onSelectCreatePlan((e.target as HTMLSelectElement).value)}
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  {#if saasPlans.length > 0}
                    {#each saasPlans as p}
                      <option value={p.name}>
                        {p.isPublic === false
                          ? "🔒 "
                          : ""}{p.name}{p.isPublic === false
                          ? " [Khusus Admin]"
                          : ""} ({p.price === 0
                          ? "Gratis / Rp 0"
                          : formatRupiah(p.price)} - {p.period})
                      </option>
                    {/each}
                  {:else}
                    <option value="Starter Bisnis">Starter Bisnis</option>
                  {/if}
                </select>
              </div>

              <div>
                <label
                  for="new_agents"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Maksimal Kursi Agen (CS)</label
                >
                <input
                  id="new_agents"
                  type="number"
                  min="1"
                  max="100"
                  bind:value={newOrgMaxAgents}
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  for="new_duration"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Durasi Sewa Awal</label
                >
                <select
                  id="new_duration"
                  bind:value={newOrgDurationDays}
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value={0}
                    >♾️ Gratis Selamanya (Tanpa Batas Waktu / No Expiry)</option
                  >
                  <option value={7}>7 Hari (Trial)</option>
                  <option value={14}>14 Hari (Promo)</option>
                  <option value={30}>1 Bulan (30 Hari)</option>
                  <option value={60}>2 Bulan (60 Hari)</option>
                  <option value={90}>3 Bulan (90 Hari)</option>
                  <option value={180}>6 Bulan (180 Hari)</option>
                  <option value={365}>1 Tahun (365 Hari)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Section 3: Kredensial Meta WhatsApp (Opsional) -->
          <div
            class="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800"
          >
            <div class="flex items-center justify-between">
              <h4
                class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Shield class="w-4 h-4 text-slate-400" />
                3. Kredensial Meta WhatsApp Klien (Opsional)
              </h4>
              <span class="text-[10px] text-slate-400"
                >Bisa diisi sekarang atau diatur kemudian oleh klien</span
              >
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  for="new_waba_id"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Meta WABA ID</label
                >
                <input
                  id="new_waba_id"
                  type="text"
                  bind:value={newOrgWabaId}
                  placeholder="e.g. 109823912039123"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  for="new_phone_id"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >Meta Phone Number ID</label
                >
                <input
                  id="new_phone_id"
                  type="text"
                  bind:value={newOrgPhoneNumberId}
                  placeholder="e.g. 192830192830192"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div class="sm:col-span-2">
                <label
                  for="new_token"
                  class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                  >System User Permanent Access Token</label
                >
                <input
                  id="new_token"
                  type="password"
                  bind:value={newOrgAccessToken}
                  placeholder="EAAGm..."
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Sticky Footer Action -->
        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0 sticky bottom-0 z-10"
        >
          <button
            type="button"
            onclick={() => (showCreateModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span
              >{isSubmitting
                ? "Mendaftarkan..."
                : "Daftarkan Organisasi Sekarang"}</span
            >
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL 2: EDIT ORGANISASI                                  -->
<!-- ========================================================= -->
{#if showEditModal && activeTenant}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showEditModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-3xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <!-- Sticky Header -->
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0 sticky top-0 z-10"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <Edit3 class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Ubah Data Organisasi: {activeTenant.name}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Atur paket sewa, status akses, limit agen, dan kredensial Meta.
            </p>
          </div>
        </div>
        <button
          type="button"
          onclick={() => (showEditModal = false)}
          class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Scrollable Form Body -->
      <form
        onsubmit={handleEditTenant}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-5 max-h-[calc(92vh-140px)]"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                for="edit_name"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Nama Organisasi *</label
              >
              <input
                id="edit_name"
                type="text"
                bind:value={editName}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label
                for="edit_status"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Status Akun</label
              >
              <select
                id="edit_status"
                bind:value={editStatus}
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ACTIVE">ACTIVE (Aktif)</option>
                <option value="TRIAL">TRIAL (Uji Coba)</option>
                <option value="SUSPENDED"
                  >SUSPENDED (Ditangguhkan / Telat Bayar)</option
                >
                <option value="EXPIRED">EXPIRED (Masa Sewa Habis)</option>
              </select>
            </div>

            <div>
              <label
                for="edit_plan"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Paket Sewa</label
              >
              <select
                id="edit_plan"
                bind:value={editPlan}
                onchange={(e) =>
                  onSelectEditPlan((e.target as HTMLSelectElement).value)}
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
              >
                {#if saasPlans.length > 0}
                  {#each saasPlans as p}
                    <option value={p.name}>
                      {p.isPublic === false ? "🔒 " : ""}{p.name}{p.isPublic ===
                      false
                        ? " [Khusus Admin]"
                        : ""} ({p.price === 0
                        ? "Gratis / Rp 0"
                        : formatRupiah(p.price)} - {p.period})
                    </option>
                  {/each}
                {/if}
                {#if editPlan && !saasPlans.some((p) => p.name === editPlan)}
                  <option value={editPlan}>{editPlan}</option>
                {/if}
              </select>
            </div>

            <div>
              <label
                for="edit_max_agents"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Batas Maksimal Agen (CS)</label
              >
              <input
                id="edit_max_agents"
                type="number"
                min="1"
                max="500"
                bind:value={editMaxAgents}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                for="edit_expires"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Tanggal Kadaluarsa Sewa</label
              >
              <input
                id="edit_expires"
                type="date"
                bind:value={editExpiresAt}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                for="edit_owner_name"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Nama PIC Pemilik</label
              >
              <input
                id="edit_owner_name"
                type="text"
                bind:value={editOwnerName}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                for="edit_owner_phone"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >No. WhatsApp PIC</label
              >
              <input
                id="edit_owner_phone"
                type="text"
                bind:value={editOwnerPhone}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                for="edit_owner_email"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Email PIC</label
              >
              <input
                id="edit_owner_email"
                type="email"
                bind:value={editOwnerEmail}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                for="edit_waba"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Meta WABA ID</label
              >
              <input
                id="edit_waba"
                type="text"
                bind:value={editWabaId}
                placeholder="1092830192830"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                for="edit_token"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Ganti Permanent Access Token (Kosongkan jika tidak ingin
                mengubah)
              </label>
              <input
                id="edit_token"
                type="password"
                bind:value={editAccessToken}
                placeholder="Masukkan token baru..."
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2">
              <label
                for="edit_notes"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >Catatan Admin</label
              >
              <textarea
                id="edit_notes"
                rows="2"
                bind:value={editNotes}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Sticky Footer -->
        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0 sticky bottom-0 z-10"
        >
          <button
            type="button"
            onclick={() => (showEditModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL 3: PERPANJANG MASA SEWA (+X HARI)                   -->
<!-- ========================================================= -->
{#if showExtendModal && activeTenant}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    onclick={(e) => {
      if (e.target === e.currentTarget) showExtendModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6"
    >
      <div
        class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <Calendar class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Perpanjang Masa Sewa
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {activeTenant.name}
            </p>
          </div>
        </div>
        <button
          onclick={() => (showExtendModal = false)}
          class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleExtend} class="p-6 space-y-4">
        <div>
          <label
            for="ext_days"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Pilih Durasi Perpanjangan Sewa
          </label>
          <select
            id="ext_days"
            bind:value={extendDays}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
          >
            <option value={30}>+ 1 Bulan (30 Hari)</option>
            <option value={60}>+ 2 Bulan (60 Hari)</option>
            <option value={90}>+ 3 Bulan (90 Hari)</option>
            <option value={180}>+ 6 Bulan (180 Hari)</option>
            <option value={365}>+ 1 Tahun (365 Hari)</option>
          </select>
        </div>

        <div
          class="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-300 space-y-1"
        >
          <div class="font-bold flex items-center gap-1.5">
            <Sparkles
              class="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400"
            />
            Otomatis Mengaktifkan Kembali Akun
          </div>
          <p
            class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed"
          >
            Jika organisasi sebelumnya berstatus <em>EXPIRED</em> atau
            <em>SUSPENDED</em>, tindakan ini akan langsung mengembalikan status
            menjadi <strong>ACTIVE</strong>.
          </p>
        </div>

        <div
          class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
        >
          <button
            type="button"
            onclick={() => (showExtendModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? "Memproses..." : "Perpanjang Sekarang"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL 4: RESET PASSWORD USER / ADMIN TENANT               -->
<!-- ========================================================= -->
{#if showResetPasswordModal && activeTenant}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    onclick={(e) => {
      if (e.target === e.currentTarget) showResetPasswordModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6"
    >
      <div
        class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <Key class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Bantuan Reset Password User
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {activeTenant.name}
            </p>
          </div>
        </div>
        <button
          onclick={() => (showResetPasswordModal = false)}
          class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleResetPassword} class="p-6 space-y-4">
        <!-- Select Target User -->
        <div>
          <label
            for="reset_user_select"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Pilih Akun yang Ingin Direset Password
          </label>
          <select
            id="reset_user_select"
            bind:value={resetUserId}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
          >
            {#if activeTenant.users && activeTenant.users.length > 0}
              {#each activeTenant.users as u}
                <option value={u.id}>
                  {u.fullName} — {u.email} ({u.role})
                </option>
              {/each}
            {:else}
              <option value=""
                >Akun Utama PIC ({activeTenant.ownerEmail || "Admin"})</option
              >
            {/if}
          </select>
        </div>

        <!-- New Password Input with Random Generator Button -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label
              for="reset_pwd"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              Password Baru
            </label>
            <button
              type="button"
              onclick={() => (resetPasswordNew = generateRandomPassword())}
              class="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
            >
              <Dices class="w-3.5 h-3.5" />
              <span>Buat Password Acak</span>
            </button>
          </div>

          <div class="relative">
            <input
              id="reset_pwd"
              type="text"
              bind:value={resetPasswordNew}
              placeholder="Minimal 6 karakter..."
              minlength="6"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>
        </div>

        <!-- Success Result Box with Ready-to-Send Template -->
        {#if resetSuccessInfo}
          <div
            class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5 animate-in fade-in"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5"
              >
                <CheckCircle2 class="w-4 h-4 text-emerald-500" />
                Password Berhasil Direset!
              </span>
              <button
                type="button"
                onclick={() =>
                  copyToClipboard(
                    `Halo ${activeTenant?.name},\n\nBerikut data login akun WhatsApp CRM Anda:\n- URL Login: ${window.location.origin}/login\n- Email: ${resetSuccessInfo?.email}\n- Password Baru: ${resetSuccessInfo?.pass}\n\nSilakan login dan ganti password Anda kembali. Terima kasih!`,
                    "wa_template",
                  )}
                class="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
              >
                {#if copiedText === "wa_template"}
                  <Check class="w-3 h-3" />
                  <span>Format Tersalin!</span>
                {:else}
                  <Copy class="w-3 h-3" />
                  <span>Salin Pesan WhatsApp</span>
                {/if}
              </button>
            </div>

            <div
              class="text-[11px] font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/60 space-y-1 text-slate-800 dark:text-slate-200"
            >
              <div>Email: <strong>{resetSuccessInfo.email}</strong></div>
              <div>
                Password Baru: <strong
                  class="text-indigo-600 dark:text-indigo-400"
                  >{resetSuccessInfo.pass}</strong
                >
              </div>
            </div>
          </div>
        {/if}

        <p
          class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed"
        >
          Setelah direset, Anda dapat menyalin data kredensial di atas untuk
          langsung dikirimkan kepada klien melalui WhatsApp.
        </p>

        <div
          class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
        >
          <button
            type="button"
            onclick={() => (showResetPasswordModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-amber-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Key class="w-4 h-4 stroke-[3]" />
            <span
              >{isSubmitting ? "Mereset..." : "Reset Password Sekarang"}</span
            >
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: TAMBAH STAF PLATFORM ADMINISTRATOR BARU            -->
<!-- ========================================================= -->
{#if showCreateStaffModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showCreateStaffModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <Users class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Tambah Staf Administrator Platform
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Akun mandiri pengelola platform (Finance, Support, Co-Admin)
            </p>
          </div>
        </div>
        <button
          onclick={() => (showCreateStaffModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form
        onsubmit={handleCreateStaff}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]"
        >
          <div
            class="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-300"
          >
            <ShieldCheck class="w-4 h-4 shrink-0 mt-0.5 text-indigo-500" />
            <span>
              <strong>Akun Berdiri Sendiri</strong>: Akun ini tidak dikaitkan
              dengan organisasi atau tenant manapun. Staf ini dapat mengakses
              panel <em>/administrator</em> sesuai peran yang diberikan.
            </span>
          </div>

          <div>
            <label
              for="new_staff_name"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Nama Lengkap Staf *
            </label>
            <input
              id="new_staff_name"
              type="text"
              bind:value={newStaffName}
              placeholder="e.g. Dewi Sartika (Finance)"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label
              for="new_staff_email"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Email Login *
            </label>
            <input
              id="new_staff_email"
              type="email"
              bind:value={newStaffEmail}
              placeholder="e.g. finance@perusahaan.com"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label
              for="new_staff_pwd"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Kata Sandi Awal *
            </label>
            <input
              id="new_staff_pwd"
              type="password"
              bind:value={newStaffPassword}
              placeholder="Minimal 6 karakter..."
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
              minlength="6"
            />
          </div>

          <div>
            <span
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2"
            >
              Peran / Hak Akses Staf *
            </span>
            <div class="space-y-2.5">
              <label
                class="p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition {newStaffRole ===
                'ADMIN_FINANCE'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
              >
                <input
                  type="radio"
                  name="new_role"
                  value="ADMIN_FINANCE"
                  bind:group={newStaffRole}
                  class="mt-1 text-emerald-600"
                />
                <div>
                  <div class="text-xs font-bold flex items-center gap-1.5">
                    <Wallet class="w-3.5 h-3.5 text-emerald-500" />
                    <span>Finance Staff (Keuangan & Langganan)</span>
                  </div>
                  <div class="text-[11px] opacity-75 mt-0.5">
                    Mengelola Paket SaaS, Tagihan/Invoice, Gateway Pembayaran
                    Midtrans, dan perpanjangan sewa klien.
                  </div>
                </div>
              </label>

              <label
                class="p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition {newStaffRole ===
                'ADMIN_SUPPORT'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-950 dark:text-cyan-200'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
              >
                <input
                  type="radio"
                  name="new_role"
                  value="ADMIN_SUPPORT"
                  bind:group={newStaffRole}
                  class="mt-1 text-cyan-600"
                />
                <div>
                  <div class="text-xs font-bold flex items-center gap-1.5">
                    <Network class="w-3.5 h-3.5 text-cyan-500" />
                    <span>Support / Technical Staff (Teknis & WABA)</span>
                  </div>
                  <div class="text-[11px] opacity-75 mt-0.5">
                    Membantu klien memantau organisasi, menguji validasi API
                    Meta WhatsApp, dan reset password penyewa.
                  </div>
                </div>
              </label>

              <label
                class="p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition {newStaffRole ===
                'CO_SUPER_ADMIN'
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-950 dark:text-indigo-200'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
              >
                <input
                  type="radio"
                  name="new_role"
                  value="CO_SUPER_ADMIN"
                  bind:group={newStaffRole}
                  class="mt-1 text-indigo-600"
                />
                <div>
                  <div class="text-xs font-bold flex items-center gap-1.5">
                    <Shield class="w-3.5 h-3.5 text-indigo-500" />
                    <span>Co-Super Administrator</span>
                  </div>
                  <div class="text-[11px] opacity-75 mt-0.5">
                    Memiliki hak akses untuk mengelola seluruh organisasi,
                    paket SaaS, keuangan, serta staf (tanpa akses Update Sistem Server).
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            type="button"
            onclick={() => (showCreateStaffModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? "Menyimpan..." : "Simpan Staf Baru"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: EDIT DATA STAF PLATFORM ADMINISTRATOR              -->
<!-- ========================================================= -->
{#if showEditStaffModal && activeStaff}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showEditStaffModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <Edit3 class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Edit Staf Platform
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {activeStaff.fullName}
            </p>
          </div>
        </div>
        <button
          onclick={() => (showEditStaffModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form
        onsubmit={handleUpdateStaff}
        class="flex flex-col flex-1 overflow-hidden"
      >
        <div
          class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]"
        >
          <div>
            <label
              for="edit_staff_name"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Nama Lengkap Staf *
            </label>
            <input
              id="edit_staff_name"
              type="text"
              bind:value={editStaffName}
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label
              for="edit_staff_email"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Email Login *
            </label>
            <input
              id="edit_staff_email"
              type="email"
              bind:value={editStaffEmail}
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                for="edit_staff_role"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Peran / Jabatan *
              </label>
              <select
                id="edit_staff_role"
                bind:value={editStaffRole}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="SUPER_ADMIN">Master Super Admin (Utama)</option>
                <option value="CO_SUPER_ADMIN">Co-Super Administrator</option>
                <option value="ADMIN_FINANCE">Finance Staff</option>
                <option value="ADMIN_SUPPORT">Support Staff</option>
              </select>
            </div>

            <div>
              <label
                for="edit_staff_status"
                class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Status Akun *
              </label>
              <select
                id="edit_staff_status"
                bind:value={editStaffStatus}
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="ACTIVE">ACTIVE (Aktif)</option>
                <option value="INACTIVE">INACTIVE (Nonaktif)</option>
                <option value="SUSPENDED">SUSPENDED (Ditangguhkan)</option>
              </select>
            </div>
          </div>

          <div>
            <label
              for="edit_staff_pwd"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Ganti Kata Sandi (Kosongkan jika tidak ingin diubah)
            </label>
            <input
              id="edit_staff_pwd"
              type="password"
              bind:value={editStaffPassword}
              placeholder="Masukkan password baru jika ingin mengubah..."
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
              minlength="6"
            />
          </div>
        </div>

        <div
          class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0"
        >
          <button
            type="button"
            onclick={() => (showEditStaffModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: RESET PASSWORD STAF PLATFORM                       -->
<!-- ========================================================= -->
{#if showResetStaffPasswordModal && activeStaff}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showResetStaffPasswordModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <Key class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              Reset Password Staf
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {activeStaff.fullName} ({activeStaff.email})
            </p>
          </div>
        </div>
        <button
          onclick={() => (showResetStaffPasswordModal = false)}
          class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleResetStaffPassword} class="p-6 space-y-4">
        <div>
          <label
            for="reset_staff_new_pwd"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Kata Sandi Baru *
          </label>
          <input
            id="reset_staff_new_pwd"
            type="text"
            bind:value={resetStaffNewPassword}
            placeholder="Ketik password baru..."
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition"
            required
            minlength="6"
          />
        </div>

        <div
          class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
        >
          <button
            type="button"
            onclick={() => (showResetStaffPasswordModal = false)}
            class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            class="py-2 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-amber-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Key class="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? "Mereset..." : "Reset Password"}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: HAPUS STAF PLATFORM ADMINISTRATOR                  -->
<!-- ========================================================= -->
{#if showDeleteStaffModal && activeStaff}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showDeleteStaffModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col p-6 space-y-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"
        >
          <Trash2 class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">
            Hapus Staf Platform
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Konfirmasi tindakan penghapusan
          </p>
        </div>
      </div>

      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Apakah Anda yakin ingin menghapus akun staf <strong
          >{activeStaff.fullName}</strong
        >
        ({activeStaff.email})? Tindakan ini tidak dapat dibatalkan.
      </p>

      <div
        class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          onclick={() => (showDeleteStaffModal = false)}
          class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onclick={handleDeleteStaff}
          disabled={isSubmitting}
          class="py-2 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-rose-500/20 transition cursor-pointer disabled:opacity-60"
        >
          <Trash2 class="w-4 h-4 stroke-[3]" />
          <span>{isSubmitting ? "Menghapus..." : "Hapus Sekarang"}</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: KONFIRMASI PEMBAYARAN MANUAL OLEH SUPER ADMIN      -->
<!-- ========================================================= -->
{#if showConfirmPaymentModal && orderToConfirmManual}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden"
    onclick={(e) => {
      if (e.target === e.currentTarget) showConfirmPaymentModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col p-6 space-y-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"
        >
          <CheckCircle class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">
            Konfirmasi Pembayaran Manual
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {orderToConfirmManual.orderNumber}
          </p>
        </div>
      </div>

      <div
        class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
      >
        <div class="flex justify-between">
          <span class="text-slate-400">Organisasi:</span>
          <strong class="text-slate-800 dark:text-slate-200"
            >{orderToConfirmManual.organizationName}</strong
          >
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Paket yang Dibeli:</span>
          <strong class="text-slate-800 dark:text-slate-200"
            >{orderToConfirmManual.planName} ({orderToConfirmManual.durationDays}
            Hari)</strong
          >
        </div>
        <div
          class="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2"
        >
          <span class="text-slate-400">Total Nominal:</span>
          <strong
            class="text-emerald-600 dark:text-emerald-400 font-mono text-sm"
            >{formatRupiah(orderToConfirmManual.amount)}</strong
          >
        </div>
      </div>

      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        Apakah Anda yakin ingin mengonfirmasi pembayaran untuk invoice <strong
          >{orderToConfirmManual.orderNumber}</strong
        >? Paket organisasi klien akan <strong>langsung aktif seketika</strong> dan
        masa aktifnya akan diperpanjang otomatis.
      </p>

      <div
        class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          onclick={() => {
            showConfirmPaymentModal = false;
            orderToConfirmManual = null;
          }}
          class="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onclick={() => handleConfirmManualPayment(orderToConfirmManual!)}
          disabled={isSubmitting}
          class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
        >
          <Check class="w-4 h-4 stroke-[3]" />
          <span
            >{isSubmitting
              ? "Memproses..."
              : "Konfirmasi & Aktifkan Paket"}</span
          >
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: GANTI / UPGRADE PAKET ORGANISASI KLIEN             -->
<!-- ========================================================= -->
{#if showChangePlanModal && selectedOrgForPlanChange}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    onclick={(e) => {
      if (e.target === e.currentTarget) showChangePlanModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto"
    >
      <div
        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          >
            <PackagePlus class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">
              Ganti / Upgrade Paket Organisasi
            </h3>
            <p class="text-[11px] text-slate-400 font-medium">
              Ubah paket langganan secara instan untuk klien
            </p>
          </div>
        </div>

        <button
          onclick={() => (showChangePlanModal = false)}
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleExecuteChangePlan} class="p-6 space-y-4">
        <!-- Target Org Info Pill -->
        <div
          class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
        >
          <div>
            <div
              class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider"
            >
              Organisasi Klien Terpilih
            </div>
            <div class="text-sm font-extrabold text-slate-900 dark:text-white">
              {selectedOrgForPlanChange.name}
            </div>
          </div>
          <div class="text-right">
            <div
              class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider"
            >
              Paket Saat Ini
            </div>
            <span
              class="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold border {getPlanBadgeClass(
                selectedOrgForPlanChange.plan,
              )}"
            >
              {selectedOrgForPlanChange.plan}
            </span>
          </div>
        </div>

        <!-- Pilih Paket Baru -->
        <div>
          <label
            for="target_plan_code"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Pilih Paket SaaS Baru *
          </label>
          <select
            id="target_plan_code"
            value={planChangeForm.planCode}
            onchange={(e) => onPlanSelectChange(e.currentTarget.value)}
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          >
            {#if saasPlans.length > 0}
              {#each saasPlans as p}
                <option value={p.code}>
                  {p.name} ({p.code}) — {formatRupiah(p.price)}
                </option>
              {/each}
            {:else}
              <option value="STARTER">Starter Bisnis (STARTER)</option>
              <option value="PRO">Pro Business (PRO)</option>
              <option value="ENTERPRISE"
                >Enterprise Corporate (ENTERPRISE)</option
              >
            {/if}
          </select>
        </div>

        <!-- Preview & Kustomisasi Kapasitas Paket Aktif -->
        <div
          class="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
        >
          <div>
            <label
              for="custom_agents"
              class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Kapasitas Agen CS (Kursi) *
            </label>
            <input
              id="custom_agents"
              type="number"
              min="1"
              bind:value={planChangeForm.customMaxAgents}
              class="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              required
            />
            <span class="text-[10px] text-slate-400"
              >Sesuai paket yang dipilih</span
            >
          </div>

          <div>
            <label
              for="custom_broadcast"
              class="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Kuota Broadcast / Bulan *
            </label>
            <input
              id="custom_broadcast"
              type="number"
              min="1000"
              step="1000"
              bind:value={planChangeForm.customMaxBroadcast}
              class="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              required
            />
            <span class="text-[10px] text-slate-400">Pesan per bulan</span>
          </div>
        </div>

        <!-- Model Durasi / Masa Aktif -->
        <div>
          <span
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Masa Berlaku / Durasi Paket *
          </span>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={() => (planChangeForm.durationType = "30_DAYS")}
              class="p-2.5 rounded-xl border text-xs font-bold transition text-left cursor-pointer {planChangeForm.durationType ===
              '30_DAYS'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}"
            >
              <div>+30 Hari</div>
              <div class="text-[10px] text-slate-400 font-normal">
                Sewa Bulanan
              </div>
            </button>

            <button
              type="button"
              onclick={() => (planChangeForm.durationType = "90_DAYS")}
              class="p-2.5 rounded-xl border text-xs font-bold transition text-left cursor-pointer {planChangeForm.durationType ===
              '90_DAYS'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}"
            >
              <div>+90 Hari</div>
              <div class="text-[10px] text-slate-400 font-normal">
                Sewa 3 Bulan
              </div>
            </button>

            <button
              type="button"
              onclick={() => (planChangeForm.durationType = "365_DAYS")}
              class="p-2.5 rounded-xl border text-xs font-bold transition text-left cursor-pointer {planChangeForm.durationType ===
              '365_DAYS'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}"
            >
              <div>+365 Hari</div>
              <div class="text-[10px] text-slate-400 font-normal">
                Sewa 1 Tahun
              </div>
            </button>

            <button
              type="button"
              onclick={() => (planChangeForm.durationType = "LIFETIME")}
              class="p-2.5 rounded-xl border text-xs font-bold transition text-left cursor-pointer {planChangeForm.durationType ===
              'LIFETIME'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}"
            >
              <div>Permanen</div>
              <div class="text-[10px] text-slate-400 font-normal">
                Tanpa Kadaluarsa
              </div>
            </button>
          </div>
        </div>

        <!-- Custom Expiration Datepicker (if CUSTOM) -->
        {#if planChangeForm.durationType === "CUSTOM"}
          <div>
            <label
              for="custom_exp"
              class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Tanggal Kedaluwarsa Spesifik
            </label>
            <input
              id="custom_exp"
              type="date"
              bind:value={planChangeForm.customExpiresAt}
              class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        {/if}

        <!-- Catatan Admin -->
        <div>
          <label
            for="plan_notes"
            class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Catatan Perubahan (Opsional)
          </label>
          <input
            id="plan_notes"
            type="text"
            bind:value={planChangeForm.notes}
            placeholder="e.g. Upgrade khusus promo akhir tahun dari admin"
            class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <!-- Action Buttons -->
        <div
          class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800"
        >
          <button
            type="button"
            onclick={() => (showChangePlanModal = false)}
            class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isChangingPlan}
            class="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {#if isChangingPlan}
              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
              <span>Menyimpan...</span>
            {:else}
              <Check class="w-3.5 h-3.5 stroke-[3]" />
              <span>Simpan & Terapkan Paket</span>
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ========================================================= -->
<!-- MODAL: KONFIRMASI GIT PULL UPDATE                         -->
<!-- ========================================================= -->
{#if showConfirmGitPullModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
    onclick={(e) => {
      if (e.target === e.currentTarget) showConfirmGitPullModal = false;
    }}
  >
    <div
      class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 my-auto"
    >
      <div class="flex items-center gap-3">
        <div
          class="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        >
          <GitPullRequest class="w-6 h-6" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            Konfirmasi Terapkan Update GitHub
          </h3>
          <p class="text-xs text-slate-400">
            Tindakan ini akan menjalankan git pull origin {gitStatus?.currentBranch ||
              "main"}
          </p>
        </div>
      </div>

      <div
        class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1"
      >
        <div class="font-bold flex items-center gap-1.5">
          <AlertCircle class="w-4 h-4 text-amber-500" />
          <span>Perhatian Pembaruan Codebase</span>
        </div>
        <p class="text-[11px] leading-relaxed">
          Sistem akan menarik kode sumber terbaru dari GitHub. Jika proses
          selesai, server akan me-reload layanan secara otomatis untuk menerapkan
          patch baru.
        </p>
      </div>

      <div class="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          onclick={() => (showConfirmGitPullModal = false)}
          class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onclick={handleGitPull}
          class="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-2"
        >
          <ArrowUpCircle class="w-4 h-4" />
          <span>Ya, Jalankan Git Pull Sekarang</span>
        </button>
      </div>
    </div>
  </div>
{/if}
