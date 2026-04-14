# Python Text Analysis Service

## Purpose

`src/services/text-analysis` is the FastAPI service that converts raw text into segment metadata for the synthesis pipeline.

## HTTP interface

### `GET /health`

```json
{
  "status": "ok",
  "service": "text-analysis"
}
```

### `POST /analyze`

Request:

```json
{
  "text": "Hello! :) How are you?"
}
```

Response now matches the shared DTO contract used by gateway and web:

```json
{
  "segments": [
    {
      "text": "Hello! :)",
      "emotion": "joy",
      "intensity": 2,
      "emoji": ["positive"],
      "punctuation": ["exclamation"],
      "pauseAfterMs": 150,
      "rate": 1.18,
      "pitchHint": 3.0
    },
    {
      "text": "How are you?",
      "emotion": "neutral",
      "intensity": 0,
      "punctuation": ["question"],
      "pauseAfterMs": 150,
      "rate": 1.0,
      "pitchHint": 1.0
    }
  ]
}
```

Important boundary rule:

- public HTTP payloads are camelCase and shared-shaped
- internal snake_case fields like `pause_ms`, `pitch_hint`, and raw `cues` stay inside the service only

## Internal pipeline

1. `normalizer.py`
   - removes whitespace noise
   - normalizes unicode ellipsis
   - collapses repeated punctuation noise before segmentation
2. `segmenter.py`
   - splits text into sentence-like segments
   - handles `.`, `!`, `?`, `...`, and mixed punctuation
3. `signal_extractor.py`
   - extracts `emoji:*` and `punctuation:*` internal cues
4. `mapper.py`
   - maps the internal emotion set `neutral | happy | sad`
5. `planner.py`
   - computes pause and prosody hints per segment
6. `service.py`
   - assembles the internal domain response
7. `app/http/contracts.py`
   - maps the internal response into the shared HTTP DTO shape

## Integration note

Gateway no longer has to translate the Python `/analyze` payload from snake_case into camelCase.
The text-analysis service now exposes the shared contract directly at the HTTP boundary.
