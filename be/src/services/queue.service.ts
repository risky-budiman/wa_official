// ===========================================
// Optional BullMQ queue for Meta webhooks
// ===========================================
//
// Off by default: webhooks are acknowledged immediately and processed in the background
// inside the API process. Set WEBHOOK_QUEUE=redis (with REDIS_HOST/PORT/PASSWORD) to
// persist events in Redis and process them with retries via a BullMQ worker.
// Redis is only connected when the queue is enabled.

import type { Queue } from 'bullmq';

export const webhookQueueEnabled = () => process.env.WEBHOOK_QUEUE === 'redis';

let queue: Queue | null = null;

async function getQueue(): Promise<Queue> {
  if (queue) return queue;
  const { Queue } = await import('bullmq');
  const { redis } = await import('../config/redis');
  queue = new Queue('whatsapp-webhook', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
  return queue;
}

export async function pushWebhookJob(payload: any) {
  return (await getQueue()).add('process-event', payload);
}
