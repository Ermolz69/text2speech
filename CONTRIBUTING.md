# Внесок у проєкт Emotional TTS

Дякуємо, що хочете зробити внесок у локальний MVP **emotion-aware text-to-speech**. Цей документ допоможе швидко розібратися зі структурою monorepo, середовищем розробки та базовими правилами роботи з репозиторієм.

---

## 1. Як влаштований репозиторій

Проєкт організовано як **monorepo**. Основний код живе в `src/`, репо-рівневі конфіги — в корені.

Коротко:

- `src/apps/web` — фронтенд (React + TypeScript, Vite).
- `src/apps/gateway` — gateway backend (Fastify + TypeScript).
- `src/services/text-analysis` — Python FastAPI сервіс аналізу тексту.
- `src/services/tts-adapter` — Python FastAPI TTS adapter над Piper + ffmpeg.
- `src/shared` — спільні типи, контракти, схеми та утиліти для TypeScript.

Додаткові папки:

- `docs/` — архітектурні та dev-документи.
- `docker/` — Dockerfile-и для окремих сервісів.
- `postman/` — Postman-колекції для ручного тестування API.
- `benchmarks/` — корпуси та скрипти для бенчмарків.
- `reports/` — результати бенчмарків, метрики.

**Правило:** будь-який прикладний код тримаємо в `src/`. У корені — тільки конфіги, мета-файли, CI/CD, документація верхнього рівня.

---

## 2. Вимоги до середовища

Перед роботою з репозиторієм підготуйте локальне середовище.

### Обов’язково

- **Node.js**: LTS 20.x
- **pnpm**: 9.x (рекомендовано через `corepack enable`)
- **Python**: 3.11.x
- **ffmpeg**: встановлений у системі та доступний як `ffmpeg` у `$PATH`
- **Piper**: встановлений локально або всередині Docker (для реального синтезу)

### Рекомендовано

- **Docker** / **Docker Compose** — для швидкого підйому всіх сервісів одночасно.
- Сучасний редактор з підтримкою TypeScript та Python (VS Code, WebStorm, PyCharm тощо).

---

## 3. Початок роботи

### 3.1. Клонування репозиторію

```bash
git clone <URL_репозиторію>
cd text2speech
```

### 3.2. Встановлення JS/TS-залежностей

```bash
corepack enable
pnpm install
```

Це підтягне залежності для всіх workspace-пакетів у `src/apps` та `src/shared`.

### 3.3. Встановлення Python-залежностей

#### Text-analysis

```bash
cd src/services/text-analysis
python -m venv .venv
source .venv/bin/activate  # або .venv\Scripts\activate на Windows
pip install -e ".[dev]"
```

#### TTS-adapter

```bash
cd src/services/tts-adapter
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

---

## 4. Запуск сервісів локально

### 4.1. Web (React + TypeScript)

З кореня репозиторію:

```bash
pnpm --dir src/apps/web dev
```

UI буде доступний на `http://localhost:5173` (порт можна змінити в конфігу).

### 4.2. Gateway (Fastify)

```bash
pnpm --dir src/apps/gateway dev
```

Gateway слухає `PORT_GATEWAY` (за замовчуванням 4000), налаштовується через `.env`.

### 4.3. Python text-analysis service

```bash
cd src/services/text-analysis
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4.4. TTS-adapter (Piper + ffmpeg)

```bash
cd src/services/tts-adapter
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

### 4.5. Запуск через Docker Compose

У корені:

```bash
docker compose up --build
```

Це підніме web, gateway, text-analysis та tts-adapter згідно з `docker-compose.yml`. Переконайтеся, що змінні оточення (`PIPER_BIN`, `PIPER_MODEL_PATH`, `FFMPEG_BIN`) налаштовано коректно.

---

## 5. Lint / typecheck / build / test

### 5.1. Web

```bash
pnpm --dir src/apps/web lint
pnpm --dir src/apps/web typecheck
pnpm --dir src/apps/web build
pnpm --dir src/apps/web test
```

### 5.2. Gateway

```bash
pnpm --dir src/apps/gateway lint
pnpm --dir src/apps/gateway typecheck
pnpm --dir src/apps/gateway build
pnpm --dir src/apps/gateway test
```

### 5.3. Python text-analysis

```bash
cd src/services/text-analysis
source .venv/bin/activate
ruff check .
pytest
```

### 5.4. Python tts-adapter

```bash
cd src/services/tts-adapter
source .venv/bin/activate
ruff check .
pytest
```

---

## 6. Базові правила внесення змін

- **Не ламайте monorepo-структуру**:
  - нові застосунки → в `src/apps/...`;
  - нові бекенд-сервіси → в `src/services/...`;
  - спільні речі для TS → в `src/shared`;
  - нові Dockerfile → в `docker/`;
  - документація → в `docs/`.
- **Не змішуйте інфраструктурні зміни з бізнес-логікою** без чіткої потреби:
  - якщо змінюєте Docker або CI, не вносьте в тому ж PR великі зміни в доменній логіці;
  - якщо рефакторите бізнес-логіку, уникайте паралельного переписування docker-compose.
- **Код тільки в `src/`**: корінь репо — для конфігів (`package.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, CI, документація).
- **Підтримуйте узгоджений стиль**:
  - TypeScript: ESLint + Prettier, strict mode, єдині правила форматування;
  - Python: `black` + `ruff` + `isort`.
- **Поважайте розподіл відповідальності**:
  - parser-логіка живе в Python text-analysis;
  - робота з Piper та ffmpeg — у tts-adapter;
  - gateway не дублює правила емоцій;
  - фронтенд залишається «тонким клієнтом».

---

## 7. Гілки та назви гілок

Рекомендований підхід:

- Основні гілки: `main`, опційно `develop`.
- Фічі:
  - `feature/<короткий-опис>`
  - приклад: `feature/web-tts-playground`, `feature/text-analysis-rules-v1`
- Багфікси:
  - `fix/<короткий-опис>`
  - приклад: `fix/gateway-timeout`, `fix/web-error-boundary`
- Технічний борг / інфраструктура:
  - `chore/<короткий-опис>`
  - приклад: `chore/ci-docker-smoke`, `chore/update-deps`

---

## 8. Стиль комітів

Використовуйте короткі, змістовні повідомлення комітів.

Формат:

```text
<type>: короткий опис
```

Можливі `type`:

- `feat` — новий функціонал;
- `fix` — виправлення багу;
- `chore` — оновлення залежностей, інфраструктура;
- `docs` — зміни в документації;
- `refactor` — рефакторинг без зміни поведінки;
- `test` — тести.

Приклади:

- `feat: add basic TTS playground page`
- `fix: handle empty text in gateway`
- `chore: configure docker smoke workflow`
- `docs: add development guide`

---

## 9. Правила pull request

- Один PR — одна логічна зміна.
- Виносьте великі рефакторинги в окремі PR.
- Не змішуйте:
  - масові зміни форматування + рефакторинг;
  - інфраструктуру (CI, Docker) + велику кількість бізнес-правок.
- Якщо PR змінює публічні контракти (DTO, API-схеми, формат metadata):
  - оновіть відповідні файли в `src/shared`;
  - за потреби оновіть документацію в `docs/`.

### 9.1. Checklist перед PR

Перед створенням PR перевірте:

- [ ] `pnpm --dir src/apps/web lint` пройшов (за наявності змін у web).
- [ ] `pnpm --dir src/apps/web typecheck` пройшов.
- [ ] `pnpm --dir src/apps/web build` пройшов (якщо чіпали збірку/конфіги).
- [ ] `pnpm --dir src/apps/gateway lint` пройшов (за наявності змін у gateway).
- [ ] `pnpm --dir src/apps/gateway typecheck` пройшов.
- [ ] `pnpm --dir src/apps/gateway build` пройшов.
- [ ] `ruff check .` і `pytest` пройшли в змінених Python-сервісах.
- [ ] Docker-пайплайн (`docker compose config`, `docker compose build`) не ламається, якщо змінювали Docker.
- [ ] Оновлена документація (`docs/`), якщо змінювали архітектуру або контракти.

---

## 10. Стиль та консистентність для monorepo

Щоб підтримувати monorepo в чистому стані:

- Використовуйте **спільні базові конфіги**:
  - `tsconfig.base.json` — загальні налаштування TS;
  - `.eslintrc.cjs` — root ESLint-конфіг із overrides.
- Для нових пакетів/додатків дотримуйтесь аналогічної структури:
  - `src/apps/<name>/src/...`
  - `src/services/<name>/app/...`
  - окремий `package.json` (для TS-проєктів) або `pyproject.toml` (для Python).
- Не дублюйте логіку між модулями:
  - якщо контракт використовується web і gateway, винесіть його в `src/shared`.
  - не створюйте «локальні копії» типів там, де можна заімпортувати спільний модуль.

Якщо сумніваєтеся, куди покласти новий код — краще спершу прогляньте `docs/project_structure_ua.md` і `docs/development_ua.md`, або створіть невелике issue/обговорення в GitHub перед великими змінами.

