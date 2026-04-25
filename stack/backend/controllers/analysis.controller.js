import crypto from 'node:crypto';
import { AnalysisJob } from '../src/models/analysisJob.model.js';
import { enqueueJob } from '../queue/index.js';
import { sanitizeImageUploads } from '../services/file.service.js';
import { removeFiles } from '../src/services/storage.service.js';

function toFileRecord(file) {
  return {
    originalName: file.originalName,
    sanitizedName: file.sanitizedName,
    mimeType: file.mimeType,
    size: file.sizeAfter,
    sha256: file.hashAfter,
    extension: file.normalizedFormat === 'jpeg' ? 'jpg' : 'png',
    width: file.width,
    height: file.height,
    steganography: file.steganography,
    tempPath: file.sanitizedPath
  };
}

function buildQueueWeight(totalFiles, totalBytes) {
  const mb = totalBytes / (1024 * 1024);
  return Math.max(1, Math.ceil(totalFiles + mb));
}

function buildQueuePriority(totalFiles, totalBytes, suspiciousCount) {
  const base = 100 - Math.ceil(totalBytes / (1024 * 1024));
  return Math.max(1, base + totalFiles * 5 - suspiciousCount * 10);
}

export async function createAnalysisJob(req, res, next) {
  const sourceFiles = req.files || [];
  const region = String(req.body?.region || 'Karnataka').trim();

  try {
    const jobId = crypto.randomUUID();
    const sanitized = await sanitizeImageUploads(sourceFiles, { jobId });
    const fileRecords = sanitized.metadata.map(toFileRecord);
    const totalBytes = fileRecords.reduce((sum, file) => sum + file.size, 0);
    const suspiciousCount = fileRecords.filter((file) => file.steganography?.suspicious).length;

    const job = await AnalysisJob.create({
      jobId,
      status: 'QUEUED',
      region,
      mlResponse: null,
      requestType: fileRecords.length > 1 ? 'batch' : 'predict',
      fileCount: fileRecords.length,
      totalBytes,
      queueWeight: buildQueueWeight(fileRecords.length, totalBytes),
      queuePriority: buildQueuePriority(fileRecords.length, totalBytes, suspiciousCount),
      files: fileRecords,
      warnings: suspiciousCount
        ? ['Potential steganography detected in uploaded image set']
        : [],
      events: [{
        status: 'QUEUED',
        message: 'Upload accepted and job queued'
      }]
    });

    await enqueueJob({
      uuid: job.jobId,
      image_count: fileRecords.length,
      file_paths: fileRecords.map((file) => file.tempPath),
      files: fileRecords,
      region: job.region,
      enqueuedAt: job.createdAt
    });

    return res.status(202).json({
      success: true,
      data: {
        uuid: job.jobId,
        status: 'queued'
      }
    });
  } catch (error) {
    if (sourceFiles.length) {
      await removeFiles(
        sourceFiles
          .map((file) => file.path || file.tempPath)
          .filter(Boolean)
      ).catch(() => {});
    }

    return next(error);
  }
}

export async function getAnalysisResult(req, res, next) {
  try {
    const job = await AnalysisJob.findOne({ jobId: req.params.uuid }).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Result not found'
        }
      });
    }

    const status = String(job.status || '').toLowerCase();

    if (status === 'queued' || status === 'processing') {
      return res.json({
        success: true,
        data: {
          uuid: job.jobId,
          status
        }
      });
    }

    if (status === 'completed') {
      return res.json({
        success: true,
        data: {
          uuid: job.jobId,
          status,
          ml_response: job.mlResponse
        }
      });
    }

    if (status === 'failed') {
      return res.status(500).json({
        success: false,
        data: {
          uuid: job.jobId,
          status,
          error: job.error?.message || 'Job failed'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        uuid: job.jobId,
        status
      }
    });
  } catch (error) {
    return next(error);
  }
}
