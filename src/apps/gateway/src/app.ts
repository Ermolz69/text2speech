import Fastify from "fastify";

const port = Number(process.env.PORT_GATEWAY ?? 4000);

async function start() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: "gateway" }));

  app.post("/api/tts", async () => {
    // Stubbed response for MVP scaffold
    return { status: "ok", audioUrl: "/placeholder.wav" };
  });

  await app.listen({ port, host: "0.0.0.0" });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
