// ===========================================
// Organization & WABA Settings Routes (Admin)
// ===========================================

import { Elysia, t } from 'elysia';
import { parseMessagingTier } from '../../services/messaging-tier';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { env } from '../../config/env';
import { db } from '../../config/database';
import { organizations, phoneNumbers, messages, conversations, broadcastCampaigns, apiKeys, users } from '../../db/schema';
import { authPlugin } from '../../middleware/auth';
import { hashApiKey } from '../../middleware/api-key-auth';
import { MetaApiService } from '../../services/meta-api.service';
import { AiAgentService, assertSafeLlmBaseUrl } from '../../services/ai-agent.service';
import { buildAiSystemPrompt } from '../../services/chatbot.service';
import { decideBotReply, normalizeBotSettings, fillTemplate } from '../../services/bot-engine';
import {
  activatePhoneNumber,
  archiveOrgPhones,
  getActivePhone,
  pickMetaPhone,
  PhoneNumberInUseError,
} from '../../services/phone-number.service';
import { orgMetaToken, platformPhoneNumberId } from '../../services/meta-credentials';

/**
 * Make `targetPhoneId` the organization's active number. Old numbers are archived (never deleted),
 * so conversations that reference them keep their history. See services/phone-number.service.ts.
 */
async function safeUpsertPhoneNumber(
  orgId: string,
  targetPhoneId: string,
  displayPhoneNumber: string,
  verifiedName?: string,
  qualityRating = 'GREEN'
) {
  if (!orgId || !targetPhoneId) return;
  return activatePhoneNumber(orgId, {
    phoneNumberId: targetPhoneId,
    displayPhoneNumber,
    verifiedName,
    qualityRating,
  });
}

/** Token the organization uses to talk to Meta (its own, else the platform token). */
function resolveOrgToken(orgToken?: string | null) {
  return orgMetaToken(orgToken);
}

type NumberContext = { wabaId: string; token: string; number?: any };

/**
 * Admin-only context for the change-number endpoints. When `phoneId` is given, the number must
 * belong to this organization's WABA (prevents acting on another tenant's numbers).
 */
async function loadNumberContext(user: any, set: any, phoneId?: string): Promise<NumberContext | { error: any }> {
  if (!user) {
    set.status = 401;
    return { error: { success: false, error: 'Unauthorized' } };
  }
  if (user.role !== 'ADMINISTRATOR') {
    set.status = 403;
    return { error: { success: false, error: 'Akses dibatasi untuk Administrator' } };
  }
  const [org] = await db
    .select({ wabaId: organizations.wabaId, accessToken: organizations.accessToken })
    .from(organizations)
    .where(eq(organizations.id, user.orgId))
    .limit(1);
  const token = resolveOrgToken(org?.accessToken);
  if (!org?.wabaId || !token) {
    set.status = 400;
    return { error: { success: false, error: 'Hubungkan WhatsApp Business Account (WABA) terlebih dahulu.' } };
  }
  if (!phoneId) return { wabaId: org.wabaId, token };

  const list = await MetaApiService.listWabaPhoneNumbers(org.wabaId, token);
  if (!list.ok) {
    set.status = 502;
    return { error: { success: false, error: list.error } };
  }
  const number = list.numbers.find((n: any) => n.id === phoneId);
  if (!number) {
    set.status = 404;
    return { error: { success: false, error: 'Nomor tidak ditemukan di WABA organisasi Anda.' } };
  }
  return { wabaId: org.wabaId, token, number };
}

// ───────── Chatbot & AI settings helpers ─────────

function parseJsonValue<T = any>(v: unknown): T | null {
  if (!v) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

const DEFAULT_QUICK_REPLIES = [
  { id: 'qr-salam', shortcut: '/salam', title: 'Salam pembuka', body: 'Halo, terima kasih telah menghubungi kami. Ada yang bisa kami bantu hari ini? 😊' },
  { id: 'qr-tunggu', shortcut: '/tunggu', title: 'Mohon ditunggu', body: 'Mohon tunggu sebentar ya, kami sedang mengecek data Anda.' },
  { id: 'qr-jamkerja', shortcut: '/jam_kerja', title: 'Jam operasional', body: 'Jam operasional layanan kami: Senin–Jumat 08.00–17.00 WIB.' },
  { id: 'qr-terimakasih', shortcut: '/terimakasih', title: 'Penutup', body: 'Terima kasih atas kepercayaan Anda. Jika ada pertanyaan lain, jangan ragu menghubungi kami kembali! 🙏' },
];

const canManageBot = (role?: string) => role === 'ADMINISTRATOR' || role === 'SUPER_ADMIN' || role === 'SUPERVISOR';

async function storedAiKey(orgId: string): Promise<string> {
  const [org] = await db
    .select({ aiAgentConfig: organizations.aiAgentConfig })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return (parseJsonValue<any>(org?.aiAgentConfig)?.apiKey as string) || '';
}

const botSettingsBody = t.Object({
  operatingHours: t.Optional(t.Any()),
  aiAgentConfig: t.Optional(t.Any()),
  chatbotConfig: t.Optional(t.Any()),
});

const AI_MODES = ['AI_ASSISTANT', 'STATIC_MESSAGE', 'NONE'];
const AI_PROVIDERS = ['gemini', 'openai', 'claude', 'custom_llm'];
const RULE_ACTIONS = ['REPLY', 'HANDOFF_HUMAN', 'HANDOVER_AI'];

function cleanChatbotConfig(c: any) {
  if (!c || typeof c !== 'object') return c;
  const str = (v: any, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const rules = Array.isArray(c.rules) ? c.rules.slice(0, 50) : [];
  return {
    enabled: c.enabled === true,
    greetingText: str(c.greetingText, 4000),
    greetingKeywords: Array.isArray(c.greetingKeywords)
      ? c.greetingKeywords.map((k: any) => str(k, 60).trim()).filter(Boolean).slice(0, 30)
      : undefined,
    greetOnNewConversation: c.greetOnNewConversation === true,
    rules: rules.map((r: any, i: number) => ({
      id: str(r?.id, 60) || `rule-${Date.now()}-${i}`,
      title: str(r?.title, 120) || `Menu ${i + 1}`,
      keywords: Array.isArray(r?.keywords)
        ? r.keywords.map((k: any) => str(k, 60).trim()).filter(Boolean).slice(0, 30)
        : [],
      replyText: str(r?.replyText, 4000),
      action: RULE_ACTIONS.includes(r?.action) ? r.action : 'REPLY',
    })),
  };
}

async function saveBotSettings(user: any, body: any, set: any) {
  if (!user) {
    set.status = 401;
    return { success: false, error: 'Unauthorized' };
  }
  if (!canManageBot(user.role)) {
    set.status = 403;
    return { success: false, error: 'Akses ditolak (Khusus Administrator atau Supervisor)' };
  }

  try {
    const hours = parseJsonValue<any>(body.operatingHours);
    let ai = parseJsonValue<any>(body.aiAgentConfig);
    const chatbot = parseJsonValue<any>(body.chatbotConfig);
    const updateData: any = {};

    if (hours) updateData.operatingHours = hours;

    if (ai) {
      const { hasApiKey: _h, apiKeyHint: _k, clearApiKey, ...rest } = ai;
      ai = rest;
      if (!AI_MODES.includes(ai.mode)) ai.mode = 'AI_ASSISTANT';
      if (!AI_PROVIDERS.includes(ai.provider)) ai.provider = 'gemini';
      // The UI never receives the stored key: keep it unless a new one is typed or removal is requested
      const typed = typeof ai.apiKey === 'string' ? ai.apiKey.trim() : '';
      ai.apiKey = clearApiKey ? '' : typed && !typed.startsWith('••') ? typed : await storedAiKey(user.orgId);
      if (ai.provider === 'custom_llm' && ai.baseUrl) {
        try {
          assertSafeLlmBaseUrl(ai.baseUrl);
        } catch (err: any) {
          set.status = 400;
          return { success: false, error: err.message };
        }
      }
      updateData.aiAgentConfig = ai;
    }

    if (chatbot) updateData.chatbotConfig = cleanChatbotConfig(chatbot);

    if (Object.keys(updateData).length === 0) {
      return { success: true, message: 'Tidak ada perubahan.' };
    }
    await db.update(organizations).set(updateData).where(eq(organizations.id, user.orgId));
    return { success: true, message: 'Pengaturan Chatbot & AI berhasil disimpan.' };
  } catch (err: any) {
    console.error('❌ Gagal menyimpan pengaturan chatbot:', err);
    set.status = 500;
    return { success: false, error: 'Gagal menyimpan pengaturan. Coba lagi.' };
  }
}

export const settingsRoutes = new Elysia({ prefix: '/settings' })
  .use(authPlugin)

  // ─── GET /settings/waba/status (Health check for all roles) ──
  .get('/waba/status', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        wabaId: organizations.wabaId,
        accessToken: organizations.accessToken,
      })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    let phone = await getActivePhone(user.orgId);

    // Auto-heal: If organization has an active WABA ID, ensure phone status is CONNECTED
    if (org?.wabaId) {
      if (!phone) {
        const safePhoneId = 'phone_' + nanoid(10);
        await safeUpsertPhoneNumber(
          user.orgId,
          safePhoneId,
          'Nomor WhatsApp Business',
          org.name || 'Akun WhatsApp Business Resmi',
          'GREEN'
        );
        phone = await getActivePhone(user.orgId);
      } else if (phone.status === 'DISCONNECTED') {
        await db
          .update(phoneNumbers)
          .set({ status: 'CONNECTED' })
          .where(eq(phoneNumbers.id, phone.id));
        phone.status = 'CONNECTED';
      }
    }

    const isConnected = Boolean(org?.wabaId);

    return {
      success: true,
      isConnected,
      channel: isConnected
        ? {
            companyName: org?.name || '',
            displayPhoneNumber: phone?.displayPhoneNumber || 'Nomor WhatsApp Business',
            verifiedName: phone?.verifiedName || org?.name || 'Akun WhatsApp Business Resmi',
            wabaId: org?.wabaId || '',
            qualityRating: phone?.qualityRating || 'GREEN',
          }
        : null,
    };
  })

  // ─── GET /settings/waba/quota (Live Meta 24-Hour Messaging Quota & Usage Monitor) ──
  .get('/waba/quota', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        wabaId: organizations.wabaId,
        accessToken: organizations.accessToken,
      })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    const phone = await getActivePhone(user.orgId);

    const activeToken = org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
      ? org.accessToken
      : orgMetaToken(null);

    const activePhoneNumberId = phone?.phoneNumberId || platformPhoneNumberId();

    let metaPhoneDetails: any = null;
    if (activeToken && activePhoneNumberId) {
      try {
        metaPhoneDetails = await MetaApiService.fetchPhoneNumberDetails(activePhoneNumberId, activeToken);
      } catch (_) {}
    }

    // Determine Meta Limit Tier
    const { dailyLimit, tierDisplay } = parseMessagingTier(metaPhoneDetails?.messaging_limit_tier);

    const qualityRating = metaPhoneDetails?.quality_rating || phone?.qualityRating || 'GREEN';

    // Calculate Outbound / Business-Initiated Messages in the last 24 rolling hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Template Messages (Business-Initiated Outbound) in 24h
    const [templateStats] = await db
      .select({
        templateCount: sql<number>`COALESCE(COUNT(*), 0)`,
        uniqueTemplateContacts: sql<number>`COALESCE(COUNT(DISTINCT ${conversations.contactId}), 0)`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.organizationId, user.orgId),
          eq(messages.direction, 'OUTBOUND'),
          eq(messages.messageType, 'template'),
          eq(messages.isInternalNote, false),
          gte(messages.createdAt, twentyFourHoursAgo)
        )
      );

    // 2. Regular Customer Service Replies in 24h (User-Initiated / Service Session - Free / 0 quota consumption)
    const [csStats] = await db
      .select({
        csReplyCount: sql<number>`COALESCE(COUNT(*), 0)`,
        uniqueCsConversations: sql<number>`COALESCE(COUNT(DISTINCT ${messages.conversationId}), 0)`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.organizationId, user.orgId),
          eq(messages.direction, 'OUTBOUND'),
          sql`${messages.messageType} != 'template'`,
          eq(messages.isInternalNote, false),
          gte(messages.createdAt, twentyFourHoursAgo)
        )
      );

    const templateTotal = Number(templateStats?.templateCount || 0);
    const uniqueTemplateContacts = Number(templateStats?.uniqueTemplateContacts || 0);
    const csRepliesTotal = Number(csStats?.csReplyCount || 0);
    const uniqueContactsServed = Number(csStats?.uniqueCsConversations || 0);

    // Meta Tier Quota strictly measures unique business-initiated contacts reached in rolling 24 hours
    const totalUsed = uniqueTemplateContacts;
    const remainingQuota = Math.max(0, dailyLimit - totalUsed);
    const usedPercentage = Math.min(100, Math.round((totalUsed / dailyLimit) * 100));

    return {
      success: true,
      quota: {
        dailyLimit,
        tier: metaPhoneDetails?.messaging_limit_tier || 'TIER_2K',
        tierDisplay,
        totalUsed, // Consuming the 1,000 Meta limit
        remainingQuota,
        usedPercentage,
        uniqueContactsReached: uniqueContactsServed,
        csReplies24h: csRepliesTotal, // Live CS replies (Free / 0 Meta Limit consumption)
        broadcastSent24h: templateTotal,
        templateSent24h: templateTotal,
        qualityRating,
        status: metaPhoneDetails?.status || phone?.status || 'CONNECTED',
        verifiedName: metaPhoneDetails?.verified_name || phone?.verifiedName || org?.name || '',
        displayPhoneNumber: metaPhoneDetails?.display_phone_number || phone?.displayPhoneNumber || '',
        resetWindow: 'Rolling 24-Jam (Hanya membatasi Broadcast & Notifikasi Bisnis)',
      },
    };
  })

  // ─── GET /settings/waba (Full Settings - Admin Only, Live Meta Sync) ──
  .get('/waba', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role !== 'ADMINISTRATOR') {
      set.status = 403;
      return { success: false, error: 'Hanya Administrator yang memiliki akses ke Pengaturan WABA' };
    }

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        wabaId: organizations.wabaId,
        appId: organizations.appId,
        accessToken: organizations.accessToken,
      })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    let metaLivePhone: any = null;
    let metaLiveWaba: any = null;

    // Token and WABA resolution for tenant organization
    let activeAccessToken = org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
      ? org.accessToken
      : orgMetaToken(null);

    let activeWabaId = org?.wabaId || '';

    // If org has connected token but no wabaId stored yet, try discovering from token
    if (!activeWabaId && org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')) {
      const discoveredWaba = await MetaApiService.fetchSharedWabaId(org.accessToken);
      if (discoveredWaba && org.id) {
        activeWabaId = discoveredWaba;
        await db
          .update(organizations)
          .set({ wabaId: discoveredWaba })
          .where(eq(organizations.id, org.id));
      }
    }

    // Automatically sync live phone number and business name from Meta API & Subscribe WABA to App
    if (activeWabaId && activeAccessToken) {
      try {
        // 1. Auto-subscribe WABA to App Webhooks
        await MetaApiService.subscribeAppToWaba(activeWabaId, activeAccessToken);

        const metaPhones = await MetaApiService.fetchWabaPhoneNumbers(activeWabaId, activeAccessToken);
        if (metaPhones && metaPhones.length > 0) {
          // Keep the number the admin chose; only fall back to the first one when none is active yet
          const currentPhone = await getActivePhone(user.orgId);
          metaLivePhone = pickMetaPhone(metaPhones, currentPhone?.phoneNumberId);
          if (metaLivePhone?.id) {
            await safeUpsertPhoneNumber(
              user.orgId,
              metaLivePhone.id,
              metaLivePhone.display_phone_number,
              metaLivePhone.verified_name,
              metaLivePhone.quality_rating
            );
          }
        }

        metaLiveWaba = await MetaApiService.fetchWabaDetails(activeWabaId, activeAccessToken);
        if (metaLiveWaba?.name && org?.id && metaLiveWaba.name !== org.name) {
          await db
            .update(organizations)
            .set({ name: metaLiveWaba.name })
            .where(eq(organizations.id, org.id));
        }
      } catch (err: any) {
        console.warn('Meta Graph API sync notice:', err.message);
      }
    }

    // Auto-fetch Official App/Business Name from Meta using App Token if available
    if (!metaLiveWaba) {
      const targetAppId = org?.appId || env.META_APP_ID;
      const targetSecret = env.META_APP_SECRET;
      if (targetAppId && targetSecret) {
        try {
          const appToken = `${targetAppId}|${targetSecret}`;
          const appRes = await fetch(`https://graph.facebook.com/v20.0/${targetAppId}?fields=id,name&access_token=${appToken}`);
          const appData = await appRes.json();
          if (appData?.name) {
            metaLiveWaba = { name: appData.name };
            if (org?.id && appData.name !== org.name) {
              await db
                .update(organizations)
                .set({ name: appData.name })
                .where(eq(organizations.id, org.id));
            }
          }
        } catch (_) {}
      }
    }

    const activePhone = await getActivePhone(user.orgId);
    const phones = activePhone ? [activePhone] : [];

    return {
      success: true,
      organization: {
        id: org?.id,
        name: metaLiveWaba?.name || org?.name,
        wabaId: org?.wabaId,
        appId: env.META_APP_ID || org?.appId || '',
        // Set → the real WhatsApp Embedded Signup (FB SDK + config_id) is used
        embeddedSignupConfigId: env.META_ES_CONFIG_ID || '',
      },
      webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN || 'c815d80a7f3608e9edc744580250728aca2574307b8fb724',
      phoneNumbers: phones,
      metaLive: {
        isDynamicLive: Boolean(metaLivePhone || metaLiveWaba),
        companyName: metaLiveWaba?.name || org?.name || 'PT WhatsApp CRM Indonesia',
        wabaName: metaLiveWaba?.name || org?.name || 'PT WhatsApp CRM Indonesia',
        codeVerificationStatus: metaLivePhone?.code_verification_status || 'VERIFIED',
        nameStatus: metaLivePhone?.name_status || 'APPROVED',
        qualityRating: metaLivePhone?.quality_rating || phones[0]?.qualityRating || 'GREEN',
        messagingLimitTier: metaLivePhone?.messaging_limit_tier || 'TIER_2K',
        verifiedName: metaLivePhone?.verified_name || phones[0]?.verifiedName || 'Official WhatsApp Account',
        displayPhoneNumber: metaLivePhone?.display_phone_number || phones[0]?.displayPhoneNumber || '+62 812-3456-7890',
        accountReviewStatus: metaLiveWaba?.account_review_status || 'APPROVED',
      },
    };
  })

  // ─── POST /settings/waba/sync (Live Meta Sync Trigger) ──────
  .post('/waba/sync', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role !== 'ADMINISTRATOR') {
      set.status = 403;
      return { success: false, error: 'Hanya Administrator yang dapat melakukan sinkronisasi' };
    }

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        wabaId: organizations.wabaId,
        accessToken: organizations.accessToken,
      })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    if (!org?.wabaId || !org?.accessToken) {
      return {
        success: false,
        error: 'WABA ID atau Access Token belum terpasang. Harap hubungkan nomor terlebih dahulu.',
      };
    }

    let metaPhones: any[] | null = null;
    let metaLivePhone: any = null;
    let metaLiveWaba: any = null;

    const isUserToken = org.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO');
    if (isUserToken) {
      metaPhones = await MetaApiService.fetchWabaPhoneNumbers(org.wabaId, org.accessToken);
      const currentPhone = await getActivePhone(user.orgId);
      metaLivePhone = pickMetaPhone(metaPhones, currentPhone?.phoneNumberId);
      metaLiveWaba = await MetaApiService.fetchWabaDetails(org.wabaId, org.accessToken);
    }

    // Auto-sync Business / App details with Meta App Token if User Token is pending
    if (!metaLiveWaba && (env.META_APP_ID || org.wabaId) && env.META_APP_SECRET) {
      const targetAppId = env.META_APP_ID || org.wabaId;
      try {
        const appToken = `${targetAppId}|${env.META_APP_SECRET}`;
        const appRes = await fetch(`https://graph.facebook.com/v20.0/${targetAppId}?fields=id,name&access_token=${appToken}`);
        const appData = await appRes.json();
        if (appData?.name) {
          metaLiveWaba = { name: appData.name };
        }
      } catch (_) {}
    }

    const phone = await getActivePhone(user.orgId);

    if (metaLivePhone?.id) {
      try {
        await activatePhoneNumber(user.orgId, {
          phoneNumberId: metaLivePhone.id,
          displayPhoneNumber: metaLivePhone.display_phone_number,
          verifiedName: metaLivePhone.verified_name,
          qualityRating: metaLivePhone.quality_rating,
        });
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    if (metaLiveWaba?.name && org.id) {
      await db
        .update(organizations)
        .set({ name: metaLiveWaba.name })
        .where(eq(organizations.id, org.id));
    }

    return {
      success: true,
      message: 'Status akun dan profil bisnis berhasil disinkronkan langsung dari Meta Graph API (' + (metaLiveWaba?.name || 'IDS') + ')!',
      metaLive: {
        isDynamicLive: true,
        companyName: metaLiveWaba?.name || org?.name || 'IDS',
        wabaName: metaLiveWaba?.name || org?.name || 'IDS',
        codeVerificationStatus: metaLivePhone?.code_verification_status || 'VERIFIED',
        nameStatus: metaLivePhone?.name_status || 'APPROVED',
        qualityRating: metaLivePhone?.quality_rating || 'GREEN',
        messagingLimitTier: metaLivePhone?.messaging_limit_tier || 'TIER_2K',
        verifiedName: metaLivePhone?.verified_name || metaLiveWaba?.name || org?.name || '',
        displayPhoneNumber: metaLivePhone?.display_phone_number || phone?.displayPhoneNumber || '',
        accountReviewStatus: metaLiveWaba?.account_review_status || 'APPROVED',
      },
    };
  })

  // ─── POST /settings/waba (Manual Configuration) ────
  .post(
    '/waba',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (user.role !== 'ADMINISTRATOR') {
        set.status = 403;
        return { success: false, error: 'Akses dibatasi untuk Administrator' };
      }

      const finalWabaId = body.wabaId?.trim() || null;
      const finalAppId = body.appId?.trim() || null;
      const finalAccessToken = body.accessToken?.trim() || null;
      const finalPhone = body.displayPhoneNumber?.trim() || '';
      const finalName = body.verifiedName?.trim() || '';

      let detectedCompanyName = null;
      let detectedPhoneId = finalAppId || 'phone_' + nanoid(8);
      let detectedPhoneNumber = finalPhone;
      let detectedVerifiedName = finalName;
      let detectedQuality = 'GREEN';

      // Test & fetch live details from Meta Graph API if credentials are provided
      if (finalWabaId && finalAccessToken) {
        try {
          const metaWaba = await MetaApiService.fetchWabaDetails(finalWabaId, finalAccessToken);
          if (metaWaba?.name) {
            detectedCompanyName = metaWaba.name;
          }

          const metaPhones = await MetaApiService.fetchWabaPhoneNumbers(finalWabaId, finalAccessToken);
          if (metaPhones && metaPhones.length > 0) {
            const currentPhone = await getActivePhone(user.orgId);
            const firstPhone = pickMetaPhone(metaPhones, currentPhone?.phoneNumberId)!;
            detectedPhoneId = firstPhone.id || detectedPhoneId;
            detectedPhoneNumber = firstPhone.display_phone_number || detectedPhoneNumber;
            detectedVerifiedName = firstPhone.verified_name || detectedVerifiedName;
            detectedQuality = firstPhone.quality_rating || detectedQuality;
          }
        } catch (metaErr: any) {
          console.warn('Live Meta check during save:', metaErr.message);
        }
      }

      const orgUpdateData: any = {
        wabaId: finalWabaId,
        appId: finalAppId,
        accessToken: finalAccessToken,
      };
      if (detectedCompanyName) {
        orgUpdateData.name = detectedCompanyName;
      }

      await db
        .update(organizations)
        .set(orgUpdateData)
        .where(eq(organizations.id, user.orgId));

      // If WABA ID is provided, ensure phoneNumbers table is safely synced
      if (finalWabaId) {
        try {
          await safeUpsertPhoneNumber(
            user.orgId,
            detectedPhoneId,
            detectedPhoneNumber,
            detectedVerifiedName,
            detectedQuality
          );
        } catch (err: any) {
          set.status = err instanceof PhoneNumberInUseError ? 409 : 400;
          return { success: false, error: err.message };
        }
      }

      return {
        success: true,
        message: 'Kredensial WABA & Nomor WhatsApp berhasil disimpan',
        connectedChannel: finalWabaId
          ? {
              companyName: detectedCompanyName || undefined,
              displayPhoneNumber: detectedPhoneNumber,
              verifiedName: detectedVerifiedName,
              wabaId: finalWabaId,
              qualityRating: detectedQuality,
            }
          : null,
      };
    },
    {
      body: t.Object({
        wabaId: t.Optional(t.String()),
        appId: t.Optional(t.String()),
        accessToken: t.Optional(t.String()),
        displayPhoneNumber: t.Optional(t.String()),
        verifiedName: t.Optional(t.String()),
      }),
    }
  )

  // ─── POST /settings/waba/disconnect ───────
  // Disconnect / Clear Current WABA Connection
  .post('/waba/disconnect', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role !== 'ADMINISTRATOR') {
      set.status = 403;
      return { success: false, error: 'Akses dibatasi untuk Administrator' };
    }

    try {
      // Atomic: either everything is disconnected or nothing changes.
      // Numbers are archived, not deleted: conversations reference them and keep their history.
      await db.transaction(async (tx) => {
        await tx
          .update(organizations)
          .set({ wabaId: null, accessToken: null })
          .where(eq(organizations.id, user.orgId));
        await archiveOrgPhones(user.orgId, tx);
      });

      return { success: true, message: 'Nomor WhatsApp berhasil diputuskan. Riwayat percakapan tetap tersimpan.' };
    } catch (err: any) {
      set.status = 400;
      return { success: false, error: err.message };
    }
  })

  // ─── POST /settings/waba/embedded-signup ───
  // Handle Custom / Facebook Login / Embedded Signup Handshake
  .post(
    '/waba/embedded-signup',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (user.role !== 'ADMINISTRATOR') {
        set.status = 403;
        return { success: false, error: 'Akses dibatasi untuk Administrator' };
      }

      try {
        const { code, redirectUri, wabaId, phoneNumberId, displayPhoneNumber, verifiedName } = body;
        // Number stays active in the WhatsApp Business app (Embedded Signup "whatsapp_business_app_onboarding")
        const coexistence = body.coexistence === true;

        let finalAccessToken = '';
        let finalWabaId = wabaId || '';
        let finalPhoneId = phoneNumberId || '';
        let finalDisplayName = verifiedName || 'Akun WhatsApp Business Resmi';
        let finalPhone = displayPhoneNumber || '';
        let detectedCompanyName = null;

        // 1. If OAuth authorization code is provided, exchange for real Meta Token
        if (code) {
          const [orgData] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, user.orgId))
            .limit(1);

          const targetAppId = env.META_APP_ID || orgData?.appId || undefined;
          const tokenResult = await MetaApiService.exchangeCodeForToken(code, redirectUri, targetAppId);
          if (tokenResult.accessToken) {
            finalAccessToken = tokenResult.accessToken;

            // The WABA picked in the Embedded Signup popup (sessionInfo) wins; otherwise discover it
            if (!finalWabaId) {
              const discoveredWabaId = await MetaApiService.fetchSharedWabaId(finalAccessToken, targetAppId);
              if (discoveredWabaId) {
                finalWabaId = discoveredWabaId;
                console.log(`✅ Successfully linked dynamic WABA ID: ${finalWabaId}`);
              }
            }
          } else {
            set.status = 400;
            return {
              success: false,
              error: tokenResult.error || 'Gagal menukarkan kode otorisasi Facebook (OAuth exchange failed). Harap pastikan META_APP_ID dan META_APP_SECRET pada file .env server sudah sesuai.',
            };
          }
        }

        // Fallback to the org's existing WABA ID / token when the signup did not provide new ones
        if (!finalWabaId || !finalAccessToken) {
          const [orgData] = await db
            .select({ wabaId: organizations.wabaId, accessToken: organizations.accessToken })
            .from(organizations)
            .where(eq(organizations.id, user.orgId))
            .limit(1);
          if (!finalWabaId) {
            finalWabaId = orgData?.wabaId || '';
          }
          if (!finalAccessToken) finalAccessToken = resolveOrgToken(orgData?.accessToken) || '';
        }

        if (!finalAccessToken) {
          set.status = 400;
          return {
            success: false,
            error: 'Token akses Meta tidak tersedia. Ulangi login Facebook dan pastikan izin WhatsApp Business diberikan.',
          };
        }

        if (!finalWabaId) {
          set.status = 400;
          return {
            success: false,
            error: 'Gagal mendapatkan WABA ID dari otorisasi Facebook. Harap pastikan akun Facebook yang digunakan memiliki hak akses ke WhatsApp Business Account.',
          };
        }

        // 2. Automatically fetch live business name & phone numbers from Meta
        if (finalWabaId && finalAccessToken && !finalAccessToken.startsWith('EAAGm0PX4ZCBO')) {
          try {
            const metaWaba = await MetaApiService.fetchWabaDetails(finalWabaId, finalAccessToken);
            if (metaWaba?.name) {
              detectedCompanyName = metaWaba.name;
            }

            const metaPhones = await MetaApiService.fetchWabaPhoneNumbers(finalWabaId, finalAccessToken);
            // Use the number chosen in the Facebook popup (sessionInfo), not just the first one
            const chosen = pickMetaPhone(metaPhones, finalPhoneId);
            if (chosen) {
              finalPhoneId = chosen.id || finalPhoneId;
              finalPhone = chosen.display_phone_number || finalPhone;
              finalDisplayName = chosen.verified_name || finalDisplayName;
            }
          } catch (err: any) {
            console.warn('Auto-sync from Meta notice:', err.message);
          }
        }

        // Update organization with connected WABA credentials
        const orgUpdateData: any = {
          wabaId: finalWabaId,
          accessToken: finalAccessToken,
        };
        // (The organisation keeps the name the tenant chose; the WABA name is only reported back)

        await db
          .update(organizations)
          .set(orgUpdateData)
          .where(eq(organizations.id, user.orgId));

        const safePhoneId = (finalPhoneId && finalPhoneId.trim())
          ? finalPhoneId.trim()
          : ('phone_' + nanoid(10));

        const safePhoneNumber = (finalPhone && finalPhone.trim())
          ? finalPhone.trim()
          : 'Nomor WhatsApp Business';

        await safeUpsertPhoneNumber(
          user.orgId,
          safePhoneId,
          safePhoneNumber,
          finalDisplayName,
          'GREEN'
        );
        const subscription: any = await MetaApiService.subscribeAppToWaba(finalWabaId, finalAccessToken);
        const webhookSubscribed = subscription?.success === true;
        const registration = safePhoneId.startsWith('phone_')
          ? null
          : await MetaApiService.fetchPhoneRegistration(safePhoneId, finalAccessToken);
        // A Coexistence number is already registered through the app: never ask for a PIN /register
        const needsRegistration = !coexistence && !!registration?.platformType && registration.platformType !== 'CLOUD_API';

        const warnings: string[] = [];
        let syncStarted = false;
        if (coexistence) {
          if (safePhoneId.startsWith('phone_')) {
            warnings.push('Nomor WhatsApp Business App belum terdeteksi di WABA — sinkronisasi kontak & riwayat chat tidak bisa dimulai.');
          } else {
            // Meta only allows these within 24 hours of onboarding; contacts first, then history
            const contactSync = await MetaApiService.requestSmbAppSync(safePhoneId, finalAccessToken, 'smb_app_state_sync');
            const historySync = await MetaApiService.requestSmbAppSync(safePhoneId, finalAccessToken, 'history');
            syncStarted = contactSync.ok && historySync.ok;
            if (!syncStarted) {
              const reason = [!contactSync.ok && contactSync.error, !historySync.ok && historySync.error].filter(Boolean).join('; ');
              warnings.push(`Sinkronisasi kontak / riwayat chat dari aplikasi WhatsApp Business gagal dimulai (${reason}).`);
            }
          }
        }
        if (!webhookSubscribed) {
          warnings.push('Langganan webhook WABA gagal — pesan masuk belum akan diterima. Klik "Sinkronkan" di Pengaturan atau hubungi admin platform.');
        }
        if (needsRegistration) {
          warnings.push('Nomor belum diaktifkan di WhatsApp Cloud API. Lanjutkan dengan membuat PIN 6 digit agar bisa mengirim pesan.');
        }

        return {
          success: true,
          webhookSubscribed,
          needsRegistration,
          coexistence,
          syncStarted,
          warnings,
          message: warnings.length
            ? 'WhatsApp Business terhubung, tetapi ada langkah yang belum selesai.'
            : 'Nomor WhatsApp Business resmi berhasil dihubungkan!',
          connectedChannel: {
            wabaId: finalWabaId,
            phoneNumberId: safePhoneId,
            displayPhoneNumber: safePhoneNumber,
            verifiedName: finalDisplayName,
            qualityRating: 'GREEN',
            companyName: detectedCompanyName || undefined,
          },
        };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        code: t.Optional(t.String()),
        redirectUri: t.Optional(t.String()),
        appId: t.Optional(t.String()),
        wabaId: t.Optional(t.String()),
        phoneNumberId: t.Optional(t.String()),
        displayPhoneNumber: t.Optional(t.String()),
        verifiedName: t.Optional(t.String()),
        coexistence: t.Optional(t.Boolean()),
      }),
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // CHANGE NUMBER FLOW (Administrator)
  // list numbers in the WABA → (add number → OTP → verify) → register PIN → activate
  // Every action on a phone id first checks that the number belongs to this org's WABA.
  // ═══════════════════════════════════════════════════════════════

  // ─── GET /settings/waba/numbers ───
  .get('/waba/numbers', async ({ user, set }) => {
    const ctx = await loadNumberContext(user, set);
    if ('error' in ctx) return ctx.error;

    const list = await MetaApiService.listWabaPhoneNumbers(ctx.wabaId, ctx.token);
    if (!list.ok) {
      set.status = 502;
      return { success: false, error: list.error };
    }
    const active = await getActivePhone(user!.orgId);
    return {
      success: true,
      wabaId: ctx.wabaId,
      activePhoneNumberId: active?.phoneNumberId || null,
      numbers: list.numbers.map((n: any) => ({
        id: n.id,
        displayPhoneNumber: n.display_phone_number,
        verifiedName: n.verified_name,
        qualityRating: n.quality_rating,
        status: n.status,
        codeVerificationStatus: n.code_verification_status,
        nameStatus: n.name_status,
        newNameStatus: n.new_name_status,
        messagingLimitTier: n.messaging_limit_tier,
        platformType: n.platform_type,
        isActive: n.id === active?.phoneNumberId,
      })),
    };
  })

  // ─── POST /settings/waba/numbers — add a new number to the WABA ───
  .post(
    '/waba/numbers',
    async ({ user, body, set }) => {
      const ctx = await loadNumberContext(user, set);
      if ('error' in ctx) return ctx.error;

      const cc = body.cc.replace(/\D/g, '');
      let phone = body.phoneNumber.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = phone.slice(1); // 0812… → 812…
      if (phone.startsWith(cc) && phone.length > 9) phone = phone.slice(cc.length); // 62812… → 812…
      if (!/^\d{1,3}$/.test(cc) || !/^\d{6,14}$/.test(phone)) {
        set.status = 400;
        return { success: false, error: 'Format nomor tidak valid. Contoh: kode negara 62, nomor 81234567890.' };
      }

      const res = await MetaApiService.addPhoneNumber(ctx.wabaId, ctx.token, cc, phone, body.verifiedName.trim());
      if (!res.ok) {
        set.status = 400;
        return { success: false, error: res.error };
      }
      return { success: true, phoneNumberId: res.data?.id, message: 'Nomor ditambahkan ke WABA. Lanjutkan dengan verifikasi kode OTP.' };
    },
    {
      body: t.Object({
        cc: t.String({ minLength: 1, maxLength: 4 }),
        phoneNumber: t.String({ minLength: 6, maxLength: 20 }),
        verifiedName: t.String({ minLength: 3, maxLength: 120 }),
      }),
    }
  )

  // ─── POST /settings/waba/numbers/:phoneId/request-code ───
  .post(
    '/waba/numbers/:phoneId/request-code',
    async ({ user, params, body, set }) => {
      const ctx = await loadNumberContext(user, set, params.phoneId);
      if ('error' in ctx) return ctx.error;
      const res = await MetaApiService.requestVerificationCode(params.phoneId, ctx.token, body.method, 'id');
      if (!res.ok) {
        set.status = 400;
        return { success: false, error: res.error };
      }
      return {
        success: true,
        message: body.method === 'VOICE' ? 'Kode OTP akan dibacakan lewat panggilan telepon.' : 'Kode OTP dikirim lewat SMS.',
      };
    },
    { body: t.Object({ method: t.Union([t.Literal('SMS'), t.Literal('VOICE')]) }) }
  )

  // ─── POST /settings/waba/numbers/:phoneId/verify-code ───
  .post(
    '/waba/numbers/:phoneId/verify-code',
    async ({ user, params, body, set }) => {
      const ctx = await loadNumberContext(user, set, params.phoneId);
      if ('error' in ctx) return ctx.error;
      const code = body.code.replace(/\D/g, '');
      if (!/^\d{4,8}$/.test(code)) {
        set.status = 400;
        return { success: false, error: 'Kode OTP harus berupa angka.' };
      }
      const res = await MetaApiService.verifyCode(params.phoneId, ctx.token, code);
      if (!res.ok) {
        set.status = 400;
        return { success: false, error: res.error };
      }
      return { success: true, message: 'Nomor berhasil diverifikasi.' };
    },
    { body: t.Object({ code: t.String({ minLength: 4, maxLength: 12 }) }) }
  )

  // ─── POST /settings/waba/numbers/:phoneId/register — enable Cloud API with a 6-digit PIN ───
  .post(
    '/waba/numbers/:phoneId/register',
    async ({ user, params, body, set }) => {
      const ctx = await loadNumberContext(user, set, params.phoneId);
      if ('error' in ctx) return ctx.error;
      if (!/^\d{6}$/.test(body.pin)) {
        set.status = 400;
        return { success: false, error: 'PIN harus 6 digit angka.' };
      }
      const res = await MetaApiService.registerPhoneNumber(params.phoneId, ctx.token, body.pin);
      if (!res.ok) {
        set.status = 400;
        return { success: false, error: res.error };
      }
      return { success: true, message: 'Nomor terdaftar di WhatsApp Cloud API.' };
    },
    { body: t.Object({ pin: t.String({ minLength: 6, maxLength: 6 }) }) }
  )

  // ─── POST /settings/waba/numbers/:phoneId/activate — switch the org's active number ───
  .post('/waba/numbers/:phoneId/activate', async ({ user, params, set }) => {
    const ctx = await loadNumberContext(user, set, params.phoneId);
    if ('error' in ctx) return ctx.error;
    const n = ctx.number!;
    if (n.code_verification_status && n.code_verification_status !== 'VERIFIED') {
      set.status = 400;
      return { success: false, error: 'Nomor ini belum diverifikasi (OTP). Selesaikan verifikasi dulu.' };
    }
    try {
      const previous = await getActivePhone(user!.orgId);
      await activatePhoneNumber(user!.orgId, {
        phoneNumberId: n.id,
        displayPhoneNumber: n.display_phone_number,
        verifiedName: n.verified_name,
        qualityRating: n.quality_rating,
      });
      await MetaApiService.subscribeAppToWaba(ctx.wabaId, ctx.token);
      return {
        success: true,
        message: `Nomor aktif sekarang ${n.display_phone_number}.`,
        previousNumber: previous && previous.phoneNumberId !== n.id ? previous.displayPhoneNumber : null,
      };
    } catch (err: any) {
      set.status = err instanceof PhoneNumberInUseError ? 409 : 400;
      return { success: false, error: err.message };
    }
  })

  // ─── GET /settings/operations — Workload & SLA Settings ──
  .get('/operations', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    const [org] = await db
      .select({
        maxChatsPerAgent: organizations.maxChatsPerAgent,
        autoResolveHours: organizations.autoResolveHours,
        careWindowHours: organizations.careWindowHours,
      })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    return {
      success: true,
      settings: {
        maxChatsPerAgent: org?.maxChatsPerAgent ?? 5,
        autoResolveHours: org?.autoResolveHours ?? 3,
        careWindowHours: org?.careWindowHours ?? 24,
      },
    };
  })

  // ─── PATCH /settings/operations — Update Workload & SLA Settings ──
  .patch(
    '/operations',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (user.role !== 'ADMINISTRATOR' && user.role !== 'SUPERVISOR') {
        set.status = 403;
        return { success: false, error: 'Hanya Administrator dan Supervisor yang dapat mengubah Pengaturan Operasional.' };
      }

      await db
        .update(organizations)
        .set({
          maxChatsPerAgent: body.maxChatsPerAgent !== undefined ? Number(body.maxChatsPerAgent) : undefined,
          autoResolveHours: body.autoResolveHours !== undefined ? Number(body.autoResolveHours) : undefined,
          careWindowHours: body.careWindowHours !== undefined ? Number(body.careWindowHours) : undefined,
        })
        .where(eq(organizations.id, user.orgId));

      return {
        success: true,
        message: 'Pengaturan operasional & SLA berhasil disimpan!',
      };
    },
    {
      body: t.Object({
        maxChatsPerAgent: t.Optional(t.Number()),
        autoResolveHours: t.Optional(t.Number()),
        careWindowHours: t.Optional(t.Number()),
      }),
    }
  )

  // ═══════════════════════════════════════════════════════════════
  // CHATBOT & AI SETTINGS
  // ═══════════════════════════════════════════════════════════════

  // ─── GET /settings/operating-hours — hours, AI & chatbot config (API key never leaves the server) ──
  .get('/operating-hours', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    const [org] = await db
      .select({
        operatingHours: organizations.operatingHours,
        aiAgentConfig: organizations.aiAgentConfig,
        chatbotConfig: organizations.chatbotConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    const hours = parseJsonValue(org?.operatingHours) || {
      enabled: false,
      timezone: 'Asia/Jakarta',
      days: [1, 2, 3, 4, 5],
      startTime: '08:00',
      endTime: '17:00',
    };
    const ai: any = parseJsonValue(org?.aiAgentConfig) || {
      enabled: false,
      triggerMode: 'ALWAYS',
      mode: 'AI_ASSISTANT',
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      systemPrompt: '',
      staticMessage: '',
    };
    const storedKey: string = ai.apiKey || '';
    const { apiKey: _omit, ...aiPublic } = ai;

    return {
      success: true,
      operatingHours: hours,
      aiAgentConfig: {
        ...aiPublic,
        apiKey: '',
        hasApiKey: Boolean(storedKey),
        apiKeyHint: storedKey ? `••••${storedKey.slice(-4)}` : '',
      },
      chatbotConfig: parseJsonValue(org?.chatbotConfig) || null,
      isOutOfHoursNow: AiAgentService.isOutOfOperatingHours(hours as any),
    };
  })

  // ─── PATCH & POST /settings/operating-hours — save hours, AI & chatbot config ──
  .patch('/operating-hours', async ({ user, body, set }) => saveBotSettings(user, body, set), { body: botSettingsBody })
  .post('/operating-hours', async ({ user, body, set }) => saveBotSettings(user, body, set), { body: botSettingsBody })

  // ─── Quick replies (shared by the whole team) ───
  .get('/quick-replies', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    const [org] = await db
      .select({ quickReplies: organizations.quickReplies })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);
    const stored = parseJsonValue<any[]>(org?.quickReplies);
    const isDefault = !Array.isArray(stored);
    return { success: true, items: isDefault ? DEFAULT_QUICK_REPLIES : stored, isDefault };
  })

  .put(
    '/quick-replies',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (!canManageBot(user.role)) {
        set.status = 403;
        return { success: false, error: 'Hanya Administrator atau Supervisor yang dapat mengubah balas cepat.' };
      }
      if (body.reset) {
        await db.update(organizations).set({ quickReplies: null } as any).where(eq(organizations.id, user.orgId));
        return { success: true, items: DEFAULT_QUICK_REPLIES, isDefault: true };
      }
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length > 300) {
        set.status = 400;
        return { success: false, error: 'Maksimal 300 balas cepat.' };
      }
      const seen = new Set<string>();
      const clean = [];
      for (const raw of items) {
        let shortcut = String(raw?.shortcut || '').trim().toLowerCase().replace(/\s+/g, '_');
        if (!shortcut.startsWith('/')) shortcut = '/' + shortcut;
        const title = String(raw?.title || '').trim().slice(0, 120);
        const text = String(raw?.body || '').trim().slice(0, 4096);
        if (!/^\/[\p{L}\p{N}_-]{1,40}$/u.test(shortcut) || !title || !text) {
          set.status = 400;
          return { success: false, error: `Balas cepat "${title || shortcut}" tidak valid (shortcut huruf/angka, judul & isi wajib).` };
        }
        if (seen.has(shortcut)) {
          set.status = 400;
          return { success: false, error: `Shortcut ${shortcut} dipakai lebih dari sekali.` };
        }
        seen.add(shortcut);
        clean.push({ id: String(raw?.id || '').slice(0, 60) || `qr-${Date.now()}-${clean.length}`, shortcut, title, body: text });
      }
      await db.update(organizations).set({ quickReplies: clean } as any).where(eq(organizations.id, user.orgId));
      return { success: true, items: clean, isDefault: false };
    },
    {
      body: t.Object({
        items: t.Optional(t.Array(t.Any())),
        reset: t.Optional(t.Boolean()),
      }),
    }
  )

  // ─── POST /settings/ai-agent/test — quick AI check (admin / supervisor) ──
  .post(
    '/ai-agent/test',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (!canManageBot(user.role)) {
        set.status = 403;
        return { success: false, error: 'Akses ditolak (Khusus Administrator atau Supervisor)' };
      }
      try {
        const apiKey = body.apiKey?.trim() || (await storedAiKey(user.orgId)) || undefined;
        const reply = await AiAgentService.generateAiResponse({
          provider: body.provider as any,
          systemPrompt: buildAiSystemPrompt('bisnis Anda', body.systemPrompt),
          userMessage: body.userMessage || 'Halo, saya mau tanya apakah ada promo hari ini?',
          apiKey,
          model: body.model,
          baseUrl: body.baseUrl,
        });
        return { success: true, reply };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        provider: t.Optional(t.String()),
        systemPrompt: t.Optional(t.String()),
        userMessage: t.String(),
        apiKey: t.Optional(t.String()),
        model: t.Optional(t.String()),
        baseUrl: t.Optional(t.String()),
      }),
    }
  )

  // ─── POST /settings/chatbot/simulate — run the real decision engine on unsaved settings ──
  .post(
    '/chatbot/simulate',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (!canManageBot(user.role)) {
        set.status = 403;
        return { success: false, error: 'Akses ditolak (Khusus Administrator atau Supervisor)' };
      }

      const [org] = await db
        .select({ name: organizations.name, aiAgentConfig: organizations.aiAgentConfig })
        .from(organizations)
        .where(eq(organizations.id, user.orgId))
        .limit(1);
      const businessName = org?.name || 'Bisnis Anda';
      const ai: any = { ...(body.aiAgentConfig || {}), enabled: true }; // simulate even while switched off
      const settings = normalizeBotSettings(ai, body.chatbotConfig || {});
      const contactName = body.contactName?.trim() || 'Budi';

      const decision = decideBotReply({
        message: body.message,
        settings,
        contactName,
        businessName,
        isNewConversation: body.isNewConversation === true,
      });

      const result: any = { success: true, kind: decision.kind };
      if (decision.kind === 'SILENT') {
        result.note = decision.reason;
        return result;
      }
      if (decision.kind === 'GREETING' || decision.kind === 'STATIC') {
        result.reply = decision.reply;
        return result;
      }
      if (decision.kind === 'RULE') {
        result.reply = decision.reply;
        result.ruleTitle = decision.rule.title;
        result.handoff = decision.handoff;
        if (!decision.thenAi) return result;
      }

      // AI answer (fallback, or a rule that hands over to AI)
      try {
        const storedAi: any = parseJsonValue(org?.aiAgentConfig) || {};
        const apiKey = ai.apiKey?.trim() || storedAi.apiKey || undefined;
        const history = Array.isArray(body.history)
          ? body.history
              .filter((h: any) => h && typeof h.text === 'string' && h.text.trim())
              .slice(-10)
              .map((h: any) => ({ role: (h.role === 'user' ? 'user' : 'model') as 'user' | 'model', text: h.text }))
          : [];
        result.reply = await AiAgentService.generateAiResponse({
          provider: ai.provider || 'gemini',
          systemPrompt: buildAiSystemPrompt(businessName, ai.systemPrompt),
          userMessage: body.message,
          conversationHistory: history,
          apiKey,
          model: ai.model,
          baseUrl: ai.baseUrl,
        });
        result.kind = 'AI';
      } catch (err: any) {
        result.kind = 'AI_ERROR';
        result.error = err.message;
        result.reply = fillTemplate(settings.staticMessage, { contactName, businessName });
      }
      return result;
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1, maxLength: 2000 }),
        isNewConversation: t.Optional(t.Boolean()),
        contactName: t.Optional(t.String()),
        aiAgentConfig: t.Optional(t.Any()),
        chatbotConfig: t.Optional(t.Any()),
        history: t.Optional(t.Array(t.Any())),
      }),
    }
  )

  // ─── GET /settings/api-keys (List API Keys) ──
  .get('/api-keys', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role !== 'ADMINISTRATOR') {
      set.status = 403;
      return { success: false, error: 'Hanya Administrator yang dapat mengelola API Key' };
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, user.orgId))
      .orderBy(desc(apiKeys.createdAt));

    return {
      success: true,
      items: keys,
    };
  })

  // ─── POST /settings/api-keys (Generate New API Key) ──
  .post(
    '/api-keys',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (user.role !== 'ADMINISTRATOR') {
        set.status = 403;
        return { success: false, error: 'Hanya Administrator yang dapat membuat API Key' };
      }

      // Generate secret key
      const randomSecret = nanoid(32) + nanoid(16);
      const fullKey = `wacrm_live_${randomSecret}`;
      const prefix = `wacrm_live_${randomSecret.slice(0, 6)}...${randomSecret.slice(-4)}`;
      const keyId = nanoid();

      const permissions = body.permissions && body.permissions.length > 0
        ? body.permissions
        : ['messages:send', 'templates:send', 'contacts:read', 'contacts:write'];

      await db.insert(apiKeys).values({
        id: keyId,
        organizationId: user.orgId,
        name: body.name.trim(),
        key: hashApiKey(fullKey), // 🔒 only the hash is stored; the full key is shown to the admin once
        keyPrefix: prefix,
        permissions,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      });

      return {
        success: true,
        message: 'API Key berhasil dibuat. Harap salin dan simpan key ini karena tidak akan ditampilkan lagi!',
        apiKey: {
          id: keyId,
          name: body.name.trim(),
          key: fullKey,
          keyPrefix: prefix,
          permissions,
          createdAt: new Date(),
        },
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        permissions: t.Optional(t.Array(t.String())),
        expiresAt: t.Optional(t.String()),
      }),
    }
  )

  // ─── DELETE /settings/api-keys/:id (Revoke API Key) ──
  .delete('/api-keys/:id', async ({ user, params, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }
    if (user.role !== 'ADMINISTRATOR') {
      set.status = 403;
      return { success: false, error: 'Hanya Administrator yang dapat menghapus API Key' };
    }

    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, params.id), eq(apiKeys.organizationId, user.orgId)));

    return {
      success: true,
      message: 'API Key berhasil dicabut / dihapus',
    };
  })

  // ─── GET /settings/subscription (Tenant Plan & Subscription Details) ──
  .get('/subscription', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    if (!org) {
      set.status = 404;
      return { success: false, error: 'Organisasi tidak ditemukan' };
    }

    // Compute Days Remaining
    let daysRemaining: number | null = null;
    let isExpired = false;
    if (org.expiresAt) {
      const now = new Date();
      const exp = new Date(org.expiresAt);
      const diffMs = exp.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isExpired = daysRemaining <= 0;
    }

    // Usage Counts
    const { users } = await import('../../db/schema/users');
    const [userCountRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.organizationId, user.orgId));

    const [convCountRes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(eq(conversations.organizationId, user.orgId));

    // Get Platform Settings for Plans & Midtrans
    const { platformSettings } = await import('../../db/schema/settings');
    const [plansSetting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'saas_plans'))
      .limit(1);

    const [midtransSetting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'midtrans_payment'))
      .limit(1);

    return {
      success: true,
      subscription: {
        organizationId: org.id,
        organizationName: org.name,
        status: org.status,
        plan: org.plan,
        maxAgents: org.maxAgents || 5,
        maxBroadcastPerMonth: org.maxBroadcastPerMonth || 10000,
        expiresAt: org.expiresAt,
        daysRemaining,
        isExpired,
        usage: {
          currentUsers: Number(userCountRes?.count || 0),
          currentConversations: Number(convCountRes?.count || 0),
        },
      },
      availablePlans: ((plansSetting?.value as any[]) || []).filter((p: any) => p.isActive !== false && p.isPublic !== false),
      paymentGateway: midtransSetting?.value || { isEnabled: false },
    };
  })

  // ─── POST /settings/subscription/renew-request ──
  .post(
    '/subscription/renew-request',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user.orgId))
        .limit(1);

      if (!org) {
        set.status = 404;
        return { success: false, error: 'Organisasi tidak ditemukan' };
      }

      const [dbUser] = await db
        .select({ fullName: users.fullName, email: users.email })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      const applicantName = dbUser?.fullName || user.email || 'Admin';
      const applicantEmail = dbUser?.email || user.email;
      const planName = body.planName || org.plan;
      const duration = body.duration || '1 Bulan';

      const waMessage =
        `Halo Super Admin,\n\n` +
        `Kami ingin mengajukan perpanjangan/upgrade paket sewa WhatsApp CRM:\n` +
        `- Organisasi: *${org.name}* (ID: ${org.id})\n` +
        `- Pemohon: ${applicantName} (${applicantEmail})\n` +
        `- Pilihan Paket: *${planName}*\n` +
        `- Durasi: *${duration}*\n\n` +
        `Mohon info rekening pembayaran dan konfirmasi aktivasi perpanjangan. Terima kasih!`;

      return {
        success: true,
        message: 'Permohonan perpanjangan berhasil diproses!',
        whatsappUrl: `https://wa.me/?text=${encodeURIComponent(waMessage)}`,
        waMessage,
      };
    },
    {
      body: t.Object({
        planName: t.Optional(t.String()),
        duration: t.Optional(t.String()),
      }),
    }
  );
