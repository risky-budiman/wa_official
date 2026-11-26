// Unit tests for broadcast template variables (pure functions, no database).
import { describe, expect, test } from 'bun:test';
import { analyzeTemplate, missingVariables, buildComponents } from '../src/services/template-params';

const promo = [
  { type: 'HEADER', format: 'TEXT', text: 'Halo {{1}}' },
  { type: 'BODY', text: 'Hai {{1}}, diskon {{2}} untuk {{1}}!' },
  {
    type: 'BUTTONS',
    buttons: [
      { type: 'URL', text: 'Lihat', url: 'https://toko.id/p/{{1}}' },
      { type: 'URL', text: 'Beranda', url: 'https://toko.id' },
      { type: 'COPY_CODE', text: 'Salin', example: ['HEMAT10'] },
    ],
  },
];

describe('analyzeTemplate', () => {
  test('counts distinct variables and dynamic buttons only', () => {
    const n = analyzeTemplate(promo);
    expect(n.headerVars).toBe(1);
    expect(n.bodyVars).toBe(2); // {{1}} used twice counts once
    expect(n.buttons.map((b) => b.kind)).toEqual(['url', 'copy_code']); // static URL needs nothing
    expect(n.buttons[1].example).toBe('HEMAT10');
  });
});

describe('missingVariables', () => {
  const n = analyzeTemplate(promo);
  test('everything missing is listed', () => {
    expect(missingVariables(n, undefined)).toEqual(['header {{1}}', '{{1}}', '{{2}}', 'tombol "Lihat"']);
  });
  test('empty text does not count as filled', () => {
    const m = missingVariables(n, {
      header: [{ source: 'contact_name' }],
      body: [{ source: 'contact_name' }, { source: 'text', value: '   ' }],
      buttons: { '0': 'promo-a' },
    });
    expect(m).toEqual(['{{2}}']);
  });
  test('media header needs a link', () => {
    const m = missingVariables(analyzeTemplate([{ type: 'HEADER', format: 'IMAGE' }]), {});
    expect(m).toEqual(['link image untuk header']);
  });
});

describe('buildComponents', () => {
  test('per-recipient values; template coupon used when none typed', () => {
    const n = analyzeTemplate(promo);
    const c = buildComponents(
      n,
      { header: [{ source: 'contact_name' }], body: [{ source: 'contact_name' }, { source: 'text', value: '20%' }], buttons: { '0': 'sepatu' } },
      'Budi'
    );
    expect(c[0]).toEqual({ type: 'header', parameters: [{ type: 'text', text: 'Budi' }] });
    expect(c[1].parameters.map((p: any) => p.text)).toEqual(['Budi', '20%']);
    expect(c[2]).toEqual({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'sepatu' }] });
    expect(c[3].parameters[0].coupon_code).toBe('HEMAT10');
    expect(c.length).toBe(4); // no parameter for the static URL button
  });
});
