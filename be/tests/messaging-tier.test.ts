// Unit tests for the Meta messaging-tier parser (pure function, no database).
import { describe, expect, test } from 'bun:test';
import { parseMessagingTier } from '../src/services/messaging-tier';

describe('parseMessagingTier', () => {
  test('known Meta tiers', () => {
    expect(parseMessagingTier('TIER_250').dailyLimit).toBe(250);
    expect(parseMessagingTier('TIER_1K').dailyLimit).toBe(1000);
    expect(parseMessagingTier('tier_10k').dailyLimit).toBe(10000);
    expect(parseMessagingTier('TIER_UNLIMITED').tierDisplay).toContain('Tanpa Batas');
  });
  test('numeric forms', () => {
    expect(parseMessagingTier('1000').tier).toBe('TIER_1K');
    expect(parseMessagingTier('100K').dailyLimit).toBe(100000);
    expect(parseMessagingTier('TIER_5000').dailyLimit).toBe(5000);
  });
  test('missing / unknown falls back to 2K', () => {
    expect(parseMessagingTier(undefined).dailyLimit).toBe(2000);
    expect(parseMessagingTier('???').tier).toBe('TIER_2K');
  });
});
