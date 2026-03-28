import Fastify, { type FastifyInstance } from "fastify";
import type {
  AnalyzeRequestDto,
  AnalyzeResponseDto,
  ApiErrorDetail,
  ApiErrorResponse,
  SynthesizeRequestDto,
  SynthesizeResponseDto,
} from "shared";

import {
  createTextAnalysisClient,
  getTextAnalysisClientConfig,
  TextAnalysisClientError,
  type TextAnalysisClient,
} from "./textAnalysisClient";

const port = Number(process.env.PORT_GATEWAY ?? 4000);

type ValidationErrorShape = {
  instancePath?: string;
  keyword: string;
  message?: string;
  params: {
    missingProperty?: string;
  };
};

export interface AppDependencies {
  textAnalysisClient?: TextAnalysisClient;
}

const analyzeBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string", minLength: 1 },
  },
} as const;

const synthesizeBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "voiceId"],
  properties: {
    text: { type: "string", minLength: 1 },
    voiceId: { type: "string", minLength: 1 },
    metadata: { type: "object", nullable: true, additionalProperties: true },
  },
} as const;

function getRequestPath(url: string): string {
  return url.split("?")[0] || "/";
}

function getValidationLocation(error: ValidationErrorShape): string {
  const basePath = error.instancePath
    ? error.instancePath.split("/").filter(Boolean).join(".")
    : "body";

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

function mapTextAnalysisClientError(
  error: TextAnalysisClientError,
  path: string
): {
  status: number;
  response: ApiErrorResponse;
} {
  if (error.kind === "timeout") {
    return {
      status: 504,
      response: createApiErrorResponse({
        code: "upstream_timeout",
        message: "Text analysis service timed out",
        status: 504,
        path,
      }),
    };
  }

  return {
    status: 502,
    response: createApiErrorResponse({
      code: "upstream_error",
      message: "Text analysis service request failed",
      status: 502,
      path,
    }),
  };
}

export function createApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({ logger: true });
  const textAnalysisClient =
    dependencies.textAnalysisClient ?? createTextAnalysisClient(getTextAnalysisClientConfig());

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
          const mapped = mapTextAnalysisClientError(error, getRequestPath(request.url));
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
    async (request) => {
      if (request.headers["x-force-error"] === "1") {
        throw new Error("Forced test runtime error");
      }

      return { audioUrl: "/placeholder.wav", metadata: request.body.metadata };
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
