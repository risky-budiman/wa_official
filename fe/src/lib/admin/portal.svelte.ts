// Shared state for the platform administrator portal (/administrator).
// Each tab lives in its own component (src/lib/components/admin/*Tab.svelte) and keeps
// its own local state; only data that several tabs or the shell need lives here.
import { apiRequest } from '$lib/api/client';
import { authStore } from '$lib/stores/auth.svelte';
import type {
  TenantItem,
  PlatformOverview,
  SaaSPlan,
  MidtransSetting,
  PlatformStaffItem,
  AdminTransactionItem,
  TransactionSummary,
} from './types';

export type AdminTab = 'tenants' | 'plans' | 'transactions' | 'midtrans' | 'staff' | 'system_update';

class PortalStore {
  activeTab = $state<AdminTab>('tenants');

  // Main data
  organizationsList = $state<TenantItem[]>([]);
  overview = $state<PlatformOverview | null>(null);
  saasPlans = $state<SaaSPlan[]>([]);
  midtrans = $state<MidtransSetting>({
    isEnabled: false,
    environment: 'sandbox',
    serverKey: '',
    clientKey: '',
    merchantId: '',
  });
  staffList = $state<PlatformStaffItem[]>([]);
  transactionsList = $state<AdminTransactionItem[]>([]);
  transactionSummary = $state<TransactionSummary>({
    totalRevenue: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    totalOrders: 0,
  });

  // UI state
  isLoading = $state(true);
  isSubmitting = $state(false);
  transactionsLoading = $state(false);
  feedbackMessage = $state<{ text: string; type: 'success' | 'error' } | null>(null);
  copiedText = $state<string | null>(null);

  // Access (must mirror isPlatformActionAllowed() in the backend super-admin routes)
  get isSuperAdminLoggedIn() {
    return !!authStore.token && authStore.isPlatformStaff;
  }
  get isFullAdmin() {
    return authStore.user?.role === 'SUPER_ADMIN' || authStore.user?.role === 'CO_SUPER_ADMIN';
  }
  get canFinance() {
    return this.isFullAdmin || authStore.user?.role === 'ADMIN_FINANCE';
  }
  get canSupport() {
    return this.isFullAdmin || authStore.user?.role === 'ADMIN_SUPPORT';
  }

  loadData = async () => {
    if (!authStore.token || !authStore.isPlatformStaff) return;
    this.isLoading = true;
    try {
      const [overviewRes, orgsRes, settingsRes, staffRes, txRes] = await Promise.all([
        apiRequest<any>('/super-admin/overview'),
        apiRequest<any>('/super-admin/organizations'),
        apiRequest<any>('/super-admin/settings'),
        apiRequest<any>('/super-admin/staff'),
        apiRequest<any>('/super-admin/transactions'),
      ]);

      if (overviewRes && overviewRes.success) {
        this.overview = overviewRes.data || overviewRes;
      }
      if (orgsRes && orgsRes.success) {
        this.organizationsList =
          orgsRes.items ||
          (orgsRes.data && orgsRes.data.items) ||
          (Array.isArray(orgsRes.data) ? orgsRes.data : []);
      }
      if (settingsRes && settingsRes.success && settingsRes.data) {
        this.saasPlans = settingsRes.data.plans || [];
        if (settingsRes.data.paymentGateway) {
          this.midtrans = settingsRes.data.paymentGateway;
        }
      }
      if (staffRes && staffRes.success) {
        this.staffList = staffRes.data || [];
      }
      if (txRes && txRes.success) {
        this.transactionsList = txRes.data || [];
        if (txRes.summary) {
          this.transactionSummary = txRes.summary;
        }
      }
    } catch (e: any) {
      this.feedbackMessage = {
        text: e?.message || 'Gagal memuat data pengaturan',
        type: 'error',
      };
    } finally {
      this.isLoading = false;
    }
  };

  loadTransactions = async () => {
    this.transactionsLoading = true;
    try {
      const res = await apiRequest<any>('/super-admin/transactions');
      if (res && res.success) {
        this.transactionsList = res.data || [];
        if (res.summary) {
          this.transactionSummary = res.summary;
        }
      }
    } catch (_) {
    } finally {
      this.transactionsLoading = false;
    }
  };

  copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.copiedText = label;
      setTimeout(() => (this.copiedText = null), 2500);
    }
  };

  getPlanBadgeClass = (plan: string) => {
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
  };

  getStatusBadgeClass = (status: string) => {
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
  };

  formatRupiah = (amount: number) => {
    if (amount === 0) return 'Gratis (Rp 0)';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };
}

export const portal = new PortalStore();
