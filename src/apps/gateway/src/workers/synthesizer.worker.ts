// src/apps/gateway/src/workers/synthesizer.worker.ts
//
// Standalone BullMQ worker process.
// Start with:  node dist/workers/synthesizer.worker.js
// Docker:      command: ["node", "dist/workers/synthesizer.worker.js"]
//
// Orchestration flow:
//   1. Call text-analysis  POST /analyze      → segments[]
//   2. Call tts-adapter    POST /synthesize   → { audio_url, … }
//   3. Return result — BullMQ stores it; gateway /status route reads it.
//

import { Worker, Job } from "bullmq";
import {
  getRedisConnection,
  SYNTHESIS_QUEUE_NAME,
  SynthesisJobData,
  SynthesisJobResult,
} from "../queues/synthesis.queue";

// ──────────────────────────────────────────────────────────────────────────────
// Config (same env vars the gateway uses)
// ──────────────────────────────────────────────────────────────────────────────
const TEXT_ANALYSIS_URL = process.env.TEXT_ANALYSIS_URL ?? "http://localhost:8001";
const TTS_ADAPTER_URL = process.env.TTS_ADAPTER_URL ?? "http://localhost:8002";
const UPSTREAM_TIMEOUT = Number(process.env.TTS_ADAPTER_TIMEOUT_MS ?? 15_000);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callTextAnalysis(text: string): Promise<unknown[]> {
  const resp = await fetchWithTimeout(
    `${TEXT_ANALYSIS_URL}/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
    UPSTREAM_TIMEOUT
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`text-analysis ${resp.status}: ${body}`);
  }

  const data = (await resp.json()) as { segments?: unknown[] };
  return data.segments ?? [];
}

async function callTtsAdapter(segments: unknown[]): Promise<{
  audio_url: string;
  received_segments: number;
  total_pause_ms: number;
}> {
  const resp = await fetchWithTimeout(
    `${TTS_ADAPTER_URL}/synthesize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments }),
    },
    UPSTREAM_TIMEOUT
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`tts-adapter ${resp.status}: ${body}`);
  }

  return resp.json() as Promise<{
    audio_url: string;
    received_segments: number;
    total_pause_ms: number;
  }>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Worker processor
// ──────────────────────────────────────────────────────────────────────────────
async function processSynthesisJob(
  job: Job<SynthesisJobData, SynthesisJobResult>
): Promise<SynthesisJobResult> {
  const { text } = job.data;

  // Step 1: text analysis
  await job.updateProgress(10);
  const segments = await callTextAnalysis(text);

  // Step 2: synthesis
  await job.updateProgress(50);
  const ttsResult = await callTtsAdapter(segments);

  await job.updateProgress(100);

  return {
    audioUrl: ttsResult.audio_url,
    segments,
    totalPauseMs: ttsResult.total_pause_ms,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────────────────────
const worker = new Worker<SynthesisJobData, SynthesisJobResult>(
  SYNTHESIS_QUEUE_NAME,
  processSynthesisJob,
  {
    connection: getRedisConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4),
  }
);

worker.on("completed", (job) => {
  console.log(`[synthesizer-worker] job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[synthesizer-worker] job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[synthesizer-worker] worker error:", err);
});

process.on("SIGTERM", async () => {
  console.log("[synthesizer-worker] SIGTERM received — draining…");
  await worker.close();
  process.exit(0);
});

console.log("[synthesizer-worker] started, waiting for jobs…");
