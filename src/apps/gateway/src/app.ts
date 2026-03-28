import Fastify, { type FastifyInstance } from "fastify";
import type {
  AnalyzeRequestDto,
  AnalyzeResponseDto,
  AnalyzeSegmentDto,
  ApiErrorDetail,
  ApiErrorResponse,
  SynthesizeRequestDto,
  SynthesizeResponseDto,
} from "shared";

const port = Number(process.env.PORT_GATEWAY ?? 4000);

type ValidationErrorShape = {
  instancePath?: string;
  keyword: string;
  message?: string;
  params: {
    missingProperty?: string;
  };
};

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
  code: ApiErrorResponse["error"]["code"];
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

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: true });

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
    async (request) => {
      if (request.headers["x-force-error"] === "1") {
        throw new Error("Forced test runtime error");
      }

      const segment: AnalyzeSegmentDto = {
        text: request.body.text.trim(),
        emotion: "joy",
        intensity: 2,
        punctuation: ["!"],
        pauseAfterMs: 120,
      };

      return { segments: [segment] };
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
