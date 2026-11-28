// Unit tests for the inbox reply-suggestion helpers (pure, no network).
import { describe, expect, test } from 'bun:test';
import {
  buildSuggestSystemPrompt,
  buildSuggestUserPrompt,
  cleanContactName,
  formatTranscript,
  parseSuggestions,
} from '../src/services/reply-suggest';

describe('parseSuggestions', () => {
  test('reads a plain JSON array', () => {
    const out = parseSuggestions('[{"title":"Jawab","text":"Halo Kak"},{"title":"Tanya","text":"Boleh info?"}]');
    expect(out).toEqual([
      { title: 'Jawab', text: 'Halo Kak' },
      { title: 'Tanya', text: 'Boleh info?' },
    ]);
  });

  test('tolerates code fences and surrounding text', () => {
    const out = parseSuggestions('Berikut:\n```json\n[{"title":"A","text":"x"}]\n```');
    expect(out).toEqual([{ title: 'A', text: 'x' }]);
  });

  test('drops empty items, fills missing titles, keeps at most 3', () => {
    const out = parseSuggestions(
      JSON.stringify([{ title: 'a', text: '' }, { text: 'satu' }, { title: 'b', text: 'dua' }, { text: 'tiga' }, { text: 'empat' }])
    );
    expect(out.map((s) => s.text)).toEqual(['satu', 'dua', 'tiga']);
    expect(out[0].title).toBe('Opsi 1');
  });

  test('returns [] for non-JSON', () => {
    expect(parseSuggestions('maaf saya tidak bisa')).toEqual([]);
    expect(parseSuggestions('[tidak valid')).toEqual([]);
  });
});

describe('prompt building', () => {
  test('transcript labels both sides and tags media', () => {
    const t = formatTranscript([
      { direction: 'INBOUND', messageType: 'text', body: 'Harga paket A?' },
      { direction: 'OUTBOUND', messageType: 'text', body: 'Rp100rb kak' },
      { direction: 'INBOUND', messageType: 'image', body: '' },
    ]);
    expect(t).toBe('Pelanggan: Harga paket A?\nKami (CS): Rp100rb kak\nPelanggan: [mengirim image]');
  });

  test('phone numbers are not used as names', () => {
    expect(cleanContactName('+62 812-3456')).toBe('');
    expect(cleanContactName('Kak')).toBe('');
    expect(cleanContactName('Budi')).toBe('Budi');
  });

  test('draft switches to polish instructions', () => {
    expect(buildSuggestUserPrompt({ transcript: 'x', draft: 'oke kak sy cek' })).toContain('oke kak sy cek');
    expect(buildSuggestUserPrompt({ transcript: 'x' })).toContain('pesan terakhir pelanggan');
  });

  test('company guide is appended and the prompt forbids invented facts', () => {
    const p = buildSuggestSystemPrompt('Toko X', 'Buka 08-17');
    expect(p).toContain('[PANDUAN PERUSAHAAN]\nBuka 08-17');
    expect(p).toContain('JANGAN mengarang');
  });
});
