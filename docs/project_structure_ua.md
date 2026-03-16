# Структура проєкту Emotional TTS (monorepo)

Цей документ пояснює дерево директорій репозиторію, призначення основних папок і файлів, а також базові правила розміщення коду.

---

## 1. Огляд дерева директорій

Спрощена структура:

```text
project-root/
  src/
    apps/
      web/
      gateway/
    services/
      text-analysis/
      tts-adapter/
    shared/
  docs/
  docker/
  postman/
  benchmarks/
  reports/
  .github/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  docker-compose.yml
  .gitignore
  .dockerignore
  .editorconfig
  CONTRIBUTING.md
  CODE_OF_CONDUCT.md
  SECURITY.md
  SUPPORT.md
  README.md
```

---

## 2. Призначення верхньорівневих папок

### 2.1. `src/`

Уся прикладна логіка проєкту. Жоден сервіс чи застосунок **не** має жити в корені репозиторію.

Всередині:

- `src/apps/` — застосунки, що напряму взаємодіють із користувачем або зовнішніми клієнтами.
- `src/services/` — бекенд-сервіси, що виконують бізнес-логіку або інтеграції.
- `src/shared/` — спільні модулі для TypeScript (контракти, типи, утиліти).

### 2.2. `docs/`

Документація:

- high-level roadmap (EN/RU/UA — окремо);
- опис архітектури backend/frontend;
- опис Python text-analysis сервісу;
- інтеграція Piper/ffmpeg;
- dev guide та опис структури проєкту.

Документи в `docs/` мають збігатися з реальним станом репозиторію й оновлюватися разом зі змінами архітектури.

### 2.3. `docker/`

Dockerfile-и для окремих сервісів:

- `Dockerfile.web`
- `Dockerfile.gateway`
- `Dockerfile.text-analysis`
- `Dockerfile.tts-adapter`

Кожен образ орієнтований на запуск відповідного сервісу в `src/apps` або `src/services`.

### 2.4. `postman/`

Колекції Postman:

- базова колекція запитів до gateway (`/health`, `/api/tts` тощо);
- environment-файли для локального використання (`EmotionTTS.local.postman_environment.json`).

### 2.5. `benchmarks/`

Місце для:

- вхідних текстових корпусів для бенчмарків;
- скриптів запуску бенчмарків;
- конфігів порівнянь (Piper vs expressive pipeline, Piper vs ElevenLabs тощо).

### 2.6. `reports/`

Вихідні артефакти:

- результати бенчмарків;
- метрики, CSV/JSON-репорти;
- діагностичні звіти.

Зазвичай не містить файлів з кодом.

### 2.7. `.github/`

Конфігурація для GitHub:

- CI workflows (`ci.yml`, `docker-smoke.yml`);
- шаблони issue (`ISSUE_TEMPLATE/bug_report.md`, `ISSUE_TEMPLATE/feature_request.md`);
- шаблон pull request (`pull_request_template.md`).

---

## 3. Що має лежати в `src/apps`

`src/apps` — це «крайні точки» взаємодії із зовнішнім світом.

Поточні застосунки:

- `src/apps/web` — фронтенд (React + TypeScript, Vite):
  - `src/` — код застосунку;
  - `pages/`, `components/`, `services/` (API-клієнти до gateway), `types/`, `utils/`.

- `src/apps/gateway` — gateway backend (Fastify + TypeScript):
  - `src/app.ts` — точка входу;
  - `routes/` — HTTP-маршрути;
  - `controllers/` — приймання DTO та передача в services;
  - `services/` — orchestration (виклик text-analysis, tts-adapter);
  - `clients/` — HTTP-клієнти до Python-сервісів;
  - `schemas/` — DTO/validation-схеми;
  - `domain/` — типи, статуси задач, режими синтезу.

**Правило:** усе, що експонується назовні (UI чи HTTP API), належить до `apps`.

---

## 4. Що має лежати в `src/services`

`src/services` — бекенд-сервіси, що виконують бізнес-логіку, аналіз, синтез, постобробку тощо.

### 4.1. `src/services/text-analysis`

- Python FastAPI-сервіс:
  - `app/` — HTTP-шар (FastAPI entrypoint, маршрути);
  - `domain/` — моделі, правила, сервіси;
  - `core/` — нормалізатор, сегментатор, виділення сигналів, mapping емоцій;
  - `tests/` — unit та integration тести.

### 4.2. `src/services/tts-adapter`

- Python FastAPI-сервіс:
  - інтеграція з Piper (CLI);
  - ffmpeg-пайплайн (concat, normalize, convert);
  - маршрути для синтезу (`POST /synthesize`);
  - логіка роботи з файлами (`outputs/`).

**Правило:** сервіс у `src/services` не повинен знати про front-end безпосередньо; він працює з payload/metadata й повертає технічно придатні для gateway/інших сервісів відповіді.

---

## 5. Що має лежати в `src/shared`

`src/shared` — спільні модулі для TypeScript:

- типи DTO між web та gateway;
- загальні інтерфейси даних;
- shared helpers/утиліти, що не прив’язані до конкретного застосунку;
- (опційно) схеми, з яких можна генерувати JSON Schema для Python-сервісів.

**Не слід** класти сюди:

- Python-код;
- логіку, яка використовується тільки одним застосунком;
- тимчасові файли, експерименти.

---

## 6. Які файли мають бути в корені репозиторію і чому

Основні кореневі файли:

- `package.json` — опис monorepo, root-скрипти (lint, test, build, dev), dev-залежності (ESLint, Prettier, husky, тощо).
- `pnpm-workspace.yaml` — список workspace-пакетів (`src/apps/*`, `src/services/*`, `src/shared`).
- `tsconfig.base.json` — базова конфігурація TypeScript для всіх TS-пакетів.
- `docker-compose.yml` — єдиний entrypoint для запуску всього стеку через Docker.
- `.gitignore` — правило ігнорування артефактів (node_modules, dist, .venv, coverage, logs, тимчасові репорти).
- `.dockerignore` — правило ігнорування зайвих файлів під час збірки образів.
- `.editorconfig` — єдині правила форматування (відступи, кінець рядка, кодування).
- `README.md` — верхньорівневий опис проєкту, стек, швидкий старт.
- `CONTRIBUTING.md` — правила внеску.
- `CODE_OF_CONDUCT.md` — базові правила взаємодії.
- `SECURITY.md` — політика безпеки.
- `SUPPORT.md` — як отримати допомогу й куди писати.

**Правило:** корінь — місце для метаінформації, інфраструктурних конфігів і документації, а не для прикладного коду.

---

## 7. Підсумкові правила розміщення коду

Коротко:

- код застосунків → `src/apps/...`;
- код бекенд-сервісів → `src/services/...`;
- спільні TypeScript-модулі → `src/shared`;
- Dockerfile-и → `docker/`;
- документація → `docs/`;
- бенчмарки → `benchmarks/`;
- звіти → `reports/`;
- CI, шаблони issue/PR → `.github/`.

Якщо ви не впевнені, куди саме покласти новий модуль, краще спочатку подивитися приклади в існуючих модулях і за потреби створити невелике issue з пропозицією.

