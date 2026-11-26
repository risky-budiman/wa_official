// Team-wide quick replies, stored on the server per organization.
import { apiRequest } from './client';

export interface QuickReplyItem {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}

/** Key used by older versions that kept quick replies only in this browser. */
export const LEGACY_QUICK_REPLIES_KEY = 'wa_crm_quick_replies';

export async function fetchQuickReplies(): Promise<{ items: QuickReplyItem[]; isDefault: boolean; error?: string }> {
  const res = await apiRequest<{ items: QuickReplyItem[]; isDefault: boolean }>('/settings/quick-replies');
  if (!res.success) return { items: [], isDefault: true, error: res.error || 'Gagal memuat balas cepat' };
  return { items: res.items || [], isDefault: !!res.isDefault };
}

export async function saveQuickReplies(items: QuickReplyItem[]) {
  return apiRequest<{ items: QuickReplyItem[]; isDefault: boolean }>('/settings/quick-replies', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });
}

export async function resetQuickReplies() {
  return apiRequest<{ items: QuickReplyItem[]; isDefault: boolean }>('/settings/quick-replies', {
    method: 'PUT',
    body: JSON.stringify({ reset: true }),
  });
}

/** Quick replies an older version saved in this browser (for a one-time import). */
export function readLegacyQuickReplies(): QuickReplyItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_QUICK_REPLIES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((q) => q && q.shortcut && q.title && q.body) : [];
  } catch {
    return [];
  }
}

export function clearLegacyQuickReplies() {
  try {
    localStorage.removeItem(LEGACY_QUICK_REPLIES_KEY);
  } catch {
    /* ignore */
  }
}
