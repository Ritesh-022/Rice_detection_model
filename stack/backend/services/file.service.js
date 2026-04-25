import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../src/config/env.js';
import { analyzeSteganography } from '../src/services/steganography.service.js';

const MAX_IMAGES = 5;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

function ensureOutputDir() {
  const outputDir = path.join(env.uploadDir, 'sanitized');
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function detectImageMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  return null;
}

function normalizeExtension(mimeType) {
  return mimeType === 'image/png' ? 'png' : 'jpg';
}

function normalizeFormat(mimeType) {
  return mimeType === 'image/png' ? 'png' : 'jpeg';
}

function sanitizeFileName(name, fallbackIndex) {
  const base = path.basename(name || `image_${fallbackIndex}`);
  return base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    || `image_${fallbackIndex}`;
}

async function readUploadBuffer(file) {
  if (file?.buffer?.length) {
    return file.buffer;
  }

  if (file?.path) {
    return fs.promises.readFile(file.path);
  }

  throw new Error('Missing upload buffer');
}

async function sanitizeSingleFile(file, jobId, index, outputDir) {
  const originalBuffer = await readUploadBuffer(file);
  const detectedMime = detectImageMime(originalBuffer);

  if (!detectedMime) {
    throw new Error(`File ${file?.originalname || index + 1} is not a valid JPG or PNG image`);
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error(`File ${file.originalname || index + 1} has an unsupported mime type`);
  }

  if (file.mimetype && file.mimetype !== detectedMime && !(file.mimetype === 'image/jpg' && detectedMime === 'image/jpeg')) {
    throw new Error(`File ${file.originalname || index + 1} mime type does not match its contents`);
  }

  const originalHash = crypto.createHash('sha256').update(originalBuffer).digest('hex');
  const metadataBefore = await sharp(originalBuffer, { failOnError: true }).metadata();
  const format = normalizeFormat(detectedMime);
  const extension = normalizeExtension(detectedMime);
  const baseName = sanitizeFileName(file.originalname, index + 1);
  const outputName = `${jobId}_${index + 1}_${baseName.replace(/\.[^.]+$/, '')}.${extension}`;
  const outputPath = path.join(outputDir, outputName);

  const sanitizedBuffer = await sharp(originalBuffer, { failOnError: true })
    .rotate()
    .toFormat(format, format === 'jpeg'
      ? { quality: 90, mozjpeg: true }
      : { compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  await fs.promises.writeFile(outputPath, sanitizedBuffer);

  const sanitizedHash = crypto.createHash('sha256').update(sanitizedBuffer).digest('hex');
  const metadataAfter = await sharp(sanitizedBuffer).metadata();
  const steganography = analyzeSteganography(originalBuffer, detectedMime);

  return {
    originalName: file.originalname || baseName,
    sanitizedName: path.basename(outputPath),
    sanitizedPath: outputPath,
    mimeType: detectedMime,
    normalizedFormat: format,
    sizeBefore: originalBuffer.length,
    sizeAfter: sanitizedBuffer.length,
    hashBefore: originalHash,
    hashAfter: sanitizedHash,
    width: metadataAfter.width || metadataBefore.width || null,
    height: metadataAfter.height || metadataBefore.height || null,
    exifRemoved: true,
    steganography,
    createdAt: new Date().toISOString()
  };
}

export async function sanitizeImageUploads(files, options = {}) {
  const uploadFiles = Array.isArray(files) ? files : [];
  if (uploadFiles.length === 0) {
    throw new Error('At least one image is required');
  }

  if (uploadFiles.length > MAX_IMAGES) {
    throw new Error(`A maximum of ${MAX_IMAGES} images are allowed`);
  }

  const jobId = options.jobId || crypto.randomUUID();
  const outputDir = ensureOutputDir();
  const sanitized = [];

  for (let index = 0; index < uploadFiles.length; index += 1) {
    sanitized.push(await sanitizeSingleFile(uploadFiles[index], jobId, index, outputDir));
  }

  return {
    jobId,
    sanitizedFilePaths: sanitized.map((file) => file.sanitizedPath),
    metadata: sanitized,
    totalFiles: sanitized.length,
    totalBytesBefore: sanitized.reduce((sum, file) => sum + file.sizeBefore, 0),
    totalBytesAfter: sanitized.reduce((sum, file) => sum + file.sizeAfter, 0)
  };
}

export { MAX_IMAGES, ALLOWED_MIME_TYPES };
