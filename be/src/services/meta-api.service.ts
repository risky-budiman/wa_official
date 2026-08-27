// ===========================================
// Meta WhatsApp Cloud API Client Service
// ===========================================

import { env } from '../config/env';

export interface MetaSendTextParams {
  phoneNumberId: string;
  recipientWaId: string;
  text: string;
  previewUrl?: boolean;
}

export interface MetaSendTemplateParams {
  phoneNumberId: string;
  recipientWaId: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}

export class MetaApiService {
  private static baseUrl = `https://graph.facebook.com/${env.META_API_VERSION}`;

  /**
   * Send text message to WhatsApp Cloud API
   */
  static async sendTextMessage(params: MetaSendTextParams, accessToken = env.META_ACCESS_TOKEN) {
    if (!accessToken || !params.phoneNumberId) {
      console.warn('⚠️ Meta access token or phone number ID missing. Message simulated.');
      return {
        messages: [{ id: `wamid.SIMULATED_${Date.now()}` }]
      };
    }

    const url = `${this.baseUrl}/${params.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.recipientWaId,
        type: 'text',
        text: {
          preview_url: params.previewUrl ?? false,
          body: params.text,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Gagal mengirim pesan ke Meta WhatsApp API');
    }

    return data;
  }

  /**
   * Send approved template message (e.g. when 24-hr window expired)
   */
  static async sendTemplateMessage(params: MetaSendTemplateParams, accessToken = env.META_ACCESS_TOKEN) {
    if (!accessToken || !params.phoneNumberId) {
      console.warn('⚠️ Meta access token or phone number ID missing. Template simulated.');
      return {
        messages: [{ id: `wamid.SIMULATED_${Date.now()}` }]
      };
    }

    const url = `${this.baseUrl}/${params.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.recipientWaId,
        type: 'template',
        template: {
          name: params.templateName,
          language: {
            code: params.languageCode,
          },
          components: params.components || [],
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Gagal mengirim template ke Meta WhatsApp API');
    }

    return data;
  }

  /**
   * Fetch Live Phone Number Details from Meta Graph API
   */
  static async fetchPhoneNumberDetails(phoneNumberId: string, accessToken: string) {
    if (!accessToken || !phoneNumberId) return null;

    try {
      const url = `${this.baseUrl}/${phoneNumberId}?fields=id,verified_name,display_phone_number,quality_rating,status`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        // Try fallback with basic fields if requested fields don't exist on this node
        if (data.error?.code === 100) {
          const fallbackRes = await fetch(`${this.baseUrl}/${phoneNumberId}?fields=id,display_phone_number`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackRes.ok) return fallbackData;
        }
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Fetch Live Phone Numbers list for a WABA from Meta Graph API
   */
  static async fetchWabaPhoneNumbers(wabaId: string, accessToken: string) {
    if (!accessToken || !wabaId) return null;

    try {
      const url = `${this.baseUrl}/${wabaId}/phone_numbers?fields=id,verified_name,display_phone_number,quality_rating,status`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        // If wabaId was actually a Phone Number ID, fallback to fetching single phone number details
        if (data.error?.code === 100) {
          const singlePhone = await this.fetchPhoneNumberDetails(wabaId, accessToken);
          if (singlePhone) return [singlePhone];
        }
        return null;
      }
      return data.data || [];
    } catch {
      return null;
    }
  }

  /**
   * Fetch Live WABA details from Meta Graph API
   */
  static async fetchWabaDetails(wabaId: string, accessToken: string) {
    if (!accessToken || !wabaId) return null;

    try {
      const url = `${this.baseUrl}/${wabaId}?fields=id,name`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Exchange OAuth Code from Facebook Login / Embedded Signup for a long-lived Access Token
   */
  static async exchangeCodeForToken(code: string, appId = env.META_APP_ID, appSecret = env.META_APP_SECRET) {
    if (!code || !appId || !appSecret) return null;

    try {
      const url = `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        console.warn('Meta OAuth exchange error:', data.error?.message);
        return null;
      }
      return data.access_token as string;
    } catch (err: any) {
      console.warn('Meta OAuth exchange network error:', err.message);
      return null;
    }
  }
}
