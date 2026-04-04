import Fastify, { type FastifyInstance } from "fastify";
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

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
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

    request.log.error(error);

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
      try {
        return await textAnalysisClient.analyze(request.body);
      } catch (error) {
        if (error instanceof TextAnalysisClientError) {
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
      try {
        return await textAnalysisClient.analyze(request.body);
      } catch (error) {
        if (error instanceof TextAnalysisClientError) {
          logTextAnalysisClientError(error, request.log);
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
      let analyzeResponse: AnalyzeResponseDto;

      try {
        analyzeResponse = await textAnalysisClient.analyze({ text: request.body.text });
      } catch (error) {
        if (error instanceof TextAnalysisClientError) {
          logTextAnalysisClientError(error, request.log);
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
        return await ttsAdapterClient.synthesize(synthesizeRequest);
      } catch (error) {
        if (error instanceof TtsAdapterClientError) {
          logTtsAdapterClientError(error, request.log);
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
