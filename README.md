# Emotional TTS

Local MVP for **emotion-aware text-to-speech** where expression is inferred from emoji, punctuation, and simple contextual text signals.

## Overview

This repository contains a prototype pipeline that:

- accepts text with emoji and punctuation cues;
- parses emotional signals from text;
- builds structured emotional metadata;
- synthesizes speech with **Piper**;
- compares neutral and expressive outputs;
- supports benchmarking against stronger references such as **ElevenLabs**.

## Status

**Roadmap / MVP planning + implementation setup**

## Pipeline

```text
text
  -> normalizer
  -> segmenter
  -> emoji/context parser
  -> emotion mapping
  -> prosody planning
  -> Piper TTS
  -> post-processing
  -> audio output + evaluation
```

## Core stack

- Frontend: React + TypeScript
- Gateway backend: TypeScript + Fastify
- Text analysis service: Python (FastAPI)
- TTS service: Piper (Python adapter + ffmpeg)
- Docker / Docker Compose

## Documentation

- [Roadmap (EN)](./roadmap.md)
- [Roadmap (RU)](./roadmap_RU.md)
- [Roadmap (UA)](./roadmap_UA.md)

## Planned structure

```text
project-root/
  src/
    apps/
      web/
      gateway/
    services/
      text-analysis/
      tts-adapter/
    shared/
  docs/
  benchmarks/
  reports/
  docker/
  postman/
  README.md
```

## MVP scope

Included:

- text input with emoji and punctuation;
- rule-based parsing;
- emotion mapping;
- segment-level metadata;
- local synthesis with Piper;
- basic objective and subjective evaluation.

Not included:

- training a new TTS model from scratch;
- full STT + TTS workflow;
- production-scale deployment;
- voice cloning as a primary goal.

## Quick start

```bash
git clone https://github.com/Ermolz69/text2speech.git
cd text2speech
docker compose up --build
```

Expected services:

- web app;
- gateway backend;
- text-analysis service;
- Piper TTS adapter service;

## Gateway upstream configuration

Gateway calls the text-analysis service through `TEXT_ANALYSIS_URL`. The current default in `docker-compose.yml` is `http://text-analysis:8001`, and gateway normalizes upstream timeouts and failures into its own shared API error envelope.

## Common API error response

Gateway and Python services now return the same top-level error JSON envelope for validation and runtime failures. The language-neutral source of truth lives in `src/shared/src/api-error.schema.json`.

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "status": 422,
    "path": "/api/analyze",
    "details": [
      {
        "location": "body.text",
        "message": "Field required",
        "code": "missing"
      }
    ]
  }
}
```

Runtime failures use the same envelope with `code: "internal_error"` and omit `details` when there are no structured validation issues.

## Benchmarking

Planned comparison levels:

1. Piper neutral vs Piper expressive pipeline
2. Piper vs ElevenLabs
3. Synthetic audio vs human reference audio

## Notes

- **Piper** is the main local synthesis engine.
- **librosa** is used for evaluation, not generation.
- **ElevenLabs** is used as a benchmark/reference, not as the base for the free local MVP.

## License

Add the project license here.
