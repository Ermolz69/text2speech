# Piper Integration

## Поточний стан інтеграції

Piper більше не зашитий прямо в endpoint logic `tts-adapter`.

Зараз у сервісі є:

- `SynthesisProvider` protocol
- `SynthesisResult` data object
- `PiperSynthesisProvider` як поточна default implementation
- `get_synthesis_provider()` у FastAPI app layer

Це дає clean boundary між:

- HTTP endpoint logic
- provider selection
- provider-specific synthesis implementation

## Поточна реалізація provider

`PiperSynthesisProvider` зараз ще не викликає зовнішній Piper binary. Він повертає placeholder result на основі сегментів:

- `audio_url`
- `received_segments`
- `total_pause_ms`

Це навмисний проміжний стан:

- endpoint contract уже стабілізований
- інтеграційна точка для провайдерів уже існує
- реальна synthesis implementation може бути додана без переписування route handler

## Runtime configuration

У `docker-compose.yml` уже є env vars:

- `PIPER_BIN`
- `PIPER_MODEL_PATH`
- `FFMPEG_BIN`

На поточному етапі вони є частиною expected deployment shape, але ще не повністю використовуються runtime-кодом.

## Рекомендація для наступних провайдерів

Якщо додавати нового synthesis provider, робити це треба в `app/providers/` з тією самою boundary-моделлю, а не через умовну логіку всередині `/synthesize` handler.
