# Архітектура Python-застосунку для аналізу тексту і побудови emotional metadata

## 1. Роль Python-сервісу в поточному каркасі
Python-застосунок у `src/services/text-analysis` є **ядром інтерпретації тексту**. Він не синтезує аудіо самостійно, а перетворює текст на **структуровані емоційні інструкції**.

Його задача:
- прочитати текст;
- нормалізувати його;
- розбити на сегменти;
- знайти емоційні сигнали;
- визначити emotion label;
- визначити intensity;
- побудувати synthesis hints для наступного рівня.

## 2. Вхід і вихід сервісу

### Вхід
```json
{
  "requestId": "req_001",
  "text": "Привіт 😊!!! Я дуже радий тебе бачити.",
  "mode": "expressive",
  "language": "uk"
}
```

### Вихід
```json
{
  "requestId": "req_001",
  "sourceText": "Привіт 😊!!! Я дуже радий тебе бачити.",
  "segments": [
    {
      "segmentId": 1,
      "text": "Привіт",
      "emotion": "joy",
      "intensity": 2,
      "signals": {
        "emoji": ["😊"],
        "punctuation": ["!!!"],
        "modifiers": []
      },
      "synthesisHints": {
        "pauseAfterMs": 120,
        "styleWeight": 0.65,
        "emphasisWords": []
      }
    },
    {
      "segmentId": 2,
      "text": "Я дуже радий тебе бачити.",
      "emotion": "joy",
      "intensity": 2,
      "signals": {
        "emoji": [],
        "punctuation": [],
        "modifiers": ["дуже"]
      },
      "synthesisHints": {
        "pauseAfterMs": 180,
        "styleWeight": 0.55,
        "emphasisWords": ["дуже", "радий"]
      }
    }
  ]
}
```

## 3. Головний принцип
Python-сервіс повинен бути **детермінованим**: однаковий текст за однакових правил має давати однаковий результат.

На MVP-етапі це означає:
- правило важливіше за ML;
- явний mapping важливіший за нечітку евристику;
- fallback у `neutral` кращий за нестабільне "вгадування".

## 4. Внутрішня архітектура

```text
input text
  -> normalizer
  -> segmenter
  -> signal extractor
  -> emotion mapper
  -> intensity resolver
  -> prosody hint planner
  -> metadata serializer
```

## 5. Основні модулі

### 5.1 normalizer
Відповідає за:
- очищення зайвих пробілів;
- уніфікацію лапок і пробілів;
- збереження емодзі;
- підготовку тексту до сегментації.

### 5.2 segmenter
Відповідає за:
- розбиття тексту на речення;
- розбиття на менші смислові сегменти;
- збереження коректного порядку сегментів.

### 5.3 signal extractor
Відповідає за:
- емодзі;
- підсилену пунктуацію;
- repeated characters;
- uppercase emphasis;
- слова-модифікатори на кшталт `дуже`, `так`, `справді`.

### 5.4 emotion mapper
Відповідає за переведення сигналів у контрольований набір:
- `neutral`
- `joy`
- `playful`
- `sadness`
- `anger`
- `surprise`

### 5.5 intensity resolver
Відповідає за шкалу:
- `0` — neutral
- `1` — weak
- `2` — medium
- `3` — strong

### 5.6 prosody hint planner
Відповідає за:
- `pauseAfterMs`
- `styleWeight`
- `emphasisWords`
- службові рекомендації для TTS-рівня

## 6. Правила роботи сервісу

### Правило 1. Сигнали не дорівнюють емоції напряму
Наприклад, `!` саме по собі не означає радість. Воно означає **підсилення**. Остаточне рішення приймається після об'єднання всіх сигналів.

### Правило 2. Parser працює на рівні сегментів
Емоція повинна визначатися не для всього тексту одразу, а для кожного сегмента окремо.

### Правило 3. Неоднозначні випадки мають fallback
Якщо немає достатніх сигналів або сигнали конфліктують, повертається:
- `neutral`
- або `neutral` з попередженням у `notes`

### Правило 4. Python-сервіс не повинен знати про HTTP-контекст front-end
Він має приймати чистий вхідний payload і повертати чисті metadata.

## 7. Приклад логіки v1

### Joy
Ознаки:
- `😊`, `😄`, `😁`
- `!`
- позитивна лексика
- підсилювачі типу `дуже`

### Sadness
Ознаки:
- `😢`, `😭`, `🥺`
- `...`
- негативна лексика

### Anger
Ознаки:
- `😡`, `🤬`
- uppercase emphasis
- `!!!`
- різка лексика

### Surprise
Ознаки:
- `😲`, `😮`
- `?!`
- короткі вигуки

## 8. Як сервіс повинен працювати з prosody
На MVP він не керує реальними акустичними параметрами Piper напряму. Замість цього він готує:
- межі сегментів;
- паузи;
- посилену текстову форму для окремих фрагментів;
- hints для adapter layer.

## 9. API Python-сервісу

### POST `/analyze`
Повертає emotional metadata без синтезу.

### POST `/analyze-and-plan`
Повертає emotional metadata разом із synthesis hints.

## 10. Внутрішня структура коду (цільова для monorepo)
```text
src/
  services/
    text-analysis/
      app/
        main.py            # FastAPI entrypoint
        api/               # HTTP-ендпоїнти
        schemas/           # Pydantic-схеми
        handlers/
      domain/
        models/
        rules/
        services/
      core/
        normalizer.py
        segmenter.py
        signal_extractor.py
        emotion_mapper.py
        intensity_resolver.py
        prosody_planner.py
        serializer.py
      tests/
        unit/
        integration/
        test_health.py     # мінімальний smoke-тест
```

## 11. Що тестувати в першу чергу
- правильну сегментацію;
- correct emoji detection;
- intensity від повторної пунктуації;
- конфліктні сигнали;
- порожній ввід;
- дуже довгий текст;
- змішану мову;
- кілька емоцій у сусідніх сегментах.

## 12. Чого сервіс не повинен робити
- не повинен запускати ffmpeg;
- не повинен напряму викликати front-end;
- не повинен форматувати UI-відповідь;
- не повинен містити жорстко прошиті HTTP-маршрути всередині domain logic;
- не повинен залежати від одного конкретного голосу Piper.

## 13. Мінімальний результат для MVP
Python-сервіс вважається готовим для MVP, якщо:
- повертає коректні сегменти;
- визначає базові emotion labels;
- присвоює intensity;
- будує synthesis hints;
- проходить тестовий набір простих і підсилених прикладів.
