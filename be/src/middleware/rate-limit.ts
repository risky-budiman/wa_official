// ===========================================
// Simple in-memory rate limiter (brute-force protection)
// ===========================================
// Single-process, no Redis needed. Counters reset when the server restarts.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so memory stays small
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}, 60_000).unref?.();

export interface RateLimitRule {
  /** Max hits allowed inside the window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
}

/** Returns seconds until the key may try again, or 0 if it is currently allowed. */
export function retryAfterSeconds(key: string, rule: RateLimitRule): number {
  const b = buckets.get(key);
  if (!b || b.resetAt <= Date.now()) return 0;
  return b.count >= rule.limit ? Math.ceil((b.resetAt - Date.now()) / 1000) : 0;
}

/** Record one hit for the key. */
export function hit(key: string, rule: RateLimitRule): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
  } else {
    b.count++;
  }
}

/** Forget a key (e.g. after a successful login). */
export function reset(key: string): void {
  buckets.delete(key);
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Best-effort client IP.
 * X-Real-IP / X-Forwarded-For are only trusted when the request comes from the local
 * reverse proxy (nginx on the same host); otherwise they could be spoofed by the client.
 */
const normalizeIp = (ip: string) => ip.trim().replace(/^::ffff:/, '');

/**
 * Extra reverse proxies in front of the local nginx (e.g. a separate edge proxy server).
 * TRUSTED_PROXIES="10.90.10.5,10.90." — exact IPs, or prefixes ending in "." / ":".
 * Without it every visitor would share the edge proxy's IP and its rate limits.
 */
function trustedProxies(): string[] {
  return (process.env.TRUSTED_PROXIES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
const isTrustedProxy = (ip: string, list: string[]) =>
  LOOPBACK.has(ip) || list.some((t) => (t.endsWith('.') || t.endsWith(':') ? ip.startsWith(t) : ip === t));

export function getClientIp(request: Request, server: any): string {
  let socketIp = '';
  try {
    socketIp = normalizeIp(server?.requestIP?.(request)?.address || '');
  } catch (_) {}

  // Forwarding headers are only believed when the request came through our local proxy
  if (!socketIp || LOOPBACK.has(socketIp)) {
    const trusted = trustedProxies();
    const fwd = request.headers.get('x-forwarded-for');
    if (trusted.length > 0 && fwd) {
      // Walk from the nearest hop outwards, skipping proxies we trust; the first other address is the client
      const hops = fwd.split(',').map(normalizeIp).filter(Boolean);
      for (let i = hops.length - 1; i >= 0; i--) {
        if (!isTrustedProxy(hops[i], trusted)) return hops[i];
      }
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp && !(trusted.length > 0 && isTrustedProxy(normalizeIp(realIp), trusted))) return normalizeIp(realIp);
    if (fwd) return normalizeIp(fwd.split(',')[0]);
    if (realIp) return normalizeIp(realIp);
  }
  return socketIp || 'unknown';
}

/** Standard 429 response body + Retry-After header. */
export function tooManyRequests(set: any, seconds: number) {
  set.status = 429;
  set.headers['Retry-After'] = String(seconds);
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return {
    success: false,
    error: `Terlalu banyak percobaan. Silakan coba lagi dalam ${minutes} menit.`,
  };
}

// ─── Rules ────────────────────────────────────────────────
const MIN = 60_000;
export const RULES = {
  /** Failed logins per email (per portal) */
  loginPerAccount: { limit: 10, windowMs: 15 * MIN },
  /** Failed logins per IP (covers password spraying across many emails) */
  loginPerIp: { limit: 30, windowMs: 15 * MIN },
  /** Registrations per IP */
  registerPerIp: { limit: 10, windowMs: 60 * MIN },
  /** Organization ID lookups per IP (prevents ID enumeration) */
  orgLookupPerIp: { limit: 30, windowMs: 15 * MIN },
  /** Wrong "current password" attempts per user on profile update */
  passwordChangePerUser: { limit: 5, windowMs: 15 * MIN },
} satisfies Record<string, RateLimitRule>;
