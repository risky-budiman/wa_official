// ===========================================
// Which Meta (WhatsApp Cloud API) credentials an organization may use
// ===========================================
//
// Every tenant must connect its OWN WhatsApp Business Account. The platform's
// credentials from .env (META_ACCESS_TOKEN / META_WABA_ID / META_PHONE_NUMBER_ID)
// are NOT used for tenants unless META_PLATFORM_FALLBACK=true — otherwise a tenant
// without a WABA would send from, and even delete templates on, the platform's WABA.
//
// Set META_PLATFORM_FALLBACK=true only for a single-tenant install where the one
// organization intentionally uses the platform number.

import { env } from '../config/env';

/** Placeholder tokens written by old demo / signup code — never real credentials. */
export const isPlaceholderToken = (token?: string | null) => !token || token.startsWith('EAAGm0PX4ZCBO');

export const platformFallbackEnabled = () => process.env.META_PLATFORM_FALLBACK === 'true';

/** The organization's own token, or (only when explicitly allowed) the platform token. */
export function orgMetaToken(orgToken?: string | null): string {
  if (!isPlaceholderToken(orgToken)) return orgToken as string;
  return platformFallbackEnabled() ? env.META_ACCESS_TOKEN || '' : '';
}

/** Platform WABA id — only when the fallback is explicitly allowed. */
export const platformWabaId = (): string => (platformFallbackEnabled() ? env.META_WABA_ID || '' : '');

/** Platform phone number id — only when the fallback is explicitly allowed. */
export const platformPhoneNumberId = (): string => (platformFallbackEnabled() ? env.META_PHONE_NUMBER_ID || '' : '');
