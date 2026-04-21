import { z } from "zod";
import type { AnalyzeRequestDto, AnalyzeResponseDto, EmotionLabel } from "shared";

export interface TextAnalysisClient {
  analyze(
    payload: AnalyzeRequestDto,
    options?: { requestId?: string }
  ): Promise<AnalyzeResponseDto>;
}

type FetchLike = typeof fetch;

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

const upstreamAnalyzeResponseSchema = z.object({
  segments: z.array(
    z.object({
      text: z.string().min(1),
      emotion: sharedEmotionSchema,
      intensity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
      emoji: z.array(z.string()).optional(),
      punctuation: z.array(z.string()).optional(),
      pauseAfterMs: z.number().int().nonnegative().optional(),
      rate: z.number().positive().optional(),
      pitchHint: z.number().optional(),
      stressedWords: z.array(z.string()).optional(),
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

export function mapAnalyzeResponse(payload: unknown): AnalyzeResponseDto {
  const parsed = upstreamAnalyzeResponseSchema.parse(payload);

  return {
    segments: parsed.segments.map((segment) => ({
      text: segment.text,
      emotion: segment.emotion as EmotionLabel,
      intensity: segment.intensity,
      ...(segment.emoji ? { emoji: segment.emoji } : {}),
      ...(segment.punctuation ? { punctuation: segment.punctuation } : {}),
      ...(typeof segment.pauseAfterMs === "number" ? { pauseAfterMs: segment.pauseAfterMs } : {}),
      ...(typeof segment.rate === "number" ? { rate: segment.rate } : {}),
      ...(typeof segment.pitchHint === "number" ? { pitchHint: segment.pitchHint } : {}),
      ...(segment.stressedWords ? { stressedWords: segment.stressedWords } : {}),
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
    async analyze(
      payload: AnalyzeRequestDto,
      options?: { requestId?: string }
    ): Promise<AnalyzeResponseDto> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetchFn(`${baseUrl}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(options?.requestId ? { "X-Request-Id": options.requestId } : {}),
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
