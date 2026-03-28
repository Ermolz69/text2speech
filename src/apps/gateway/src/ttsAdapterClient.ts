import { z } from "zod";
import type { AnalyzeSegmentDto, SynthesizeRequestDto, SynthesizeResponseDto } from "shared";

export interface TtsAdapterClient {
  synthesize(payload: SynthesizeRequestDto): Promise<SynthesizeResponseDto>;
}

type FetchLike = typeof fetch;

type UpstreamEmotion = "neutral" | "happy" | "sad" | "angry" | "calm" | "excited" | "surprised";

type UpstreamSynthesizeRequest = {
  segments: Array<{
    text: string;
    emotion: UpstreamEmotion;
    intensity: number;
    pause_ms: number;
    rate: number;
    pitch_hint: number;
    cues: string[];
  }>;
};

const upstreamSynthesizeResponseSchema = z.object({
  audio_url: z.string().min(1),
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

function mapEmotion(emotion: AnalyzeSegmentDto["emotion"]): UpstreamEmotion {
  switch (emotion) {
    case "joy":
      return "happy";
    case "playful":
      return "excited";
    case "sadness":
      return "sad";
    case "anger":
      return "angry";
    case "surprise":
      return "surprised";
    case "fear":
      return "neutral";
    case "neutral":
    default:
      return "neutral";
  }
}

function mapIntensity(intensity: AnalyzeSegmentDto["intensity"]): number {
  return intensity / 3;
}

function toCueValues(values: string[] | undefined, prefix: string): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return values.map((value) => `${prefix}${value}`);
}

export function mapSynthesizeRequest(payload: SynthesizeRequestDto): UpstreamSynthesizeRequest {
  const segments = payload.metadata?.segments;

  if (!segments || segments.length === 0) {
    throw new Error("Prepared synthesis segments are required");
  }

  return {
    segments: segments.map((segment) => ({
      text: segment.text,
      emotion: mapEmotion(segment.emotion),
      intensity: mapIntensity(segment.intensity),
      pause_ms: segment.pauseAfterMs ?? 0,
      rate: 1,
      pitch_hint: 0,
      cues: [
        ...toCueValues(segment.emoji, "emoji:"),
        ...toCueValues(segment.punctuation, "punctuation:"),
      ],
    })),
  };
}

export function mapSynthesizeResponse(
  payload: unknown,
  requestMetadata: SynthesizeRequestDto["metadata"]
): SynthesizeResponseDto {
  const parsed = upstreamSynthesizeResponseSchema.parse(payload);

  return {
    audioUrl: parsed.audio_url,
    ...(requestMetadata ? { metadata: requestMetadata } : {}),
  };
}

export function getTtsAdapterClientConfig(): TtsAdapterClientConfig {
  const rawTimeout = Number(process.env.TTS_ADAPTER_TIMEOUT_MS ?? 3000);

  return {
    baseUrl: process.env.TTS_ADAPTER_URL ?? "http://tts-adapter:8002",
    timeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 3000,
  };
}

export function createTtsAdapterClient(config: TtsAdapterClientConfig): TtsAdapterClient {
  const fetchFn = config.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);

  return {
    async synthesize(payload: SynthesizeRequestDto): Promise<SynthesizeResponseDto> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchFn(`${baseUrl}/synthesize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
          return mapSynthesizeResponse(body, payload.metadata);
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
  };
}
