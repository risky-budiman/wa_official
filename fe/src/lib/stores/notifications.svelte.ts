// ===========================================
// Real-time Notification Store (Sound & Desktop Alerts)
// ===========================================

import { apiRequest } from '$lib/api/client';

export interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  type: 'chat' | 'collab' | 'queue' | 'system';
  conversationId?: string;
  createdAt: string;
}

export class NotificationStore {
  items = $state<NotificationItem[]>([]);
  soundEnabled = $state<boolean>(true);
  permissionRequested = $state<boolean>(false);
  private lastKnownMessageIds = new Set<string>();
  private pollInterval: any = null;

  get unreadCount(): number {
    return this.items.filter((n) => n.unread).length;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      const savedSound = localStorage.getItem('wa_crm_sound_enabled');
      if (savedSound !== null) {
        this.soundEnabled = savedSound === 'true';
      }
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_crm_sound_enabled', String(this.soundEnabled));
    }
  }

  async requestBrowserPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permissionRequested = true;
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
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

      // Sweet two-tone WhatsApp chime (D5 -> A5)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08); // A5

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // AudioContext might be blocked until user interacts with the page
    }
  }

  triggerDesktopNotification(title: string, body: string, conversationId?: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.png',
          badge: '/favicon.png',
          tag: conversationId || 'wa-crm-notif',
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.warn('Desktop notification failed:', err);
      }
    }
  }

  addNotification(item: Omit<NotificationItem, 'id' | 'createdAt' | 'unread' | 'time'>) {
    const newItem: NotificationItem = {
      ...item,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      unread: true,
      createdAt: new Date().toISOString(),
      time: 'Baru saja',
    };

    this.items = [newItem, ...this.items.slice(0, 49)];
    this.playChime();
    this.triggerDesktopNotification(item.title, item.desc, item.conversationId);
  }

  markAllAsRead() {
    this.items = this.items.map((n) => ({ ...n, unread: false }));
  }

  markAsRead(id: string) {
    this.items = this.items.map((n) => (n.id === id ? { ...n, unread: false } : n));
  }

  clearAll() {
    this.items = [];
  }

  async pollRecentActivities() {
    try {
      const res = await apiRequest<{ items: any[] }>('/conversations');
      if (res && res.success && Array.isArray(res.items)) {
        for (const conv of res.items) {
          const msgKey = `${conv.id}:${conv.lastMessageAt}:${conv.lastMessagePreview}`;
          if (!this.lastKnownMessageIds.has(conv.id)) {
            // First time tracking this conversation ID
            this.lastKnownMessageIds.add(conv.id);
            // If it has a recent message within last 10 minutes and unassigned, seed into notifications
            const diffMs = Date.now() - new Date(conv.lastMessageAt).getTime();
            if (diffMs < 10 * 60 * 1000 && conv.status === 'UNASSIGNED') {
              this.items.push({
                id: 'init-' + conv.id,
                title: `Pesan Masuk: ${conv.contact.name}`,
                desc: conv.lastMessagePreview || 'Pesan baru dari pelanggan',
                time: new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                unread: true,
                type: 'chat',
                conversationId: conv.id,
                createdAt: conv.lastMessageAt,
              });
            }
          }
        }
      }
    } catch (e) {
      // Ignore background fetch error
    }
  }

  startPolling(intervalMs = 6000) {
    if (this.pollInterval || typeof window === 'undefined') return;
    this.pollRecentActivities();
    this.pollInterval = setInterval(() => {
      if (document.hidden) return;
      this.pollRecentActivities();
    }, intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export const notificationStore = new NotificationStore();
