# Emotional TTS

Emotion-aware text-to-speech monorepo with a React web app, a Fastify gateway, a Python text-analysis service, and a Python TTS adapter.

## Current status

The repository currently implements a working MVP pipeline with these characteristics:

- the web app sends requests to the gateway only;
- the gateway validates public payloads and orchestrates downstream services;
- the text-analysis service normalizes text, splits it into segments, extracts cues, maps a small internal emotion set, and plans prosody;
- the TTS adapter exposes a provider boundary and the default provider invokes Piper CLI to generate a real WAV file;
- `/api/tts/debug` returns gateway-shaped analysis metadata without synthesis;
- `/api/tts` runs the full gateway pipeline and returns `audioUrl` from the adapter.

## Read this first

For the exact supported startup flow, use:

- `docs/startup_runbook_ua.md`

That file is the authoritative launch guide for the current repo state.

## Quick start

### Docker

1. Put your Piper voice model in `models/piper/model.onnx`
2. Put the matching config in `models/piper/model.onnx.json`
3. Run:

```bash
docker compose up -d --build
powershell -ExecutionPolicy Bypass -File scripts/smoke_check.ps1 -RequireSynthesisReady
powershell -ExecutionPolicy Bypass -File scripts/synthesis_integration_check.ps1
```

### Verified starting voices

- `en_US-lessac-medium`
- `en_US-amy-medium`

Official source list:

- [Piper voice downloads](https://tderflinger.github.io/piper-docs/about/voices/download/)
- [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)

### Local

Use the detailed runbook if you want all services on the host machine instead.

## Runtime topology

Default local ports from `docker-compose.yml`:

- web: `5173`
- gateway: `4000`
- text-analysis: `8001`
- tts-adapter: `8002`

## Public API summary

### `GET /health`

Gateway health endpoint.

### `POST /api/analyze`

Validates `{ "text": string }` and returns gateway-shaped segment metadata.

### `POST /api/tts/debug`

Runs the same analysis as `/api/analyze` and returns the same gateway-shaped metadata.

### `POST /api/tts`

Validates a synthesis request and runs the gateway pipeline.

The resulting `audioUrl` now points to a real downloadable WAV when the Piper model is present.

## Internal services

### Text analysis service

FastAPI service at `src/services/text-analysis`.

Current internal pipeline:

1. normalize whitespace and punctuation noise;
2. split text into sentence-like segments;
3. extract emoji and punctuation cues;
4. map internal emotions (`neutral`, `happy`, `sad`);
5. compute prosody hints per segment.

### TTS adapter

FastAPI service at `src/services/tts-adapter`.

Current direct endpoint:

- `POST /synthesize`
- `GET /health`
- `GET /health/ready`

The endpoint delegates through a provider abstraction and the default Piper provider writes generated WAV files that are exposed under `/audio/<file>.wav`.

## Local development

Use `docs/startup_runbook_ua.md` for the exact startup sequence.

Useful workspace commands:

```bash
pnpm install
pnpm dev:web
pnpm dev:gateway
pnpm build
pnpm test
pnpm lint
```

## Documentation index

Supporting documentation lives in `docs/`:

- `docs/startup_runbook_ua.md`
- `docs/docs_index_ua.md`
- `docs/backend_architecture_ua.md`
- `docs/frontend_architecture_ua.md`
- `docs/python_text_analysis_service_ua.md`
- `docs/piper_integration_ua.md`
- `docs/ffmpeg_pipeline_ua.md`
- `docs/development_ua.md`
- `docs/project_structure_ua.md`
- `docs/initial_plan_ua.md`

Roadmap files remain separate and are intentionally not used as implementation truth.
