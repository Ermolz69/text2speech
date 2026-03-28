import { z } from "zod";
import type { AnalyzeRequestDto, AnalyzeResponseDto, EmotionLabel } from "shared";

export interface TextAnalysisClient {
  analyze(payload: AnalyzeRequestDto): Promise<AnalyzeResponseDto>;
}

type FetchLike = typeof fetch;

type UpstreamEmotion = "neutral" | "happy" | "sad" | "angry" | "calm" | "excited" | "surprised";

const upstreamAnalyzeResponseSchema = z.object({
  segments: z.array(
    z.object({
      text: z.string().min(1),
      emotion: z.enum(["neutral", "happy", "sad", "angry", "calm", "excited", "surprised"]),
      intensity: z.number(),
      pause_ms: z.number().int().nonnegative(),
      rate: z.number().positive(),
      pitch_hint: z.number(),
      cues: z.array(z.string()),
    })
  ),
});

export type TextAnalysisClientErrorKind = "timeout" | "upstream";

export class TextAnalysisClientError extends Error {
  readonly kind: TextAnalysisClientErrorKind;
  cause?: unknown;

  constructor(kind: TextAnalysisClientErrorKind, message: string, cause?: unknown) {
    super(message);
    this.kind = kind;
    this.name = "TextAnalysisClientError";
    this.cause = cause;
  }
}

export interface TextAnalysisClientConfig {
  baseUrl: string;
  timeoutMs: number;
  fetchFn?: FetchLike;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function mapEmotion(emotion: UpstreamEmotion): EmotionLabel {
  switch (emotion) {
    case "happy":
    case "excited":
      return "joy";
    case "sad":
      return "sadness";
    case "angry":
      return "anger";
    case "surprised":
      return "surprise";
    case "calm":
    case "neutral":
    default:
      return "neutral";
  }
}

function mapIntensity(intensity: number): 0 | 1 | 2 | 3 {
  const clamped = Math.max(0, Math.min(1, intensity));

  if (clamped < 0.25) {
    return 0;
  }

  if (clamped < 0.5) {
    return 1;
  }

  if (clamped < 0.75) {
    return 2;
  }

  return 3;
}

function pickCueValues(cues: string[], prefix: string): string[] | undefined {
  const values = cues
    .filter((cue) => cue.startsWith(prefix))
    .map((cue) => cue.slice(prefix.length))
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

export function mapAnalyzeResponse(payload: unknown): AnalyzeResponseDto {
  const parsed = upstreamAnalyzeResponseSchema.parse(payload);

  return {
    segments: parsed.segments.map((segment) => ({
      text: segment.text,
      emotion: mapEmotion(segment.emotion),
      intensity: mapIntensity(segment.intensity),
      emoji: pickCueValues(segment.cues, "emoji:"),
      punctuation: pickCueValues(segment.cues, "punctuation:"),
      pauseAfterMs: segment.pause_ms,
    })),
  };
}

export function getTextAnalysisClientConfig(): TextAnalysisClientConfig {
  const rawTimeout = Number(process.env.TEXT_ANALYSIS_TIMEOUT_MS ?? 3000);

  return {
    baseUrl: process.env.TEXT_ANALYSIS_URL ?? "http://text-analysis:8001",
    timeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 3000,
  };
}

export function createTextAnalysisClient(config: TextAnalysisClientConfig): TextAnalysisClient {
  const fetchFn = config.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);

  return {
    async analyze(payload: AnalyzeRequestDto): Promise<AnalyzeResponseDto> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchFn(`${baseUrl}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new TextAnalysisClientError(
            "upstream",
            `Text analysis service responded with status ${response.status}`
          );
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch (error) {
          throw new TextAnalysisClientError(
            "upstream",
            "Text analysis service returned invalid JSON",
            error
          );
        }

        try {
          return mapAnalyzeResponse(body);
        } catch (error) {
          throw new TextAnalysisClientError(
            "upstream",
            "Text analysis service returned an unexpected payload",
            error
          );
        }
      } catch (error) {
        if (error instanceof TextAnalysisClientError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new TextAnalysisClientError(
            "timeout",
            "Text analysis service request timed out",
            error
          );
        }

        throw new TextAnalysisClientError(
          "upstream",
          "Text analysis service request failed",
          error instanceof Error ? error : undefined
        );
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
