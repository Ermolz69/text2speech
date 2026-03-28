import Fastify from "fastify";
import type {
  AnalyzeRequestDto,
  AnalyzeResponseDto,
  AnalyzeSegmentDto,
  SynthesizeRequestDto,
  SynthesizeResponseDto,
} from "shared";

const port = Number(process.env.PORT_GATEWAY ?? 4000);

async function start() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: "gateway" }));

  app.post<{ Body: AnalyzeRequestDto; Reply: AnalyzeResponseDto }>(
    "/api/analyze",
    async (request) => {
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

  app.post<{ Body: SynthesizeRequestDto; Reply: SynthesizeResponseDto }>(
    "/api/tts",
    async (request) => {
      // Stubbed response for MVP scaffold
      return { audioUrl: "/placeholder.wav", metadata: request.body.metadata };
    }
  );

  await app.listen({ port, host: "0.0.0.0" });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
