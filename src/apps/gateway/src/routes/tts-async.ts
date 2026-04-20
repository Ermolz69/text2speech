import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import {
  createSynthesisQueue,
  SynthesisJobData,
  SynthesisJobResult,
} from "../queues/synthesis.queue";

let queue: Queue<SynthesisJobData, SynthesisJobResult> | null = null;

function getQueue(): Queue<SynthesisJobData, SynthesisJobResult> {
  if (!queue) {
    queue = createSynthesisQueue();
  }
  return queue;
}

const asyncTtsBodySchema = {
  type: "object",
  required: ["text"],
  properties: {
    text: { type: "string", minLength: 1, maxLength: 5000 },
  },
} as const;

const jobAcceptedResponseSchema = {
  type: "object",
  properties: {
    jobId: { type: "string" },
    status: { type: "string" },
    statusUrl: { type: "string" },
  },
} as const;

const jobStatusResponseSchema = {
  type: "object",
  properties: {
    jobId: { type: "string" },
    status: { type: "string" },
    progress: { type: "number" },
    result: { type: "object", nullable: true },
    error: { type: "string", nullable: true },
    createdAt: { type: "number", nullable: true },
    processedAt: { type: "number", nullable: true },
    finishedAt: { type: "number", nullable: true },
  },
} as const;

export async function ttsAsyncRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/api/tts/async",
    {
      schema: {
        body: asyncTtsBodySchema,
        response: { 202: jobAcceptedResponseSchema },
      },
    },
    async (request: FastifyRequest<{ Body: { text: string } }>, reply: FastifyReply) => {
      const { text } = request.body;
      const requestId = randomUUID();

      const job = await getQueue().add("synthesize", { text, requestId }, { jobId: requestId });

      return reply.status(202).send({
        jobId: job.id,
        status: "queued",
        statusUrl: `/api/tts/status/${job.id}`,
      });
    }
  );

  fastify.get(
    "/api/tts/status/:jobId",
    {
      schema: {
        params: {
          type: "object",
          required: ["jobId"],
          properties: { jobId: { type: "string" } },
        },
        response: { 200: jobStatusResponseSchema },
      },
    },
    async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
      const { jobId } = request.params;
      const q = getQueue();
      const job = await q.getJob(jobId);

      if (!job) {
        return reply.status(404).send({
          error: { code: "not_found", message: `Job ${jobId} not found` },
        });
      }

      const state = await job.getState();

      const body: Record<string, unknown> = {
        jobId: job.id,
        status: state,
        progress: typeof job.progress === "number" ? job.progress : 0,
        result: null,
        error: null,
        createdAt: job.timestamp ?? null,
        processedAt: job.processedOn ?? null,
        finishedAt: job.finishedOn ?? null,
      };

      if (state === "completed") {
        body.result = job.returnvalue as SynthesisJobResult;
      }

      if (state === "failed") {
        body.error = job.failedReason ?? "Unknown error";
      }

      return reply.status(200).send(body);
    }
  );
}
