# Emotional TTS Roadmap (UA)

## Table of Contents
- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Product Scope](#product-scope)
- [Goals and Non Goals](#goals-and-non-goals)
- [Key Decisions](#key-decisions)
- [Source Documents and Knowledge Base](#source-documents-and-knowledge-base)
- [System Vision](#system-vision)
- [Target Architecture](#target-architecture)
- [Core Modules](#core-modules)
  - [Input Layer](#input-layer)
  - [Normalization and Segmentation](#normalization-and-segmentation)
  - [Emoji and Context Parser](#emoji-and-context-parser)
  - [Emotion Mapping Layer](#emotion-mapping-layer)
  - [Prosody Planning Layer](#prosody-planning-layer)
  - [TTS Provider Layer](#tts-provider-layer)
  - [Audio Post Processing](#audio-post-processing)
  - [Evaluation and Analytics](#evaluation-and-analytics)
- [Technology Stack](#technology-stack)
- [Data and Test Inputs](#data-and-test-inputs)
- [How the System Should Work End to End](#how-the-system-should-work-end-to-end)
- [Delivery Plan](#delivery-plan)
  - [Phase 1 Discovery](#phase-1-discovery)
  - [Phase 2 Core Design](#phase-2-core-design)
  - [Phase 3 MVP Implementation](#phase-3-mvp-implementation)
  - [Phase 4 Quality Improvement](#phase-4-quality-improvement)
  - [Phase 5 Benchmarking and Release Preparation](#phase-5-benchmarking-and-release-preparation)
- [Sprint Plan](#sprint-plan)
  - [Sprint 1 Foundation and Research](#sprint-1-foundation-and-research)
  - [Sprint 2 Parser and Emotion Metadata](#sprint-2-parser-and-emotion-metadata)
  - [Sprint 3 Piper Service and First End to End MVP](#sprint-3-piper-service-and-first-end-to-end-mvp)
  - [Sprint 4 Quality Controls and Edge Cases](#sprint-4-quality-controls-and-edge-cases)
  - [Sprint 5 Benchmarking Against Higher Quality TTS](#sprint-5-benchmarking-against-higher-quality-tts)
  - [Sprint 6 Stabilization Demo and Documentation](#sprint-6-stabilization-demo-and-documentation)
- [Team Structure for 7 Participants](#team-structure-for-7-participants)
- [Collaboration Model](#collaboration-model)
- [Benchmark Strategy](#benchmark-strategy)
  - [Benchmark A Piper Neutral vs Piper Emotion Aware Pipeline](#benchmark-a-piper-neutral-vs-piper-emotion-aware-pipeline)
  - [Benchmark B Piper vs ElevenLabs](#benchmark-b-piper-vs-elevenlabs)
  - [Benchmark C Synthetic Audio vs Human Reference Audio](#benchmark-c-synthetic-audio-vs-human-reference-audio)
- [Acceptance Criteria](#acceptance-criteria)
- [Risks and Mitigations](#risks-and-mitigations)
- [Expected Deliverables](#expected-deliverables)
- [Open Questions](#open-questions)
- [Appendix A Example Metadata Contract](#appendix-a-example-metadata-contract)
- [Appendix B Suggested Repository Structure](#appendix-b-suggested-repository-structure)

## Overview
Цей документ визначає дорожню карту реалізації **emotion-aware text-to-speech системи**, яка приймає текст з емодзі, пунктуаційними підсилювачами та контекстними маркерами, інтерпретує емоційний намір і генерує виразне мовлення локально.

Документ розрахований на **команду з 7 учасників** і спирається на такі стратегічні рішення:

- **Основний локальний рушій синтезу:** Piper
- **Основна ціль для MVP:** локальний, безкоштовний, Docker-friendly запуск
- **Головний виклик продукту:** не створення нового TTS-рушія з нуля, а побудова **control layer** поверх TTS, який перетворює текстові емоційні сигнали на керовану виразну озвучку
- **Ціль для benchmark:** порівняння локального результату з якіснішим хмарним еталоном, зокрема ElevenLabs

Див. [Key Decisions](#key-decisions) та [Technology Stack](#technology-stack).

## Problem Statement
На вхід надходить звичайний текст, який може містити емодзі, емоційно підсилену пунктуацію, повторювані символи та контекстні маркери настрою. Система повинна:

1. виявляти емоційні сигнали в тексті;
2. перетворювати їх на структуровані emotional metadata;
3. трансформувати metadata в інструкції для синтезу;
4. генерувати аудіо через локальний TTS-рушій;
5. оцінювати, чи є згенероване мовлення виразнішим за нейтральний baseline.

Це насамперед задача **text-to-speech**, а не speech-to-text. STT може з’явитися пізніше лише для benchmark, голосового вводу або транскрипційної оцінки. Див. [Benchmark Strategy](#benchmark-strategy).

## Product Scope
### In scope
- Текстовий ввід з емодзі та пунктуацією
- Rule-based інтерпретація емоцій
- Segment-level emotional metadata
- Локальний синтез через Piper
- Dockerized локальний сценарій розробки
- Базовий UI або API для тестування
- Суб’єктивна та об’єктивна оцінка якості
- Порівняння з сильнішою зовнішньою reference-system

### Out of scope for MVP
- Навчання нового emotional TTS model з нуля
- Повний end-to-end STT + TTS voice assistant
- Production-grade distributed infrastructure
- Voice cloning як основний deliverable
- Real-time conversational streaming як жорстка вимога MVP

## Goals and Non Goals
### Goals
- Швидко отримати працюючий локальний MVP
- Зберегти стартову систему безкоштовною для локального запуску
- Розділити emotional interpretation та synthesis backend
- Зробити pipeline вимірюваним і придатним до benchmark
- Побудувати кодову базу, де Piper пізніше можна замінити іншим provider

### Non Goals
- Перевершити state-of-the-art cloud TTS вже в першій ітерації
- Ідеально розв’язати всі випадки сарказму та іронії в MVP
- Повністю залежати від платного vendor з першого дня

## Key Decisions
1. **Використовуємо Piper як основний synthesis layer.** Piper підходить як швидкий локальний neural TTS engine, зручний для практичного MVP.
2. **Не донавчаємо і не перенавчаємо TTS model на першому етапі.** Спочатку будуємо control layer навколо моделі.
3. **Емоцію представляємо явно у вигляді metadata.** Parser повинен повертати структуровані дані, а не лише факт наявності емодзі.
4. **Docker використовуємо для відтворюваності.** Усі учасники команди повинні запускати однаковий стек.
5. **librosa використовуємо для оцінки, а не для синтезу.** Вона корисна для MFCC, RMS, spectral centroid, spectral bandwidth, spectral contrast та інших ознак.
6. **ElevenLabs використовуємо лише як benchmark і quality reference.** Це корисний еталон, але не найкраща база для безкоштовного локального MVP.
7. **Система має бути provider-agnostic.** TTS layer потрібно спроєктувати так, щоб пізніше можна було підключити ElevenLabs, Azure, Coqui або інший provider.

## Source Documents and Knowledge Base
Ця roadmap спирається на комбінацію **основних джерел** та **додаткових матеріалів для ознайомлення**.

### Primary sources for implementation decisions
- OHF-Voice Piper repository
- Повідомлення про перенесення Piper до OHF-Voice
- Документація librosa щодо feature extraction
- Документація ElevenLabs щодо TTS capabilities
- Документація ElevenLabs щодо real-time audio generation
- Стаття EmoSphere++

### Supplementary background reading
- GenAI Guidebook: Audio feature extraction
- Text-to-speech overview, part 1
- Text-to-speech overview, part 2

### How these documents are used
- Документацію Piper використовуємо для **runtime integration та local deployment**.
- Документацію librosa використовуємо для **evaluation and analysis design**.
- Документацію ElevenLabs використовуємо як **definition of benchmark target**, а не як основу локального MVP.
- EmoSphere++ використовуємо як **R&D-орієнтир** для майбутнього керування емоційним стилем.
- Оглядові статті використовуємо як **background reading**, а не як фінальний архітектурний авторитет.

## System Vision
Система повинна працювати як pipeline, що перетворює текстові сигнали на виразну озвучку.

```text
User text
  -> normalizer
  -> segmenter
  -> emoji and context parser
  -> emotion mapping
  -> prosody planner
  -> TTS adapter
  -> audio post processing
  -> output audio + metrics
```

Головний архітектурний принцип — separation of concerns:
- розуміння тексту не залежить від synthesis engine;
- synthesis engine можна замінювати;
- оцінка має бути відтворюваною.

## Target Architecture
Архітектура повинна містити такі сервіси або модулі:

1. **Client layer**
   - простий UI, CLI або API consumer;
   - надсилає текст і отримує аудіо.

2. **Parser and control service**
   - нормалізує текст;
   - витягує сигнали;
   - генерує emotional metadata.

3. **TTS service**
   - приймає текстові сегменти та synthesis hints;
   - синтезує мовлення через Piper.

4. **Audio utility layer**
   - конвертує WAV у MP3 за потреби;
   - склеює сегменти;
   - нормалізує гучність.

5. **Evaluation layer**
   - обчислює об’єктивні метрики;
   - зберігає benchmark outputs;
   - підтримує listening tests.

Див. [Core Modules](#core-modules) та [How the System Should Work End to End](#how-the-system-should-work-end-to-end).

## Core Modules

### Input Layer
Відповідальність:
- приймати звичайний текст;
- приймати текст з емодзі;
- приймати текст з патернами пунктуації `!!!`, `???`, `...`;
- за потреби приймати batch test files.

Початкові інтерфейси:
- CLI для розробників;
- мінімальна web-form для demo;
- REST endpoint для automation.

### Normalization and Segmentation
Відповідальність:
- нормалізація пробілів;
- збереження емодзі;
- розбиття тексту на речення або змістові сегменти;
- виявлення повторюваної пунктуації;
- позначення upper-case emphasis.

Виходом цього модуля має бути нормалізоване внутрішнє представлення, а не фінальні емоційні ярлики.

### Emoji and Context Parser
Відповідальність:
- знаходити емодзі;
- знаходити punctuation amplifiers;
- знаходити modifier words на кшталт “дуже”, “так”, “справді”;
- враховувати положення сигналу відносно речення;
- визначати, чи сигнал локальний, чи глобальний.

Цей модуль має відповідати на питання:
- які емоційні сигнали присутні;
- до чого саме вони застосовуються;
- наскільки сильним є їхній вплив.

### Emotion Mapping Layer
Відповідальність:
- переводити виявлені сигнали у невеликий контрольований набір ярликів;
- задавати інтенсивність;
- поєднувати емодзі, пунктуацію та лексичні сигнали.

Рекомендований початковий label set:
- neutral
- joy
- playful
- sadness
- anger
- surprise

Рекомендована шкала інтенсивності:
- 0 neutral
- 1 weak
- 2 medium
- 3 strong

Саме тут має жити перша версія rule logic.

### Prosody Planning Layer
Відповідальність:
- транслювати emotional metadata у synthesis hints;
- визначати межі сегментів;
- задавати довжину пауз;
- визначати стратегію акцентування;
- готувати chunks, придатні до синтезу.

Важливо: у MVP цей шар переважно керує **підготовкою тексту до синтезу**, а не внутрішнім емоційним керуванням усередині Piper.

### TTS Provider Layer
Відповідальність:
- надавати єдиний synthesis interface;
- обгорнути Piper як основний provider;
- дозволити підключення інших provider пізніше.

Рекомендований інтерфейс:

```python
synthesize(text: str, voice_id: str, output_path: str, metadata: dict | None = None) -> str
```

Реалізації:
- `PiperProvider`
- `ElevenLabsProvider` пізніше, лише для benchmark
- опціонально `AzureProvider` або `CoquiProvider`

### Audio Post Processing
Відповідальність:
- склеювання сегментів аудіо;
- нормалізація гучності;
- обрізання зайвої тиші за потреби;
- конвертація у формат для відтворення.

Рекомендовані інструменти:
- `ffmpeg`
- `pydub` або легкий utility layer

### Evaluation and Analytics
Відповідальність:
- обчислення audio features через librosa;
- порівняння neutral та expressive outputs;
- збереження benchmark metadata;
- підтримка listening tests.

Рекомендовані метрики:
- duration
- pause count і pause length
- RMS energy
- MFCC summary statistics
- spectral centroid
- spectral bandwidth
- spectral contrast

Див. [Benchmark Strategy](#benchmark-strategy).

## Technology Stack
### Target stack
- **Frontend:** React + TypeScript
- **Gateway backend:** TypeScript + Fastify
- **Text analysis service:** Python
- **TTS service:** Piper
- **Storage / logs:** локально, пізніше за потреби object storage

### Notes on stack choice
- **Frontend** відповідає лише за взаємодію з користувачем і викликає gateway по API.
- **Gateway backend** агрегує запити, координує виклики сервісу текстового аналізу та TTS-сервісу і надає єдину публічну точку входу.
- **Text analysis service** реалізує нормалізацію, парсинг емодзі та контексту, mapping емоцій та логіку планування просодії.
- **TTS service (Piper)** розглядається як замінний синтезатор за простим adapter interface.
- **Storage/logs** на старті базуються на локальній файловій системі; за потреби пізніше можна додати S3-сумісне object storage для довгострокових артефактів і метрик.

## Data and Test Inputs
Потрібен структурований тестовий корпус з самого початку.

### Input groups
1. **Neutral sentences**
   - без емодзі;
   - мінімально підсилена пунктуація.
2. **Simple emotional cases**
   - один емодзі, чітке значення.
3. **Amplified cases**
   - повтор емодзі, повтор пунктуації, uppercase.
4. **Ambiguous cases**
   - іронія, сарказм, змішані сигнали.
5. **Multi segment cases**
   - довший текст, де емоція змінюється між сегментами.

### Example corpus format
Кожний test item має містити:
- input text;
- expected label;
- expected intensity;
- notes on ambiguity;
- benchmark outputs.

## How the System Should Work End to End
1. Користувач вводить текст.
2. Вхід проходить через normalization та segmentation.
3. Parser виявляє емодзі, пунктуацію та lexical amplifiers.
4. Emotion mapping layer призначає labels та intensities.
5. Prosody planner перетворює metadata на synthesis-ready segments.
6. Piper синтезує кожний сегмент.
7. Audio utilities склеюють та нормалізують фінальний результат.
8. Evaluation utilities опційно обчислюють метрики та зберігають звіти.

### Example flow
Вхід:

```text
I am so happy to see you 😊😊!
```

Проміжні metadata:

```json
{
  "segments": [
    {
      "text": "I am so happy to see you",
      "emotion": "joy",
      "intensity": 2,
      "emoji": ["😊", "😊"],
      "punctuation": ["!"],
      "pause_after_ms": 120
    }
  ]
}
```

Вихід:
- один synthesized audio file;
- опціональний metrics file;
- опціональне порівняння з neutral synthesis.

## Delivery Plan

### Phase 1 Discovery
Цілі:
- визначити emotion label set;
- підтвердити локальний runtime stack;
- зібрати тестовий корпус;
- перевірити голоси та мовну підтримку для MVP.

Критерії виходу:
- затверджено architecture sketch;
- створено test corpus v1;
- підтверджено інтеграційну придатність Piper.

### Phase 2 Core Design
Цілі:
- визначити metadata contract;
- визначити parser outputs;
- визначити provider interface;
- визначити repository layout.

Критерії виходу:
- інтерфейс MVP зафіксований;
- ролі команди розподілені;
- issue breakdown підготовлений.

### Phase 3 MVP Implementation
Цілі:
- реалізувати parser v1;
- реалізувати emotion mapping v1;
- запустити Piper локально через API;
- отримати перші expressive vs neutral outputs.

Критерії виходу:
- повний шлях text-to-audio працює локально;
- демонстраційний сценарій запускається в Docker.

### Phase 4 Quality Improvement
Цілі:
- покращити segmentation;
- покращити обробку edge cases;
- додати objective evaluation;
- додати logging та reproducibility.

Критерії виходу:
- emotional metadata дає чутні відмінності на test corpus;
- objective metrics записуються.

### Phase 5 Benchmarking and Release Preparation
Цілі:
- порівняти систему з ElevenLabs;
- порівняти систему з human reference recordings;
- підготувати demo та документацію;
- підсумувати обмеження і наступні кроки.

Критерії виходу:
- benchmark report готовий;
- demo scenario готовий;
- документація завершена.

## Sprint Plan
Базове припущення: **6 спринтів по 2 тижні**.

### Sprint 1 Foundation and Research
**Мета спринту:** узгодити рамки MVP, визначити ключові текстові сигнали, зафіксувати базову emotion taxonomy, перевірити роботу Piper та підготувати спільне середовище команди.

**Командні завдання:**
- провести стартову зустріч і погодити бачення MVP;
- спільно визначити, які текстові сигнали входять до першої версії;
- разом переглянути базові матеріали щодо Piper, TTS та audio analysis;
- узгодити структуру репозиторію, Docker-оточення та правила командної роботи;
- наприкінці спринту провести спільний review результатів і зафіксувати backlog наступного етапу.

**Індивідуальний внесок:**
- **Учасник 1:** фіналізує scope, дерево задач та межі MVP.
- **Учасник 2:** досліджує категорії текстових сигналів і готує їхню первинну класифікацію.
- **Учасник 3:** готує draft emotion taxonomy та базових правил інтерпретації.
- **Учасник 4:** валідовує setup Piper, голоси та базовий локальний запуск.
- **Учасник 5:** проєктує UX вводу та виводу і формує базові user flow.
- **Учасник 6:** визначає framework оцінювання та критерії первинної перевірки.
- **Учасник 7:** налаштовує репозиторій, Docker і CI.

**Очікуваний результат:**
- погоджений scope MVP;
- початкове дерево задач;
- перелік текстових сигналів;
- draft emotion taxonomy;
- базовий робочий setup Piper;
- framework оцінювання;
- репозиторій з Docker та базовим CI.

### Sprint 2 Parser and Emotion Metadata
**Мета спринту:** побудувати перший зв’язний шар `text -> normalized representation -> emotional metadata`.

**Командні завдання:**
- спільно затвердити metadata contract та acceptance criteria;
- провести review формату сегментів, labels, intensities та fallback-поведінки;
- синхронізувати вимоги між parser, TTS adapter та test harness/UI;
- провести загальну інтеграційну зустріч щодо API та структур даних;
- у кінці спринту разом переглянути спірні кейси.

**Індивідуальний внесок:**
- **Учасник 1:** затверджує metadata та критерії приймання.
- **Учасник 2:** реалізує normalizer і segmentation.
- **Учасник 3:** реалізує emoji-to-emotion mapping v1.
- **Учасник 4:** визначає контракт TTS adapter.
- **Учасник 5:** готує test harness або невеликий UI для перевірки pipeline.
- **Учасник 6:** формує набір оцінки parser та приклади очікуваної поведінки.
- **Учасник 7:** створює каркас test automation і підтримує інфраструктурну зв’язність.

**Очікуваний результат:**
- parser v1;
- metadata contract v1;
- нормалізація, сегментація та перший mapping;
- мінімальний інструмент для локальної перевірки.

### Sprint 3 Piper Service and First End to End MVP
**Мета спринту:** зібрати перший робочий pipeline `text -> parser -> metadata -> Piper -> audio`.

**Командні завдання:**
- разом інтегрувати parser і TTS service;
- узгодити правила обробки меж речень, інтенсивності та пауз;
- спільно відлагодити перший end-to-end сценарій;
- провести колективне тестування neutral та expressive режимів на одному наборі прикладів;
- зафіксувати технічний борг після першого demo.

**Індивідуальний внесок:**
- **Учасник 1:** зводить результати спринту в єдиний backlog view та координує інтеграцію.
- **Учасник 2:** покращує parser для коректної роботи з межами речень.
- **Учасник 3:** додає правила пунктуації та інтенсивності.
- **Учасник 4:** піднімає Dockerized Piper synthesis service.
- **Учасник 5:** додає playback і шлях експорту аудіо.
- **Учасник 6:** порівнює neutral та expressive прогони на першому наборі тестів.
- **Учасник 7:** посилює dev environment та проводить regression checks.

**Очікуваний результат:**
- Dockerized synthesis service;
- перший end-to-end MVP;
- робоче відтворення та збереження аудіо;
- перші порівняльні результати.

### Sprint 4 Quality Controls and Edge Cases
**Мета спринту:** покращити надійність системи, обробку складних випадків і якість фінального аудіо.

**Командні завдання:**
- спільно зібрати та пріоритезувати edge cases;
- провести огляд неоднозначних шаблонів, повторів емодзі та змішаної пунктуації;
- домовитися про fallback logic для невизначених або конфліктних випадків;
- разом перевірити якість post-processing та reproducibility;
- запустити перший цикл objective evaluation scripts.

**Індивідуальний внесок:**
- **Учасник 1:** пріоритезує edge cases і формує план їх обробки.
- **Учасник 2:** реалізує підтримку повтору емодзі та змішаної пунктуації.
- **Учасник 3:** реалізує шаблони сарказму, іронії та fallback logic.
- **Учасник 4:** покращує надійність сервісу, logging та обробку помилок.
- **Учасник 5:** додає склеювання аудіо та конвертацію форматів.
- **Учасник 6:** реалізує scripts метрик на основі librosa.
- **Учасник 7:** проводить QA щодо відтворюваності на різних машинах.

**Очікуваний результат:**
- краща обробка edge cases;
- audio post-processing;
- reproducible локальний запуск;
- перші objective metrics.

### Sprint 5 Benchmarking Against Higher Quality TTS
**Мета спринту:** оцінити розрив між локальним MVP та сильнішим quality reference.

**Командні завдання:**
- разом підготувати benchmark corpus та сценарії порівняння;
- узгодити правила human listening evaluation;
- зафіксувати, які поля benchmark metadata мають зберігатися;
- провести серію спільних прослуховувань і короткий review висновків;
- підготувати технічне та продуктовe summary trade-offs.

**Індивідуальний внесок:**
- **Учасник 1:** проводить benchmark review і формує summary рішень.
- **Учасник 2:** готує benchmark inputs.
- **Учасник 3:** розмічає expected emotional perception для тестових прикладів.
- **Учасник 4:** інтегрує клієнт ElevenLabs для benchmark.
- **Учасник 5:** збирає playback outputs для listening tests.
- **Учасник 6:** агрегує subjective та objective benchmark results.
- **Учасник 7:** перевіряє reproducibility і готує release candidates.

**Очікуваний результат:**
- порівняння Piper vs ElevenLabs;
- порівняння neutral vs expressive pipeline;
- артефакти для listening tests;
- зведений benchmark summary.

### Sprint 6 Stabilization Demo and Documentation
**Мета спринту:** стабілізувати продукт, підготувати demo, документацію та фінальний пакет здачі.

**Командні завдання:**
- провести фінальний інтеграційний review;
- погодити demo flow та narrative презентації;
- разом пройти setup instructions з чистого середовища;
- звести technical docs, benchmark results та known issues;
- підготувати release package і фінальний README.

**Індивідуальний внесок:**
- **Учасник 1:** формує фінальний narrative, closure roadmap і логіку презентації.
- **Учасник 2:** документує parser.
- **Учасник 3:** документує emotion rules.
- **Учасник 4:** документує deploy і service layer.
- **Учасник 5:** полірує demo flow і UI.
- **Учасник 6:** готує фінальний benchmark report.
- **Учасник 7:** проводить фінальний QA, packaging release та polishing README.

**Очікуваний результат:**
- demo-ready продукт;
- комплект документації;
- benchmark report;
- release package;
- оновлений README.

## Team Structure for 7 Participants
### Participant 1
Координація проєкту, вимоги, спринт-трекінг, цілісність документації.

### Participant 2
Нормалізація тексту, парсинг, витяг емодзі, лексичні сигнали.

### Participant 3
Emotion mapping rules, логіка інтенсивності, обробка неоднозначності.

### Participant 4
Інтеграція Piper, API layer, Docker service.

### Participant 5
Audio post-processing, output management, базовий UI або playback layer.

### Participant 6
Оцінювання, librosa metrics, benchmark scripts, звітність.

### Participant 7
QA, CI, відтворюваність оточення, packaging demo та release support.

## Collaboration Model
Команда працює не за схемою **“одна задача = один учасник”**, а за схемою **“один спільний робочий потік = кілька підзадач, у які внесок роблять усі”**.

### Принципи взаємодії
1. **Кожен спринт має спільну ціль.**
2. **Кожен спринт містить командні завдання**, де працюють усі.
3. **Кожен учасник має свій фокус**, але не ізольований від інших.
4. **Будь-який важливий артефакт проходить спільний review.**
5. **Інтеграція відбувається рано**, а не наприкінці проєкту.
6. **Відтворюваність середовища — спільна відповідальність**, а не лише задача одного учасника.

### Рекомендований формат роботи всередині спринту
- спільне планування;
- розподіл підзадач;
- короткі синхронізації;
- проміжна інтеграція;
- загальний review результату;
- фіксація наступного backlog.

## Benchmark Strategy

### Benchmark A Piper Neutral vs Piper Emotion Aware Pipeline
**Мета:** довести, що control layer реально змінює поведінку синтезу.

**Метод:**
- для кожного input синтезувати аудіо двічі;
- один раз у plain/neutral режимі;
- другий раз з emotional metadata;
- порівнювати audio features та listening impressions.

**Ознака успіху:**
- neutral і expressive outputs відчутно відрізняються в правильному напрямку.

### Benchmark B Piper vs ElevenLabs
**Мета:** оцінити розрив між локальним безкоштовним MVP та якісним хмарним reference.

**Метод:**
- використовувати однакові речення та однакові intended emotional labels;
- генерувати аудіо через Piper і ElevenLabs;
- порівнювати naturalness, perceived emotion та latency.

**Що фіксувати:**
- synthesis latency;
- total audio duration;
- subjective rating;
- reproducibility notes;
- cost and dependency notes.

### Benchmark C Synthetic Audio vs Human Reference Audio
**Мета:** оцінити, наскільки система наближається до природного виразного читання.

**Метод:**
- записати людину, що читає ті самі промпти в потрібних емоціях;
- порівняти human audio, Piper output та benchmark output;
- за можливості провести blind listening tests.

**Рекомендовані осі оцінювання:**
- naturalness;
- emotional clarity;
- intelligibility;
- listening comfort.

## Acceptance Criteria
MVP вважається прийнятим, якщо виконані всі умови:

1. Система приймає текст, який містить емодзі.
2. Parser генерує структуровані emotional metadata.
3. Metadata відтворювано впливають на згенероване аудіо.
4. Piper запускається локально в Docker для всієї команди.
5. Щонайменше один голос інтегрований і працює end-to-end.
6. Benchmark corpus існує та versioned.
7. Реалізоване базове порівняння з neutral synthesis.
8. Benchmark plan проти ElevenLabs задокументований і частково виконаний.
9. Репозиторій містить setup instructions та demo path.

## Risks and Mitigations
### Risk 1 Ambiguous emoji meaning
**Mitigation:**
- почати з малого label set;
- логувати неоднозначні випадки;
- використовувати явний fallback до neutral.

### Risk 2 Piper expressiveness is limited
**Mitigation:**
- керувати виразністю через segmentation та synthesis hints;
- використовувати benchmark для виявлення розривів;
- тримати provider abstraction готовим.

### Risk 3 Language or voice limitations
**Mitigation:**
- рано зафіксувати голоси та мову для MVP;
- versioned зберігати voice assets;
- провести ранню перевірку якості голосів.

### Risk 4 Local reproducibility issues
**Mitigation:**
- використовувати Docker;
- pin versions;
- рано документувати runtime setup.

### Risk 5 Over-engineering in early sprints
**Mitigation:**
- уникати retraining та advanced research features у MVP;
- спочатку довести control layer.

## Expected Deliverables
- `roadmap.md`
- `roadmap_RU.md`
- `roadmap_UA.md`
- `README.md`
- architecture diagram
- metadata contract
- parser implementation
- Piper service in Docker
- evaluation scripts на librosa
- benchmark dataset
- benchmark report
- demo instructions
- фінальний runbook

## Open Questions
- Яка саме мова і який голос будуть зафіксовані для MVP?
- Чи буде parser у v1 повністю rule-based, чи матиме light sentiment heuristics?
- Чи потрібен real-time streaming на пізнішому етапі, чи достатньо offline generation?
- Чи потрібен STT взагалі в межах цього проєкту, чи лише як optional benchmark layer?
- Який рівень виявлення іронії реально встигнути в наявний термін?

## Appendix A Example Metadata Contract
```json
{
  "request_id": "sample-001",
  "source_text": "I am so happy to see you 😊😊!",
  "segments": [
    {
      "segment_id": 1,
      "text": "I am so happy to see you",
      "emotion": "joy",
      "intensity": 2,
      "emoji": ["😊", "😊"],
      "punctuation": ["!"],
      "pause_after_ms": 120,
      "notes": "positive with amplification"
    }
  ]
}
```

## Appendix B Suggested Repository Structure
```text
project-root/
  docs/
    roadmap.md
    roadmap_RU.md
    roadmap_UA.md
    architecture.md
    benchmark-plan.md
  data/
    test_corpus/
    human_reference/
  services/
    parser/
    tts/
    evaluation/
  docker/
    docker-compose.yml
  notebooks/
    evaluation/
  scripts/
  outputs/
    generated_audio/
    reports/
  README.md
```
