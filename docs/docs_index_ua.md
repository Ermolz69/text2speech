# Documentation Index

This directory describes the current implementation state, not backlog or roadmap ideas.

## Core documents

- `startup_runbook_ua.md` - authoritative launch guide and exact supported startup modes
- `backend_architecture_ua.md` - current server-side architecture and roles of gateway, text-analysis, and tts-adapter
- `frontend_architecture_ua.md` - current web app structure and UI flow
- `python_text_analysis_service_ua.md` - internal contract and pipeline of the text-analysis service
- `piper_integration_ua.md` - provider boundary in tts-adapter and the current role of Piper
- `ffmpeg_pipeline_ua.md` - what is currently implemented around ffmpeg and what is still not implemented
- `development_ua.md` - workspace commands, tests, and links to the supported runbook
- `project_structure_ua.md` - current monorepo structure
- `initial_plan_ua.md` - short baseline snapshot instead of outdated startup assumptions

## Sources of truth

1. Code in `src/apps/*` and `src/services/*`
2. `docker-compose.yml`
3. `postman/EmotionTTS.postman_collection.json`
4. the documents in this directory

## What not to treat as current implementation truth

- any roadmap files
- historical backlog assumptions that are not confirmed by code
