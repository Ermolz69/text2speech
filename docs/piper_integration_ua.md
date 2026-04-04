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

`PiperSynthesisProvider` invokes the external Piper CLI with:

- `PIPER_BIN`
- `PIPER_MODEL_PATH`
- a generated output WAV path inside the adapter audio directory

The provider writes a real `.wav` file and returns:

- `audio_url`
- `received_segments`
- `total_pause_ms`

Generated files are exposed by `tts-adapter` under `/audio/<file>.wav`.

## Current Docker behavior

The `tts-adapter` Docker image now installs the Piper CLI through `piper-tts`.
That means the container already includes a working `piper` command.

For real synthesis in Docker, you still need to provide the voice model files.
The default compose setup mounts:

- `./models/piper` -> `/models/piper`

and expects:

- `/models/piper/model.onnx`

If your voice requires a companion config file, keep it in the same mounted directory.

## Current runtime constraint

The provider still calls Piper as a local process through `subprocess.run(...)`.
That means Piper must exist in the same runtime environment as `tts-adapter`.

Supported shapes today:

- `tts-adapter` local + Piper local
- `tts-adapter` in Docker + Piper bundled in that same container

Not supported by the current provider:

- `tts-adapter` local + Piper in a separate container as a remote service

That would require a different provider implementation that talks over the network instead of calling a local CLI binary.

## Runtime configuration

Main adapter environment variables:

- `PIPER_BIN`
- `PIPER_MODEL_PATH`
- `FFMPEG_BIN`
- `TTS_OUTPUT_DIR` for local or custom output placement

## Provider guidance

If we add another synthesis provider later, it should live in `app/providers/` behind the same provider boundary instead of adding conditional logic directly inside the `/synthesize` route handler.
