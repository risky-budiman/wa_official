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

const API_BASE = '/api/v1';

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
