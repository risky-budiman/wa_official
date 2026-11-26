// Client IP resolution behind one or two reverse proxies (drives per-IP login limits).
import { afterEach, describe, expect, test } from 'bun:test';
import { getClientIp } from '../src/middleware/rate-limit';

const server = (ip: string) => ({ requestIP: () => ({ address: ip }) });
const req = (headers: Record<string, string>) => new Request('http://x/api', { headers });
const original = process.env.TRUSTED_PROXIES;
afterEach(() => {
  if (original === undefined) delete process.env.TRUSTED_PROXIES;
  else process.env.TRUSTED_PROXIES = original;
});

describe('getClientIp', () => {
  test('direct connection uses the socket address and ignores headers', () => {
    expect(getClientIp(req({ 'x-real-ip': '1.2.3.4' }), server('203.0.113.9'))).toBe('203.0.113.9');
  });

  test('behind local nginx: X-Real-IP', () => {
    delete process.env.TRUSTED_PROXIES;
    expect(getClientIp(req({ 'x-real-ip': '198.51.100.7' }), server('127.0.0.1'))).toBe('198.51.100.7');
  });

  test('two proxies: without TRUSTED_PROXIES every user would look like the edge proxy', () => {
    delete process.env.TRUSTED_PROXIES;
    const r = req({ 'x-real-ip': '10.90.10.5', 'x-forwarded-for': '198.51.100.7, 10.90.10.5' });
    expect(getClientIp(r, server('127.0.0.1'))).toBe('10.90.10.5');
  });

  test('two proxies with TRUSTED_PROXIES: real client address', () => {
    process.env.TRUSTED_PROXIES = '10.90.';
    const r = req({ 'x-real-ip': '10.90.10.5', 'x-forwarded-for': '198.51.100.7, 10.90.10.5' });
    expect(getClientIp(r, server('127.0.0.1'))).toBe('198.51.100.7');
  });

  test('a client cannot spoof its address by prepending fake X-Forwarded-For entries', () => {
    process.env.TRUSTED_PROXIES = '10.90.10.5';
    const r = req({ 'x-forwarded-for': '1.1.1.1, 198.51.100.7, 10.90.10.5' });
    expect(getClientIp(r, server('::ffff:127.0.0.1'))).toBe('198.51.100.7');
  });
});
