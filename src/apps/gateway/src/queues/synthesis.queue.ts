// src/apps/gateway/src/queues/synthesis.queue.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface SynthesisJobData {
  text: string;
  requestId: string;
}

export interface SynthesisJobResult {
  audioUrl: string;
  segments: unknown[];
  totalPauseMs: number;
}

let _connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!_connection) {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    _connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
    });
  }
  return _connection;
}

export const SYNTHESIS_QUEUE_NAME = "synthesis";

export function createSynthesisQueue(): Queue<SynthesisJobData, SynthesisJobResult> {
  return new Queue<SynthesisJobData, SynthesisJobResult>(SYNTHESIS_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  });
}
