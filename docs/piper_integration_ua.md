# Piper Integration

## Current state

Piper is not hardcoded into the `/synthesize` endpoint logic.

The `tts-adapter` service now has:

- `SynthesisProvider` as the provider boundary
- `SynthesisResult` as the provider result model
- `PiperSynthesisProvider` as the default runtime implementation
- `get_synthesis_provider()` in the FastAPI app layer
- a shared HTTP boundary contract in `app/http/contracts.py`

This keeps the boundary explicit between:

- HTTP endpoint handling
- shared DTO validation
- provider selection
- provider-specific synthesis logic

## Runtime behavior

`PiperSynthesisProvider` invokes the external Piper CLI with:

- `PIPER_BIN`
- `PIPER_MODEL_PATH`
- a generated output WAV path inside the adapter audio directory

The provider writes a real `.wav` file and returns an internal result with:

- `audio_url`
- `received_segments`
- `total_pause_ms`

The FastAPI boundary maps that internal result into the shared HTTP response shape:

- `audioUrl`
- optional `metadata`
- optional `metricsUrl`

Generated files are exposed by `tts-adapter` under `/audio/<file>.wav`.

## Shared request shape

`POST /synthesize` now validates the shared contract directly:

```json
{
  "text": "Hello! :)",
  "voiceId": "voice-1",
  "metadata": {
    "format": "wav",
    "segments": [
      {
        "text": "Hello! :)",
        "emotion": "joy",
        "intensity": 2,
        "emoji": ["positive"],
        "punctuation": ["exclamation"],
        "pauseAfterMs": 250,
        "rate": 1.18,
        "pitchHint": 3.0
      }
    ]
  }
}
```

Internal snake_case synthesis fields remain provider-only and are not part of the public HTTP contract.

## Current Docker behavior

The `tts-adapter` Docker image installs the Piper CLI through `piper-tts`.
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
