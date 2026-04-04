# Startup Runbook

## Goal

This document is the authoritative launch guide for the current repository state.

If README, older notes, or historical assumptions disagree with this file, trust this file and the code.

## Recommended mode

The repository now supports two practical startup modes:

- full Docker startup, if you provide Piper model files in `models/piper`
- full local startup, if you prefer running every service on the host machine

## Verified voice models

The easiest known-good starting voices for this repo are:

- `en_US-lessac-medium`
  - model: [official download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx)
  - config: [official download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json)
- `en_US-amy-medium`
  - model: [official download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx)
  - config: [official download](https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json)

Recommended repo convention:

- copy the chosen model to `models/piper/model.onnx`
- copy the matching config to `models/piper/model.onnx.json`

Official voice catalog:

- [Piper voice downloads](https://tderflinger.github.io/piper-docs/about/voices/download/)
- [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)

## Docker-first startup

This is now the easiest shared setup.

### Prerequisites

Install these once:

- Docker Desktop
- a Piper voice model file at `models/piper/model.onnx`
- if your voice requires it, place the companion config file in the same directory

### Exact steps

1. Put the Piper model in `models/piper/`
2. From the repo root run:

```powershell
docker compose up -d --build
```

### Expected endpoints

- [http://localhost:5173](http://localhost:5173) -> web
- [http://localhost:4000/health](http://localhost:4000/health) -> gateway
- [http://localhost:8001/health](http://localhost:8001/health) -> text-analysis
- [http://localhost:8002/health](http://localhost:8002/health) -> tts-adapter
- [http://localhost:8002/health/ready](http://localhost:8002/health/ready) -> synthesis readiness

### Docker notes

- the `web` container now proxies `/api`, `/health`, and `/audio` correctly
- the compose file now uses real `healthcheck` sections for all 4 services
- the `gateway` image now builds and starts reliably in Docker
- the `tts-adapter` image now includes the Piper CLI through `piper-tts`
- the Piper model directory is mounted from `./models/piper` into `/models/piper`

### Verification commands

General stack smoke check:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke_check.ps1 -RequireSynthesisReady
```

Real audio generation check:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/synthesis_integration_check.ps1
```

## Local startup

Use local mode if you want direct control over Python and Node processes.

### Prerequisites

Install these once:

- Node.js 20+
- `pnpm`
- Python 3.11+
- Piper CLI binary
- a Piper model file such as `model.onnx`

### One-time setup

From the repo root:

```powershell
pnpm install
```

Text analysis service:

```powershell
Set-Location src/services/text-analysis
py -m pip install -e .[dev]
```

TTS adapter service:

```powershell
Set-Location ../tts-adapter
py -m pip install -e .[dev]
```

### Exact local startup order

Open 4 terminals from the repo root.

#### Terminal 1: text-analysis

```powershell
Set-Location src/services/text-analysis
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

#### Terminal 2: tts-adapter with Piper

```powershell
Set-Location src/services/tts-adapter
$env:PIPER_BIN='C:\path\to\piper.exe'
$env:PIPER_MODEL_PATH='C:\path\to\model.onnx'
$env:TTS_OUTPUT_DIR='E:\Academy of Mohyla\Course3_Stage2\MachineLearning\text2speech\src\services\tts-adapter\generated-audio'
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

#### Terminal 3: gateway

```powershell
Set-Location src/apps/gateway
$env:TEXT_ANALYSIS_URL='http://localhost:8001'
$env:TTS_ADAPTER_URL='http://localhost:8002'
$env:PORT_GATEWAY='4000'
pnpm dev
```

#### Terminal 4: web

```powershell
Set-Location src/apps/web
pnpm dev
```

In local dev, Vite proxies:

- `/api` -> `http://localhost:4000`
- `/health` -> `http://localhost:4000`
- `/audio` -> `http://localhost:8002`
