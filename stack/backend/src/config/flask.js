import { env } from './env.js';

export const flaskConfig = {
  baseUrl: env.FLASK_API_URL,
  healthUrl: `${env.FLASK_API_URL}/health`,
  predictUrl: `${env.FLASK_API_URL}/predict`,
  batchUrl: `${env.FLASK_API_URL}/batch`,
  timeoutMs: env.FLASK_TIMEOUT_MS
};
