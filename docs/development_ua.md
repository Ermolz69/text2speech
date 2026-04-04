# Development Guide

## Prerequisites

For the current monorepo state you need:

- Node.js 20+
- `pnpm`
- Python 3.11+
- Docker Desktop for container startup
- Piper model files for real synthesis

## Important repo rule

Use only `pnpm` for JavaScript and TypeScript workspace commands.

## Authoritative startup guide

Use [`startup_runbook_ua.md`](./startup_runbook_ua.md) as the source of truth for launch instructions.

## Current recommended startup

Recommended default:

- put the Piper model in `models/piper/model.onnx`
- put the matching config in `models/piper/model.onnx.json`
- run `docker compose up -d --build`
- run `scripts/smoke_check.ps1 -RequireSynthesisReady`
- run `scripts/synthesis_integration_check.ps1`

## Verification commands

General stack readiness:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke_check.ps1 -RequireSynthesisReady
```

Real audio generation:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/synthesis_integration_check.ps1
```

Coverage across the tested services:

```powershell
pnpm coverage
```

If you want to run only one part:

```powershell
pnpm coverage:web
pnpm coverage:gateway
py -m pytest -q --cov=app --cov-report=term-missing --cov-report=json:coverage/coverage.json --cov-report=html:coverage/html
```

## Workspace commands

From the repo root:

```bash
pnpm install
pnpm dev:web
pnpm dev:gateway
pnpm build
pnpm test
pnpm lint
pnpm coverage
```

## CI coverage

The main CI workflow now:

- runs coverage for `web`, `gateway`, `text-analysis`, and `tts-adapter`
- uploads each coverage directory as an artifact
- writes a compact per-service coverage table into the GitHub Actions job summary

## Docker note

The Docker setup now uses `healthcheck` sections for all services and waits on healthy dependencies instead of plain container start order.
For real synthesis in Docker, keep the Piper model in `models/piper/` so it is mounted into the `tts-adapter` container.
