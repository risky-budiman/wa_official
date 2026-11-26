// Unit tests for server-side guards that protect money and the internal network.
import { describe, expect, test } from 'bun:test';
import { assertSafeLlmBaseUrl } from '../src/services/ai-agent.service';
import { BillingService } from '../src/modules/billing/billing.service';

describe('assertSafeLlmBaseUrl (SSRF guard for Custom LLM)', () => {
  test('allows public http(s) endpoints', () => {
    expect(() => assertSafeLlmBaseUrl('https://llm.example.com')).not.toThrow();
    expect(() => assertSafeLlmBaseUrl('http://203.0.113.10:11434')).not.toThrow();
  });

  test.each([
    'http://localhost:11434',
    'http://127.0.0.1:3306',
    'http://10.0.0.5',
    'http://192.168.1.10',
    'http://172.16.0.1',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]:8080',
    'http://db.internal',
  ])('blocks private / loopback address %s', (url) => {
    expect(() => assertSafeLlmBaseUrl(url)).toThrow();
  });

  test('rejects non-http schemes and garbage', () => {
    expect(() => assertSafeLlmBaseUrl('file:///etc/passwd')).toThrow();
    expect(() => assertSafeLlmBaseUrl('not a url')).toThrow();
  });
});

describe('BillingService.calculateOrderPricing (price is decided by the server)', () => {
  const monthly = { price: 199000, durationType: 'MONTHLY', durationDays: 30 } as any;

  test('default duration uses the plan price', () => {
    expect(BillingService.calculateOrderPricing(monthly)).toEqual({ durationDays: 30, amount: 199000 });
  });

  test('longer allowed durations scale the price proportionally', () => {
    expect(BillingService.calculateOrderPricing(monthly, 90)).toEqual({ durationDays: 90, amount: 597000 });
    expect(BillingService.calculateOrderPricing(monthly, 365).amount).toBe(Math.round((199000 * 365) / 30));
  });

  test('arbitrary durations are refused (no cheap 3650-day orders)', () => {
    expect(() => BillingService.calculateOrderPricing(monthly, 3650)).toThrow();
    expect(() => BillingService.calculateOrderPricing(monthly, 7)).toThrow();
  });

  test('free plans cannot be stretched', () => {
    const free = { price: 0, durationType: 'DAYS', durationDays: 14 } as any;
    expect(BillingService.calculateOrderPricing(free, 365)).toEqual({ durationDays: 14, amount: 0 });
  });

  test('permanent plans have no duration', () => {
    expect(BillingService.calculateOrderPricing({ price: 5000000, durationType: 'PERMANENT' } as any, 90)).toEqual({ durationDays: 0, amount: 5000000 });
  });
});
