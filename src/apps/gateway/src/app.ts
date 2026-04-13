import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type {
  AnalyzeRequestDto,
  AnalyzeResponseDto,
  ApiErrorDetail,
  ApiErrorResponse,
  EmotionLabel,
  SynthesizeRequestDto,
  SynthesizeResponseDto,
} from "shared";

import {
  createTextAnalysisClient,
  getTextAnalysisClientConfig,
  TextAnalysisClientError,
  type TextAnalysisClient,
} from "./textAnalysisClient.js";
import {
  createTtsAdapterClient,
  getTtsAdapterClientConfig,
  TtsAdapterClientError,
  type TtsAdapterClient,
} from "./ttsAdapterClient.js";

const port = Number(process.env.PORT_GATEWAY ?? 4000);
const nonBlankStringPattern = "\\S";
const requestIdHeaderName = "X-Request-Id";

const emotionLabels: EmotionLabel[] = [
  "neutral",
  "joy",
  "playful",
  "sadness",
  "anger",
  "fear",
  "surprise",
];

type ValidationErrorShape = {
  instancePath?: string;
  keyword: string;
  message?: string;
  params: {
    missingProperty?: string;
  };
};

type UpstreamClientErrorLike = {
  kind: "timeout" | "upstream";
};

type JsonSchema = {
  type: string;
  nullable?: boolean;
  additionalProperties?: boolean;
  required?: readonly string[];
  properties?: Record<string, unknown>;
  items?: unknown;
  enum?: readonly unknown[];
  minLength?: number;
  minimum?: number;
  pattern?: string;
};

export interface AppDependencies {
  textAnalysisClient?: TextAnalysisClient;
  ttsAdapterClient?: TtsAdapterClient;
}

const nonBlankStringSchema = {
  type: "string",
  minLength: 1,
  pattern: nonBlankStringPattern,
} as const;

const sharedMetadataSchema = {
  type: "object",
  nullable: true,
  additionalProperties: false,
  properties: {
    emotion: { type: "string", enum: emotionLabels },
    intensity: { type: "integer", enum: [0, 1, 2, 3] },
    format: { type: "string", enum: ["wav", "mp3", "ogg"] },
  },
} as const;

function createBodySchema(
  required: readonly string[],
  properties: Record<string, JsonSchema | typeof nonBlankStringSchema>
) {
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties,
  } as const;
}

const analyzeBodySchema = createBodySchema(["text"], {
  text: nonBlankStringSchema,
});

const synthesizeBodySchema = createBodySchema(["text", "voiceId"], {
  text: nonBlankStringSchema,
  voiceId: nonBlankStringSchema,
  metadata: sharedMetadataSchema,
});

function getRequestPath(url: string): string {
  return url.split("?")[0] || "/";
}

function getRequestId(request: FastifyRequest): string {
  const incoming = request.headers["x-request-id"];
  if (typeof incoming === "string" && incoming.trim().length > 0) {
    return incoming.trim();
  }
  return request.id;
}

function setRequestIdHeader(reply: FastifyReply, requestId: string): void {
  void reply.header(requestIdHeaderName, requestId);
}

function logStructuredEvent(
  request: FastifyRequest,
  input: {
    event: string;
    status?: number;
    upstream?: string;
    error_code?: string;
    segment_count?: number;
    audio_url?: string;
    filename?: string;
    duration_ms?: number;
  }
): void {
  request.log.info({
    service: "gateway",
    request_id: getRequestId(request),
    method: request.method,
    path: getRequestPath(request.url),
    event: input.event,
    ...(typeof input.status === "number" ? { status: input.status } : {}),
    ...(typeof input.duration_ms === "number" ? { duration_ms: input.duration_ms } : {}),
    ...(input.upstream ? { upstream: input.upstream } : {}),
    ...(input.error_code ? { error_code: input.error_code } : {}),
    ...(typeof input.segment_count === "number" ? { segment_count: input.segment_count } : {}),
    ...(input.audio_url ? { audio_url: input.audio_url } : {}),
    ...(input.filename ? { filename: input.filename } : {}),
  });
}

function getValidationLocation(error: ValidationErrorShape): string {
  const pathSegments = error.instancePath?.split("/").filter(Boolean) ?? [];
  const basePath = pathSegments.length > 0 ? `body.${pathSegments.join(".")}` : "body";

  if (error.keyword === "required" && typeof error.params.missingProperty === "string") {
    return `${basePath}.${error.params.missingProperty}`;
  }

  return basePath;
}

function mapValidationDetails(errors: ValidationErrorShape[]): ApiErrorDetail[] {
  return errors.map((error) => ({
    location: getValidationLocation(error),
    message: error.message ?? "Invalid request",
    code: error.keyword,
  }));
}

function createApiErrorResponse(input: {
  code: ApiErrorResponse["error"]["code"] | "upstream_timeout" | "upstream_error";
  message: string;
  status: number;
  path: string;
  details?: ApiErrorDetail[];
}): ApiErrorResponse {
  return {
    error: {
      code: input.code,
      message: input.message,
      status: input.status,
      path: input.path,
      ...(input.details && input.details.length > 0 ? { details: input.details } : {}),
    },
  };
}

function mapUpstreamClientError(
  error: UpstreamClientErrorLike,
  path: string,
  serviceName: string
): {
  status: number;
  response: ApiErrorResponse;
} {
  if (error.kind === "timeout") {
    return {
      status: 504,
      response: createApiErrorResponse({
        code: "upstream_timeout",
        message: `${serviceName} timed out`,
        status: 504,
        path,
      }),
    };
  }

  return {
    status: 502,
    response: createApiErrorResponse({
      code: "upstream_error",
      message: `${serviceName} request failed`,
      status: 502,
      path,
    }),
  };
}

function logTtsAdapterClientError(error: TtsAdapterClientError, log: FastifyInstance["log"]): void {
  if (error.kind === "timeout") {
    log.warn(
      {
        upstream: "tts-adapter",
        kind: error.kind,
        reason: error.reason,
      },
      error.message
    );
    return;
  }

  log.warn(
    {
      upstream: "tts-adapter",
      kind: error.kind,
      reason: error.reason,
      ...(typeof error.statusCode === "number" ? { statusCode: error.statusCode } : {}),
    },
    error.message
  );
}

function logTextAnalysisClientError(
  error: TextAnalysisClientError,
  log: FastifyInstance["log"]
): void {
  log.warn(
    {
      upstream: "text-analysis",
      kind: error.kind,
    },
    error.message
  );
}

function buildSynthesizePipelineRequest(
  requestBody: SynthesizeRequestDto,
  analyzeResponse: AnalyzeResponseDto
): SynthesizeRequestDto {
  return {
    text: requestBody.text,
    voiceId: requestBody.voiceId,
    metadata: {
      ...(requestBody.metadata?.format ? { format: requestBody.metadata.format } : {}),
      ...(requestBody.metadata?.emotion ? { emotion: requestBody.metadata.emotion } : {}),
      ...(typeof requestBody.metadata?.intensity === "number"
        ? { intensity: requestBody.metadata.intensity }
        : {}),
      segments: analyzeResponse.segments,
    },
  };
}

function extractAudioFilename(audioUrl: string): string | null {
  const match = /^\/audio\/([^/?#]+)$/.exec(audioUrl);
  return match?.[1] ?? null;
}

function toGatewayAudioUrl(audioUrl: string): string {
  const filename = extractAudioFilename(audioUrl);
  if (!filename) {
    throw new Error(`Unexpected adapter audio URL: ${audioUrl}`);
  }
  return `/api/audio/${filename}`;
}

export function createApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });
  const textAnalysisClient =
    dependencies.textAnalysisClient ?? createTextAnalysisClient(getTextAnalysisClientConfig());
  const ttsAdapterClient =
    dependencies.ttsAdapterClient ?? createTtsAdapterClient(getTtsAdapterClientConfig());

  app.addHook("onRequest", async (request, reply) => {
    const requestId = getRequestId(request);
    setRequestIdHeader(reply, requestId);
    logStructuredEvent(request, { event: "request_started" });
  });

  app.addHook("onResponse", async (request, reply) => {
    const durationMs = Number(reply.elapsedTime.toFixed(2));
    logStructuredEvent(request, {
      event: "request_finished",
      status: reply.statusCode,
      duration_ms: durationMs,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    setRequestIdHeader(reply, getRequestId(request));

    if (error.validation) {
      logStructuredEvent(request, {
        event: "validation_error",
        status: 422,
        error_code: "validation_error",
      });
      const response = createApiErrorResponse({
        code: "validation_error",
        message: "Request validation failed",
        status: 422,
        path: getRequestPath(request.url),
        details: mapValidationDetails(error.validation as ValidationErrorShape[]),
      });

      void reply.status(422).send(response);
      return;
    }

    request.log.error({
      service: "gateway",
      request_id: getRequestId(request),
      method: request.method,
      path: getRequestPath(request.url),
      event: "runtime_error",
      error_code: "internal_error",
      err: error,
    });

    const response = createApiErrorResponse({
      code: "internal_error",
      message: "Internal server error",
      status: 500,
      path: getRequestPath(request.url),
    });

    void reply.status(500).send(response);
  });

  app.get("/health", async () => ({ status: "ok", service: "gateway" }));

  app.post<{ Body: AnalyzeRequestDto; Reply: AnalyzeResponseDto | ApiErrorResponse }>(
    "/api/analyze",
    {
      schema: {
        body: analyzeBodySchema,
      },
    },
    async (request, reply) => {
      const requestId = getRequestId(request);
      try {
        logStructuredEvent(request, {
          event: "upstream_request_started",
          upstream: "text-analysis",
        });
        const response = await textAnalysisClient.analyze(request.body, { requestId });
        logStructuredEvent(request, {
          event: "analyze_completed",
          status: 200,
          segment_count: response.segments.length,
        });
        return response;
      } catch (error) {
        if (error instanceof TextAnalysisClientError) {
          logStructuredEvent(request, {
            event: "upstream_request_failed",
            upstream: "text-analysis",
            status: error.kind === "timeout" ? 504 : 502,
            error_code: error.kind === "timeout" ? "upstream_timeout" : "upstream_error",
          });
          const mapped = mapUpstreamClientError(
            error,
            getRequestPath(request.url),
            "Text analysis service"
          );
          return reply.status(mapped.status).send(mapped.response);
        }

        throw error;
      }
    }
  );

  app.post<{ Body: AnalyzeRequestDto; Reply: AnalyzeResponseDto | ApiErrorResponse }>(
    "/api/tts/debug",
    {
      schema: {
        body: analyzeBodySchema,
      },
    },
    async (request, reply) => {
      const requestId = getRequestId(request);
      try {
        logStructuredEvent(request, {
          event: "upstream_request_started",
          upstream: "text-analysis",
        });
        const response = await textAnalysisClient.analyze(request.body, { requestId });
        logStructuredEvent(request, {
          event: "tts_debug_completed",
          status: 200,
          segment_count: response.segments.length,
        });
        return response;
      } catch (error) {
        if (error instanceof TextAnalysisClientError) {
          logTextAnalysisClientError(error, request.log);
          logStructuredEvent(request, {
            event: "upstream_request_failed",
            upstream: "text-analysis",
            status: error.kind === "timeout" ? 504 : 502,
            error_code: error.kind === "timeout" ? "upstream_timeout" : "upstream_error",
          });
          const mapped = mapUpstreamClientError(
            error,
            getRequestPath(request.url),
            "Text analysis service"
          );
          return reply.status(mapped.status).send(mapped.response);
        }

        throw error;
      }
    }
  );

  app.post<{ Body: SynthesizeRequestDto; Reply: SynthesizeResponseDto | ApiErrorResponse }>(
    "/api/tts",
    {
      schema: {
        body: synthesizeBodySchema,
      },
    },
    async (request, reply) => {
      const requestId = getRequestId(request);
      let analyzeResponse: AnalyzeResponseDto;

      try {
        logStructuredEvent(request, {
          event: "upstream_request_started",
          upstream: "text-analysis",
        });
        analyzeResponse = await textAnalysisClient.analyze(
          { text: request.body.text },
          { requestId }
        );
        logStructuredEvent(request, {
          event: "analyze_completed",
          status: 200,
          segment_count: analyzeResponse.segments.length,
        });
      } catch (error) {
        if (error instanceof TextAnalysisClientError) {
          logTextAnalysisClientError(error, request.log);
          logStructuredEvent(request, {
            event: "upstream_request_failed",
            upstream: "text-analysis",
            status: error.kind === "timeout" ? 504 : 502,
            error_code: error.kind === "timeout" ? "upstream_timeout" : "upstream_error",
          });
          const mapped = mapUpstreamClientError(
            error,
            getRequestPath(request.url),
            "Text analysis service"
          );
          return reply.status(mapped.status).send(mapped.response);
        }

        throw error;
      }

      try {
        const synthesizeRequest = buildSynthesizePipelineRequest(request.body, analyzeResponse);
        logStructuredEvent(request, { event: "upstream_request_started", upstream: "tts-adapter" });
        const synthesisResponse = await ttsAdapterClient.synthesize(synthesizeRequest, {
          requestId,
        });
        const gatewayAudioUrl = toGatewayAudioUrl(synthesisResponse.audioUrl);
        logStructuredEvent(request, {
          event: "synthesize_completed",
          status: 200,
          segment_count: synthesizeRequest.metadata?.segments?.length,
          audio_url: gatewayAudioUrl,
          filename: extractAudioFilename(synthesisResponse.audioUrl) ?? undefined,
        });
        return {
          ...synthesisResponse,
          audioUrl: gatewayAudioUrl,
        };
      } catch (error) {
        if (error instanceof TtsAdapterClientError) {
          logTtsAdapterClientError(error, request.log);
          logStructuredEvent(request, {
            event: "upstream_request_failed",
            upstream: "tts-adapter",
            status: error.kind === "timeout" ? 504 : 502,
            error_code: error.kind === "timeout" ? "upstream_timeout" : "upstream_error",
          });
          const mapped = mapUpstreamClientError(
            error,
            getRequestPath(request.url),
            "TTS adapter service"
          );
          return reply.status(mapped.status).send(mapped.response);
        }

        throw error;
      }
    }
  );

  app.get<{ Params: { filename: string } }>("/api/audio/:filename", async (request, reply) => {
    const requestId = getRequestId(request);
    try {
      logStructuredEvent(request, {
        event: "upstream_request_started",
        upstream: "tts-adapter",
        filename: request.params.filename,
      });
      const audio = await ttsAdapterClient.fetchAudio(request.params.filename, { requestId });

      if (audio.contentType) {
        void reply.header("Content-Type", audio.contentType);
      }
      if (audio.contentDisposition) {
        void reply.header("Content-Disposition", audio.contentDisposition);
      }

      logStructuredEvent(request, {
        event: "audio_proxy_completed",
        status: 200,
        filename: request.params.filename,
      });
      return reply.send(audio.body);
    } catch (error) {
      if (error instanceof TtsAdapterClientError) {
        if (error.reason === "response_status" && error.statusCode === 404) {
          logStructuredEvent(request, {
            event: "audio_proxy_missing",
            status: 404,
            filename: request.params.filename,
            upstream: "tts-adapter",
            error_code: "upstream_error",
          });
          return reply.status(404).send(
            createApiErrorResponse({
              code: "upstream_error",
              message: "Audio file was not found",
              status: 404,
              path: getRequestPath(request.url),
            })
          );
        }

        logStructuredEvent(request, {
          event: "upstream_request_failed",
          upstream: "tts-adapter",
          status: error.kind === "timeout" ? 504 : 502,
          filename: request.params.filename,
          error_code: error.kind === "timeout" ? "upstream_timeout" : "upstream_error",
        });
        const mapped = mapUpstreamClientError(
          error,
          getRequestPath(request.url),
          "TTS adapter service"
        );
        return reply.status(mapped.status).send(mapped.response);
      }

      throw error;
    }
  });

  return app;
}

export async function start(): Promise<FastifyInstance> {
  const app = createApp();
  await app.listen({ port, host: "0.0.0.0" });
  return app;
}

if (process.env.NODE_ENV !== "test") {
  void start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
