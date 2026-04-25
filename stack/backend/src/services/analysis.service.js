import crypto from 'node:crypto';
import { AnalysisJob } from '../models/analysisJob.model.js';
import { env } from '../config/env.js';
import { analyzeSteganography } from './steganography.service.js';
import {
  computeSha256,
  detectMimeFromBuffer,
  extensionFromMime,
  getImageDimensions,
  sanitizeFileName
} from '../utils/file.js';
import { removeFiles, writeTempFile } from './storage.service.js';

function buildQueueMetrics(files) {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const stegoAverage = files.length
    ? files.reduce((sum, file) => sum + file.steganography.score, 0) / files.length
    : 0;

  const queueWeight = Math.max(
    1,
    Math.ceil(totalBytes / (1024 * 1024)) + files.length * 2 + Math.ceil(stegoAverage / 10)
  );

  const queuePriority = Math.max(
    1,
    Math.ceil((files.length * 12) + (Math.max(0, 40 - queueWeight) * 2) + Math.ceil(stegoAverage))
  );

  return { queueWeight, queuePriority };
}

async function validateAndStoreFile(jobId, file, index) {
  if (!file?.buffer?.length) {
    throw new Error(`File ${index + 1} is empty`);
  }

  const detectedMime = detectMimeFromBuffer(file.buffer);
  if (!detectedMime) {
    throw new Error(`File ${file.originalname} is not a supported image`);
  }

  if (detectedMime !== file.mimetype) {
    throw new Error(`File ${file.originalname} failed mime validation`);
  }

  const sha256 = computeSha256(file.buffer);
  const extension = extensionFromMime(detectedMime);
  const sanitizedName = sanitizeFileName(file.originalname);
  const tempPath = await writeTempFile(jobId, index, file.buffer, extension);
  const { width, height } = getImageDimensions(file.buffer, detectedMime);
  const steganography = analyzeSteganography(file.buffer, detectedMime);

  return {
    originalName: file.originalname,
    sanitizedName,
    mimeType: detectedMime,
    size: file.size,
    sha256,
    extension,
    width,
    height,
    steganography,
    tempPath
  };
}

export async function createQueuedAnalysisJob({ files, region, metadata, userMode = 'farmer' }) {
  const jobId = crypto.randomUUID();
  const storedFiles = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const storedFile = await validateAndStoreFile(jobId, files[index], index);
      storedFiles.push(storedFile);
    }

    const warnings = [];
    for (const file of storedFiles) {
      if (file.steganography.suspicious) {
        warnings.push(`Potential steganography detected in ${file.originalName}`);
      }
    }

    const { queueWeight, queuePriority } = buildQueueMetrics(storedFiles);
    const requestType = storedFiles.length > 1 ? 'batch' : 'predict';
    const strictStego = env.STRICT_STEGO_REJECTION && storedFiles.some((file) => file.steganography.suspicious);

    if (strictStego) {
      throw new Error('Upload rejected because the file set appears to contain steganography');
    }

    const job = await AnalysisJob.create({
      jobId,
      status: 'QUEUED',
      region,
      userMode,
      requestType,
      fileCount: storedFiles.length,
      totalBytes: storedFiles.reduce((sum, file) => sum + file.size, 0),
      queueWeight,
      queuePriority,
      files: storedFiles,
      warnings,
      metadata,
      events: [{
        status: 'QUEUED',
        message: 'Upload accepted and queued'
      }]
    });

    return job;
  } catch (error) {
    await removeFiles(storedFiles.map((file) => file.tempPath));
    throw error;
  }
}

export async function getAnalysisJobById(jobId) {
  return AnalysisJob.findOne({ jobId }).lean();
}

export async function updateJobStatus(jobId, patch) {
  const job = await AnalysisJob.findOne({ jobId });
  if (!job) {
    return null;
  }

  const { message, ...rest } = patch;
  Object.assign(job, rest);
  if (patch.status) {
    job.addEvent(patch.status, message || '');
  }

  await job.save();
  return job;
}

export async function cleanupJobTempFiles(job) {
  const paths = (job.files || []).map((file) => file.tempPath);
  await removeFiles(paths);
}
