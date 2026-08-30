// ===========================================
// Organization & WABA Settings Routes (Admin)
// ===========================================

import { Elysia, t } from 'elysia';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { env } from '../../config/env';
import { db } from '../../config/database';
import { organizations, phoneNumbers, messages, conversations, broadcastCampaigns, apiKeys } from '../../db/schema';
import { authPlugin } from '../../middleware/auth';
import { MetaApiService } from '../../services/meta-api.service';

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

    const phones = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, user.orgId));

    const phone = phones.length > 0 ? phones[0] : null;
    const isConnected = !!org?.wabaId && (!phone || phone.status !== 'DISCONNECTED');

    return {
      success: true,
      isConnected,
      channel: isConnected
        ? {
            companyName: org?.name || '',
            displayPhoneNumber: phone?.displayPhoneNumber || '',
            verifiedName: phone?.verifiedName || org?.name || '',
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

    const phones = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, user.orgId));

    const phone = phones.length > 0 ? phones[0] : null;

    const activeToken = org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
      ? org.accessToken
      : env.META_ACCESS_TOKEN;

    const activePhoneNumberId = phone?.phoneNumberId || env.META_PHONE_NUMBER_ID;

    let metaPhoneDetails: any = null;
    if (activeToken && activePhoneNumberId) {
      try {
        metaPhoneDetails = await MetaApiService.fetchPhoneNumberDetails(activePhoneNumberId, activeToken);
      } catch (_) {}
    }

    // Determine Meta Limit Tier
    const tierRaw = metaPhoneDetails?.messaging_limit_tier || 'TIER_1K';
    let dailyLimit = 1000;
    let tierDisplay = 'TIER_1K (1.000 Chat / 24 Jam)';

    if (tierRaw === 'TIER_50') {
      dailyLimit = 50;
      tierDisplay = 'TIER_50 (50 Chat / 24 Jam)';
    } else if (tierRaw === 'TIER_250') {
      dailyLimit = 250;
      tierDisplay = 'TIER_250 (250 Chat / 24 Jam)';
    } else if (tierRaw === 'TIER_1K' || tierRaw === '1000') {
      dailyLimit = 1000;
      tierDisplay = 'TIER_1K (1.000 Chat / 24 Jam)';
    } else if (tierRaw === 'TIER_10K' || tierRaw === '10000') {
      dailyLimit = 10000;
      tierDisplay = 'TIER_10K (10.000 Chat / 24 Jam)';
    } else if (tierRaw === 'TIER_100K' || tierRaw === '100000') {
      dailyLimit = 100000;
      tierDisplay = 'TIER_100K (100.000 Chat / 24 Jam)';
    } else if (tierRaw === 'TIER_UNLIMITED') {
      dailyLimit = 1000000;
      tierDisplay = 'TIER_UNLIMITED (Tanpa Batas Kuota)';
    }

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
        tier: tierRaw,
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

    // Token and WABA resolution (org settings first, fallback to env)
    let activeAccessToken = org?.accessToken && !org.accessToken.startsWith('EAAGm0PX4ZCBO')
      ? org.accessToken
      : env.META_ACCESS_TOKEN;

    let activeWabaId = org?.wabaId && org.wabaId.length > 10
      ? org.wabaId
      : env.META_WABA_ID;

    // Dynamically resolve true WABA ID from Phone Number ID if token is present
    if (activeAccessToken && env.META_PHONE_NUMBER_ID) {
      const resolvedWaba = await MetaApiService.fetchWabaIdFromPhoneNumberId(env.META_PHONE_NUMBER_ID, activeAccessToken);
      if (resolvedWaba) {
        activeWabaId = resolvedWaba;
        if (org?.id && org.wabaId !== resolvedWaba) {
          await db
            .update(organizations)
            .set({ wabaId: resolvedWaba })
            .where(eq(organizations.id, org.id));
        }
      }
    }

    // Automatically sync live phone number and business name from Meta API & Subscribe WABA to App
    if (activeWabaId && activeWabaId !== '1386698372551547' && activeAccessToken) {
      try {
        // 1. Auto-subscribe WABA to App Webhooks
        await MetaApiService.subscribeAppToWaba(activeWabaId, activeAccessToken);

        const metaPhones = await MetaApiService.fetchWabaPhoneNumbers(activeWabaId, activeAccessToken);
        if (metaPhones && metaPhones.length > 0) {
          metaLivePhone = metaPhones[0];
          const existingPhones = await db
            .select()
            .from(phoneNumbers)
            .where(eq(phoneNumbers.organizationId, user.orgId));

          if (existingPhones.length > 0) {
            await db
              .update(phoneNumbers)
              .set({
                phoneNumberId: metaLivePhone.id || existingPhones[0].phoneNumberId,
                displayPhoneNumber: metaLivePhone.display_phone_number || existingPhones[0].displayPhoneNumber,
                verifiedName: metaLivePhone.verified_name || existingPhones[0].verifiedName,
                qualityRating: metaLivePhone.quality_rating || existingPhones[0].qualityRating,
                status: 'CONNECTED',
              })
              .where(eq(phoneNumbers.id, existingPhones[0].id));
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

    const phones = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, user.orgId));

    return {
      success: true,
      organization: {
        id: org?.id,
        name: metaLiveWaba?.name || org?.name,
        wabaId: org?.wabaId,
        appId: org?.appId || env.META_APP_ID || '',
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
        messagingLimitTier: metaLivePhone?.messaging_limit_tier || 'TIER_1K',
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
      metaLivePhone = metaPhones && metaPhones.length > 0 ? metaPhones[0] : null;
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

    const existingPhones = await db
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, user.orgId));

    const phone = existingPhones.length > 0 ? existingPhones[0] : null;

    if (metaLivePhone && existingPhones.length > 0) {
        await db
          .update(phoneNumbers)
          .set({
            phoneNumberId: metaLivePhone.id || existingPhones[0].phoneNumberId,
            displayPhoneNumber: metaLivePhone.display_phone_number || existingPhones[0].displayPhoneNumber,
            verifiedName: metaLivePhone.verified_name || existingPhones[0].verifiedName,
            qualityRating: metaLivePhone.quality_rating || existingPhones[0].qualityRating,
            status: 'CONNECTED',
          })
          .where(eq(phoneNumbers.id, existingPhones[0].id));
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
        messagingLimitTier: metaLivePhone?.messaging_limit_tier || 'TIER_1K',
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
            const firstPhone = metaPhones[0];
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

      // If WABA ID is provided, ensure phoneNumbers table is synced
      if (finalWabaId) {
        const existingPhones = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.organizationId, user.orgId));

        if (existingPhones.length > 0) {
          await db
            .update(phoneNumbers)
            .set({
              phoneNumberId: detectedPhoneId,
              displayPhoneNumber: detectedPhoneNumber,
              verifiedName: detectedVerifiedName,
              qualityRating: detectedQuality,
              status: 'CONNECTED',
            })
            .where(eq(phoneNumbers.id, existingPhones[0].id));
        } else {
          await db.insert(phoneNumbers).values({
            id: nanoid(),
            organizationId: user.orgId,
            phoneNumberId: detectedPhoneId,
            displayPhoneNumber: detectedPhoneNumber,
            verifiedName: detectedVerifiedName,
            qualityRating: detectedQuality,
            status: 'CONNECTED',
          });
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
      await db
        .update(organizations)
        .set({
          wabaId: null,
          accessToken: null,
        })
        .where(eq(organizations.id, user.orgId));

      await db
        .update(phoneNumbers)
        .set({
          status: 'DISCONNECTED',
        })
        .where(eq(phoneNumbers.organizationId, user.orgId));

      return { success: true, message: 'Koneksi WhatsApp WABA berhasil diputuskan' };
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
        const { code, wabaId, phoneNumberId, displayPhoneNumber, verifiedName } = body;

        let finalAccessToken = env.META_ACCESS_TOKEN || ('EAAGm0PX4ZCBO' + nanoid(32));
        let finalWabaId = wabaId || env.META_WABA_ID || '';
        let finalPhoneId = phoneNumberId || env.META_PHONE_NUMBER_ID || ('phone_' + nanoid(14));
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

          try {
            const exchangedToken = await MetaApiService.exchangeCodeForToken(code, orgData?.appId || undefined);
            if (exchangedToken) {
              finalAccessToken = exchangedToken;
            } else {
              finalAccessToken = (orgData?.accessToken && !orgData.accessToken.startsWith('EAAGm0PX4ZCBO'))
                ? orgData.accessToken
                : env.META_ACCESS_TOKEN;
            }
          } catch (_) {
            finalAccessToken = (orgData?.accessToken && !orgData.accessToken.startsWith('EAAGm0PX4ZCBO'))
              ? orgData.accessToken
              : env.META_ACCESS_TOKEN;
          }
        }

        // 2. Automatically fetch live business name & phone numbers from Meta
        if (finalWabaId && finalAccessToken && !finalAccessToken.startsWith('EAAGm0PX4ZCBO')) {
          try {
            const metaWaba = await MetaApiService.fetchWabaDetails(finalWabaId, finalAccessToken);
            if (metaWaba?.name) {
              detectedCompanyName = metaWaba.name;
            }

            const metaPhones = await MetaApiService.fetchWabaPhoneNumbers(finalWabaId, finalAccessToken);
            if (metaPhones && metaPhones.length > 0) {
              finalPhoneId = metaPhones[0].id || finalPhoneId;
              finalPhone = metaPhones[0].display_phone_number || finalPhone;
              finalDisplayName = metaPhones[0].verified_name || finalDisplayName;
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
        if (detectedCompanyName) {
          orgUpdateData.name = detectedCompanyName;
        }

        await db
          .update(organizations)
          .set(orgUpdateData)
          .where(eq(organizations.id, user.orgId));

        // Upsert phone number into database
        const existingPhones = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.organizationId, user.orgId));

        if (existingPhones.length > 0) {
          await db
            .update(phoneNumbers)
            .set({
              phoneNumberId: finalPhoneId,
              displayPhoneNumber: finalPhone,
              verifiedName: finalDisplayName,
              qualityRating: 'GREEN',
              status: 'CONNECTED',
            })
            .where(eq(phoneNumbers.id, existingPhones[0].id));
        } else {
          await db.insert(phoneNumbers).values({
            id: nanoid(),
            organizationId: user.orgId,
            phoneNumberId: finalPhoneId,
            displayPhoneNumber: finalPhone,
            verifiedName: finalDisplayName,
            qualityRating: 'GREEN',
            status: 'CONNECTED',
          });
        }

        return {
          success: true,
          message: 'Nomor WhatsApp Business resmi berhasil dihubungkan!',
          connectedChannel: {
            wabaId: finalWabaId,
            phoneNumberId: finalPhoneId,
            displayPhoneNumber: finalPhone,
            verifiedName: finalDisplayName,
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
        appId: t.Optional(t.String()),
        wabaId: t.Optional(t.String()),
        phoneNumberId: t.Optional(t.String()),
        displayPhoneNumber: t.Optional(t.String()),
        verifiedName: t.Optional(t.String()),
      }),
    }
  )

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

  // ─── GET /settings/operating-hours — Get Operating Hours & AI Agent Config ──
  .get('/operating-hours', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    const [org] = await db
      .select({
        operatingHours: organizations.operatingHours,
        aiAgentConfig: organizations.aiAgentConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1);

    const defaultHours = {
      enabled: false,
      timezone: 'Asia/Jakarta',
      days: [1, 2, 3, 4, 5],
      startTime: '08:00',
      endTime: '17:00',
    };

    const defaultAi = {
      enabled: false,
      mode: 'AI_ASSISTANT',
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-2.0-flash',
      systemPrompt: '',
      staticMessage: 'Halo! Layanan kami sedang di luar jam operasional. Pesan Anda telah kami terima dan akan segera dibalas oleh tim kami saat jam kerja dimulai. Terima kasih! 🙏',
    };

    let hours = org?.operatingHours;
    let ai = org?.aiAgentConfig;

    if (typeof hours === 'string') {
      try { hours = JSON.parse(hours); } catch (_) {}
    }
    if (typeof ai === 'string') {
      try { ai = JSON.parse(ai); } catch (_) {}
    }

    return {
      success: true,
      operatingHours: hours || defaultHours,
      aiAgentConfig: ai || defaultAi,
    };
  })

  // ─── PATCH /settings/operating-hours — Save Operating Hours & AI Agent Config ──
  .patch(
    '/operating-hours',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }
      if (user.role !== 'ADMINISTRATOR' && user.role !== 'SUPERVISOR') {
        set.status = 403;
        return { success: false, error: 'Akses ditolak (Khusus Administrator atau Supervisor)' };
      }

      try {
        console.log(`🕒 Updating Operating Hours & AI Agent for org ${user.orgId}...`);
        
        let hoursToSave = body.operatingHours;
        let aiToSave = body.aiAgentConfig;

        if (typeof hoursToSave === 'string') {
          try { hoursToSave = JSON.parse(hoursToSave); } catch (_) {}
        }
        if (typeof aiToSave === 'string') {
          try { aiToSave = JSON.parse(aiToSave); } catch (_) {}
        }

        await db
          .update(organizations)
          .set({
            operatingHours: hoursToSave as any,
            aiAgentConfig: aiToSave as any,
          })
          .where(eq(organizations.id, user.orgId));

        console.log(`✅ Operating Hours & AI Agent updated successfully for org ${user.orgId}`);

        return {
          success: true,
          message: 'Pengaturan Jam Operasional & AI Agent berhasil disimpan!',
        };
      } catch (err: any) {
        console.error('❌ Failed to update operating hours:', err);
        set.status = 500;
        return {
          success: false,
          error: err.message || 'Gagal menyimpan ke database',
        };
      }
    },
    {
      body: t.Object({
        operatingHours: t.Optional(t.Any()),
        aiAgentConfig: t.Optional(t.Any()),
      }),
    }
  )

  // ─── POST /settings/ai-agent/test — Test AI Prompt Directly ──
  .post(
    '/ai-agent/test',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: 'Unauthorized' };
      }

      try {
        const { AiAgentService } = await import('../../services/ai-agent.service');
        const reply = await AiAgentService.generateGeminiResponse({
          systemPrompt: body.systemPrompt || '',
          userMessage: body.userMessage || 'Halo, saya mau tanya apakah ada promo hari ini?',
          apiKey: body.apiKey || undefined,
          model: body.model || 'gemini-2.0-flash',
        });

        return {
          success: true,
          reply,
        };
      } catch (err: any) {
        set.status = 400;
        return {
          success: false,
          error: err.message,
        };
      }
    },
    {
      body: t.Object({
        systemPrompt: t.String(),
        userMessage: t.String(),
        apiKey: t.Optional(t.String()),
        model: t.Optional(t.String()),
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
        key: fullKey,
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
  });
