# Backend Architecture

## Current topology

The backend consists of three main components:

- `gateway` (`src/apps/gateway`) as the only public HTTP entrypoint for the web app
- `text-analysis` (`src/services/text-analysis`) as the FastAPI service for segmentation, cue extraction, emotion mapping, and prosody planning
- `tts-adapter` (`src/services/tts-adapter`) as the FastAPI synthesis service with a provider boundary

Current request flow:

```text
web -> gateway -> text-analysis -> gateway -> tts-adapter
```

## Gateway responsibility

Gateway:

- accepts public requests on `/api/analyze`, `/api/tts/debug`, `/api/tts`, and `/api/audio/:filename`
- validates public payloads through Fastify schemas
- normalizes upstream timeout and failure responses into the shared error envelope
- orchestrates the synthesis pipeline
- exposes a stable public audio URL under `/api/audio/<file>.wav`

## Text-analysis responsibility

Text-analysis:

- accepts `POST /analyze`
- normalizes text
- splits text into segments
- extracts internal cue signals (`emoji:*`, `punctuation:*`)
- maps the internal emotion set (`neutral`, `happy`, `sad`)
- computes prosody hints
- maps the internal result into the shared camelCase HTTP contract

Public response fields from `/analyze` now match the shared DTO contract:

- `text`
- `emotion`
- `intensity`
- optional `emoji`
- optional `punctuation`
- optional `pauseAfterMs`
- optional `rate`
- optional `pitchHint`

Internal fields like `pause_ms`, `pitch_hint`, and raw `cues` remain private to the service.

## TTS adapter responsibility

TTS adapter:

- accepts `POST /synthesize`
- validates the shared synthesis request shape directly
- converts shared metadata segments into internal provider segments
- delegates synthesis through the provider interface
- exposes generated files under `/audio/<file>.wav`
- maps the internal provider result into the shared synthesis response shape

Public success payload from `/synthesize` now matches the shared DTO contract:

- `audioUrl`
- optional `metadata`
- optional `metricsUrl`

Internal provider-only fields like `audio_url`, `received_segments`, and `total_pause_ms` do not leak through the public HTTP boundary.

## Shared contract model

There is now one public wire contract across gateway, text-analysis, and tts-adapter:

- camelCase field names
- shared emotion labels from `src/shared/src/dto.ts`
- shared error envelope from `src/shared/src/error.ts`

Gateway still keeps only the transformations that are genuinely gateway-owned:

- orchestration
- stable public audio URL rewriting
- upstream timeout and failure mapping

## Error handling

All backend layers use the same error envelope shape:

- `validation_error`
- `internal_error`
- `upstream_timeout`
- `upstream_error`

## Current limits

- internal Python domain models still use service-specific representations where needed
- the alignment in this iteration is specifically at the public HTTP boundary
- long-term provider metrics remain optional and are not yet populated in the shared synthesis response
