// Unit tests for inbound message descriptions (pure functions, no database).
import { describe, expect, test } from 'bun:test';
import { describeInbound, extensionForMime } from '../src/services/inbound-message';

describe('describeInbound', () => {
  test('template quick-reply button keeps its text and can trigger the bot', () => {
    const d = describeInbound({ type: 'button', button: { text: 'Ya, saya tertarik', payload: 'YES' } });
    expect(d).toEqual({ body: 'Ya, saya tertarik', textLike: true, onlyInActiveConversation: false });
  });
  test('interactive list reply shows title and description', () => {
    const d = describeInbound({ type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: '2', title: 'Cek ongkir', description: 'Jawa Timur' } } });
    expect(d.body).toBe('Cek ongkir — Jawa Timur');
    expect(d.textLike).toBe(true);
  });
  test('location gets a map link', () => {
    const d = describeInbound({ type: 'location', location: { latitude: -7.25, longitude: 112.75, name: 'Toko', address: 'Jl. Raya 1' } });
    expect(d.body).toBe('📍 Lokasi\nToko, Jl. Raya 1\nhttps://maps.google.com/?q=-7.25,112.75');
  });
  test('contact card lists names and numbers', () => {
    const d = describeInbound({ type: 'contacts', contacts: [{ name: { formatted_name: 'Budi' }, phones: [{ phone: '+62 812' }] }] });
    expect(d.body).toBe('👤 Kartu kontak\n• Budi (+62 812)');
  });
  test('reaction only belongs to an active conversation', () => {
    expect(describeInbound({ type: 'reaction', reaction: { emoji: '👍' } })).toEqual({
      body: 'Bereaksi 👍 pada pesan',
      textLike: false,
      onlyInActiveConversation: true,
    });
  });
  test('unknown type stays visible', () => {
    expect(describeInbound({ type: 'ephemeral' }).body).toBe('[EPHEMERAL]');
  });
});

describe('extensionForMime', () => {
  test('voice note in MP4 container is m4a, not a video', () => {
    expect(extensionForMime('audio/mp4')).toBe('m4a');
    expect(extensionForMime('video/mp4')).toBe('mp4');
  });
  test('codecs suffix and unknown types', () => {
    expect(extensionForMime('audio/ogg; codecs=opus')).toBe('ogg');
    expect(extensionForMime('text/plain')).toBe('txt');
    expect(extensionForMime('application/x-unknown')).toBe('bin');
  });
});
