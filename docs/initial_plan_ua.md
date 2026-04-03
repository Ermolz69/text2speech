# Поточний baseline замість стартового плану

Цей файл більше не описує гіпотетичний початок проєкту. Він фіксує, що вже реально імплементовано зараз.

## Уже є в репозиторії

- monorepo на `pnpm`
- React web app для запуску synthesis flow
- Fastify gateway з validation та upstream error normalization
- FastAPI text-analysis service з rule-based pipeline
- FastAPI tts-adapter з provider abstraction
- Postman collection для локальної перевірки gateway та internal endpoints
- docker-compose для всіх основних сервісів

## Поточний analysis baseline

Text-analysis зараз уже робить:

- normalize text
- segment text
- extract emoji/punctuation cues
- map internal emotions `neutral | happy | sad`
- build prosody hints per segment

## Поточний synthesis baseline

Synthesis pipeline зараз уже проходить через gateway і tts-adapter, але adapter поки повертає placeholder `audio_url`.

Це означає:

- integration boundaries вже є
- API flow уже тестується
- production-grade audio generation ще не завершена

## Що вважати наступними кроками

Наступні кроки мають спиратися на поточний код і roadmap, а не на історичні стартові припущення.
