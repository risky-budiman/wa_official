// ===========================================
// Channel Store — Real-time WhatsApp Channel State
// ===========================================

import { apiRequest } from '$lib/api/client';

export interface ChannelInfo {
  displayPhoneNumber: string;
  verifiedName: string;
  wabaId: string;
  qualityRating: string;
  companyName?: string;
}

class ChannelStore {
  isConnected = $state(false);
  channel = $state<ChannelInfo | null>(null);
  isLoading = $state(false);

  async checkStatus() {
    this.isLoading = true;
    try {
      const res = await apiRequest<any>('/settings/waba/status');
      if (res.success && res.isConnected && res.channel) {
        this.isConnected = true;
        this.channel = res.channel;
      } else {
        this.isConnected = false;
        this.channel = null;
      }
    } catch {
      this.isConnected = false;
      this.channel = null;
    } finally {
      this.isLoading = false;
    }
  }

  setConnected(info: ChannelInfo) {
    this.isConnected = true;
    this.channel = info;
  }

  setDisconnected() {
    this.isConnected = false;
    this.channel = null;
  }
}

export const channelStore = new ChannelStore();
