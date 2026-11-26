// ===========================================
// Notifications — new customer messages (sound, desktop, unread badge)
// ===========================================
//
// One source of truth for "a customer wrote to us":
//  - only messages FROM THE CUSTOMER notify (not our replies, bot replies or broadcasts)
//  - grouped per conversation ("3 pesan baru")
//  - nothing fires for the conversation you are looking at while the tab is visible
//  - keeps polling (slower) while the tab is in the background so desktop alerts still arrive

import { apiRequest } from '$lib/api/client';
import { goto } from '$app/navigation';

export interface NotificationItem {
  id: string;
  conversationId: string;
  contactName: string;
  preview: string;
  /** Messages received since the notification was last read */
  count: number;
  unread: boolean;
  /** ISO time of the newest message */
  at: string;
  kind: 'message' | 'queue';
}

const FOREGROUND_MS = 6000;
/** While a page (the Inbox) shows the conversation list, poll a bit faster */
const SUBSCRIBED_MS = 4000;
const BACKGROUND_MS = 15000;
const SOUND_KEY = 'wa_crm_sound_enabled';
const DESKTOP_KEY = 'wa_crm_desktop_notif';

export class NotificationStore {
  items = $state<NotificationItem[]>([]);
  soundEnabled = $state(true);
  /** User preference for desktop pop-ups (browser permission is separate) */
  desktopEnabled = $state(true);
  permission = $state<NotificationPermission | 'unsupported'>('default');
  /** Conversation currently open in the Inbox (no alerts for it while visible) */
  activeConversationId = $state<string | null>(null);
  /** Conversation the Inbox should open next (set by clicking a notification) */
  pendingOpen = $state<string | null>(null);

  private lastSeen = new Map<string, string>();
  private initialized = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  /** Pages that want every fresh /conversations result (one request feeds bell + Inbox) */
  private listeners = new Set<(items: any[]) => void>();

  get unreadCount(): number {
    return this.items.filter((n) => n.unread).length;
  }

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      const s = localStorage.getItem(SOUND_KEY);
      if (s !== null) this.soundEnabled = s === 'true';
      const d = localStorage.getItem(DESKTOP_KEY);
      if (d !== null) this.desktopEnabled = d === 'true';
    } catch {
      /* storage unavailable */
    }
    this.permission = 'Notification' in window ? Notification.permission : 'unsupported';
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    try {
      localStorage.setItem(SOUND_KEY, String(this.soundEnabled));
    } catch {
      /* ignore */
    }
    if (this.soundEnabled) this.playChime();
  }

  toggleDesktop() {
    this.desktopEnabled = !this.desktopEnabled;
    try {
      localStorage.setItem(DESKTOP_KEY, String(this.desktopEnabled));
    } catch {
      /* ignore */
    }
  }

  /** Must be called from a click: browsers only show the permission prompt after a user gesture. */
  async requestBrowserPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      this.permission = 'unsupported';
      return;
    }
    if (Notification.permission === 'default') {
      try {
        this.permission = await Notification.requestPermission();
      } catch {
        this.permission = Notification.permission;
      }
    } else {
      this.permission = Notification.permission;
    }
  }

  playChime() {
    if (!this.soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
      osc.onended = () => ctx.close().catch(() => {});
    } catch {
      /* audio blocked until the user interacts with the page */
    }
  }

  private desktopAlert(item: NotificationItem) {
    if (!this.desktopEnabled || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(item.contactName, {
        body: item.count > 1 ? `${item.count} pesan baru · ${item.preview}` : item.preview,
        icon: '/favicon.png',
        tag: `conv-${item.conversationId}`, // replaces the previous pop-up for the same chat
      });
      n.onclick = () => {
        window.focus();
        this.open(item);
        n.close();
      };
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }

  /** Open the conversation in the Inbox and mark its notification read. */
  open(item: NotificationItem) {
    this.markConversationRead(item.conversationId);
    this.pendingOpen = item.conversationId;
    if (typeof window !== 'undefined' && window.location.pathname !== '/inbox') goto('/inbox');
  }

  markAllAsRead() {
    this.items = this.items.map((n) => ({ ...n, unread: false, count: 0 }));
  }

  markConversationRead(conversationId: string) {
    this.items = this.items.map((n) => (n.conversationId === conversationId ? { ...n, unread: false, count: 0 } : n));
  }

  clearAll() {
    this.items = [];
  }

  /** The Inbox tells us which chat is open; its notification is cleared. */
  setActiveConversation(id: string | null) {
    this.activeConversationId = id;
    if (id) this.markConversationRead(id);
  }

  /** Receive every conversation list this store fetches. Returns an unsubscribe function. */
  subscribe(cb: (items: any[]) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Fetch now (e.g. right after the user changed something) instead of waiting for the next tick. */
  refreshNow() {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.tick();
  }

  private async poll() {
    const res = await apiRequest<{ items: any[] }>('/conversations');
    if (!res.success || !Array.isArray(res.items)) return;
    for (const cb of this.listeners) {
      try {
        cb(res.items);
      } catch {
        /* a listener error must not stop notifications */
      }
    }

    const firstRun = !this.initialized;
    this.initialized = true;
    const fresh: NotificationItem[] = [];

    for (const conv of res.items) {
      if (!conv?.id || !conv.lastMessageAt) continue;
      const stamp = String(conv.lastMessageAt);
      const previous = this.lastSeen.get(conv.id);
      this.lastSeen.set(conv.id, stamp);

      // First load only remembers where we are — no burst of old alerts
      if (firstRun || previous === stamp) continue;
      if (!conv.lastMessageFromCustomer) continue;
      if (conv.status === 'RESOLVED') continue;

      const viewingIt = conv.id === this.activeConversationId && !document.hidden;
      if (viewingIt) continue;

      const existing = this.items.find((n) => n.conversationId === conv.id);
      const item: NotificationItem = {
        id: existing?.id || `n-${conv.id}`,
        conversationId: conv.id,
        contactName: conv.contact?.name || 'Pelanggan',
        preview: conv.lastMessagePreview || 'Pesan baru',
        count: (existing?.unread ? existing.count : 0) + 1,
        unread: true,
        at: stamp,
        kind: !conv.assignedUser ? 'queue' : 'message',
      };
      fresh.push(item);
    }

    if (fresh.length === 0) return;
    const freshIds = new Set(fresh.map((f) => f.conversationId));
    this.items = [...fresh, ...this.items.filter((n) => !freshIds.has(n.conversationId))].slice(0, 50);
    this.playChime();
    for (const item of fresh.slice(0, 3)) this.desktopAlert(item);
  }

  private polling = false;
  private tick = async () => {
    if (!this.running || this.polling) return;
    this.polling = true;
    try {
      await this.poll();
    } catch {
      /* network hiccup — try again next tick */
    } finally {
      this.polling = false;
    }
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    const wait = document.hidden ? BACKGROUND_MS : this.listeners.size > 0 ? SUBSCRIBED_MS : FOREGROUND_MS;
    this.timer = setTimeout(this.tick, wait);
  };

  startPolling() {
    if (this.running || typeof window === 'undefined') return;
    this.running = true;
    this.tick();
  }

  stopPolling() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.initialized = false;
    this.lastSeen.clear();
  }
}

export const notificationStore = new NotificationStore();
