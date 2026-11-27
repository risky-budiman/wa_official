// How long the bot stays quiet after a person replied (Chatbot & AI → "Setelah agen membalas").
import { describe, expect, test } from 'bun:test';
import { DEFAULT_HUMAN_QUIET_HOURS, humanQuietHours } from '../src/services/chatbot.service';

describe('humanQuietHours', () => {
  test('defaults to 12 hours for older configs', () => {
    expect(DEFAULT_HUMAN_QUIET_HOURS).toBe(12);
    expect(humanQuietHours(null)).toBe(12);
    expect(humanQuietHours({})).toBe(12);
    expect(humanQuietHours({ humanQuietHours: null as any })).toBe(12);
    expect(humanQuietHours({ humanQuietHours: '' as any })).toBe(12);
  });
  test('keeps an allowed choice, including 0 = until resolved', () => {
    expect(humanQuietHours({ humanQuietHours: 24 })).toBe(24);
    expect(humanQuietHours({ humanQuietHours: 0 })).toBe(0);
    expect(humanQuietHours({ humanQuietHours: '6' as any })).toBe(6);
  });
  test('rejects values outside the list', () => {
    expect(humanQuietHours({ humanQuietHours: 5 })).toBe(12);
    expect(humanQuietHours({ humanQuietHours: -1 })).toBe(12);
    expect(humanQuietHours({ humanQuietHours: 9999 })).toBe(12);
  });
});
