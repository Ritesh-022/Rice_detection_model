import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { listDirectoryFiles } from './storage.service.js';

let cleanupTimer = null;

async function removeOldFiles(directory, maxAgeMs) {
  const entries = await listDirectoryFiles(directory);
  const cutoff = Date.now() - maxAgeMs;

  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.mtimeMs < cutoff) {
            await fs.promises.rm(fullPath, { force: true });
          }
        } catch {
          return null;
        }
      })
  );
}

export async function runCleanupNow() {
  await removeOldFiles(env.tempDir, env.TEMP_RETENTION_HOURS * 60 * 60 * 1000);
  await removeOldFiles(env.pdfDir, env.PDF_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function startCleanupScheduler() {
  if (cleanupTimer) {
    return cleanupTimer;
  }

  cleanupTimer = setInterval(() => {
    runCleanupNow().catch((error) => {
      console.error('Cleanup job failed', error);
    });
  }, env.CLEANUP_INTERVAL_MS);

  cleanupTimer.unref?.();
  return cleanupTimer;
}

export function stopCleanupScheduler() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
