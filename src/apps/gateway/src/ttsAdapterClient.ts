import { z } from "zod";
import type { SynthesizeRequestDto, SynthesizeResponseDto } from "shared";

export interface TtsAdapterClient {
  synthesize(
    payload: SynthesizeRequestDto,
    options?: { requestId?: string }
  ): Promise<SynthesizeResponseDto>;
  fetchAudio(filename: string, options?: { requestId?: string }): Promise<UpstreamAudioFile>;
}

type FetchLike = typeof fetch;

export interface UpstreamAudioFile {
  body: Buffer;
  contentType?: string;
  contentDisposition?: string;
}

const sharedEmotionSchema = z.enum([
  "neutral",
  "happy",
  "sad",
  "joy",
  "playful",
  "sadness",
  "anger",
  "fear",
  "surprise",
]);

const sharedAnalyzeSegmentSchema = z.object({
  text: z.string().min(1),
  emotion: sharedEmotionSchema,
  intensity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  emoji: z.array(z.string()).optional(),
  punctuation: z.array(z.string()).optional(),
  pauseAfterMs: z.number().int().nonnegative().optional(),
  rate: z.number().positive().optional(),
  pitchHint: z.number().optional(),
  stressedWords: z.array(z.string()).optional(),
});

const upstreamSynthesizeRequestSchema = z.object({
  text: z.string().min(1),
  voiceId: z.string().min(1),
  metadata: z
    .object({
      segments: z.array(sharedAnalyzeSegmentSchema).min(1).optional(),
      emotion: sharedEmotionSchema.optional(),
      intensity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
      format: z.enum(["wav", "mp3", "ogg"]).optional(),
    })
    .optional(),
});

const upstreamSynthesizeResponseSchema = z.object({
  audioUrl: z.string().min(1),
  metadata: z
    .object({
      segments: z.array(sharedAnalyzeSegmentSchema).optional(),
      emotion: sharedEmotionSchema.optional(),
      intensity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
      format: z.enum(["wav", "mp3", "ogg"]).optional(),
    })
    .optional(),
  metricsUrl: z.string().min(1).optional(),
});

export type TtsAdapterClientErrorKind = "timeout" | "upstream";
export type TtsAdapterClientFailureReason =
  | "timeout"
  | "network"
  | "response_status"
  | "invalid_json"
  | "invalid_payload";

export class TtsAdapterClientError extends Error {
  readonly kind: TtsAdapterClientErrorKind;
  readonly reason: TtsAdapterClientFailureReason;
  readonly statusCode?: number;
  cause?: unknown;

  constructor(
    kind: TtsAdapterClientErrorKind,
    reason: TtsAdapterClientFailureReason,
    message: string,
    options: {
      cause?: unknown;
      statusCode?: number;
    } = {}
  ) {
    super(message);
    this.kind = kind;
    this.reason = reason;
    this.name = "TtsAdapterClientError";
    this.cause = options.cause;
    this.statusCode = options.statusCode;
  }
}

export interface TtsAdapterClientConfig {
  baseUrl: string;
  timeoutMs: number;
  fetchFn?: FetchLike;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function mapSynthesizeRequest(payload: SynthesizeRequestDto): SynthesizeRequestDto {
  const parsed = upstreamSynthesizeRequestSchema.parse(payload);

  if (!parsed.metadata?.segments?.length) {
    throw new Error("Prepared synthesis segments are required");
  }

  return payload;
}

export function mapSynthesizeResponse(payload: unknown): SynthesizeResponseDto {
  return upstreamSynthesizeResponseSchema.parse(payload);
}

export function getTtsAdapterClientConfig(): TtsAdapterClientConfig {
  const rawTimeout = Number(process.env.TTS_ADAPTER_TIMEOUT_MS ?? 15000);

  return {
    baseUrl: process.env.TTS_ADAPTER_URL ?? "http://tts-adapter:8002",
    timeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 15000,
  };
}

export function createTtsAdapterClient(config: TtsAdapterClientConfig): TtsAdapterClient {
  const fetchFn = config.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);

  return {
    async synthesize(
      payload: SynthesizeRequestDto,
      options?: { requestId?: string }
    ): Promise<SynthesizeResponseDto> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchFn(`${baseUrl}/synthesize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(options?.requestId ? { "X-Request-Id": options.requestId } : {}),
          },
          body: JSON.stringify(mapSynthesizeRequest(payload)),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new TtsAdapterClientError(
            "upstream",
            "response_status",
            `TTS adapter service responded with status ${response.status}`,
            { statusCode: response.status }
          );
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch (error) {
          throw new TtsAdapterClientError(
            "upstream",
            "invalid_json",
            "TTS adapter service returned invalid JSON",
            { cause: error }
          );
        }

        try {
          return mapSynthesizeResponse(body);
        } catch (error) {
          throw new TtsAdapterClientError(
            "upstream",
            "invalid_payload",
            "TTS adapter service returned an unexpected payload",
            { cause: error }
          );
        }
      } catch (error) {
        if (error instanceof TtsAdapterClientError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new TtsAdapterClientError(
            "timeout",
            "timeout",
            "TTS adapter service request timed out",
            { cause: error }
          );
        }

        throw new TtsAdapterClientError(
          "upstream",
          "network",
          "TTS adapter service request failed",
          { cause: error instanceof Error ? error : undefined }
        );
      } finally {
        clearTimeout(timeoutId);
      }
    },
    async fetchAudio(
      filename: string,
      options?: { requestId?: string }
    ): Promise<UpstreamAudioFile> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchFn(`${baseUrl}/audio/${encodeURIComponent(filename)}`, {
          method: "GET",
          headers: {
            ...(options?.requestId ? { "X-Request-Id": options.requestId } : {}),
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new TtsAdapterClientError(
            "upstream",
            "response_status",
            `TTS adapter audio responded with status ${response.status}`,
            { statusCode: response.status }
          );
        }

        const body = Buffer.from(await response.arrayBuffer());

        return {
          body,
          contentType: response.headers.get("content-type") ?? undefined,
          contentDisposition: response.headers.get("content-disposition") ?? undefined,
        };
      } catch (error) {
        if (error instanceof TtsAdapterClientError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new TtsAdapterClientError(
            "timeout",
            "timeout",
            "TTS adapter audio request timed out",
            { cause: error }
          );
        }

        throw new TtsAdapterClientError("upstream", "network", "TTS adapter audio request failed", {
          cause: error instanceof Error ? error : undefined,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
