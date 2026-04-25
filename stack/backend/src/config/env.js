import { configDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

configDotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeUrl(value, fallback) {
  const candidate = value || fallback;
  return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: asNumber(process.env.PORT, 6532),
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rice_quality',
  FLASK_API_URL: normalizeUrl(process.env.FLASK_API_URL, 'http://127.0.0.1:5000'),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_SERVICE: process.env.SMTP_SERVICE || '',
  SMTP_PORT: asNumber(process.env.SMTP_PORT, 587),
  SMTP_SECURE: asBoolean(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  PUBLIC_API_URL: normalizeUrl(process.env.PUBLIC_API_URL, 'http://127.0.0.1:6532/api'),
  FRONTEND_URL: normalizeUrl(process.env.FRONTEND_URL, 'http://localhost:5173'),
  MAX_UPLOAD_FILES: asNumber(process.env.MAX_UPLOAD_FILES, 5),
  MAX_FILE_SIZE_MB: asNumber(process.env.MAX_FILE_SIZE_MB, 10),
  QUEUE_CAPACITY: asNumber(process.env.QUEUE_CAPACITY, 25),
  QUEUE_CONCURRENCY: asNumber(process.env.QUEUE_CONCURRENCY, 2),
  FLASK_TIMEOUT_MS: asNumber(process.env.FLASK_TIMEOUT_MS, 180000),
  CLEANUP_INTERVAL_MS: asNumber(process.env.CLEANUP_INTERVAL_MS, 6 * 60 * 60 * 1000),
  TEMP_RETENTION_HOURS: asNumber(process.env.TEMP_RETENTION_HOURS, 24),
  PDF_RETENTION_DAYS: asNumber(process.env.PDF_RETENTION_DAYS, 30),
  STRICT_STEGO_REJECTION: asBoolean(process.env.STRICT_STEGO_REJECTION, false),
  backendRoot,
  storageDir: path.join(backendRoot, 'storage'),
  uploadDir: path.join(backendRoot, 'storage', 'uploads'),
  pdfDir: path.join(backendRoot, 'storage', 'pdfs'),
  tempDir: path.join(backendRoot, 'storage', 'tmp')
};
