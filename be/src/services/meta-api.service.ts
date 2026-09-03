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
   * Send Media message (image, document, video, audio) to Meta WhatsApp Cloud API
   */
  static async sendMediaMessage(
    params: {
      phoneNumberId: string;
      recipientWaId: string;
      type: 'image' | 'document' | 'video' | 'audio';
      mediaUrl: string;
      caption?: string;
      filename?: string;
    },
    accessToken = env.META_ACCESS_TOKEN
  ) {
    if (!accessToken || !params.phoneNumberId) {
      console.warn('⚠️ Meta access token or phone number ID missing. Media message simulated.');
      return {
        messages: [{ id: `wamid.SIMULATED_MEDIA_${Date.now()}` }]
      };
    }

    let targetNumber = (params.recipientWaId || '').replace(/[^0-9]/g, '');
    if (targetNumber.startsWith('08')) {
      targetNumber = '62' + targetNumber.slice(1);
    } else if (targetNumber.startsWith('8')) {
      targetNumber = '62' + targetNumber;
    }

    const url = `${this.baseUrl}/${params.phoneNumberId}/messages`;

    const mediaPayload: any = {
      link: params.mediaUrl,
    };
    if (params.caption && (params.type === 'image' || params.type === 'video' || params.type === 'document')) {
      mediaPayload.caption = params.caption;
    }
    if (params.filename && params.type === 'document') {
      mediaPayload.filename = params.filename;
    }

    const bodyObj: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: targetNumber,
      type: params.type,
      [params.type]: mediaPayload,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyObj),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('❌ Meta sendMediaMessage error:', JSON.stringify(data));
      throw new Error(data.error?.message || 'Gagal mengirim file media ke Meta WhatsApp API');
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

    let targetNumber = (params.recipientWaId || '').replace(/[^0-9]/g, '');
    if (targetNumber.startsWith('08')) {
      targetNumber = '62' + targetNumber.slice(1);
    } else if (targetNumber.startsWith('8')) {
      targetNumber = '62' + targetNumber;
    }

    const templateObj: any = {
      name: params.templateName,
      language: {
        code: params.languageCode || 'id',
      },
    };

    if (params.components && Array.isArray(params.components) && params.components.length > 0) {
      templateObj.components = params.components;
    }

    const url = `${this.baseUrl}/${params.phoneNumberId}/messages`;
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: targetNumber,
        type: 'template',
        template: templateObj,
      }),
    });

    let data = await res.json();

    // Auto-heal retry: If Meta requires a URL button parameter that was missing
    if (!res.ok && data.error?.error_data?.details?.includes('Button at index')) {
      const match = data.error.error_data.details.match(/index (\d+)/);
      const btnIdx = match ? match[1] : '0';
      if (!templateObj.components) templateObj.components = [];
      templateObj.components.push({
        type: 'button',
        sub_type: 'url',
        index: btnIdx,
        parameters: [{ type: 'text', text: 'promo' }],
      });

      console.log(`🔄 Auto-healing button parameter at index ${btnIdx} and retrying...`);
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: targetNumber,
          type: 'template',
          template: templateObj,
        }),
      });
      data = await res.json();
    }

    if (!res.ok) {
      console.error('❌ Meta sendTemplateMessage error:', JSON.stringify(data));
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
      const url = `${this.baseUrl}/${phoneNumberId}?fields=id,verified_name,display_phone_number,quality_rating,status,messaging_limit_tier,throughput`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        // Try fallback with basic fields if requested fields don't exist on this node
        if (data.error?.code === 100) {
          const fallbackRes = await fetch(`${this.baseUrl}/${phoneNumberId}?fields=id,display_phone_number,quality_rating`, {
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
      const url = `${this.baseUrl}/${wabaId}/phone_numbers?fields=id,verified_name,display_phone_number,quality_rating,status,messaging_limit_tier,throughput`;
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
   * Resolve true WABA ID directly from Phone Number ID via Meta Graph API
   */
  static async fetchWabaIdFromPhoneNumberId(phoneNumberId: string, accessToken: string) {
    if (!phoneNumberId || !accessToken) return null;

    try {
      const url = `${this.baseUrl}/${phoneNumberId}?fields=whatsapp_business_account`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.whatsapp_business_account?.id) {
        console.log(`✨ Resolved true WABA ID ${data.whatsapp_business_account.id} for Phone Number ${phoneNumberId}`);
        return data.whatsapp_business_account.id as string;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Subscribe App to WABA (WhatsApp Business Account) Webhooks via Meta Graph API
   */
  static async subscribeAppToWaba(wabaId: string, accessToken: string) {
    if (!wabaId || !accessToken || wabaId === '1386698372551547') return null;

    try {
      const url = `${this.baseUrl}/${wabaId}/subscribed_apps`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ WABA ${wabaId} successfully subscribed to App Webhooks!`);
      } else {
        console.warn('⚠️ WABA subscribe app warning:', data.error?.message);
      }
      return data;
    } catch (err: any) {
      console.warn('WABA subscribe app notice:', err.message);
      return null;
    }
  }

  /**
   * Exchange OAuth Code from Facebook Login Embedded Signup for Permanent / User Access Token
   */
  static async exchangeCodeForToken(code: string, customAppId?: string): Promise<string | null> {
    const appId = customAppId || env.META_APP_ID;
    const appSecret = env.META_APP_SECRET;

    if (!code || !appId || !appSecret) {
      console.warn('⚠️ Cannot exchange OAuth code: code, META_APP_ID, or META_APP_SECRET is missing');
      return null;
    }

    try {
      const url = `https://graph.facebook.com/${env.META_API_VERSION}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.access_token) {
        console.log('✅ Meta OAuth code successfully exchanged for Access Token');
        return data.access_token as string;
      } else {
        console.warn('⚠️ Meta OAuth exchange failed:', data.error?.message);
        return null;
      }
    } catch (err: any) {
      console.warn('⚠️ Meta OAuth exchange exception:', err.message);
      return null;
    }
  }

  /**
   * Download Inbound Media (Images, Documents, Audio, Video) from WhatsApp Cloud API and save locally
   */
  static async downloadMedia(
    mediaId: string,
    accessToken = env.META_ACCESS_TOKEN
  ): Promise<{ localUrl: string; mimeType: string; filename: string } | null> {
    if (!mediaId || !accessToken) return null;

    try {
      // 1. Fetch download URL from Meta Graph API
      const metaMediaUrl = `${this.baseUrl}/${mediaId}`;
      const resMeta = await fetch(metaMediaUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'curl/7.64.1',
        },
      });
      const metaData = await resMeta.json();

      if (!resMeta.ok || !metaData.url) {
        console.warn('⚠️ Meta get media URL failed:', metaData.error?.message || metaData);
        return null;
      }

      const mimeType = (metaData.mime_type || 'image/jpeg').split(';')[0].trim();
      let ext = 'bin';
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
      else if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('gif')) ext = 'gif';
      else if (mimeType.includes('pdf')) ext = 'pdf';
      else if (mimeType.includes('mp4')) ext = 'mp4';
      else if (mimeType.includes('ogg') || mimeType.includes('opus')) ext = 'ogg';
      else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) ext = 'mp3';
      else if (mimeType.includes('msword') || mimeType.includes('document')) ext = 'docx';
      else if (mimeType.includes('sheet') || mimeType.includes('excel')) ext = 'xlsx';

      const filename = `${mediaId}.${ext}`;

      // 2. Download binary payload from the temporary lookaside URL
      const resBinary = await fetch(metaData.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'curl/7.64.1',
        },
      });

      if (!resBinary.ok) {
        console.warn('⚠️ Failed to download media payload from Meta:', resBinary.status, resBinary.statusText);
        return null;
      }

      const buffer = await resBinary.arrayBuffer();

      // 3. Ensure destination directory exists
      const { join } = await import('path');
      const { existsSync, mkdirSync } = await import('fs');
      const uploadDir = join(process.cwd(), 'uploads', 'media');
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      // 4. Save file to disk
      const filePath = join(uploadDir, filename);
      await Bun.write(filePath, buffer);

      console.log(`📸 Berhasil mengunduh media WhatsApp (${filename}, ${buffer.byteLength} bytes)`);

      return {
        localUrl: `/api/v1/media/${filename}`,
        mimeType,
        filename,
      };
    } catch (err: any) {
      console.error('❌ Error downloading Meta media:', err.message);
      return null;
    }
  }
}
