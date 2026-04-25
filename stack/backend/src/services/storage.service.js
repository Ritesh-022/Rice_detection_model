import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

export function ensureStorageDirectories() {
  for (const dir of [env.storageDir, env.uploadDir, env.pdfDir, env.tempDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function writeTempFile(jobId, index, buffer, extension) {
  ensureStorageDirectories();
  const fileName = `${jobId}_${index}.${extension}`;
  const filePath = path.join(env.tempDir, fileName);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

export async function removeFiles(filePaths = []) {
  await Promise.allSettled(
    filePaths.filter(Boolean).map((filePath) => fs.promises.rm(filePath, { force: true }))
  );
}

export function pdfPathForJob(jobId) {
  ensureStorageDirectories();
  return path.join(env.pdfDir, `${jobId}.pdf`);
}

export async function listDirectoryFiles(dirPath) {
  try {
    return await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}
