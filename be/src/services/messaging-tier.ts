// Meta messaging limit tier → number of unique customers a business may start
// conversations with per rolling 24 hours.
// (database / Meta modules are imported lazily so the pure parser stays unit-testable)

const KNOWN: Record<string, number> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_2K: 2000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: 1000000,
};

/** "TIER_1K" / "1000" / "1K" → { dailyLimit, tier, tierDisplay } */
export function parseMessagingTier(raw: unknown) {
  const clean = String(raw || 'TIER_2K').toUpperCase().trim();
  let tier = clean.startsWith('TIER_') ? clean : `TIER_${clean}`;
  if (tier === 'TIER_1000') tier = 'TIER_1K';
  if (tier === 'TIER_2000') tier = 'TIER_2K';
  if (tier === 'TIER_10000') tier = 'TIER_10K';
  if (tier === 'TIER_100000') tier = 'TIER_100K';

  let dailyLimit = KNOWN[tier];
  if (!dailyLimit) {
    const digits = clean.replace(/[^0-9]/g, '');
    dailyLimit = digits ? parseInt(digits, 10) : 2000;
    tier = digits ? `TIER_${dailyLimit}` : 'TIER_2K';
  }
  const tierDisplay =
    tier === 'TIER_UNLIMITED'
      ? 'TIER_UNLIMITED (Tanpa Batas Kuota)'
      : `${tier} (${dailyLimit.toLocaleString('id-ID')} Chat / 24 Jam)`;
  return { tier, dailyLimit, tierDisplay };
}

/** Live tier + quality of the organisation's active number (null fields when Meta is unreachable). */
export async function fetchOrgMessagingTier(orgId: string) {
  const [{ db }, { organizations }, { eq }, { MetaApiService }, { getActivePhone }, { orgMetaToken, platformPhoneNumberId }] = await Promise.all([
    import('../config/database'),
    import('../db/schema'),
    import('drizzle-orm'),
    import('./meta-api.service'),
    import('./phone-number.service'),
    import('./meta-credentials'),
  ]);
  const [org] = await db.select({ accessToken: organizations.accessToken }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const phone = await getActivePhone(orgId);
  const token = orgMetaToken(org?.accessToken);
  const phoneNumberId = phone?.phoneNumberId || platformPhoneNumberId();

  let details: any = null;
  if (token && phoneNumberId) {
    try {
      details = await MetaApiService.fetchPhoneNumberDetails(phoneNumberId, token);
    } catch {
      /* Meta unreachable — fall back to the default tier */
    }
  }
  return {
    ...parseMessagingTier(details?.messaging_limit_tier),
    live: !!details?.messaging_limit_tier,
    qualityRating: details?.quality_rating || phone?.qualityRating || null,
    phone,
    details,
  };
}
