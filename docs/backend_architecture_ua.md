# Backend Architecture

## Поточна схема

Система складається з трьох backend-компонентів:

- `gateway` (`src/apps/gateway`) — єдиний публічний HTTP entrypoint для web-клієнта
- `text-analysis` (`src/services/text-analysis`) — FastAPI сервіс сегментації, cue extraction, emotion mapping і prosody planning
- `tts-adapter` (`src/services/tts-adapter`) — FastAPI сервіс синтезу з provider boundary

Поточний запитний ланцюжок:

```text
web -> gateway -> text-analysis -> gateway -> tts-adapter
```

## Відповідальність gateway

Gateway:

- приймає публічні запити `/api/analyze`, `/api/tts/debug`, `/api/tts`
- валідовує вхідні payload-и через Fastify schema
- нормалізує upstream timeout/error responses у спільний error envelope
- мапить внутрішній Python response у public DTO для web
- запускає synthesis pipeline для `/api/tts`

Поточні публічні endpoint-и gateway:

- `GET /health`
- `POST /api/analyze`
- `POST /api/tts/debug`
- `POST /api/tts`

## Відповідальність text-analysis

Text-analysis зараз:

- приймає `POST /analyze`
- нормалізує текст
- ділить текст на сегменти
- витягує cue-сигнали (`emoji:*`, `punctuation:*`)
- мапить внутрішню емоцію (`neutral`, `happy`, `sad`)
- рахує `pause_ms`, `rate`, `pitch_hint`

Внутрішній response сервісу — segment list зі snake_case полями:

- `text`
- `emotion`
- `intensity`
- `pause_ms`
- `rate`
- `pitch_hint`
- `cues`

## Відповідальність tts-adapter

TTS adapter зараз:

- приймає `POST /synthesize`
- валідує сегменти synthesis payload-а
- делегує синтез через provider interface
- за замовчуванням використовує `PiperSynthesisProvider`
- повертає placeholder synthesis result

Поточний direct response сервісу:

- `audio_url`
- `received_segments`
- `total_pause_ms`

## Public vs internal contracts

Є два рівні контракту:

### Публічний gateway-контракт

Використовується web та Postman для `gateway`.

Поточні label-и емоцій у public DTO:

- `neutral`
- `joy`
- `playful`
- `sadness`
- `anger`
- `fear`
- `surprise`

### Внутрішній Python-контракт

Використовується між gateway та Python сервісами.

Поточні label-и text-analysis:

- `neutral`
- `happy`
- `sad`

Gateway має adapter-layer, який мапить внутрішні Python labels у public DTO labels.

## Error handling

Усі три backend-шари використовують сумісний envelope для validation/runtime помилок.

Типові коди:

- `validation_error`
- `internal_error`
- `upstream_timeout`
- `upstream_error`

## Поточні обмеження

- `tts-adapter` ще не виконує реальний Piper synthesis end-to-end і повертає placeholder audio URL
- ffmpeg та Piper env vars вже закладені в runtime-конфігурацію, але фактичний synthesis pipeline ще мінімальний
- public shared DTO історично ширший за поточний внутрішній emotion set text-analysis
