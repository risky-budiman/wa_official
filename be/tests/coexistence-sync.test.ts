// Unit tests for WhatsApp Business app Coexistence webhook parsing (pure functions, no database).
import { describe, expect, test } from 'bun:test';
import { historyItems, historyStatus, syncedContacts } from '../src/services/coexistence-sync';

describe('historyItems', () => {
  const value = {
    history: [
      {
        metadata: { phase: 0, chunk_order: 1, progress: 100 },
        threads: [
          {
            id: '6281234567890',
            messages: [
              { from: '6289900000000', to: '6281234567890', id: 'wamid.B', timestamp: '1700000200', type: 'text', text: { body: 'Halo kak' }, history_context: { status: 'READ' } },
              { from: '6281234567890', id: 'wamid.A', timestamp: '1700000100', type: 'text', text: { body: 'Ready?' }, history_context: { status: 'DELIVERED' } },
              { from: '6281234567890', timestamp: '1700000300', type: 'text', text: { body: 'no id' } },
            ],
          },
        ],
      },
    ],
  };

  test('orders oldest first and tells customer from business', () => {
    const items = historyItems(value);
    expect(items.map((i) => [i.msg.id, i.direction, i.status])).toEqual([
      ['wamid.A', 'INBOUND', 'READ'],
      ['wamid.B', 'OUTBOUND', 'READ'],
    ]);
    expect(items[0].customerWaId).toBe('6281234567890');
  });

  test('tolerates empty or error-only payloads', () => {
    expect(historyItems({})).toEqual([]);
    expect(historyItems({ history: [{ errors: [{ code: 2593109 }] }] })).toEqual([]);
  });
});

describe('historyStatus', () => {
  test('imported customer messages never count as unread', () => {
    expect(historyStatus('DELIVERED', 'INBOUND')).toBe('READ');
  });
  test('maps business message states', () => {
    expect(historyStatus('PLAYED', 'OUTBOUND')).toBe('READ');
    expect(historyStatus('ERROR', 'OUTBOUND')).toBe('FAILED');
    expect(historyStatus(undefined, 'OUTBOUND')).toBe('SENT');
  });
});

describe('syncedContacts', () => {
  test('keeps added contacts with a number and skips removals', () => {
    const value = {
      state_sync: [
        { type: 'contact', action: 'add', contact: { full_name: 'Budi Santoso', first_name: 'Budi', phone_number: '+62 812-3456' } },
        { type: 'contact', action: 'remove', contact: { full_name: 'Lama', phone_number: '628111' } },
        { type: 'contact', action: 'add', contact: { first_name: 'Tanpa nomor' } },
      ],
    };
    expect(syncedContacts(value)).toEqual([{ waId: '628123456', name: 'Budi Santoso' }]);
  });
});
