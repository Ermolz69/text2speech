# Emotional TTS

Emotion-aware text-to-speech monorepo with a React web app, a Fastify gateway, a Python text-analysis service, and a Python TTS adapter.

## Current status

The repository currently implements a working MVP pipeline with these characteristics:

- the web app sends requests to the gateway only;
- the gateway validates public payloads and orchestrates downstream services;
- the text-analysis service normalizes text, splits it into segments, extracts cues, maps a small internal emotion set, and plans prosody;
- the TTS adapter exposes a provider boundary and currently uses a Piper-backed placeholder provider implementation;
- `/api/tts/debug` returns gateway-shaped analysis metadata without synthesis;
- `/api/tts` runs the full gateway pipeline and currently returns a placeholder audio URL.

## Runtime topology

Default local ports from `docker-compose.yml`:

- web: `5173`
- gateway: `4000`
- text-analysis: `8001`
- tts-adapter: `8002`

Internal gateway dependencies:

- `TEXT_ANALYSIS_URL=http://text-analysis:8001`
- `TTS_ADAPTER_URL=http://tts-adapter:8002`

## Public API summary

### `GET /health`

Gateway health endpoint.

Response:

```json
{
  "status": "ok",
  "service": "gateway"
}
```

### `POST /api/analyze`

Validates `{ "text": string }` and returns gateway-shaped segment metadata.

Example request:

```json
{
  "text": "Hello! :) How are you?"
}
```

Example response:

```json
{
  "segments": [
    {
      "text": "Hello! :)",
      "emotion": "joy",
      "intensity": 3,
      "emoji": ["positive"],
      "punctuation": ["exclamation"],
      "pauseAfterMs": 150,
      "rate": 1.1,
      "pitchHint": 2
    },
    {
      "text": "How are you?",
      "emotion": "neutral",
      "intensity": 0,
      "punctuation": ["question"],
      "pauseAfterMs": 150,
      "rate": 1,
      "pitchHint": 1
    }
  ]
}
```

Notes:

- gateway labels are public DTO labels such as `neutral`, `joy`, and `sadness`;
- internal Python labels are different (`neutral`, `happy`, `sad`) and are mapped by the gateway client layer.

### `POST /api/tts/debug`

Runs the same analysis as `/api/analyze` and returns the same gateway-shaped metadata.

### `POST /api/tts`

Validates a synthesis request and runs the gateway pipeline.

Example request:

```json
{
  "text": "Hello! :) How are you?",
  "voiceId": "voice-1",
  "metadata": {
    "format": "wav"
  }
}
```

Current response shape:

```json
{
  "audioUrl": "/audio/generated-example.wav",
  "metadata": {
    "format": "wav",
    "segments": [
      {
        "text": "Hello! :)",
        "emotion": "joy",
        "intensity": 3,
        "emoji": ["positive"],
        "punctuation": ["exclamation"],
        "pauseAfterMs": 150,
        "rate": 1.1,
        "pitchHint": 2
      }
    ]
  }
}
```

Notes:

- `voiceId` is required by the public API, while the current adapter forwards analyzed segments to the Piper-backed TTS adapter;
- `metadata.format` accepts `wav`, `mp3`, or `ogg`;
- `metadata.emotion` accepts the public gateway labels: `neutral`, `joy`, `playful`, `sadness`, `anger`, `fear`, `surprise`;
- `metadata.intensity` accepts `0..3`.

## Internal services

### Text analysis service

FastAPI service at `src/services/text-analysis`.

Current internal pipeline:

1. normalize whitespace and punctuation noise;
2. split text into sentence-like segments;
3. extract emoji and punctuation cues;
4. map internal emotions (`neutral`, `happy`, `sad`);
5. compute prosody hints per segment.

Direct endpoint:

- `POST /analyze`
- response fields use snake_case: `pause_ms`, `pitch_hint`, `cues`
- internal emotion labels are `neutral`, `happy`, `sad`

### TTS adapter

FastAPI service at `src/services/tts-adapter`.

Current direct endpoint:

- `POST /synthesize`
- request body contains analyzed `segments`
- response currently returns:
  - `audio_url`
  - `received_segments`
  - `total_pause_ms`

The endpoint now delegates through a provider abstraction and the default Piper provider writes generated WAV files that are exposed under `/audio/<file>.wav`.

## Local development

### Docker

```bash
docker compose up --build
```

### Workspace commands

```bash
pnpm dev:web
pnpm dev:gateway
pnpm build
pnpm test
pnpm lint
```

### Python service tests

```bash
cd src/services/text-analysis
py -m pytest -q

cd ../tts-adapter
py -m pytest -q
```

## Documentation index

Supporting documentation lives in `docs/`:

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
