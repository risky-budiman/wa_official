// ===========================================
// BullMQ Queue Service
// ===========================================

import { Queue } from 'bullmq';
import { redis } from '../config/redis';

// Define Webhook Ingestion Queue
export const webhookQueue = new Queue('whatsapp-webhook', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function pushWebhookJob(payload: any) {
  return await webhookQueue.add('process-event', payload);
}
