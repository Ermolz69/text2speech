# Development Guide

## Передумови

Для поточного monorepo потрібні:

- Node.js 20+
- pnpm
- Python 3.11+
- Docker Desktop для docker-based запуску

## Важливе правило репозиторію

Використовуємо тільки `pnpm` для JavaScript/TypeScript workspace-команд.

## Швидкий старт через Docker

```bash
docker compose up --build
```

Після запуску доступні:

- web: `http://localhost:5173`
- gateway: `http://localhost:4000`
- text-analysis: `http://localhost:8001`
- tts-adapter: `http://localhost:8002`

## Локальні workspace-команди

З кореня репозиторію:

```bash
pnpm dev:web
pnpm dev:gateway
pnpm build
pnpm test
pnpm lint
```

## Команди окремих apps

### Web

```bash
pnpm --dir src/apps/web dev
pnpm --dir src/apps/web test
pnpm --dir src/apps/web build
```

### Gateway

```bash
pnpm --dir src/apps/gateway dev
pnpm --dir src/apps/gateway test
pnpm --dir src/apps/gateway build
```

## Python сервіси

### Text analysis

```bash
cd src/services/text-analysis
py -m pip install -e .[dev]
py -m pytest -q
py -m uvicorn app.main:app --reload --port 8001
```

### TTS adapter

```bash
cd src/services/tts-adapter
py -m pip install -e .[dev]
py -m pytest -q
py -m uvicorn app.main:app --reload --port 8002
```

## Рекомендована перевірка після змін

- для web/gateway/shared: відповідні `pnpm ... test` або `pnpm test`
- для Python сервісів: `py -m pytest -q` у відповідному каталозі
- для змін у документації/Postman: ручна звірка прикладів з поточним кодом endpoint-ів
