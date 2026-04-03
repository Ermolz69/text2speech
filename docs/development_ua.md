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

## Workspace commands

From the repo root:

```bash
pnpm install
pnpm dev:web
pnpm dev:gateway
pnpm build
pnpm test
pnpm lint
```

## Docker note

The Docker setup now uses `healthcheck` sections for all services and waits on healthy dependencies instead of plain container start order.
For real synthesis in Docker, keep the Piper model in `models/piper/` so it is mounted into the `tts-adapter` container.
