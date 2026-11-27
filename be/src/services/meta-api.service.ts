// ===========================================
// Meta WhatsApp Cloud API Client Service
// ===========================================

import { nanoid } from 'nanoid';
import { env } from '../config/env';
import { extensionForMime } from './inbound-message';

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
  static async sendTextMessage(params: MetaSendTextParams, accessToken = '') {
    if (!accessToken || !params.phoneNumberId) {
      if (env.NODE_ENV === 'production') {
        throw new Error('Nomor WhatsApp organisasi belum terhubung (token / Phone Number ID kosong). Hubungkan di Pengaturan → Saluran WhatsApp.');
      }
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
    accessToken = ''
  ) {
    if (!accessToken || !params.phoneNumberId) {
      if (env.NODE_ENV === 'production') {
        throw new Error('Nomor WhatsApp organisasi belum terhubung (token / Phone Number ID kosong). Hubungkan di Pengaturan → Saluran WhatsApp.');
      }
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

    let fullMediaUrl = params.mediaUrl;
    if (fullMediaUrl && fullMediaUrl.startsWith('/')) {
      let baseUrl = env.PUBLIC_APP_URL || '';
      if (!baseUrl && env.CORS_ORIGIN && env.CORS_ORIGIN !== '*') {
        baseUrl = env.CORS_ORIGIN.split(',')[0].trim();
      }
      if (!baseUrl) {
        // Meta downloads media from a public URL — a relative link can never work
        throw new Error('PUBLIC_APP_URL belum diisi di .env server (mis. https://crm.ids.net.id); media tidak bisa dikirim.');
      }
      fullMediaUrl = `${baseUrl.replace(/\/$/, '')}${fullMediaUrl}`;
    }

    const mediaPayload: any = {
      link: fullMediaUrl,
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
  static async sendTemplateMessage(params: MetaSendTemplateParams, accessToken = '') {
    if (!accessToken || !params.phoneNumberId) {
      if (env.NODE_ENV === 'production') {
        throw new Error('Nomor WhatsApp organisasi belum terhubung (token / Phone Number ID kosong). Hubungkan di Pengaturan → Saluran WhatsApp.');
      }
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
    const res = await fetch(url, {
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

    const data = await res.json();

    // (No "auto-heal": re-sending with an invented link parameter would show customers a fake URL)
    if (!res.ok && data.error?.error_data?.details?.includes('Button at index')) {
      throw new Error(`Template membutuhkan isian tombol link dinamis: ${data.error.error_data.details}`);
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
  /**
   * Is this number registered on the Cloud API? (platform_type CLOUD_API). Numbers that just went
   * through Embedded Signup must be registered with a 6-digit PIN before they can send.
   */
  static async fetchPhoneRegistration(phoneNumberId: string, accessToken: string): Promise<{ platformType?: string; status?: string } | null> {
    if (!phoneNumberId || !accessToken) return null;
    try {
      const res = await fetch(`${this.baseUrl}/${phoneNumberId}?fields=platform_type,status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data: any = await res.json();
      if (!res.ok) return null;
      return { platformType: data.platform_type, status: data.status };
    } catch {
      return null;
    }
  }

  static async subscribeAppToWaba(wabaId: string, accessToken: string) {
    if (!wabaId || !accessToken) return null;

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

  // ───────── Phone number management (change-number flow) ─────────

  private static async graphPost(path: string, accessToken: string, body: Record<string, any>) {
    try {
      const res = await fetch(`${this.baseUrl}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        const e = data?.error || {};
        return { ok: false as const, data, error: e.error_user_msg || e.message || `Meta API error (${res.status})`, code: e.code };
      }
      return { ok: true as const, data };
    } catch (err: any) {
      return { ok: false as const, data: null, error: err?.message || 'Gagal menghubungi Meta API' };
    }
  }

  /** All numbers in a WABA, including verification & display-name review status. */
  static async listWabaPhoneNumbers(wabaId: string, accessToken: string) {
    if (!accessToken || !wabaId) return { ok: false as const, numbers: [] as any[], error: 'WABA ID / token belum tersedia' };
    try {
      const fields = 'id,verified_name,display_phone_number,quality_rating,status,code_verification_status,name_status,new_name_status,messaging_limit_tier,platform_type';
      const res = await fetch(`${this.baseUrl}/${wabaId}/phone_numbers?fields=${fields}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data: any = await res.json();
      if (!res.ok) return { ok: false as const, numbers: [] as any[], error: data?.error?.message || 'Gagal memuat nomor dari Meta' };
      return { ok: true as const, numbers: (data?.data || []) as any[] };
    } catch (err: any) {
      return { ok: false as const, numbers: [] as any[], error: err?.message || 'Gagal menghubungi Meta API' };
    }
  }

  /** Add a new number to a WABA. Returns the new phone_number_id. */
  static addPhoneNumber(wabaId: string, accessToken: string, cc: string, phoneNumber: string, verifiedName: string) {
    return this.graphPost(`${wabaId}/phone_numbers`, accessToken, { cc, phone_number: phoneNumber, verified_name: verifiedName });
  }

  /** Send the ownership OTP to the number by SMS or voice call. */
  static requestVerificationCode(phoneNumberId: string, accessToken: string, method: 'SMS' | 'VOICE', language = 'id') {
    return this.graphPost(`${phoneNumberId}/request_code`, accessToken, { code_method: method, language });
  }

  /** Confirm the OTP received on the number. */
  static verifyCode(phoneNumberId: string, accessToken: string, code: string) {
    return this.graphPost(`${phoneNumberId}/verify_code`, accessToken, { code });
  }

  /** Register the number on Cloud API with its 6-digit two-step verification PIN. */
  static registerPhoneNumber(phoneNumberId: string, accessToken: string, pin: string) {
    return this.graphPost(`${phoneNumberId}/register`, accessToken, { messaging_product: 'whatsapp', pin });
  }

  /**
   * Coexistence: ask Meta to send the WhatsApp Business app's contacts (smb_app_state_sync) or
   * chat history (history) as webhooks. Only allowed within 24 hours of onboarding.
   */
  static requestSmbAppSync(phoneNumberId: string, accessToken: string, syncType: 'smb_app_state_sync' | 'history') {
    return this.graphPost(`${phoneNumberId}/smb_app_data`, accessToken, { messaging_product: 'whatsapp', sync_type: syncType });
  }

  /**
   * Exchange OAuth Code from Facebook Login Embedded Signup for Permanent / User Access Token
   */
  static async exchangeCodeForToken(code: string, redirectUri?: string, customAppId?: string): Promise<{ accessToken?: string; error?: string }> {
    const appId = customAppId || env.META_APP_ID;
    const appSecret = env.META_APP_SECRET;

    if (!code) {
      return { error: 'Kode otorisasi (code) dari Facebook kosong.' };
    }
    if (!appId || !appSecret) {
      return { error: `META_APP_ID (${appId ? 'ADA' : 'KOSONG'}) atau META_APP_SECRET (${appSecret ? 'ADA' : 'KOSONG'}) belum diset di file .env server backend.` };
    }

    try {
      let url = `https://graph.facebook.com/${env.META_API_VERSION}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;
      if (redirectUri) {
        url += `&redirect_uri=${encodeURIComponent(redirectUri)}`;
      }
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.access_token) {
        console.log('✅ Meta OAuth code successfully exchanged for Access Token');
        return { accessToken: data.access_token as string };
      } else {
        const metaErrMsg = data.error?.message || JSON.stringify(data);
        console.warn('⚠️ Meta OAuth exchange failed:', metaErrMsg);
        return { error: `Meta OAuth Error: ${metaErrMsg}` };
      }
    } catch (err: any) {
      console.warn('⚠️ Meta OAuth exchange exception:', err.message);
      return { error: `Network Exception: ${err.message}` };
    }
  }

  /**
   * Dynamically discover shared WABA ID(s) associated with an Access Token (Facebook Login / Embedded Signup)
   */
  static async fetchSharedWabaId(accessToken: string, customAppId?: string): Promise<string | null> {
    if (!accessToken) return null;

    try {
      // 1. Try GET /v20.0/me/shared_wabas
      let res = await fetch(`${this.baseUrl}/me/shared_wabas`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let data = await res.json();
      if (res.ok && data.data && data.data.length > 0) {
        console.log(`✨ Dynamically discovered Shared WABA ID: ${data.data[0].id}`);
        return data.data[0].id as string;
      }

      // 2. Fallback: Try GET /v20.0/me/client_whatsapp_business_accounts
      res = await fetch(`${this.baseUrl}/me/client_whatsapp_business_accounts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      data = await res.json();
      if (res.ok && data.data && data.data.length > 0) {
        console.log(`✨ Dynamically discovered Client WABA ID: ${data.data[0].id}`);
        return data.data[0].id as string;
      }

      // 3. Fallback: Try GET /v20.0/me/whatsapp_business_accounts
      res = await fetch(`${this.baseUrl}/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      data = await res.json();
      if (res.ok && data.data && data.data.length > 0) {
        console.log(`✨ Dynamically discovered User WABA ID: ${data.data[0].id}`);
        return data.data[0].id as string;
      }

      // 4. Fallback: Query debug_token using App Access Token to inspect target_ids / granular_scopes
      const appId = customAppId || env.META_APP_ID;
      const appSecret = env.META_APP_SECRET;
      if (appId && appSecret) {
        const appToken = `${appId}|${appSecret}`;
        res = await fetch(`${this.baseUrl}/debug_token?input_token=${accessToken}&access_token=${appToken}`);
        data = await res.json();
        const targetIds = data.data?.target_ids;
        if (targetIds && targetIds.length > 0) {
          console.log(`✨ Discovered WABA ID from debug_token target_ids: ${targetIds[0]}`);
          return targetIds[0] as string;
        }
        const granularScopes = data.data?.granular_scopes;
        if (granularScopes && Array.isArray(granularScopes)) {
          for (const scope of granularScopes) {
            if (scope.target_ids && scope.target_ids.length > 0) {
              console.log(`✨ Discovered WABA ID from granular_scopes: ${scope.target_ids[0]}`);
              return scope.target_ids[0] as string;
            }
          }
        }
      }

      return null;
    } catch (err: any) {
      console.warn('⚠️ Error discovering shared WABA ID:', err.message);
      return null;
    }
  }

  /**
   * Download Inbound Media (Images, Documents, Audio, Video) from WhatsApp Cloud API and save locally
   */
  static async downloadMedia(
    mediaId: string,
    accessToken = ''
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
      // e.g. audio/mp4 (voice note) → .m4a, not a video
      const ext = extensionForMime(mimeType);

      // Random suffix so customer media URLs cannot be guessed from the Meta media ID
      const safeMediaId = String(mediaId).replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `${safeMediaId}_${nanoid(20)}.${ext}`;

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
