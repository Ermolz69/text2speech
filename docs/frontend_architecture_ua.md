# Frontend Architecture

## Поточний стек

Frontend знаходиться в `src/apps/web` і побудований на:

- React 18
- TypeScript
- Vite
- Tailwind CSS

## Поточний UI flow

Основний екран `HomePage`:

- показує форму синтезу
- виконує `POST /api/analyze` перед синтезом
- виконує `POST /api/tts` для отримання `audioUrl`
- показує summary по сегментах
- показує diagnostics panel із сегментами gateway-формату

## Основні UI блоки

### `SynthesisForm`

Форма містить:

- текст для синтезу
- `voiceId`
- режим `neutral | expressive`
- output format `mp3 | wav`

### `ResultPanel`

Показує:

- стан запиту
- summary emotion/intensity
- час генерації
- `audioUrl`

### `DiagnosticsPanel`

Показує gateway-shaped сегменти:

- `text`
- `emotion`
- `intensity`
- `pauseAfterMs`
- `emoji`
- `punctuation`

## API взаємодія frontend

Frontend не звертається напряму до Python сервісів.

Використовуються лише gateway routes:

- `GET /health`
- `POST /api/analyze`
- `POST /api/tts`

Базовий клієнт лежить у `src/apps/web/src/shared/api/gateway.ts`.

## Поточні обмеження frontend

- `voiceId` зараз вибирається з локального статичного списку
- `audioUrl` приходить як placeholder від поточного adapter implementation
- web не викликає `/api/tts/debug` окремо, але gateway endpoint існує для QA/debug flows
