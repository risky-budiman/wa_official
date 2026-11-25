<script lang="ts">
  import { apiRequest } from "$lib/api/client";
  import { authStore } from "$lib/stores/auth.svelte";

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
    AlertTriangle,
    LogIn,
    Edit3,
    Trash2,
    Lock,
    Unlock,
    Sparkles,
    CreditCard,
    Key,
    X,
    Check,
    ArrowRight,
    Mail,
    Copy,
    Dices,
    User,
    Send,
    Zap,
    Network,
    Link2,
    PackagePlus,
    Gauge,
  } from "lucide-svelte";
  import type { TenantItem } from "$lib/admin/types";
  import { portal } from "$lib/admin/portal.svelte";

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

  let searchQuery = $state("");
  let selectedStatus = $state<string>("ALL");
  let selectedPlan = $state<string>("ALL");

  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showExtendModal = $state(false);
  let showResetPasswordModal = $state(false);
  let showUsersModal = $state(false);
  let activeTenant = $state<TenantItem | null>(null);

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

  let extendDays = $state(30);

  let resetUserId = $state<string>("");
  let resetPasswordNew = $state("");
  let resetSuccessInfo = $state<{ email: string; pass: string } | null>(null);

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
    const p = portal.saasPlans.find(
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
    const foundPlan = portal.saasPlans.find(
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
        portal.feedbackMessage = {
          text:
            res.message ||
            `Paket organisasi "${selectedOrgForPlanChange.name}" berhasil diubah!`,
          type: "success",
        };
        showChangePlanModal = false;
        selectedOrgForPlanChange = null;
        await portal.loadData();
      } else {
        portal.feedbackMessage = {
          text: res?.error || "Gagal mengubah paket organisasi",
          type: "error",
        };
      }
    } catch (err: any) {
      portal.feedbackMessage = {
        text: err?.message || "Terjadi kesalahan saat mengubah paket",
        type: "error",
      };
    } finally {
      isChangingPlan = false;
    }
  }

  function formatMessagingTier(tierRaw?: string): string {
    if (!tierRaw) return "2,000 Percakapan / 24 Jam";
    const t = String(tierRaw).toUpperCase().trim();
    if (t === "TIER_250" || t === "250") return "250 Percakapan / 24 Jam (Akun Baru)";
    if (t === "TIER_1K" || t === "TIER_1000" || t === "1000" || t === "1K") return "1,000 Percakapan / 24 Jam (Tier 1K)";
    if (t === "TIER_2K" || t === "TIER_2000" || t === "2000" || t === "2K") return "2,000 Percakapan / 24 Jam (Tier 2K)";
    if (t === "TIER_10K" || t === "TIER_10000" || t === "10000" || t === "10K") return "10,000 Percakapan / 24 Jam (Tier 10K)";
    if (t === "TIER_100K" || t === "TIER_100000" || t === "100000" || t === "100K") return "100,000 Percakapan / 24 Jam (Tier 100K)";
    if (t === "TIER_UNLIMITED" || t === "UNLIMITED") return "♾️ Tanpa Batas / Unlimited (Tier Unlimited)";
    
    const digits = t.replace(/[^0-9]/g, "");
    if (digits) {
      const num = parseInt(digits, 10);
      return `${num.toLocaleString("id-ID")} Percakapan / 24 Jam`;
    }
    return `${tierRaw} Percakapan / 24 Jam`;
  }

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

    portal.isSubmitting = true;
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
    portal.isSubmitting = false;

    if (res.success) {
      showMetaModal = false;
      portal.feedbackMessage = {
        text: "Integrasi Meta WhatsApp Cloud API berhasil disimpan!",
        type: "success",
      };
      portal.loadData();
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal menyimpan konfigurasi Meta",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 5000);
  }

  // ==========================================
  // PLANS MANAGEMENT HANDLERS

  function openCreate() {
    newOrgName = "";
    const defaultPlan = portal.saasPlans[0];
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
    const found = portal.saasPlans.find(
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
    const found = portal.saasPlans.find(
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

  async function handleCreateTenant(e: Event) {
    e.preventDefault();
    if (
      !newOrgName.trim() ||
      !newOrgAdminEmail.trim() ||
      !newOrgAdminPassword.trim()
    ) {
      portal.feedbackMessage = {
        text: "Mohon lengkapi nama organisasi, email, dan password admin!",
        type: "error",
      };
      return;
    }

    portal.isSubmitting = true;
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
    portal.isSubmitting = false;

    if (res.success) {
      showCreateModal = false;
      portal.feedbackMessage = {
        text: res.message || "Organisasi baru berhasil didaftarkan!",
        type: "success",
      };
      portal.loadData();
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal mendaftarkan organisasi",
        type: "error",
      };
    }
    // Keep the message longer when it contains a one-time generated password
    const hasGeneratedPwd = Boolean(res.success && res.data?.generatedAdminPassword);
    setTimeout(() => (portal.feedbackMessage = null), hasGeneratedPwd ? 60000 : 5000);
  }

  async function handleEditTenant(e: Event) {
    e.preventDefault();
    if (!activeTenant) return;

    portal.isSubmitting = true;
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
    portal.isSubmitting = false;

    if (res.success) {
      showEditModal = false;
      portal.feedbackMessage = {
        text: res.message || "Data organisasi berhasil diperbarui!",
        type: "success",
      };
      portal.loadData();
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal memperbarui organisasi",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 5000);
  }

  async function handleExtend(e: Event) {
    e.preventDefault();
    if (!activeTenant) return;

    portal.isSubmitting = true;
    const res = await apiRequest<any>(
      `/super-admin/organizations/${activeTenant.id}/extend`,
      {
        method: "POST",
        body: JSON.stringify({ days: Number(extendDays) }),
      },
    );
    portal.isSubmitting = false;

    if (res.success) {
      showExtendModal = false;
      portal.feedbackMessage = {
        text: res.message || "Masa aktif sewa berhasil diperpanjang!",
        type: "success",
      };
      portal.loadData();
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal memperpanjang masa aktif sewa",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 5000);
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
      portal.feedbackMessage = {
        text: res.message || `Status berhasil diubah`,
        type: "success",
      };
      portal.loadData();
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal mengubah status organisasi",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 4000);
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
      portal.feedbackMessage = {
        text: res.error || "Gagal masuk ke akun tenant",
        type: "error",
      };
      setTimeout(() => (portal.feedbackMessage = null), 4000);
    }
  }

  async function handleResetPassword(e: Event) {
    e.preventDefault();
    if (!activeTenant || !resetPasswordNew.trim()) return;

    portal.isSubmitting = true;
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
    portal.isSubmitting = false;

    if (res.success) {
      const targetUser =
        activeTenant.users?.find((u) => u.id === resetUserId) ||
        activeTenant.users?.[0];
      resetSuccessInfo = {
        email: targetUser?.email || activeTenant.ownerEmail || "admin",
        pass: resetPasswordNew.trim(),
      };
      portal.feedbackMessage = {
        text: res.message || "Password berhasil direset!",
        type: "success",
      };
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal mereset password",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 5000);
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
      portal.feedbackMessage = {
        text: res.message || `Organisasi ${tenant.name} berhasil dihapus`,
        type: "success",
      };
      portal.loadData();
    } else {
      portal.feedbackMessage = {
        text: res.error || "Gagal menghapus organisasi",
        type: "error",
      };
    }
    setTimeout(() => (portal.feedbackMessage = null), 5000);
  }

  function getPrimaryAdmin(org: TenantItem) {
    return org.users?.find((u) => u.role === "ADMINISTRATOR") || org.users?.[0];
  }

  const filteredOrganizations = $derived(
    portal.organizationsList.filter((org) => {
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
    for (const p of portal.saasPlans) if (p.name) plansSet.add(p.name);
    for (const o of portal.organizationsList) if (o.plan) plansSet.add(o.plan);
    return Array.from(plansSet);
  });

</script>

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
        onclick={portal.loadData}
        disabled={portal.isLoading}
        class="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition cursor-pointer disabled:opacity-60"
      >
        <RefreshCw class="w-4 h-4 {portal.isLoading ? 'animate-spin' : ''}" />
        <span>Refresh</span>
      </button>

      {#if portal.isFullAdmin}
      <button
        onclick={openCreate}
        class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
      >
        <Plus class="w-4 h-4 stroke-[3]" />
        <span>+ Daftarkan Organisasi Baru</span>
      </button>
      {/if}
    </div>
  </div>

  <!-- Platform Overview KPI Cards -->
  {#if portal.overview}
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
            >{portal.overview.totalOrganizations}</span
          >
          <span
            class="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
          >
            {portal.overview.activeOrganizations} Aktif
          </span>
        </div>
        <div
          class="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80"
        >
          <span>{portal.overview.trialOrganizations} Trial</span>
          <span>•</span>
          <span class="text-rose-500 dark:text-rose-400 font-medium"
            >{portal.overview.suspendedOrganizations} Suspend</span
          >
          <span>•</span>
          <span class="text-amber-500 dark:text-amber-400 font-medium"
            >{portal.overview.expiredOrganizations} Expired</span
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
            >{portal.overview.totalAgents}</span
          >
          <span class="text-[11px] text-slate-500 dark:text-slate-400"
            >dari {portal.overview.totalUsers} akun</span
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
            >{portal.overview.totalMessages.toLocaleString("id-ID")}</span
          >
          <span class="text-[11px] text-slate-500 dark:text-slate-400"
            >pesan</span
          >
        </div>
        <div
          class="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80"
        >
          Dari {portal.overview.totalConversations.toLocaleString("id-ID")} sesi chat
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
            >{portal.overview.expiringSoonCount}</span
          >
          <span class="text-[11px] text-slate-300">organisasi</span>
        </div>
        <div
          class="text-[10px] text-slate-400 pt-1 border-t border-slate-800"
        >
          {portal.overview.expiringSoonCount > 0
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
          {#if portal.isLoading}
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
                                portal.copyToClipboard(
                                  primaryAdmin.email,
                                  `email_${primaryAdmin.id}`,
                                )}
                              class="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer font-medium"
                              title="Salin Email Admin"
                            >
                              {#if portal.copiedText === `email_${primaryAdmin.id}`}
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
                    {#if portal.canSupport}
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
                    {/if}

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
                      class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border {portal.getPlanBadgeClass(
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
                    class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border {portal.getStatusBadgeClass(
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
                    {#if portal.canSupport}
                    <button
                      onclick={() => handleImpersonate(org)}
                      class="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                      title="Masuk ke Dashboard Organisasi Ini (Impersonate)"
                    >
                      <LogIn class="w-4 h-4" />
                    </button>
                    {/if}

                    <!-- Meta Integration Wizard Button -->
                    {#if portal.canSupport}
                    <button
                      onclick={() => openMetaWizard(org)}
                      class="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                      title="Integrasi & Uji Meta WhatsApp API"
                    >
                      <Network class="w-4 h-4" />
                    </button>
                    {/if}

                    <!-- View Users & Reset Password Button -->
                    <button
                      onclick={() => openUsersList(org)}
                      class="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                      title="Lihat Akun & Reset Password User Tenant"
                    >
                      <Key class="w-4 h-4" />
                    </button>

                    <!-- Extend Subscription Button -->
                    {#if portal.canFinance}
                    <button
                      onclick={() => openExtend(org)}
                      class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      title="Perpanjang Masa Aktif Sewa"
                    >
                      <Calendar class="w-4 h-4" />
                    </button>
                    {/if}

                    <!-- Change / Upgrade Plan Button -->
                    {#if portal.canFinance}
                    <button
                      onclick={() => openChangePlanModal(org)}
                      class="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                      title="Ganti / Upgrade Paket SaaS Organisasi Ini"
                    >
                      <PackagePlus class="w-4 h-4" />
                    </button>
                    {/if}

                    <!-- Edit Details Button -->
                    {#if portal.isFullAdmin}
                    <button
                      onclick={() => openEdit(org)}
                      class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      title="Edit Profil Organisasi"
                    >
                      <Edit3 class="w-4 h-4" />
                    </button>
                    {/if}

                    <!-- Toggle Suspend Button -->
                    {#if portal.isFullAdmin}
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
                    {/if}

                    <!-- Delete Button -->
                    {#if portal.isFullAdmin}
                    <button
                      onclick={() => handleDeleteTenant(org)}
                      class="p-2 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                      title="Hapus Organisasi"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
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
                      Nomor Tampilan: <strong>{metaTestResult.data.phoneNumber.display_phone_number || '-'}</strong>
                    </div>
                    <div>
                      Nama Bisnis Terverifikasi: <strong>{metaTestResult.data.phoneNumber.verified_name || metaTestResult.data.waba?.name || metaOrg?.name}</strong>
                    </div>
                    <div>
                      Kualitas Nomor: <strong class="uppercase text-emerald-600 dark:text-emerald-400">{metaTestResult.data.phoneNumber.quality_rating || 'GREEN (Sangat Baik)'}</strong>
                    </div>
                    <div>
                      Status Verifikasi Nomor: <strong>{metaTestResult.data.phoneNumber.code_verification_status || 'VERIFIED'}</strong>
                    </div>
                    {#if metaTestResult.data.waba}
                      <div>
                        Mata Uang & Waktu: <strong>{metaTestResult.data.waba.currency || 'IDR'} ({metaTestResult.data.waba.timezone_id || 'Asia/Jakarta'})</strong>
                      </div>
                      <div>
                        Status Bisnis Meta: <strong class="uppercase text-emerald-600 dark:text-emerald-400">{metaTestResult.data.waba.business_verification_status || 'VERIFIED'}</strong>
                      </div>
                      <div class="sm:col-span-2">
                        Metode Pembayaran Meta: <strong class="{metaTestResult.data.waba.primary_funding_id ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">{metaTestResult.data.waba.primary_funding_id ? '🟢 Metode Pembayaran Terhubung di Meta' : '⚠️ Kartu Pembayaran Belum Terhubung di Meta Business Suite'}</strong>
                      </div>
                    {/if}
                    {#if metaTestResult.data.phoneNumber?.throughput?.level}
                      <div>
                        Kecepatan Kirim: <strong>{metaTestResult.data.phoneNumber.throughput.level} ({metaTestResult.data.phoneNumber.throughput.messages_per_second || 80} MPS)</strong>
                      </div>
                    {/if}

                    <div class="sm:col-span-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 flex items-center justify-between font-sans shadow-xs mt-1">
                      <span class="font-bold flex items-center gap-1.5 text-xs">
                        <Gauge class="w-4 h-4 text-emerald-500 shrink-0" />
                        Batas Quota Meta (Messaging Limit Tier):
                      </span>
                      <strong class="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">
                        {formatMessagingTier(metaTestResult.data.phoneNumber.messaging_limit_tier)}
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
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span
              >{portal.isSubmitting ? "Menyimpan..." : "Simpan & Aktifkan Meta"}</span
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
                    onclick={() => portal.copyToClipboard(u.email, `u_email_${u.id}`)}
                    class="text-[10px] text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                    title="Salin Email Login"
                  >
                    {#if portal.copiedText === `u_email_${u.id}`}
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
                {#if portal.canSupport}
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
                {/if}
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
                  {#if portal.saasPlans.length > 0}
                    {#each portal.saasPlans as p}
                      <option value={p.name}>
                        {p.isPublic === false
                          ? "🔒 "
                          : ""}{p.name}{p.isPublic === false
                          ? " [Khusus Admin]"
                          : ""} ({p.price === 0
                          ? "Gratis / Rp 0"
                          : portal.formatRupiah(p.price)} - {p.period})
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
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span
              >{portal.isSubmitting
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
                {#if portal.saasPlans.length > 0}
                  {#each portal.saasPlans as p}
                    <option value={p.name}>
                      {p.isPublic === false ? "🔒 " : ""}{p.name}{p.isPublic ===
                      false
                        ? " [Khusus Admin]"
                        : ""} ({p.price === 0
                        ? "Gratis / Rp 0"
                        : portal.formatRupiah(p.price)} - {p.period})
                    </option>
                  {/each}
                {/if}
                {#if editPlan && !portal.saasPlans.some((p) => p.name === editPlan)}
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
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-indigo-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{portal.isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
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
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Check class="w-4 h-4 stroke-[3]" />
            <span>{portal.isSubmitting ? "Memproses..." : "Perpanjang Sekarang"}</span>
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
                  portal.copyToClipboard(
                    `Halo ${activeTenant?.name},\n\nBerikut data login akun WhatsApp CRM Anda:\n- URL Login: ${window.location.origin}/login\n- Email: ${resetSuccessInfo?.email}\n- Password Baru: ${resetSuccessInfo?.pass}\n\nSilakan login dan ganti password Anda kembali. Terima kasih!`,
                    "wa_template",
                  )}
                class="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
              >
                {#if portal.copiedText === "wa_template"}
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
            disabled={portal.isSubmitting}
            class="py-2 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-amber-500/20 transition cursor-pointer disabled:opacity-60"
          >
            <Key class="w-4 h-4 stroke-[3]" />
            <span
              >{portal.isSubmitting ? "Mereset..." : "Reset Password Sekarang"}</span
            >
          </button>
        </div>
      </form>
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
              class="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold border {portal.getPlanBadgeClass(
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
            {#if portal.saasPlans.length > 0}
              {#each portal.saasPlans as p}
                <option value={p.code}>
                  {p.name} ({p.code}) — {portal.formatRupiah(p.price)}
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
