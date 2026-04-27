import client from 'prom-client';

const register = new client.Registry();

register.setDefaultLabels({
  service: 'gateway',
});

client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const ttsSynthesisRequestsTotal = new client.Counter({
  name: 'tts_synthesis_requests_total',
  help: 'Total number of TTS synthesis requests',
});

export const ttsSynthesisDurationSeconds = new client.Histogram({
  name: 'tts_synthesis_duration_seconds',
  help: 'TTS synthesis duration in seconds',
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 15, 20, 30],
});

export const textAnalysisRequestsTotal = new client.Counter({
  name: 'text_analysis_requests_total',
  help: 'Total number of text analysis requests',
});

export const textAnalysisDurationSeconds = new client.Histogram({
  name: 'text_analysis_duration_seconds',
  help: 'Text analysis duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

export const errorsTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type'],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);
register.registerMetric(ttsSynthesisRequestsTotal);
register.registerMetric(ttsSynthesisDurationSeconds);
register.registerMetric(textAnalysisRequestsTotal);
register.registerMetric(textAnalysisDurationSeconds);
register.registerMetric(errorsTotal);

export { register };
