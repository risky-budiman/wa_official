// ===========================================
// API Client Helper
// ===========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  user?: any;
  token?: string;
  [key: string]: any;
}

// In production, set PUBLIC_API_URL to your backend URL (e.g. https://api.domain.com/api/v1)
// In development, Vite proxy handles /api/* → localhost:3000
const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    // Check for runtime config injected via env
    const envUrl = (import.meta as any).env?.PUBLIC_API_URL;
    if (envUrl) return envUrl;
  }
  return '/api/v1';
};

const API_BASE = getApiBase();

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('wa_crm_token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers
    });
    const text = await res.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    if (!res.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${res.status}: ${res.statusText || 'Server Error'}`
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Koneksi ke server gagal'
    };
  }
}
