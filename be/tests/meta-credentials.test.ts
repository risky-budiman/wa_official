// Tenants must use their own Meta credentials; the platform's are opt-in only.
import { afterEach, describe, expect, test } from 'bun:test';
import { env } from '../src/config/env';
import { orgMetaToken, platformPhoneNumberId, platformWabaId, isPlaceholderToken } from '../src/services/meta-credentials';

const original = process.env.META_PLATFORM_FALLBACK;
afterEach(() => {
  if (original === undefined) delete process.env.META_PLATFORM_FALLBACK;
  else process.env.META_PLATFORM_FALLBACK = original;
});

describe('meta credentials', () => {
  test('an organization always uses its own real token', () => {
    process.env.META_PLATFORM_FALLBACK = 'true';
    expect(orgMetaToken('EAAreal-org-token')).toBe('EAAreal-org-token');
  });

  test('without the opt-in, tenants never get the platform token / WABA / number', () => {
    delete process.env.META_PLATFORM_FALLBACK;
    expect(orgMetaToken(null)).toBe('');
    expect(orgMetaToken('EAAGm0PX4ZCBOplaceholder')).toBe('');
    expect(platformWabaId()).toBe('');
    expect(platformPhoneNumberId()).toBe('');
  });

  test('with META_PLATFORM_FALLBACK=true the platform credentials are used', () => {
    process.env.META_PLATFORM_FALLBACK = 'true';
    expect(orgMetaToken(null)).toBe(env.META_ACCESS_TOKEN || '');
    expect(platformWabaId()).toBe(env.META_WABA_ID || '');
  });

  test('placeholder detection', () => {
    expect(isPlaceholderToken(undefined)).toBe(true);
    expect(isPlaceholderToken('EAAGm0PX4ZCBOabc')).toBe(true);
    expect(isPlaceholderToken('EAAreal')).toBe(false);
  });
});
