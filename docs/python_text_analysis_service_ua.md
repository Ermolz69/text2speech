# Python Text Analysis Service

## Призначення

`src/services/text-analysis` — FastAPI сервіс, який перетворює сирий текст на segment metadata для synthesis pipeline.

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

Current internal response shape:

```json
{
  "segments": [
    {
      "text": "Hello! :)",
      "emotion": "happy",
      "intensity": 0.7,
      "pause_ms": 150,
      "rate": 1.1,
      "pitch_hint": 2.0,
      "cues": ["punctuation:exclamation", "emoji:positive"]
    },
    {
      "text": "How are you?",
      "emotion": "neutral",
      "intensity": 0.0,
      "pause_ms": 150,
      "rate": 1.0,
      "pitch_hint": 1.0,
      "cues": ["punctuation:question"]
    }
  ]
}
```

## Поточний pipeline

1. `normalizer.py`
   - прибирає whitespace noise
   - нормалізує unicode ellipsis
   - згортає repeated punctuation noise до базової форми
2. `segmenter.py`
   - розбиває текст на sentence-like segments
   - враховує `.` `!` `?` `...` і mixed punctuation
   - не ріже поширені скорочення
3. `signal_extractor.py`
   - збирає `emoji:*` та `punctuation:*` cues
   - підтримує mixed punctuation і repeated punctuation cues
4. `mapper.py`
   - мапить внутрішні емоції `neutral | happy | sad`
5. `planner.py`
   - обчислює `pause_ms`, `rate`, `pitch_hint`
6. `service.py`
   - збирає все у `AnalyzeResponse`

## Поточні emotion rules

- positive emoji/emoticon -> `happy`, `0.7`
- ellipsis -> `sad`, `0.4`
- punctuation-only cases -> `neutral`, `0.0`

## Важливе про інтеграцію з gateway

Gateway не віддає цей internal shape напряму в web.
Він мапить:

- `happy` -> `joy`
- `sad` -> `sadness`
- snake_case поля -> camelCase public DTO
- `cues` -> окремі масиви `emoji` і `punctuation`
