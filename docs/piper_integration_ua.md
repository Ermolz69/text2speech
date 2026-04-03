# Piper Integration

## Current state

Piper is no longer hardcoded into the `/synthesize` endpoint logic.

The `tts-adapter` service now has:

- `SynthesisProvider` as the provider boundary
- `SynthesisResult` as the provider result model
- `PiperSynthesisProvider` as the default runtime implementation
- `get_synthesis_provider()` in the FastAPI app layer

This keeps the boundary explicit between:

- HTTP endpoint handling
- provider selection
- provider-specific synthesis logic

## Runtime behavior

`PiperSynthesisProvider` now invokes the external Piper CLI with:

- `PIPER_BIN`
- `PIPER_MODEL_PATH`
- a generated output WAV path inside the adapter audio directory

The provider writes a real `.wav` file and returns:

- `audio_url`
- `received_segments`
- `total_pause_ms`

Generated files are exposed by `tts-adapter` under `/audio/<file>.wav`.

## Runtime configuration

`docker-compose.yml` already defines the main adapter environment variables:

- `PIPER_BIN`
- `PIPER_MODEL_PATH`
- `FFMPEG_BIN`

The adapter can also use `TTS_OUTPUT_DIR` to override where generated WAV files are stored.

## Provider guidance

If we add another synthesis provider later, it should live in `app/providers/` behind the same provider boundary instead of adding conditional logic directly inside the `/synthesize` route handler.
