# Dev guide для monorepo Emotional TTS

Цей документ пояснює, як влаштований поточний каркас monorepo, як локально запускати сервіси, як рухається запит через систему та як додавати новий код, не ламаючи структуру.

---

## 1. Короткий огляд архітектури

Проєкт — це локальний MVP **emotion-aware text-to-speech**, побудований як monorepo.

Основні компоненти:

- **Web** (`src/apps/web`) — React + TypeScript фронтенд (Vite).
- **Gateway** (`src/apps/gateway`) — Fastify + TypeScript backend, єдина публічна точка входу.
- **Text-analysis** (`src/services/text-analysis`) — Python FastAPI сервіс, який аналізує текст і будує emotional metadata.
- **TTS-adapter** (`src/services/tts-adapter`) — Python FastAPI сервіс, що обгортає Piper + ffmpeg, відповідає за синтез і постобробку.
- **Shared** (`src/shared`) — спільні контракти/типи/утиліти для TypeScript-коду.

Додаткові папки:

- `docs/` — документація (архітектура, dev guide, структури модулів).
- `docker/` — Dockerfile-и для кожного сервісу.
- `postman/` — колекції для ручного тестування.
- `benchmarks/` — вхідні дані, скрипти для бенчмарків.
- `reports/` — результати бенчмарків і звіти.

---

## 2. Як локально розгорнути monorepo

### 2.1. Встановити залежності

У корені:

```bash
corepack enable
pnpm install
```

Python-сервіси:

```bash
cd src/services/text-analysis
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cd ../../tts-adapter
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### 2.2. Запустити сервіси окремо

Web:

```bash
pnpm --dir src/apps/web dev
```

Gateway:

```bash
pnpm --dir src/apps/gateway dev
```

Text-analysis:

```bash
cd src/services/text-analysis
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

TTS-adapter:

```bash
cd src/services/tts-adapter
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

### 2.3. Запуск через Docker Compose

```bash
docker compose up --build
```

Це підніме всі основні сервіси в одному середовищі.

---

## 3. Як рухається запит через систему

Спрощений потік:

```text
web (React UI)
  -> gateway (Fastify)
    -> text-analysis (Python)
      -> metadata + synthesis hints
    -> tts-adapter (Python + Piper + ffmpeg)
      -> raw audio segments + final audio
  -> відповідь у web з посиланням на аудіо + службовими даними
```

### 3.1. Web

- рендерить форму вводу тексту;
- дозволяє обрати голос/режим;
- викликає gateway API (`POST /api/tts` або аналогічний endpoint);
- показує статус запиту;
- відтворює отримане аудіо.

### 3.2. Gateway

- приймає HTTP-запит;
- валідовує вхідні дані (через схеми в `src/apps/gateway/src/schemas`);
- викликає text-analysis сервіс;
- отримує metadata + hints;
- передає сегменти й hints у tts-adapter;
- збирає результат (шлях до аудіо, технічні дані);
- повертає відповідь на фронтенд.

### 3.3. Text-analysis service

- отримує текст;
- нормалізує, сегментує;
- виділяє емоційні сигнали (емодзі, пунктуація, модифікатори);
- призначає emotion labels та intensities;
- формує synthesis hints (паузи, акценти тощо);
- повертає структуровані metadata.

### 3.4. TTS-adapter service

- приймає текстові сегменти та hints;
- викликає Piper (через CLI);
- отримує WAV-сегменти;
- передає їх у ffmpeg-пайплайн для склеювання, нормалізації та конвертації;
- повертає шлях до фінального файлу.

---

## 4. Зони відповідальності модулів

- **Web**:
  - UI, стан форми;
  - виклики до gateway API;
  - відображення результатів;
  - **не** містить parser logic і бізнес-правил емоцій.

- **Gateway**:
  - HTTP API, валідація DTO;
  - orchestration між сервісами;
  - централізована обробка помилок;
  - **не** реалізує правила emoji-to-emotion, **не** працює з Piper напряму.

- **Text-analysis**:
  - робота з текстом, сегментація;
  - mapping сигналів у емоції та інтенсивності;
  - генерація metadata / hints;
  - **не** викликає ffmpeg, **не** синтезує аудіо.

- **TTS-adapter**:
  - інтеграція з Piper;
  - робота з WAV/ffmpeg;
  - управління файлами аудіо;
  - **не** приймає рішень про емоцію (використовує готові hints).

---

## 5. Як додавати новий модуль, не ламаючи структуру

### 5.1. Новий front-end застосунок

- розташування: `src/apps/<new-app>/`.
- структура аналогічна `src/apps/web`.
- новий `package.json`, `tsconfig.json`, entry-файл у `src/`.
- підключення в `pnpm-workspace.yaml`.

### 5.2. Новий backend/gateway-подібний застосунок

- розташування: `src/apps/<name>/`.
- TypeScript + Fastify/Express (або інший Node-фреймворк, але узгоджений із мейнтейнерами).
- окремі папки `routes/`, `services/`, `clients/`, `schemas/`.

### 5.3. Новий сервіс (Python)

- розташування: `src/services/<name>/`.
- `pyproject.toml` або `requirements*.txt` + структура:

```text
app/         # FastAPI/Flask entrypoint + HTTP-шар
domain/      # моделі, бізнес-логіка
core/        # низькорівневі функції, утиліти
tests/       # unit + integration
```

### 5.4. Робота з `src/shared`

- спільні TypeScript-контракти (DTO для gateway/web);
- опис схем запитів/відповідей;
- утиліти, яким потрібен reuse в кількох TS-пакетах.

**Не** кладіть туди:

- Python-код;
- специфічну для одного застосунку логіку;
- тимчасові «чернетки» або файли для експериментів.

---

## 6. Робота зі спільними типами та контрактами

- Всі DTO/схеми, які використовує і web, і gateway, варто:
  - описати в `src/shared`;
  - за потреби згенерувати JSON Schema і використати в Python-сервісах.
- При зміні контрактів:
  - оновіть типи в `src/shared`;
  - синхронізуйте gateway (схеми валідації) і web (типи запитів/відповідей);
  - за потреби оновіть документацію в `docs/`.

---

## 7. Acceptable technical debt на стадії MVP

Припустимо:

- мінімальні UI-оптимізації (простий дизайн, без складних анімацій);
- обмежена кількість голосів Piper (1–2 фіксованих голоси);
- статичний список голосів/мов у коді, якщо це спрощує MVP;
- прості rule-based евристики в text-analysis без важких ML-моделей;
- простий ffmpeg-пайплайн без просунутих фільтрів.

Не слід вважати «нормальним боргом»:

- дублювання одних і тих самих контрактів між модулями замість `src/shared`;
- розміщення бізнес-логіки в frontend-компонентах або HTTP-контролерах;
- жорстко прошиті шляхи до файлів/моделей всередині коду без конфігурації через оточення;
- «тимчасові» обхідні маршрути, які ігнорують лінти/тести в CI.

---

## 8. Що робити перед створенням PR

- Перевірити, що зміни не ламають `pnpm lint/typecheck/build` там, де були зміни.
- Перевірити `ruff` + `pytest` для змінених Python-сервісів.
- Оновити `docs/`, якщо:
  - змінилася архітектура;
  - змінився контракт між модулями;
  - з’явився новий публічний endpoint.

Якщо ви не впевнені, куди саме додати новий код або як правильно «вписати» його в архітектуру, — краще створити невелике issue або обговорити це в PR-описі до того, як зміни стануть великими.

