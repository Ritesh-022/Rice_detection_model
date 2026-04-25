import fs from 'node:fs';
import { flaskConfig } from '../config/flask.js';
import { logError, logInfo } from '../utils/logger.js';

async function requestJson(url, options = {}) {
  const { timeoutMs = flaskConfig.timeoutMs, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const endpointName = url.includes('/predict')
    ? 'Flask /predict'
    : url.includes('/batch')
      ? 'Flask /batch'
      : url.includes('/health')
        ? 'Flask /health'
        : 'Flask request';

  try {
    logInfo(`Calling ${endpointName}`, {
      url,
      method
    });

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });

    const text = await response.text();
    let parsed = null;

    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    const durationMs = Date.now() - startedAt;
    logInfo(`${endpointName} completed`, {
      url,
      method,
      statusCode: response.status,
      durationMs
    });

    if (!response.ok) {
      const error = new Error(`Flask API request failed with status ${response.status}`);
      error.statusCode = 502;
      error.details = parsed;
      logError(`${endpointName} failed`, {
        url,
        method,
        statusCode: response.status,
        durationMs,
        details: parsed
      });
      throw error;
    }

    return parsed;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logError(`${endpointName} errored`, {
      url,
      method,
      durationMs,
      message: error?.message,
      stack: error?.stack
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function buildFormData(files, region, fieldName, userMode = 'farmer') {
  const form = new FormData();
  form.set('region', region);
  form.set('user_mode', userMode);

  for (const file of files) {
    const buffer = await fs.promises.readFile(file.tempPath);
    const blob = new Blob([buffer], { type: file.mimeType });
    form.append(fieldName, blob, file.sanitizedName || file.originalName);
  }

  return form;
}

export async function callPredictApi(file, region, userMode = 'farmer') {
  const form = await buildFormData([file], region, 'image', userMode);
  return requestJson(flaskConfig.predictUrl, {
    method: 'POST',
    body: form
  });
}

export async function callBatchApi(files, region, userMode = 'farmer') {
  const form = await buildFormData(files, region, 'images', userMode);
  return requestJson(flaskConfig.batchUrl, {
    method: 'POST',
    body: form
  });
}

export async function checkFlaskHealth() {
  return requestJson(flaskConfig.healthUrl, { method: 'GET', timeoutMs: 5000 });
}
