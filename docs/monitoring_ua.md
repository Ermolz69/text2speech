# Моніторинг з Prometheus та Grafana

## Огляд

Система моніторингу базується на стеку Prometheus + Grafana для збору та візуалізації метрик синтезу мовлення.

## Архітектура

```
[Services] --> [Prometheus] --> [Grafana]
   |                |               |
   |- Gateway       |- Scrapes      |- Dashboards
   |- Text-Analysis |- /metrics     |- Alerts
   |- TTS-Adapter                   |- Panels
```

## Метрики

### Gateway (Node.js)

- `http_requests_total` - загальна кількість HTTP запитів
- `http_request_duration_seconds` - тривалість HTTP запитів
- `tts_synthesis_requests_total` - кількість запитів на синтез
- `tts_synthesis_duration_seconds` - тривалість синтезу
- `text_analysis_requests_total` - кількість запитів аналізу тексту
- `text_analysis_duration_seconds` - тривалість аналізу тексту

### Text Analysis (Python)

- `http_requests_total` - загальна кількість HTTP запитів
- `http_request_duration_seconds` - тривалість HTTP запитів
- `text_analysis_requests_total` - кількість запитів аналізу
- `text_analysis_duration_seconds` - тривалість аналізу
- `text_analysis_emotion_total` - кількість виявлених емоцій

### TTS Adapter (Python)

- `http_requests_total` - загальна кількість HTTP запитів
- `http_request_duration_seconds` - тривалість HTTP запитів
- `tts_synthesis_requests_total` - кількість запитів синтезу
- `tts_synthesis_duration_seconds` - тривалість синтезу

## Запуск

Моніторинг запускається автоматично з docker-compose:

```bash
docker compose up -d --build
```

## Доступ до сервісів

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000
  - Логін: `admin` (або змінна `GRAFANA_ADMIN_USER`)
  - Пароль: `admin` (або змінна `GRAFANA_ADMIN_PASSWORD`)

## Порти

| Сервіс | Порт | Змінна середовища |
|--------|------|-------------------|
| Prometheus | 9090 | `PORT_PROMETHEUS` |
| Grafana | 3000 | `PORT_GRAFANA` |

## Конфігурація

### Prometheus

Конфігурація знаходиться в `monitoring/prometheus/prometheus.yml`

### Grafana

- Datasources: `monitoring/grafana/provisioning/datasources/`
- Dashboards: `monitoring/grafana/provisioning/dashboards/`
- Dashboard JSON: `monitoring/grafana/dashboards/`

## Дашборд

Готовий дашборд "Emotional TTS Monitoring" включає:

- Rate HTTP запитів
- Duration HTTP запитів (p95)
- Кількість запитів синтезу
- Тривалість синтезу (p95)
- Кількість запитів аналізу тексту
- Тривалість аналізу (p95)
- Rate помилок по сервісах
- Розподіл емоцій

## Збереження даних

Дані зберігаються в Docker volumes:

- `prometheus-data` - метрики Prometheus
- `grafana-data` - конфігурація Grafana

## Вирішення проблем

### Prometheus не бачить сервіси

Перевірте, що сервіси запущені та доступні:

```bash
docker compose ps
curl http://localhost:4000/metrics
curl http://localhost:8001/metrics
curl http://localhost:8002/metrics
```

### Grafana не показує дані

1. Перевірте підключення до Prometheus в Grafana
2. Переконайтеся, що Prometheus збирає метрики
3. Перевірте логи:

```bash
docker compose logs prometheus
docker compose logs grafana
```
