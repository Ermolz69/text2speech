# Emotional TTS

Emotion-aware text-to-speech monorepo with a React web app, a Fastify gateway, a Python text-analysis service, and a Python TTS adapter.

## Current status

The repository currently implements a working MVP pipeline with these characteristics:

- the web app sends requests to the gateway only;
- the gateway validates public payloads and orchestrates downstream services;
- the text-analysis service normalizes text, splits it into segments, extracts cues, maps a small internal emotion set, and plans prosody;
- the text-analysis and tts-adapter HTTP boundaries now validate shared camelCase DTOs directly;
- the TTS adapter exposes a provider boundary and the default provider invokes Piper CLI to generate a real WAV file;
- `/api/tts/debug` returns gateway-shaped analysis metadata without synthesis;
- `/api/tts` runs the full gateway pipeline and returns a gateway-owned `audioUrl` under `/api/audio/<file>.wav`.

## Read this first

For the exact supported startup flow, use:

- `docs/startup_runbook_ua.md`

That file is the authoritative launch guide for the current repo state.

## Quick start

### Docker

1. Put your Piper voice model in `models/piper/model.onnx`
2. Put the matching config in `models/piper/model.onnx.json`
3. Copy `.env.example` to `.env` if you want to override ports, upstream URLs, timeouts, or the TTS output directory.
4. Run:

```bash
docker compose up -d --build
powershell -ExecutionPolicy Bypass -File scripts/smoke_check.ps1 -RequireSynthesisReady
powershell -ExecutionPolicy Bypass -File scripts/synthesis_integration_check.ps1
```

Generated WAV files are persisted on the host under:

- `src/services/tts-adapter/generated-audio`

They survive `docker compose down` / `up` because the directory is bind-mounted into the `tts-adapter` container.

### Verified starting voices

- `en_US-lessac-medium`
- `en_US-amy-medium`

Official source list:

- [Piper voice downloads](https://tderflinger.github.io/piper-docs/about/voices/download/)
- [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)

### Local

Use the detailed runbook if you want all services on the host machine instead.

Important environment examples now live in:

- `.env.example`

That file includes the currently used variables for:

- shared ports
- gateway upstream URLs and timeouts
- Piper/ffmpeg paths
- local TTS output placement

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

Validates `{ "text": string }` and returns shared segment metadata in camelCase:

- `text`
- `emotion`
- `intensity`
- optional `emoji`
- optional `punctuation`
- optional `pauseAfterMs`
- optional `rate`
- optional `pitchHint`

### `POST /api/tts/debug`

Runs the same analysis as `/api/analyze` and returns the same shared metadata.

### `POST /api/tts`

Validates a synthesis request with the shared shape:

- `text`
- `voiceId`
- optional `metadata`
- `metadata.segments` in the same shared segment format

The resulting `audioUrl` is a stable gateway URL that points to a real downloadable WAV when the Piper model is present.

## Internal services

### Text analysis service

FastAPI service at `src/services/text-analysis`.

Current internal pipeline:

1. normalize whitespace and punctuation noise;
2. split text into sentence-like segments;
3. extract emoji and punctuation cues;
4. map internal emotions (`neutral`, `happy`, `sad`);
5. compute prosody hints per segment.

The public HTTP response already converts that internal state into the shared DTO shape.

### TTS adapter

FastAPI service at `src/services/tts-adapter`.

Current direct endpoints:

- `POST /synthesize`
- `GET /health`
- `GET /health/ready`
- `GET /audio/<file>.wav`

The adapter validates the shared synthesis request shape, maps it into internal segment metadata for the provider, and returns a shared synthesis response with `audioUrl`.

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
pnpm coverage
```

Useful coverage commands:

```bash
pnpm coverage
pnpm coverage:web
pnpm coverage:gateway
powershell -ExecutionPolicy Bypass -File scripts/coverage_check.ps1
```

CI now publishes coverage artifacts and appends a per-service coverage summary directly into the GitHub Actions job summary.

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
