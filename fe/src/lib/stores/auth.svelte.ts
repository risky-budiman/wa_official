import { apiRequest } from '$lib/api/client';
import { goto } from '$app/navigation';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'CO_SUPER_ADMIN' | 'ADMIN_FINANCE' | 'ADMIN_SUPPORT' | 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT';
  organizationId: string | null;
  organizationName?: string;
  isOnline?: boolean;
  isPrimaryAdmin?: boolean;
}

class AuthStore {
  user = $state<User | null>(null);
  token = $state<string | null>(null);
  impersonatorToken = $state<string | null>(null);
  impersonatorUser = $state<User | null>(null);
  isLoading = $state<boolean>(true);

  constructor() {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('wa_crm_token');
      const savedUser = localStorage.getItem('wa_crm_user');
      const savedImpToken = localStorage.getItem('wa_crm_imp_token');
      const savedImpUser = localStorage.getItem('wa_crm_imp_user');

      if (savedImpToken && savedImpUser) {
        try {
          this.impersonatorToken = savedImpToken;
          this.impersonatorUser = JSON.parse(savedImpUser);
        } catch (_) {}
      }

      if (savedToken && savedUser) {
        try {
          this.token = savedToken;
          const parsed = JSON.parse(savedUser);
          if (parsed.isOnline === undefined) parsed.isOnline = true;
          this.user = parsed;
          this.fetchFreshProfile();
        } catch {
          this.logout();
        }
      }
      this.isLoading = false;
    }
  }

  async fetchFreshProfile() {
    if (!this.token) return;
    try {
      const res = await apiRequest<{ user: User }>('/auth/me');
      if (res.success && res.user) {
        this.user = res.user;
        if (typeof window !== 'undefined') {
          localStorage.setItem('wa_crm_user', JSON.stringify(res.user));
        }
      }
    } catch (_) {}
  }

  get isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  get role(): 'SUPER_ADMIN' | 'CO_SUPER_ADMIN' | 'ADMIN_FINANCE' | 'ADMIN_SUPPORT' | 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT' | null {
    return this.user?.role || null;
  }

  get isSuperAdmin(): boolean {
    return this.user?.role === 'SUPER_ADMIN' || this.user?.role === 'CO_SUPER_ADMIN';
  }

  get isPrimaryAdmin(): boolean {
    return this.user?.isPrimaryAdmin === true;
  }

  get isPlatformStaff(): boolean {
    return (
      this.user?.role === 'SUPER_ADMIN' ||
      this.user?.role === 'CO_SUPER_ADMIN' ||
      this.user?.role === 'ADMIN_FINANCE' ||
      this.user?.role === 'ADMIN_SUPPORT'
    );
  }

  get isImpersonating(): boolean {
    return !!this.impersonatorToken;
  }

  get isOnline(): boolean {
    return this.user?.isOnline ?? false;
  }

  setAuth(token: string, user: User) {
    if (user.isOnline === undefined) user.isOnline = false;
    this.token = token;
    this.user = user;
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_crm_token', token);
      localStorage.setItem('wa_crm_user', JSON.stringify(user));
    }
  }

  impersonate(tenantToken: string, tenantUser: User) {
    if (typeof window !== 'undefined') {
      // Save current master session if not already impersonating
      if (!this.impersonatorToken && this.token && this.user) {
        this.impersonatorToken = this.token;
        this.impersonatorUser = this.user;
        localStorage.setItem('wa_crm_imp_token', this.token);
        localStorage.setItem('wa_crm_imp_user', JSON.stringify(this.user));
      }
      this.setAuth(tenantToken, tenantUser);
    }
  }

  revertImpersonation() {
    if (this.impersonatorToken && this.impersonatorUser) {
      const origToken = this.impersonatorToken;
      const origUser = this.impersonatorUser;
      this.impersonatorToken = null;
      this.impersonatorUser = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('wa_crm_imp_token');
        localStorage.removeItem('wa_crm_imp_user');
      }
      this.setAuth(origToken, origUser);
      goto('/administrator');
    }
  }

  async setOnlineStatus(targetStatus: boolean) {
    if (this.user) {
      this.user.isOnline = targetStatus;
      if (typeof window !== 'undefined') {
        localStorage.setItem('wa_crm_user', JSON.stringify(this.user));
      }
      if (this.user.id) {
        try {
          await apiRequest(`/users/${this.user.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isOnline: targetStatus }),
          });
        } catch (_) {}
      }
    }
  }

  async toggleOnline() {
    await this.setOnlineStatus(!this.isOnline);
  }

  async login(body: {
    email: string;
    password: string;
    organizationId?: string;
    portalType?: 'TENANT' | 'PLATFORM';
  }) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (res.success && res.token && res.user) {
      this.setAuth(res.token, res.user);
      return { success: true };
    }
    return { success: false, error: res.error || 'Login gagal' };
  }

  async register(body: {
    email: string;
    password: string;
    fullName: string;
    organizationName?: string;
    organizationId?: string;
  }) {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (res.success && res.token && res.user) {
      this.setAuth(res.token, res.user);
      return { success: true };
    }
    return { success: false, error: res.error || 'Registrasi gagal' };
  }

  async logout(confirmLogout = true) {
    if (confirmLogout && typeof window !== 'undefined') {
      if (!confirm('Apakah Anda yakin ingin Logout? Status ketersediaan Anda akan otomatis diubah menjadi Offline.')) {
        return;
      }
    }
    if (this.user?.id) {
      try {
        await apiRequest(`/users/${this.user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isOnline: false }),
        });
      } catch (_) {}
    }
    this.token = null;
    this.user = null;
    this.impersonatorToken = null;
    this.impersonatorUser = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('wa_crm_status_prompted');
      localStorage.removeItem('wa_crm_token');
      localStorage.removeItem('wa_crm_user');
      localStorage.removeItem('wa_crm_imp_token');
      localStorage.removeItem('wa_crm_imp_user');
      goto('/login');
    }
  }
}

export const authStore = new AuthStore();
