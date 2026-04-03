# Індекс документації

Цей каталог описує поточний стан реалізації, а не backlog або roadmap.

## Основні документи

- `backend_architecture_ua.md` — поточна серверна архітектура, ролі gateway, text-analysis та tts-adapter
- `frontend_architecture_ua.md` — структура web-додатка і поточний UI flow
- `python_text_analysis_service_ua.md` — внутрішній контракт і пайплайн сервісу аналізу тексту
- `piper_integration_ua.md` — provider boundary у tts-adapter і поточна роль Piper provider
- `ffmpeg_pipeline_ua.md` — що реально є зараз навколо ffmpeg і що поки не реалізовано
- `development_ua.md` — локальний запуск, тести, docker і робочі команди
- `project_structure_ua.md` — актуальна структура monorepo
- `initial_plan_ua.md` — коротка фіксація поточного baseline замість застарілого стартового опису

## Що вважати джерелом правди

1. Код у `src/apps/*` та `src/services/*`
2. `docker-compose.yml`
3. `postman/EmotionTTS.postman_collection.json`
4. Документи з цього каталогу

## Що не використовувати як джерело поточної реалізації

- будь-які `roadmap` файли
- історичні припущення з backlog, якщо вони не підтверджені кодом
