# Project Structure

## Актуальна структура монорепозиторію

```text
text2speech/
  docker/
  docs/
  postman/
  src/
    apps/
      gateway/
      web/
    services/
      text-analysis/
      tts-adapter/
    shared/
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  README.md
```

## Що де знаходиться

### `src/apps/web`

React/Vite frontend.

### `src/apps/gateway`

Fastify gateway із public HTTP API:

- `/health`
- `/api/analyze`
- `/api/tts/debug`
- `/api/tts`

### `src/services/text-analysis`

Python FastAPI service для аналізу тексту.

Ключові модулі:

- `app/domain/normalizer.py`
- `app/domain/segmenter.py`
- `app/domain/signal_extractor.py`
- `app/domain/mapper.py`
- `app/domain/planner.py`
- `app/domain/service.py`

### `src/services/tts-adapter`

Python FastAPI service для synthesis adapter logic.

Ключові модулі:

- `app/main.py`
- `app/models/segment.py`
- `app/providers/base.py`
- `app/providers/piper.py`

### `src/shared`

Public TypeScript DTOs та shared error schema, які використовують gateway і web.

## Артефакти для ручної перевірки

- `postman/EmotionTTS.postman_collection.json`
- `postman/EmotionTTS.local.postman_environment.json`

## Важливо

Roadmap-файли в `docs/ROADMAP/` не описують поточний runtime-стан і не повинні використовуватися як оперативна документація реалізації.
