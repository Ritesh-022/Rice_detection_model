import fs from 'node:fs';

const PREDICT_URL = 'http://localhost:5000/predict';
const BATCH_URL = 'http://localhost:5000/batch';
const DEFAULT_TIMEOUT_MS = 180000;


async function readFileBlob(filePath, mimeType = 'application/octet-stream') {
  const buffer = await fs.promises.readFile(filePath);
  return new Blob([buffer], { type: mimeType });
}

async function postMultipart(url, files, region, fieldName, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formData = new FormData();

    if (region) {
      formData.append('region', region);
    }

    for (const file of files) {
      const filePath = typeof file === 'string' ? file : file?.path || file?.tempPath || file?.sanitizedPath;
      if (!filePath) {
        throw new Error('File path is required');
      }

      const mimeType = typeof file === 'object' ? file.mimeType : undefined;
      const originalName = typeof file === 'object'
        ? file.originalName || file.sanitizedName || filePath.split(/[\\/]/).pop()
        : filePath.split(/[\\/]/).pop();

      const blob = await readFileBlob(filePath, mimeType);
      formData.append(fieldName, blob, originalName);
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      const error = new Error(`Flask API failed with status ${response.status}`);
      error.status = response.status;
      error.body = text;
      throw error;
    }

    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text;
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Flask API request timed out after ${timeoutMs}ms`);
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeImage(file, region, options = {}) {
  return postMultipart(
    PREDICT_URL,
    [file],
    region,
    'image',
    options.timeoutMs || DEFAULT_TIMEOUT_MS
  );
}

export async function analyzeBatch(files, region, options = {}) {
  return postMultipart(
    BATCH_URL,
    files,
    region,
    'images',
    options.timeoutMs || DEFAULT_TIMEOUT_MS
  );
}

export async function analyze(files, region, options = {}) {
  const list = Array.isArray(files) ? files : [files];
  return list.length <= 1
    ? analyzeImage(list[0], region, options)
    : analyzeBatch(list, region, options);
}
