import { apiRequest } from '$lib/api/client';
import { goto } from '$app/navigation';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT';
  organizationId: string;
  organizationName?: string;
  isOnline?: boolean;
}

class AuthStore {
  user = $state<User | null>(null);
  token = $state<string | null>(null);
  isLoading = $state<boolean>(true);

  constructor() {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('wa_crm_token');
      const savedUser = localStorage.getItem('wa_crm_user');
      if (savedToken && savedUser) {
        try {
          this.token = savedToken;
          const parsed = JSON.parse(savedUser);
          if (parsed.isOnline === undefined) parsed.isOnline = true;
          this.user = parsed;
        } catch {
          this.logout();
        }
      }
      this.isLoading = false;
    }
  }

  get isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  get role(): 'ADMINISTRATOR' | 'SUPERVISOR' | 'AGENT' | null {
    return this.user?.role || null;
  }

  get isOnline(): boolean {
    return this.user?.isOnline ?? true;
  }

  setAuth(token: string, user: User) {
    if (user.isOnline === undefined) user.isOnline = true;
    this.token = token;
    this.user = user;
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_crm_token', token);
      localStorage.setItem('wa_crm_user', JSON.stringify(user));
    }
  }

  async toggleOnline() {
    if (!this.user?.id) return;
    const targetStatus = !this.isOnline;
    this.user.isOnline = targetStatus;
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_crm_user', JSON.stringify(this.user));
    }
    await apiRequest(`/users/${this.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isOnline: targetStatus }),
    });
  }

  async login(body: { email: string; password: string; organizationId?: string }) {
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

  logout() {
    this.token = null;
    this.user = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wa_crm_token');
      localStorage.removeItem('wa_crm_user');
      goto('/login');
    }
  }
}

export const authStore = new AuthStore();
