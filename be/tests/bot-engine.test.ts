// Unit tests for the chatbot decision engine (pure functions, no database).
import { describe, expect, test } from 'bun:test';
import { decideBotReply, keywordMatches, normalizeBotSettings, fillTemplate } from '../src/services/bot-engine';

describe('keywordMatches', () => {
  test('numbers and very short keywords must be the whole message', () => {
    expect(keywordMatches('1', '1')).toBe(true);
    expect(keywordMatches(' 1 ', '1')).toBe(true);
    expect(keywordMatches('pesan 10 barang', '1')).toBe(false);
    expect(keywordMatches('ada discount?', 'cs')).toBe(false);
    expect(keywordMatches('CS', 'cs')).toBe(true);
  });

  test('longer keywords match whole words, not parts of words', () => {
    expect(keywordMatches('cek resi dong', 'resi')).toBe(true);
    expect(keywordMatches('presiden', 'resi')).toBe(false);
    expect(keywordMatches('Mau CEK  ongkir!', 'cek ongkir')).toBe(true);
    expect(keywordMatches('cekongkir', 'cek ongkir')).toBe(false);
  });
});

describe('fillTemplate', () => {
  test('replaces contact and business name', () => {
    expect(fillTemplate('Halo {{contactName}} dari {{ businessName }}', { contactName: 'Budi', businessName: 'Toko' })).toBe('Halo Budi dari Toko');
  });
});

describe('decideBotReply', () => {
  const rules = [
    { id: 'a', title: 'Katalog', keywords: ['1', 'katalog'], replyText: 'Katalog untuk {{contactName}}', action: 'REPLY' },
    { id: 'b', title: 'CS', keywords: ['3', 'admin'], replyText: 'Menghubungkan…', action: 'HANDOFF_HUMAN' },
    { id: 'c', title: 'AI', keywords: ['4'], replyText: '', action: 'HANDOVER_AI' },
  ] as any;
  const settings = normalizeBotSettings(
    { enabled: true, mode: 'AI_ASSISTANT' } as any,
    { enabled: true, greetingText: 'Halo {{contactName}}', rules } as any
  );
  const decide = (message: string, extra: object = {}) =>
    decideBotReply({ message, settings, contactName: 'Budi', businessName: 'Toko', ...extra }) as any;

  test('greeting word shows the main menu', () => {
    expect(decide('Halo!')).toEqual({ kind: 'GREETING', reply: 'Halo Budi' });
  });

  test('keyword rule replies with filled template', () => {
    const d = decide('1');
    expect(d.kind).toBe('RULE');
    expect(d.reply).toBe('Katalog untuk Budi');
    expect(d.handoff).toBe(false);
  });

  test('hand-off rule asks for a human', () => {
    expect(decide('mau bicara dengan admin').handoff).toBe(true);
  });

  test('hand-over-to-AI rule without text lets the AI answer', () => {
    expect(decide('4').thenAi).toBe(true);
  });

  test('free text falls back to AI', () => {
    expect(decide('berapa harga paket premium?').kind).toBe('AI');
  });

  test('greeting on a new conversation only when enabled', () => {
    expect(decide('tanya dong', { isNewConversation: true }).kind).toBe('AI');
    const greetNew = normalizeBotSettings(
      { enabled: true, mode: 'AI_ASSISTANT' } as any,
      { enabled: true, greetingText: 'Halo', greetOnNewConversation: true, rules } as any
    );
    expect((decideBotReply({ message: 'tanya dong', settings: greetNew, isNewConversation: true }) as any).kind).toBe('GREETING');
  });

  test('legacy configs (no menu flag) keep the menu off', () => {
    const legacy = normalizeBotSettings({ enabled: true, mode: 'AI_ASSISTANT' } as any, { greetingText: 'x', rules } as any);
    expect((decideBotReply({ message: '1', settings: legacy }) as any).kind).toBe('AI');
  });

  test('fallback modes and master switch', () => {
    const none = normalizeBotSettings({ enabled: true, mode: 'NONE' } as any, { enabled: true, rules } as any);
    expect((decideBotReply({ message: 'apa kabar', settings: none }) as any).kind).toBe('SILENT');
    const fixed = normalizeBotSettings({ enabled: true, mode: 'STATIC_MESSAGE', staticMessage: 'Hi {{contactName}}' } as any, {} as any);
    expect(decideBotReply({ message: 'apa kabar', settings: fixed, contactName: 'Ani' })).toEqual({ kind: 'STATIC', reply: 'Hi Ani' });
    const off = normalizeBotSettings({ enabled: false } as any, { enabled: true, rules } as any);
    expect((decideBotReply({ message: '1', settings: off }) as any).kind).toBe('SILENT');
  });
});
