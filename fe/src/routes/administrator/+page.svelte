<script lang="ts">
  import { apiRequest } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { onMount } from 'svelte';
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
    ShieldCheck
  } from 'lucide-svelte';

  interface TenantItem {
    id: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'EXPIRED';
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
    createdAt: string;
    stats: {
      userCount: number;
      agentCount: number;
      conversationCount: number;
      contactCount: number;
    };
    users: Array<{
      id: string;
      fullName: string;
      email: string;
      role: string;
      status: string;
      isOnline?: boolean;
    }>;
    phoneNumbers: Array<{
      id: string;
      displayPhoneNumber: string;
      verifiedName: string;
      qualityRating: string;
    }>;
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
    durationType?: 'PERMANENT' | 'MONTHLY' | 'DAYS';
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
    environment: 'sandbox' | 'production';
    serverKey: string;
    clientKey: string;
    merchantId?: string;
  }

  // Active Tab
  let activeTab = $state<'tenants' | 'plans' | 'midtrans'>('tenants');

  // Main Data States
  let organizationsList = $state<TenantItem[]>([]);
  let overview = $state<PlatformOverview | null>(null);
  let saasPlans = $state<SaaSPlan[]>([]);
  let midtrans = $state<MidtransSetting>({
    isEnabled: false,
    environment: 'sandbox',
    serverKey: '',
    clientKey: '',
    merchantId: '',
  });

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let feedbackMessage = $state<{ text: string; type: 'success' | 'error' } | null>(null);
  let copiedText = $state<string | null>(null);

  // Super Admin Login Gate state
  let loginEmail = $state('admin@perusahaan.com');
  let loginPassword = $state('');
  let loginLoading = $state(false);
  let loginError = $state<string | null>(null);
  let showPassword = $state(false);

  // Super Admin Profile Edit Modal state
  let showProfileModal = $state(false);
  let profileFullName = $state('');
  let profileEmail = $state('');
  let profileCurrentPassword = $state('');
  let profileNewPassword = $state('');
  let profileLoading = $state(false);

  // Meta Integration Wizard Modal state
  let showMetaModal = $state(false);
  let metaOrg = $state<TenantItem | null>(null);
  let metaWabaId = $state('');
  let metaPhoneId = $state('');
  let metaDisplayPhone = $state('');
  let metaVerifiedName = $state('');
  let metaAccessToken = $state('');
  let metaAppId = $state('');
  let metaTestResult = $state<{ success: boolean; message: string; data?: any; error?: string } | null>(null);
  let isTestingMeta = $state(false);

  // SaaS Plan Edit/Create Modal state
  let showPlanModal = $state(false);
  let editingPlan = $state<SaaSPlan | null>(null);
  let planName = $state('');
  let planCode = $state<string>('STARTER');
  let planPrice = $state(199000);
  let planPeriod = $state('bulan');
  let planDurationType = $state<'PERMANENT' | 'MONTHLY' | 'DAYS'>('MONTHLY');
  let planDurationDays = $state(30);
  let planMaxAgents = $state(5);
  let planMaxBroadcast = $state(5000);
  let planDescription = $state('');
  let planFeaturesText = $state('');
  let planIsPopular = $state(false);
  let planIsPublic = $state(true);
  let planIsActive = $state(true);

  // Midtrans Key Visibility
  let showMidtransServerKey = $state(false);

  // Check if authenticated as SUPER_ADMIN
  const isSuperAdminLoggedIn = $derived(
    !!authStore.token && (authStore.user?.role === 'SUPER_ADMIN' || authStore.user?.role === 'ADMINISTRATOR')
  );

  // Filters & Search for Tenants
  let searchQuery = $state('');
  let selectedStatus = $state<string>('ALL');
  let selectedPlan = $state<string>('ALL');

  // Modals state for Tenants
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showExtendModal = $state(false);
  let showResetPasswordModal = $state(false);
  let showUsersModal = $state(false);
  let activeTenant = $state<TenantItem | null>(null);

  // Form Fields: Create Organization
  let newOrgName = $state('');
  let newOrgPlan = $state<string>('STARTER');
  let newOrgMaxAgents = $state(5);
  let newOrgDurationDays = $state(30);
  let newOrgOwnerName = $state('');
  let newOrgAdminEmail = $state('');
  let newOrgAdminPassword = $state('');
  let newOrgOwnerPhone = $state('');
  let newOrgNotes = $state('');
  let newOrgWabaId = $state('');
  let newOrgPhoneNumberId = $state('');
  let newOrgDisplayPhone = $state('');
  let newOrgAccessToken = $state('');

  // Form Fields: Edit Organization
  let editName = $state('');
  let editPlan = $state<string>('STARTER');
  let editStatus = $state<'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'EXPIRED'>('ACTIVE');
  let editMaxAgents = $state(5);
  let editMaxBroadcast = $state(10000);
  let editExpiresAt = $state<string>('');
  let editOwnerName = $state('');
  let editOwnerPhone = $state('');
  let editOwnerEmail = $state('');
  let editNotes = $state('');
  let editWabaId = $state('');
  let editAppId = $state('');
  let editAccessToken = $state('');

  // Form Fields: Extend Subscription
  let extendDays = $state(30);

  // Form Fields: Reset Admin Password
  let resetUserId = $state<string>('');
  let resetPasswordNew = $state('');
  let resetSuccessInfo = $state<{ email: string; pass: string } | null>(null);

  onMount(async () => {
    if (authStore.token) {
      await authStore.fetchFreshProfile();
      await loadData();
    } else {
      isLoading = false;
    }
  });

  function openSuperAdminProfile() {
    profileFullName = authStore.user?.fullName || 'Master Administrator';
    profileEmail = authStore.user?.email || 'admin@perusahaan.com';
    profileCurrentPassword = '';
    profileNewPassword = '';
    showProfileModal = true;
  }

  async function handleUpdateProfile(e: Event) {
    e.preventDefault();
    if (!profileEmail.trim()) {
      feedbackMessage = { text: 'Email tidak boleh kosong!', type: 'error' };
      return;
    }

    profileLoading = true;
    const res = await apiRequest<any>('/auth/profile', {
      method: 'PUT',
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
      feedbackMessage = { text: res.message || 'Profil & Data Login Anda Berhasil Diperbarui!', type: 'success' };
      if (res.token && res.user) {
        authStore.setAuth(res.token, {
          ...authStore.user!,
          ...res.user,
        });
      }
      await authStore.fetchFreshProfile();
    } else {
      feedbackMessage = { text: res.error || 'Gagal memperbarui profil login', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleSuperAdminLogin(e: Event) {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      loginError = 'Harap isi email dan password super admin';
      return;
    }

    loginLoading = true;
    loginError = null;

    const res = await authStore.login({ email: loginEmail, password: loginPassword });
    loginLoading = false;

    if (res.success) {
      await authStore.fetchFreshProfile();
      await loadData();
    } else {
      loginError = res.error || 'Login gagal. Periksa kembali email dan kata sandi Anda.';
    }
  }

  async function loadData() {
    if (!authStore.token) return;
    isLoading = true;
    try {
      const [overviewRes, orgsRes, settingsRes] = await Promise.all([
        apiRequest<any>('/super-admin/overview'),
        apiRequest<any>('/super-admin/organizations'),
        apiRequest<any>('/super-admin/settings'),
      ]);

      if (overviewRes && overviewRes.success) {
        overview = overviewRes.data || overviewRes;
      }
      if (orgsRes && orgsRes.success) {
        organizationsList = orgsRes.items || (orgsRes.data && orgsRes.data.items) || (Array.isArray(orgsRes.data) ? orgsRes.data : []);
      }
      if (settingsRes && settingsRes.success && settingsRes.data) {
        saasPlans = settingsRes.data.plans || [];
        if (settingsRes.data.paymentGateway) {
          midtrans = settingsRes.data.paymentGateway;
        }
      }
    } catch (e: any) {
      feedbackMessage = { text: e?.message || 'Gagal memuat data pengaturan', type: 'error' };
    } finally {
      isLoading = false;
    }
  }

  // ==========================================
  // META CLOUD API INTEGRATION WIZARD HANDLERS
  // ==========================================
  function openMetaWizard(tenant: TenantItem) {
    metaOrg = tenant;
    metaWabaId = tenant.wabaId || '';
    metaPhoneId = tenant.phoneNumbers?.[0]?.id || '';
    metaDisplayPhone = tenant.phoneNumbers?.[0]?.displayPhoneNumber || '';
    metaVerifiedName = tenant.phoneNumbers?.[0]?.verifiedName || tenant.name;
    metaAccessToken = '';
    metaAppId = tenant.appId || '';
    metaTestResult = null;
    showMetaModal = true;
  }

  async function handleTestMetaConnection() {
    if (!metaOrg) return;
    isTestingMeta = true;
    metaTestResult = null;

    const res = await apiRequest<any>(`/super-admin/organizations/${metaOrg.id}/test-meta`, {
      method: 'POST',
      body: JSON.stringify({
        wabaId: metaWabaId.trim() || undefined,
        phoneNumberId: metaPhoneId.trim() || undefined,
        accessToken: metaAccessToken.trim() || undefined,
      }),
    });
    isTestingMeta = false;

    if (res.success) {
      metaTestResult = {
        success: true,
        message: res.message || 'Koneksi ke Meta Cloud API Berhasil!',
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
        message: res.error || 'Gagal menghubungkan ke Meta API',
        error: res.error,
      };
    }
  }

  async function handleSaveMetaConfig(e: Event) {
    e.preventDefault();
    if (!metaOrg) return;

    isSubmitting = true;
    const res = await apiRequest(`/super-admin/organizations/${metaOrg.id}/meta-config`, {
      method: 'PUT',
      body: JSON.stringify({
        wabaId: metaWabaId.trim() || undefined,
        phoneNumberId: metaPhoneId.trim() || undefined,
        displayPhoneNumber: metaDisplayPhone.trim() || undefined,
        verifiedName: metaVerifiedName.trim() || undefined,
        accessToken: metaAccessToken.trim() || undefined,
        appId: metaAppId.trim() || undefined,
        qualityRating: metaTestResult?.data?.phoneNumber?.quality_rating || undefined,
      }),
    });
    isSubmitting = false;

    if (res.success) {
      showMetaModal = false;
      feedbackMessage = { text: 'Integrasi Meta WhatsApp Cloud API berhasil disimpan!', type: 'success' };
      loadData();
    } else {
      feedbackMessage = { text: res.error || 'Gagal menyimpan konfigurasi Meta', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  // ==========================================
  // PLANS MANAGEMENT HANDLERS
  // ==========================================
  function openCreatePlan(isPromo = false) {
    editingPlan = null;
    if (isPromo) {
      planName = 'Promo Spesial';
      planCode = 'PROMO';
      planPrice = 0;
      planPeriod = '14 hari';
      planDurationType = 'DAYS';
      planDurationDays = 14;
      planMaxAgents = 3;
      planMaxBroadcast = 1000;
      planDescription = 'Paket promo khusus dari Super Admin.';
      planFeaturesText = '3 Kursi Agen CS\n1.000 Broadcast / Bulan\nLive Inbox & Kontak\nTemplate Pesan';
      planIsPopular = false;
      planIsPublic = false; // Default: Khusus Super Admin
      planIsActive = true;
    } else {
      planName = '';
      planCode = 'STARTER';
      planPrice = 299000;
      planPeriod = 'bulan';
      planDurationType = 'MONTHLY';
      planDurationDays = 30;
      planMaxAgents = 10;
      planMaxBroadcast = 15000;
      planDescription = '';
      planFeaturesText = '10 Kursi Agen CS\n15.000 Broadcast / Bulan\nLive Chat & SLA Report\nAPI Key Webhook';
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
    planPeriod = plan.period || 'bulan';
    planDurationType = plan.durationType || (plan.price === 0 ? (plan.durationDays === 0 ? 'PERMANENT' : 'DAYS') : 'MONTHLY');
    planDurationDays = plan.durationDays !== undefined ? plan.durationDays : (planDurationType === 'PERMANENT' ? 0 : 30);
    planMaxAgents = plan.maxAgents;
    planMaxBroadcast = plan.maxBroadcastPerMonth;
    planDescription = plan.description;
    planFeaturesText = (plan.features || []).join('\n');
    planIsPopular = !!plan.isPopular;
    planIsPublic = plan.isPublic !== false;
    planIsActive = plan.isActive !== false;
    showPlanModal = true;
  }

  async function handleSavePlan(e: Event) {
    e.preventDefault();
    if (!planName.trim()) {
      feedbackMessage = { text: 'Nama paket wajib diisi!', type: 'error' };
      return;
    }

    const featuresArray = planFeaturesText
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const actualDurationDays = planDurationType === 'PERMANENT' ? 0 : Number(planDurationDays);
    const actualPeriod = planDurationType === 'PERMANENT' ? 'selamanya' : planDurationType === 'DAYS' ? `${actualDurationDays} hari` : 'bulan';

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
          : p
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
    const res = await apiRequest('/super-admin/settings/plans', {
      method: 'PUT',
      body: JSON.stringify({ plans: updatedPlans }),
    });
    isSubmitting = false;

    if (res.success) {
      saasPlans = updatedPlans;
      showPlanModal = false;
      feedbackMessage = { text: 'Daftar paket & harga SaaS berhasil disimpan!', type: 'success' };
    } else {
      feedbackMessage = { text: res.error || 'Gagal menyimpan paket', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 4000);
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus paket sewa ini?')) return;

    const updatedPlans = saasPlans.filter((p) => p.id !== planId);
    isSubmitting = true;
    const res = await apiRequest('/super-admin/settings/plans', {
      method: 'PUT',
      body: JSON.stringify({ plans: updatedPlans }),
    });
    isSubmitting = false;

    if (res.success) {
      saasPlans = updatedPlans;
      feedbackMessage = { text: 'Paket berhasil dihapus!', type: 'success' };
    } else {
      feedbackMessage = { text: res.error || 'Gagal menghapus paket', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 4000);
  }

  // ==========================================
  // MIDTRANS PAYMENT GATEWAY HANDLERS
  // ==========================================
  async function handleSaveMidtrans(e: Event) {
    e.preventDefault();
    isSubmitting = true;
    const res = await apiRequest('/super-admin/settings/payment', {
      method: 'PUT',
      body: JSON.stringify(midtrans),
    });
    isSubmitting = false;

    if (res.success) {
      feedbackMessage = { text: 'Konfigurasi pembayaran Midtrans berhasil disimpan!', type: 'success' };
    } else {
      feedbackMessage = { text: res.error || 'Gagal menyimpan konfigurasi Midtrans', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  // ==========================================
  // TENANTS MANAGEMENT HANDLERS
  // ==========================================
  function openCreate() {
    newOrgName = '';
    const defaultPlan = saasPlans[0];
    newOrgPlan = defaultPlan?.name || 'STARTER';
    newOrgMaxAgents = defaultPlan?.maxAgents || 5;
    newOrgDurationDays = defaultPlan?.durationType === 'PERMANENT' ? 0 : defaultPlan?.durationDays || 30;
    newOrgOwnerName = '';
    newOrgAdminEmail = '';
    newOrgAdminPassword = '';
    newOrgOwnerPhone = '';
    newOrgNotes = '';
    newOrgWabaId = '';
    newOrgPhoneNumberId = '';
    newOrgDisplayPhone = '';
    newOrgAccessToken = '';
    showCreateModal = true;
  }

  function onSelectCreatePlan(planNameOrCode: string) {
    newOrgPlan = planNameOrCode;
    const found = saasPlans.find((p) => p.name === planNameOrCode || p.code === planNameOrCode);
    if (found) {
      newOrgMaxAgents = found.maxAgents;
      if (found.durationType === 'PERMANENT') {
        newOrgDurationDays = 0;
      } else if (found.durationDays) {
        newOrgDurationDays = found.durationDays;
      }
    }
  }

  function onSelectEditPlan(planNameOrCode: string) {
    editPlan = planNameOrCode;
    const found = saasPlans.find((p) => p.name === planNameOrCode || p.code === planNameOrCode);
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
    editExpiresAt = tenant.expiresAt ? tenant.expiresAt.substring(0, 10) : '';
    editOwnerName = tenant.ownerName || '';
    editOwnerPhone = tenant.ownerPhone || '';
    editOwnerEmail = tenant.ownerEmail || '';
    editNotes = tenant.notes || '';
    editWabaId = tenant.wabaId || '';
    editAppId = tenant.appId || '';
    editAccessToken = '';
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
    const adminUser = tenant.users?.find((u) => u.role === 'ADMINISTRATOR') || tenant.users?.[0];
    resetUserId = specificUserId || adminUser?.id || '';
    resetPasswordNew = generateRandomPassword();
    resetSuccessInfo = null;
    showResetPasswordModal = true;
  }

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let result = '';
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
    if (!newOrgName.trim() || !newOrgAdminEmail.trim() || !newOrgAdminPassword.trim()) {
      feedbackMessage = { text: 'Mohon lengkapi nama organisasi, email, dan password admin!', type: 'error' };
      return;
    }

    isSubmitting = true;
    const res = await apiRequest<any>('/super-admin/organizations', {
      method: 'POST',
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
      feedbackMessage = { text: res.message || 'Organisasi baru berhasil didaftarkan!', type: 'success' };
      loadData();
    } else {
      feedbackMessage = { text: res.error || 'Gagal mendaftarkan organisasi', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleEditTenant(e: Event) {
    e.preventDefault();
    if (!activeTenant) return;

    isSubmitting = true;
    const res = await apiRequest(`/super-admin/organizations/${activeTenant.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: editName.trim(),
        plan: editPlan,
        status: editStatus,
        maxAgents: Number(editMaxAgents),
        maxBroadcastPerMonth: Number(editMaxBroadcast),
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
        ownerName: editOwnerName.trim(),
        ownerPhone: editOwnerPhone.trim(),
        ownerEmail: editOwnerEmail.trim(),
        notes: editNotes.trim(),
        wabaId: editWabaId.trim(),
        appId: editAppId.trim(),
        accessToken: editAccessToken.trim() ? editAccessToken.trim() : undefined,
      }),
    });
    isSubmitting = false;

    if (res.success) {
      showEditModal = false;
      feedbackMessage = { text: res.message || 'Data organisasi berhasil diperbarui!', type: 'success' };
      loadData();
    } else {
      feedbackMessage = { text: res.error || 'Gagal memperbarui organisasi', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleExtend(e: Event) {
    e.preventDefault();
    if (!activeTenant) return;

    isSubmitting = true;
    const res = await apiRequest<any>(`/super-admin/organizations/${activeTenant.id}/extend`, {
      method: 'POST',
      body: JSON.stringify({ days: Number(extendDays) }),
    });
    isSubmitting = false;

    if (res.success) {
      showExtendModal = false;
      feedbackMessage = { text: res.message || 'Masa aktif sewa berhasil diperpanjang!', type: 'success' };
      loadData();
    } else {
      feedbackMessage = { text: res.error || 'Gagal memperpanjang masa aktif sewa', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleToggleStatus(tenant: TenantItem) {
    const nextStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionName = nextStatus === 'ACTIVE' ? 'mengaktifkan kembali' : 'menangguhkan (suspend)';

    if (!confirm(`Apakah Anda yakin ingin ${actionName} organisasi "${tenant.name}"?`)) return;

    const res = await apiRequest(`/super-admin/organizations/${tenant.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus }),
    });

    if (res.success) {
      feedbackMessage = { text: res.message || `Status berhasil diubah`, type: 'success' };
      loadData();
    } else {
      feedbackMessage = { text: res.error || 'Gagal mengubah status organisasi', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 4000);
  }

  async function handleImpersonate(tenant: TenantItem) {
    if (!confirm(`Anda akan masuk ke dashboard sebagai Admin dari "${tenant.name}". Lanjutkan?`)) return;

    const res = await apiRequest<any>(`/super-admin/organizations/${tenant.id}/impersonate`, {
      method: 'POST',
    });

    if (res.success && res.data?.token && res.data?.user) {
      authStore.impersonate(res.data.token, res.data.user);
      window.location.href = '/inbox';
    } else {
      feedbackMessage = { text: res.error || 'Gagal masuk ke akun tenant', type: 'error' };
      setTimeout(() => (feedbackMessage = null), 4000);
    }
  }

  async function handleResetPassword(e: Event) {
    e.preventDefault();
    if (!activeTenant || !resetPasswordNew.trim()) return;

    isSubmitting = true;
    const res = await apiRequest<any>(`/super-admin/organizations/${activeTenant.id}/reset-admin-password`, {
      method: 'POST',
      body: JSON.stringify({
        userId: resetUserId || undefined,
        newPassword: resetPasswordNew.trim(),
      }),
    });
    isSubmitting = false;

    if (res.success) {
      const targetUser = activeTenant.users?.find((u) => u.id === resetUserId) || activeTenant.users?.[0];
      resetSuccessInfo = {
        email: targetUser?.email || activeTenant.ownerEmail || 'admin',
        pass: resetPasswordNew.trim(),
      };
      feedbackMessage = { text: res.message || 'Password berhasil direset!', type: 'success' };
    } else {
      feedbackMessage = { text: res.error || 'Gagal mereset password', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  async function handleDeleteTenant(tenant: TenantItem) {
    const confirmation = prompt(
      `PERINGATAN: Menghapus organisasi akan menghapus SELURUH chat, kontak, agen, dan data template di dalamnya.\n\nKetik nama organisasi "${tenant.name}" untuk konfirmasi:`
    );

    if (confirmation !== tenant.name) {
      if (confirmation !== null) alert('Nama organisasi tidak cocok. Penghapusan dibatalkan.');
      return;
    }

    const res = await apiRequest(`/super-admin/organizations/${tenant.id}`, { method: 'DELETE' });
    if (res.success) {
      feedbackMessage = { text: res.message || `Organisasi ${tenant.name} berhasil dihapus`, type: 'success' };
      loadData();
    } else {
      feedbackMessage = { text: res.error || 'Gagal menghapus organisasi', type: 'error' };
    }
    setTimeout(() => (feedbackMessage = null), 5000);
  }

  function getPrimaryAdmin(org: TenantItem) {
    return org.users?.find((u) => u.role === 'ADMINISTRATOR') || org.users?.[0];
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
        (org.users && org.users.some((u) => (u?.email && u.email.toLowerCase().includes(q)) || (u?.fullName && u.fullName.toLowerCase().includes(q))));

      const matchStatus = selectedStatus === 'ALL' || org.status === selectedStatus;
      const matchPlan = selectedPlan === 'ALL' || org.plan === selectedPlan;

      return matchSearch && matchStatus && matchPlan;
    })
  );

  const allDistinctPlans = $derived.by(() => {
    const plansSet = new Set<string>();
    for (const p of saasPlans) if (p.name) plansSet.add(p.name);
    for (const o of organizationsList) if (o.plan) plansSet.add(o.plan);
    return Array.from(plansSet);
  });

  function getPlanBadgeClass(plan: string) {
    const upper = (plan || '').toUpperCase();
    if (upper.includes('ENTERPRISE') || upper.includes('VIP') || upper.includes('PLATINUM')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
    if (upper.includes('BUSINESS') || upper.includes('PRO') || upper.includes('GOLD')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
    if (upper.includes('STARTER') || upper.includes('BASIC') || upper.includes('STANDARD')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (upper.includes('TRIAL') || upper.includes('PROMO') || upper.includes('GRATIS') || upper.includes('FREE')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'SUSPENDED':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'EXPIRED':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'TRIAL':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  }

  function formatRupiah(amount: number) {
    if (amount === 0) return 'Gratis (Rp 0)';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  }
</script>

<svelte:head>
  <title>Portal Master Administrator (/administrator) — WhatsApp CRM SaaS</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
  <!-- Top Master Navigation Bar -->
  <header class="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
        <Building2 class="w-5 h-5 stroke-[2.5]" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">Portal Kontrol Master SaaS</h1>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            /administrator
          </span>
        </div>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">Pusat Manajemen Seluruh Organisasi, Paket Sewa, & Integrasi Meta WhatsApp</p>
      </div>
    </div>

    <!-- Header Right Quick Actions -->
    <div class="flex items-center gap-2.5">
      {#if isSuperAdminLoggedIn}
        <!-- Edit Super Admin Profile & Credentials -->
        <button
          onclick={openSuperAdminProfile}
          class="flex items-center gap-2 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
          title="Ubah Nama, Email Login, dan Password Akun Super Admin Anda"
        >
          <UserCog class="w-4 h-4 text-indigo-500" />
          <span class="hidden md:inline">Akun Saya ({authStore.user?.fullName?.split(' ')[0] || 'Super Admin'})</span>
        </button>

        <!-- Button to Open Live CRM -->
        <a
          href="/inbox"
          class="hidden sm:flex items-center gap-2 py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
        >
          <LayoutDashboard class="w-4 h-4 text-emerald-500" />
          <span>Buka Live CRM</span>
        </a>
      {/if}

      <!-- Theme Switcher -->
      <button
        onclick={() => themeStore.toggle()}
        class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
        title="Ubah Tema Light / Dark"
      >
        {#if themeStore.current === 'dark'}
          <Sun class="w-4 h-4 text-amber-400" />
        {:else}
          <Moon class="w-4 h-4 text-indigo-600" />
        {/if}
      </button>

      {#if isSuperAdminLoggedIn}
        <!-- Logout -->
        <button
          onclick={() => authStore.logout()}
          class="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
          title="Keluar / Logout"
        >
          <LogOut class="w-4 h-4" />
        </button>
      {/if}
    </div>
  </header>

  <!-- Content Area -->
  {#if !isSuperAdminLoggedIn}
    <!-- ========================================================= -->
    <!-- DEDICATED SUPER ADMIN LOGIN GATE                          -->
    <!-- ========================================================= -->
    <div class="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      <!-- Glow effects -->
      <div class="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div class="w-full max-w-md relative z-10 my-8">
        <!-- Logo & Title -->
        <div class="text-center mb-6">
          <div class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-500 items-center justify-center shadow-xl shadow-indigo-500/25 text-white mb-3">
            <Shield class="w-7 h-7 stroke-[2.5]" />
          </div>
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Autentikasi Master Super Admin</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Masuk untuk mengelola seluruh organisasi & kontrol sewa SaaS</p>
        </div>

        <!-- Login Card -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-7 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
          {#if loginError}
            <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{loginError}</span>
            </div>
          {/if}

          <form onsubmit={handleSuperAdminLogin} class="space-y-4">
            <div>
              <label for="super_email" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email Super Admin</label>
              <div class="relative">
                <Mail class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
              <label for="super_pwd" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Password Super Admin</label>
              <div class="relative">
                <Lock class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="super_pwd"
                  type={showPassword ? 'text' : 'password'}
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
                <div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                <span>Memverifikasi Akses...</span>
              {:else}
                <span>Masuk ke Portal Master</span>
                <ArrowRight class="w-4 h-4" />
              {/if}
            </button>
          </form>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
            <p class="text-[11px] text-slate-400">
              Kredensial Default: <span class="font-mono text-indigo-500">admin@perusahaan.com</span> / <span class="font-mono text-indigo-500">admin12345</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- ========================================================= -->
    <!-- MASTER SUPER ADMIN DASHBOARD WITH TABS                    -->
    <!-- ========================================================= -->
    <main class="flex-1 p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
      <!-- Tabs Navigation Header -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
        <button
          onclick={() => (activeTab = 'tenants')}
          class="py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 {activeTab === 'tenants'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}"
        >
          <Building2 class="w-4 h-4" />
          <span>Manajemen Organisasi Klien ({organizationsList.length})</span>
        </button>

        <button
          onclick={() => (activeTab = 'plans')}
          class="py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 {activeTab === 'plans'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}"
        >
          <Package class="w-4 h-4" />
          <span>Pengaturan Paket & Promo SaaS</span>
        </button>

        <button
          onclick={() => (activeTab = 'midtrans')}
          class="py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 {activeTab === 'midtrans'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}"
        >
          <Wallet class="w-4 h-4" />
          <span>Channel Pembayaran Midtrans</span>
          {#if midtrans.isEnabled}
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          {/if}
        </button>
      </div>

      <!-- Feedback Banner -->
      {#if feedbackMessage}
        <div
          class="p-4 rounded-2xl flex items-center gap-3 border text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 {feedbackMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'}"
        >
          {#if feedbackMessage.type === 'success'}
            <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0" />
          {:else}
            <AlertTriangle class="w-4 h-4 text-rose-500 shrink-0" />
          {/if}
          <span class="flex-1">{feedbackMessage.text}</span>
          <button onclick={() => (feedbackMessage = null)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>
      {/if}

      <!-- ========================================================= -->
      <!-- TAB 1: MANAJEMEN TENANT & ORGANISASI                      -->
      <!-- ========================================================= -->
      {#if activeTab === 'tenants'}
        <!-- Top Action Banner -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div class="space-y-1">
            <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Manajemen Organisasi Klien</span>
              <span class="text-xs font-normal text-slate-500 dark:text-slate-400">({filteredOrganizations.length} Terdaftar)</span>
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Kelola aktivasi sewa, integrasi Meta WhatsApp API, akun admin login, dan reset password user.
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
            <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span class="text-xs font-bold uppercase tracking-wider">Total Klien / Tenant</span>
                <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Building2 class="w-4 h-4" />
                </div>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-slate-900 dark:text-white">{overview.totalOrganizations}</span>
                <span class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {overview.activeOrganizations} Aktif
                </span>
              </div>
              <div class="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <span>{overview.trialOrganizations} Trial</span>
                <span>•</span>
                <span class="text-rose-500 dark:text-rose-400 font-medium">{overview.suspendedOrganizations} Suspend</span>
                <span>•</span>
                <span class="text-amber-500 dark:text-amber-400 font-medium">{overview.expiredOrganizations} Expired</span>
              </div>
            </div>

            <!-- Card 2: Platform Agents -->
            <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span class="text-xs font-bold uppercase tracking-wider">Total Kursi Agen CS</span>
                <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Users class="w-4 h-4" />
                </div>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-slate-900 dark:text-white">{overview.totalAgents}</span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400">dari {overview.totalUsers} akun</span>
              </div>
              <div class="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                Agen aktif menangani chat di seluruh tenant
              </div>
            </div>

            <!-- Card 3: Platform Chats -->
            <div class="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div class="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span class="text-xs font-bold uppercase tracking-wider">Total Pesan Platform</span>
                <div class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <MessageSquare class="w-4 h-4" />
                </div>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-slate-900 dark:text-white">{overview.totalMessages.toLocaleString('id-ID')}</span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400">pesan</span>
              </div>
              <div class="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                Dari {overview.totalConversations.toLocaleString('id-ID')} sesi chat
              </div>
            </div>

            <!-- Card 4: Expiring Alert -->
            <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-indigo-500/30 shadow-md space-y-2">
              <div class="flex items-center justify-between text-slate-300">
                <span class="text-xs font-bold uppercase tracking-wider">Segera Habis (&le; 7 Hari)</span>
                <div class="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Clock class="w-4 h-4" />
                </div>
              </div>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-black text-amber-400">{overview.expiringSoonCount}</span>
                <span class="text-[11px] text-slate-300">organisasi</span>
              </div>
              <div class="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                {overview.expiringSoonCount > 0 ? 'Perlu follow-up pembayaran sewa' : 'Semua sewa tenant aman'}
              </div>
            </div>
          </div>
        {/if}

        <!-- Search & Filter Controls -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
          <!-- Search Bar -->
          <div class="relative flex-1 w-full">
            <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
              <option value="ALL">Semua Paket ({allDistinctPlans.length})</option>
              {#each allDistinctPlans as pName}
                <option value={pName}>{pName}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Organizations Table -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead class="bg-slate-50 dark:bg-slate-950/90 font-bold text-[11px] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
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
                      <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      <span>Memuat data organisasi penyewa...</span>
                    </td>
                  </tr>
                {:else if filteredOrganizations.length === 0}
                  <tr>
                    <td colspan="6" class="py-12 text-center text-slate-400">
                      <Building2 class="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                      <p class="font-bold text-slate-700 dark:text-slate-300">Tidak ada organisasi yang sesuai filter</p>
                      <p class="text-[11px] text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau daftarkan tenant baru.</p>
                    </td>
                  </tr>
                {:else}
                  {#each filteredOrganizations as org (org.id)}
                    {@const primaryAdmin = getPrimaryAdmin(org)}
                    {@const phoneItem = org.phoneNumbers?.[0]}
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <!-- Org Info & PIC & Admin Login Account -->
                      <td class="py-3.5 px-4">
                        <div class="flex items-start gap-3">
                          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs mt-0.5">
                            {org.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div class="space-y-1.5 min-w-0">
                            <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                              <span>{org.name}</span>
                              {#if org.hasAccessToken}
                                <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Access Token Terhubung"></span>
                              {/if}
                            </div>

                            <!-- Primary Admin Account Box -->
                            <div class="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1">
                              <div class="flex items-center justify-between gap-2">
                                <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                  <Shield class="w-3 h-3" />
                                  Admin Login:
                                </span>
                                {#if primaryAdmin}
                                  <button
                                    type="button"
                                    onclick={() => copyToClipboard(primaryAdmin.email, `email_${primaryAdmin.id}`)}
                                    class="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer font-medium"
                                    title="Salin Email Admin"
                                  >
                                    {#if copiedText === `email_${primaryAdmin.id}`}
                                      <Check class="w-3 h-3 text-emerald-500" />
                                      <span class="text-emerald-500">Tersalin</span>
                                    {:else}
                                      <Copy class="w-3 h-3" />
                                      <span>Salin</span>
                                    {/if}
                                  </button>
                                {/if}
                              </div>
                              <div class="font-mono text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 truncate">
                                <Mail class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span class="truncate">{primaryAdmin?.email || org.ownerEmail || 'Belum ada akun admin'}</span>
                              </div>
                              <div class="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span>PIC: <strong>{primaryAdmin?.fullName || org.ownerName || 'Admin'}</strong></span>
                                {#if org.ownerPhone}
                                  <span>•</span>
                                  <span class="font-mono">{org.ownerPhone}</span>
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
                            class="py-1.5 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer {org.hasAccessToken && org.wabaId
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'}"
                          >
                            <Link2 class="w-3.5 h-3.5" />
                            <span>{org.hasAccessToken && org.wabaId ? 'Meta Terhubung' : 'Hubungkan Meta'}</span>
                          </button>

                          {#if phoneItem?.displayPhoneNumber}
                            <div class="text-[11px] font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1">
                              <Phone class="w-3 h-3 text-slate-400" />
                              <span>{phoneItem.displayPhoneNumber}</span>
                            </div>
                          {/if}

                          {#if org.wabaId}
                            <div class="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" title={org.wabaId}>
                              WABA: {org.wabaId}
                            </div>
                          {/if}
                        </div>
                      </td>

                      <!-- Plan & Users Team Count -->
                      <td class="py-3.5 px-4">
                        <div class="space-y-1.5">
                          <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border {getPlanBadgeClass(org.plan)}">
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
                              <span>{org.users?.length || 0} / {org.maxAgents} User</span>
                            </div>
                            <ArrowRight class="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      <!-- Subscription Expiry -->
                      <td class="py-3.5 px-4">
                        <div class="space-y-1">
                          {#if org.expiresAt}
                            <div class="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {new Date(org.expiresAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                            </div>
                            <div>
                              {#if org.isExpired || (org.daysRemaining !== null && org.daysRemaining < 0)}
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  Kadaluarsa
                                </span>
                              {:else if org.daysRemaining !== null && org.daysRemaining <= 7}
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                                  Sisa {org.daysRemaining} Hari
                                </span>
                              {:else if org.daysRemaining !== null}
                                <span class="text-[10px] text-slate-400 font-mono">
                                  Sisa {org.daysRemaining} hari
                                </span>
                              {/if}
                            </div>
                          {:else}
                            <span class="text-[11px] text-slate-400 italic">Tanpa Batas</span>
                          {/if}
                        </div>
                      </td>

                      <!-- Status -->
                      <td class="py-3.5 px-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border {getStatusBadgeClass(org.status)}">
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
                            title={org.status === 'ACTIVE' ? 'Tangguhkan / Suspend Organisasi Ini' : 'Aktifkan Kembali Organisasi Ini'}
                          >
                            {#if org.status === 'ACTIVE'}
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
      {#if activeTab === 'plans'}
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package class="w-5 h-5 text-indigo-500" />
                <span>Katalog Paket Sewa & Paket Promosi SaaS</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Atur harga langganan bulanan, paket promosi gratis (Rp 0), kuota agen CS, limit broadcast, dan benefit klien.
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
                  <span class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-md">
                    Paling Populer
                  </span>
                {/if}

                {#if plan.price === 0}
                  <span class="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 shadow-md flex items-center gap-1">
                    <Gift class="w-3 h-3" />
                    Promo / Gratis
                  </span>
                {/if}

                <!-- Card Header -->
                <div class="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border {getPlanBadgeClass(plan.code)}">
                      {plan.code}
                    </span>
                    <div class="flex items-center gap-1.5">
                      {#if plan.isPublic === false}
                        <span class="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1" title="Hanya tampil untuk Super Admin (Tidak muncul di katalog tenant)">
                          <Lock class="w-3 h-3 text-amber-500" />
                          Khusus Admin
                        </span>
                      {:else}
                        <span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1" title="Tampil di menu langganan seluruh tenant">
                          <Globe class="w-3 h-3 text-emerald-500" />
                          Publik
                        </span>
                      {/if}

                      {#if !plan.isActive}
                        <span class="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">Nonaktif</span>
                      {/if}
                    </div>
                  </div>
                  <h3 class="text-lg font-black text-slate-900 dark:text-white">{plan.name}</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 min-h-[36px] line-clamp-2">{plan.description || 'Tidak ada deskripsi'}</p>
                </div>

                <!-- Price -->
                <div class="mb-5">
                  <div class="flex items-baseline gap-1">
                    <span class="text-2xl font-black text-slate-900 dark:text-white">{formatRupiah(plan.price)}</span>
                    <span class="text-xs text-slate-400">/{plan.period || 'bulan'}</span>
                  </div>
                  <div class="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <Users class="w-3.5 h-3.5" />
                    <span>Maksimal {plan.maxAgents} Kursi Agen CS</span>
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Radio class="w-3.5 h-3.5" />
                    <span>{plan.maxBroadcastPerMonth.toLocaleString('id-ID')} Broadcast / Bulan</span>
                  </div>
                </div>

                <!-- Feature List -->
                <div class="space-y-2.5 flex-1 mb-6">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fitur Termasuk:</span>
                  {#each plan.features as feat}
                    <div class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <CheckCircle class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  {/each}
                </div>

                <!-- Card Footer Actions -->
                <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
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
      <!-- TAB 3: CHANNEL PEMBAYARAN MIDTRANS                        -->
      <!-- ========================================================= -->
      {#if activeTab === 'midtrans'}
        <div class="space-y-6 max-w-4xl">
          <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div class="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wallet class="w-5 h-5 text-indigo-500" />
                  <span>Integrasi Payment Gateway Midtrans</span>
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Hubungkan akun Midtrans Snap Anda untuk menerima pembayaran otomatis QRIS, Virtual Account (BCA, Mandiri, BNI, BRI), Kartu Kredit, dan e-Wallet dari klien saat berlangganan sewa.
                </p>
              </div>

              <!-- Enable/Disable Switch -->
              <label class="flex items-center gap-2 cursor-pointer shrink-0 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  bind:checked={midtrans.isEnabled}
                  class="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {midtrans.isEnabled ? 'Channel Aktif' : 'Nonaktif'}
                </span>
              </label>
            </div>

            <form onsubmit={handleSaveMidtrans} class="space-y-5">
              <!-- Environment Selection -->
              <div>
                <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Mode Lingkungan Midtrans</span>
                <div class="grid grid-cols-2 gap-4">
                  <label class="p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition {midtrans.environment === 'sandbox' ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}">
                    <input
                      type="radio"
                      name="midtrans_env"
                      value="sandbox"
                      bind:group={midtrans.environment}
                      class="text-amber-500"
                    />
                    <div>
                      <div class="text-xs font-bold">Sandbox (Testing / Simulasi)</div>
                      <div class="text-[11px] opacity-80">Untuk pengujian simulasi transaksi tanpa uang sungguhan</div>
                    </div>
                  </label>

                  <label class="p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition {midtrans.environment === 'production' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}">
                    <input
                      type="radio"
                      name="midtrans_env"
                      value="production"
                      bind:group={midtrans.environment}
                      class="text-emerald-600"
                    />
                    <div>
                      <div class="text-xs font-bold">Production (Resmi / Live)</div>
                      <div class="text-[11px] opacity-80">Untuk menerima pembayaran uang riil dari klien penyewa</div>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Server Key -->
              <div>
                <label for="mt_server_key" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Midtrans Server Key *
                </label>
                <div class="relative">
                  <Key class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="mt_server_key"
                    type={showMidtransServerKey ? 'text' : 'password'}
                    bind:value={midtrans.serverKey}
                    placeholder={midtrans.environment === 'sandbox' ? 'SB-Mid-server-...' : 'Mid-server-...'}
                    class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onclick={() => (showMidtransServerKey = !showMidtransServerKey)}
                    class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {#if showMidtransServerKey}
                      <EyeOff class="w-4 h-4" />
                    {:else}
                      <Eye class="w-4 h-4" />
                    {/if}
                  </button>
                </div>
                <span class="text-[11px] text-slate-400 mt-1 block">Didapatkan dari menu: Midtrans Dashboard &rarr; Settings &rarr; Access Keys</span>
              </div>

              <!-- Client Key -->
              <div>
                <label for="mt_client_key" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Midtrans Client Key *
                </label>
                <div class="relative">
                  <Shield class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="mt_client_key"
                    type="text"
                    bind:value={midtrans.clientKey}
                    placeholder={midtrans.environment === 'sandbox' ? 'SB-Mid-client-...' : 'Mid-client-...'}
                    class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <!-- Merchant ID -->
              <div>
                <label for="mt_merchant_id" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
              <div class="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Zap class="w-4 h-4 text-indigo-500" />
                    Midtrans Payment Notification URL (Webhook)
                  </span>
                  <button
                    type="button"
                    onclick={() => copyToClipboard(`${window.location.origin}/api/v1/billing/midtrans-webhook`, 'webhook_url')}
                    class="py-1 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    {#if copiedText === 'webhook_url'}
                      <Check class="w-3 h-3" />
                      <span>URL Tersalin!</span>
                    {:else}
                      <Copy class="w-3 h-3" />
                      <span>Salin Webhook URL</span>
                    {/if}
                  </button>
                </div>
                <div class="font-mono text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900 text-slate-700 dark:text-slate-200 break-all select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/v1/billing/midtrans-webhook` : 'https://domain-anda.com/api/v1/billing/midtrans-webhook'}
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                  Tempel URL di atas pada dashboard Midtrans (<strong>Settings &rarr; Configuration &rarr; Payment Notification URL</strong>) agar sistem otomatis memperpanjang masa aktif tenant saat pembayaran berhasil.
                </p>
              </div>

              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  class="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-60"
                >
                  <Check class="w-4 h-4 stroke-[3]" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Konfigurasi Midtrans'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      {/if}
    </main>
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
    onclick={(e) => { if (e.target === e.currentTarget) showMetaModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-2xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Network class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Integrasi Meta WhatsApp Cloud API</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Organisasi: <strong>{metaOrg.name}</strong></p>
          </div>
        </div>
        <button onclick={() => (showMetaModal = false)} class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Form Body -->
      <form onsubmit={handleSaveMetaConfig} class="flex flex-col flex-1 overflow-hidden">
        <div class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="meta_waba" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Meta WABA ID *
              </label>
              <input
                id="meta_waba"
                type="text"
                bind:value={metaWabaId}
                placeholder="e.g. 109823912039123"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label for="meta_phone_id" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number ID *
              </label>
              <input
                id="meta_phone_id"
                type="text"
                bind:value={metaPhoneId}
                placeholder="e.g. 192830192830192"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div class="sm:col-span-2">
              <label for="meta_token" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Permanent System User Access Token *
              </label>
              <input
                id="meta_token"
                type="password"
                bind:value={metaAccessToken}
                placeholder="EAAGm... (Kosongkan jika ingin memakai token yang sudah tersimpan)"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label for="meta_disp_phone" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
              <label for="meta_verif_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
          <div class="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Uji Validasi Koneksi API Meta</span>
              <button
                type="button"
                onclick={handleTestMetaConnection}
                disabled={isTestingMeta}
                class="py-2 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
              >
                <Zap class="w-3.5 h-3.5 {isTestingMeta ? 'animate-spin' : 'text-emerald-500'}" />
                <span>{isTestingMeta ? 'Menguji ke Meta...' : '⚡ Uji Koneksi Meta'}</span>
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
                  <div class="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200 dark:border-emerald-900 text-[11px] font-mono">
                    <div>Nomor: <strong>{metaTestResult.data.phoneNumber.display_phone_number}</strong></div>
                    <div>Nama: <strong>{metaTestResult.data.phoneNumber.verified_name}</strong></div>
                    <div>Kualitas: <strong class="uppercase text-emerald-600">{metaTestResult.data.phoneNumber.quality_rating}</strong></div>
                    <div>Status Verif: <strong>{metaTestResult.data.phoneNumber.code_verification_status || 'VERIFIED'}</strong></div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Sticky Footer -->
        <div class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0">
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
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Aktifkan Meta'}</span>
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
    onclick={(e) => { if (e.target === e.currentTarget) showPlanModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Package class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">{editingPlan ? 'Ubah Pengaturan Paket' : 'Buat Paket Sewa Baru'}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Tentukan harga, kapasitas agen CS, dan benefit untuk klien</p>
          </div>
        </div>
        <button onclick={() => (showPlanModal = false)} class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleSavePlan} class="flex flex-col flex-1 overflow-hidden">
        <div class="p-6 overflow-y-auto flex-1 space-y-4 max-h-[calc(92vh-140px)]">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="plan_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Paket *</label>
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
              <label for="plan_code" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kode / Label Paket <span class="text-slate-400 font-normal">(Bebas, e.g. PROMO14, STARTER, VIP)</span>
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
            <div class="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <span class="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Masa Berlaku / Skema Durasi Paket *
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType === 'PERMANENT'
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
                      planPeriod = 'selamanya';
                      planDurationDays = 0;
                    }}
                    class="text-amber-500 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Gift class="w-3.5 h-3.5 text-amber-500" />
                      <span>Gratis Selamanya</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">Tanpa kadaluarsa / no expiry (Tidak perlu perpanjangan)</div>
                  </div>
                </label>

                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType === 'MONTHLY'
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
                      planPeriod = 'bulan';
                      planDurationDays = 30;
                    }}
                    class="text-indigo-600 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Clock class="w-3.5 h-3.5 text-indigo-500" />
                      <span>Bulanan (30 Hari)</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">Perpanjangan sewa rutin setiap bulan</div>
                  </div>
                </label>

                <label
                  class="p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition {planDurationType === 'DAYS'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'}"
                >
                  <input
                    type="radio"
                    name="plan_duration_type"
                    value="DAYS"
                    bind:group={planDurationType}
                    onchange={() => {
                      if (planDurationDays === 0 || planDurationDays === 30) planDurationDays = 14;
                      planPeriod = `${planDurationDays} hari`;
                    }}
                    class="text-emerald-600 mt-0.5"
                  />
                  <div>
                    <div class="text-xs font-bold flex items-center gap-1">
                      <Calendar class="w-3.5 h-3.5 text-emerald-500" />
                      <span>Batas Hari Khusus</span>
                    </div>
                    <div class="text-[11px] opacity-75 mt-0.5 leading-snug">Promo berbatas waktu (misal 7, 14, atau 60 hari)</div>
                  </div>
                </label>
              </div>

              {#if planDurationType === 'DAYS'}
                <div class="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <label for="plan_custom_days" class="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
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
                  <span class="text-xs text-slate-400">hari (Setelah lewat, status tenant otomatis EXPIRED)</span>
                </div>
              {/if}
            </div>

            <div>
              <label for="plan_price" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Harga Sewa (IDR) * <span class="text-amber-500 font-normal">(Isi 0 untuk Gratis/Promo)</span>
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
              <label for="plan_period" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Label Periode Tagihan</label>
              <input
                id="plan_period"
                type="text"
                bind:value={planPeriod}
                placeholder="e.g. bulan / 14 hari / selamanya"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label for="plan_agents" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Maksimal Kursi Agen (CS)</label>
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
              <label for="plan_bcast" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kuota Broadcast Pesan / Bulan</label>
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
              <label for="plan_desc" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Deskripsi Singkat</label>
              <input
                id="plan_desc"
                type="text"
                bind:value={planDescription}
                placeholder="e.g. Solusi ideal untuk UMKM dan tim kecil"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2">
              <label for="plan_features" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
            <div class="sm:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <span class="block text-xs font-bold text-slate-800 dark:text-slate-200">
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
                      Tampil di menu <em>Paket & Langganan</em> seluruh tenant sehingga mereka bisa memilih dan mengajukan perpanjangan/upgrade secara langsung.
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
                      <strong>Paket Khusus/Rahasia</strong>: Tidak muncul di katalog tenant. Hanya dapat diberikan secara manual oleh Super Admin dari portal administrator.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div class="sm:col-span-2 flex items-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" bind:checked={planIsPopular} class="w-4 h-4 text-indigo-600 rounded" />
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Tandai sebagai Paket Paling Populer</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" bind:checked={planIsActive} class="w-4 h-4 text-emerald-600 rounded" />
                <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Paket Aktif (Bisa Dipilih)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0">
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
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Paket'}</span>
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
    onclick={(e) => { if (e.target === e.currentTarget) showProfileModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
      <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <UserCog class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Pengaturan Akun Super Admin Saya</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Ubah email login, nama profil, dan kata sandi akses portal</p>
          </div>
        </div>
        <button onclick={() => (showProfileModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleUpdateProfile} class="p-6 space-y-4">
        <div>
          <label for="prof_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
          <label for="prof_email" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
          <span class="text-[10px] text-slate-400 mt-1 block">Email ini digunakan untuk login ke portal /administrator</span>
        </div>

        <div class="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Lock class="w-3.5 h-3.5 text-indigo-500" />
            Ubah Kata Sandi (Opsional)
          </h4>

          <div>
            <label for="prof_cur_pwd" class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
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
            <label for="prof_new_pwd" class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
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

        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
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
            <span>{profileLoading ? 'Menyimpan...' : 'Simpan Perubahan Akun'}</span>
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
    onclick={(e) => { if (e.target === e.currentTarget) showUsersModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Users class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Daftar Akun User & Bantuan Login</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Organisasi: <strong>{activeTenant.name}</strong> ({activeTenant.users?.length || 0} Akun)</p>
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
            <p class="text-xs font-semibold">Belum ada akun user terdaftar untuk organisasi ini.</p>
          </div>
        {:else}
          {#each activeTenant.users as u (u.id)}
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-900 dark:text-white text-xs">{u.fullName}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider {u.role === 'ADMINISTRATOR' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' : u.role === 'SUPERVISOR' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'}">
                    {u.role}
                  </span>
                  {#if u.isOnline}
                    <span class="w-2 h-2 rounded-full bg-emerald-500" title="Online"></span>
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{u.email}</span>
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
      <div class="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
        <span class="text-[11px] text-slate-400">Gunakan tombol <strong>Reset Password</strong> jika user lupa kata sandi.</span>
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
    onclick={(e) => { if (e.target === e.currentTarget) showCreateModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-3xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
      <!-- Sticky Header -->
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0 sticky top-0 z-10">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Plus class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Daftarkan Organisasi Klien Baru</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Buat workspace tenant baru, akun admin utama, dan tentukan paket sewa.</p>
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
      <form onsubmit={handleCreateTenant} class="flex flex-col flex-1 overflow-hidden">
        <div class="p-6 overflow-y-auto flex-1 space-y-6 max-h-[calc(92vh-140px)]">
          <!-- Section 1: Profil Organisasi Klien -->
          <div class="space-y-4">
            <h4 class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Building2 class="w-4 h-4" />
              1. Informasi Bisnis & Pemilik Tenant
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="new_org_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Organisasi / Brand *</label>
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
                <label for="new_owner_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama PIC Pemilik Bisnis</label>
                <input
                  id="new_owner_name"
                  type="text"
                  bind:value={newOrgOwnerName}
                  placeholder="e.g. Budi Santoso"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label for="new_admin_email" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Login Admin Klien *</label>
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
                <label for="new_admin_password" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Password Awal Login *</label>
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
                <label for="new_owner_phone" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">No. WhatsApp Pemilik (Untuk Tagihan)</label>
                <input
                  id="new_owner_phone"
                  type="text"
                  bind:value={newOrgOwnerPhone}
                  placeholder="e.g. 081234567890"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label for="new_notes" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan Internal Super Admin</label>
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
          <div class="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CreditCard class="w-4 h-4" />
              2. Paket Sewa & Masa Aktif
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label for="new_plan" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pilihan Paket Sewa</label>
                <select
                  id="new_plan"
                  bind:value={newOrgPlan}
                  onchange={(e) => onSelectCreatePlan((e.target as HTMLSelectElement).value)}
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  {#if saasPlans.length > 0}
                    {#each saasPlans as p}
                      <option value={p.name}>
                        {p.isPublic === false ? '🔒 ' : ''}{p.name}{p.isPublic === false ? ' [Khusus Admin]' : ''} ({p.price === 0 ? 'Gratis / Rp 0' : formatRupiah(p.price)} - {p.period})
                      </option>
                    {/each}
                  {:else}
                    <option value="Starter Bisnis">Starter Bisnis</option>
                  {/if}
                </select>
              </div>

              <div>
                <label for="new_agents" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Maksimal Kursi Agen (CS)</label>
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
                <label for="new_duration" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Durasi Sewa Awal</label>
                <select
                  id="new_duration"
                  bind:value={newOrgDurationDays}
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value={0}>♾️ Gratis Selamanya (Tanpa Batas Waktu / No Expiry)</option>
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
          <div class="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Shield class="w-4 h-4 text-slate-400" />
                3. Kredensial Meta WhatsApp Klien (Opsional)
              </h4>
              <span class="text-[10px] text-slate-400">Bisa diisi sekarang atau diatur kemudian oleh klien</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="new_waba_id" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Meta WABA ID</label>
                <input
                  id="new_waba_id"
                  type="text"
                  bind:value={newOrgWabaId}
                  placeholder="e.g. 109823912039123"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label for="new_phone_id" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Meta Phone Number ID</label>
                <input
                  id="new_phone_id"
                  type="text"
                  bind:value={newOrgPhoneNumberId}
                  placeholder="e.g. 192830192830192"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div class="sm:col-span-2">
                <label for="new_token" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">System User Permanent Access Token</label>
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
        <div class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0 sticky bottom-0 z-10">
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
            <span>{isSubmitting ? 'Mendaftarkan...' : 'Daftarkan Organisasi Sekarang'}</span>
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
    onclick={(e) => { if (e.target === e.currentTarget) showEditModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-3xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
      <!-- Sticky Header -->
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0 sticky top-0 z-10">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Edit3 class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Ubah Data Organisasi: {activeTenant.name}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Atur paket sewa, status akses, limit agen, dan kredensial Meta.</p>
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
      <form onsubmit={handleEditTenant} class="flex flex-col flex-1 overflow-hidden">
        <div class="p-6 overflow-y-auto flex-1 space-y-5 max-h-[calc(92vh-140px)]">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="edit_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Organisasi *</label>
              <input
                id="edit_name"
                type="text"
                bind:value={editName}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label for="edit_status" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status Akun</label>
              <select
                id="edit_status"
                bind:value={editStatus}
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ACTIVE">ACTIVE (Aktif)</option>
                <option value="TRIAL">TRIAL (Uji Coba)</option>
                <option value="SUSPENDED">SUSPENDED (Ditangguhkan / Telat Bayar)</option>
                <option value="EXPIRED">EXPIRED (Masa Sewa Habis)</option>
              </select>
            </div>

            <div>
              <label for="edit_plan" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Paket Sewa</label>
              <select
                id="edit_plan"
                bind:value={editPlan}
                onchange={(e) => onSelectEditPlan((e.target as HTMLSelectElement).value)}
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold"
              >
                {#if saasPlans.length > 0}
                  {#each saasPlans as p}
                    <option value={p.name}>
                      {p.isPublic === false ? '🔒 ' : ''}{p.name}{p.isPublic === false ? ' [Khusus Admin]' : ''} ({p.price === 0 ? 'Gratis / Rp 0' : formatRupiah(p.price)} - {p.period})
                    </option>
                  {/each}
                {/if}
                {#if editPlan && !saasPlans.some((p) => p.name === editPlan)}
                  <option value={editPlan}>{editPlan}</option>
                {/if}
              </select>
            </div>

            <div>
              <label for="edit_max_agents" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Batas Maksimal Agen (CS)</label>
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
              <label for="edit_expires" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal Kadaluarsa Sewa</label>
              <input
                id="edit_expires"
                type="date"
                bind:value={editExpiresAt}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label for="edit_owner_name" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama PIC Pemilik</label>
              <input
                id="edit_owner_name"
                type="text"
                bind:value={editOwnerName}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label for="edit_owner_phone" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">No. WhatsApp PIC</label>
              <input
                id="edit_owner_phone"
                type="text"
                bind:value={editOwnerPhone}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label for="edit_owner_email" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email PIC</label>
              <input
                id="edit_owner_email"
                type="email"
                bind:value={editOwnerEmail}
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2">
              <label for="edit_waba" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Meta WABA ID</label>
              <input
                id="edit_waba"
                type="text"
                bind:value={editWabaId}
                placeholder="1092830192830"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="sm:col-span-2">
              <label for="edit_token" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ganti Permanent Access Token (Kosongkan jika tidak ingin mengubah)
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
              <label for="edit_notes" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Catatan Admin</label>
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
        <div class="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3 shrink-0 sticky bottom-0 z-10">
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
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
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
    onclick={(e) => { if (e.target === e.currentTarget) showExtendModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
      <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Calendar class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Perpanjang Masa Sewa</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">{activeTenant.name}</p>
          </div>
        </div>
        <button onclick={() => (showExtendModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleExtend} class="p-6 space-y-4">
        <div>
          <label for="ext_days" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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

        <div class="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-300 space-y-1">
          <div class="font-bold flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            Otomatis Mengaktifkan Kembali Akun
          </div>
          <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Jika organisasi sebelumnya berstatus <em>EXPIRED</em> atau <em>SUSPENDED</em>, tindakan ini akan langsung mengembalikan status menjadi <strong>ACTIVE</strong>.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
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
            <span>{isSubmitting ? 'Memproses...' : 'Perpanjang Sekarang'}</span>
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
    onclick={(e) => { if (e.target === e.currentTarget) showResetPasswordModal = false; }}
  >
    <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
      <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Key class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Bantuan Reset Password User</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">{activeTenant.name}</p>
          </div>
        </div>
        <button onclick={() => (showResetPasswordModal = false)} class="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer p-1">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form onsubmit={handleResetPassword} class="p-6 space-y-4">
        <!-- Select Target User -->
        <div>
          <label for="reset_user_select" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
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
              <option value="">Akun Utama PIC ({activeTenant.ownerEmail || 'Admin'})</option>
            {/if}
          </select>
        </div>

        <!-- New Password Input with Random Generator Button -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label for="reset_pwd" class="block text-xs font-bold text-slate-700 dark:text-slate-300">
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
          <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5 animate-in fade-in">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 class="w-4 h-4 text-emerald-500" />
                Password Berhasil Direset!
              </span>
              <button
                type="button"
                onclick={() =>
                  copyToClipboard(
                    `Halo ${activeTenant?.name},\n\nBerikut data login akun WhatsApp CRM Anda:\n- URL Login: ${window.location.origin}/login\n- Email: ${resetSuccessInfo?.email}\n- Password Baru: ${resetSuccessInfo?.pass}\n\nSilakan login dan ganti password Anda kembali. Terima kasih!`,
                    'wa_template'
                  )}
                class="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
              >
                {#if copiedText === 'wa_template'}
                  <Check class="w-3 h-3" />
                  <span>Format Tersalin!</span>
                {:else}
                  <Copy class="w-3 h-3" />
                  <span>Salin Pesan WhatsApp</span>
                {/if}
              </button>
            </div>

            <div class="text-[11px] font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/60 space-y-1 text-slate-800 dark:text-slate-200">
              <div>Email: <strong>{resetSuccessInfo.email}</strong></div>
              <div>Password Baru: <strong class="text-indigo-600 dark:text-indigo-400">{resetSuccessInfo.pass}</strong></div>
            </div>
          </div>
        {/if}

        <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Setelah direset, Anda dapat menyalin data kredensial di atas untuk langsung dikirimkan kepada klien melalui WhatsApp.
        </p>

        <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
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
            <span>{isSubmitting ? 'Mereset...' : 'Reset Password Sekarang'}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
