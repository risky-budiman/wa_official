// ===========================================
// Redis Connection (ioredis)
// ===========================================

import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.log(`🔄 Redis reconnecting (attempt ${times})...`);
    return delay;
  },
});

redis.on('connect', () => {
  console.log(`✅ Redis connected → ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

export { Redis };
