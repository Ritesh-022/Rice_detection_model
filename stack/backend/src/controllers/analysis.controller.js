import fs from 'node:fs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createQueuedAnalysisJob, getAnalysisJobById } from '../services/analysis.service.js';
import { enqueueJob, getQueueSnapshotSync } from '../services/analysisQueue.service.js';
import { generateAnalysisPdf } from '../services/pdf.service.js';
import { pdfPathForJob } from '../services/storage.service.js';
import { AnalysisJob } from '../models/analysisJob.model.js';

function normalizeRegion(region) {
  return String(region || 'Karnataka').trim() || 'Karnataka';
}

function normalizeUserMode(userMode) {
  const mode = String(userMode || 'farmer').toLowerCase().trim();
  return ['farmer', 'consumer'].includes(mode) ? mode : 'farmer';
}

export const createAnalysisJob = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({
      success: false,
      error: { message: 'At least one image is required' }
    });
  }

  const region = normalizeRegion(req.body.region);
  const userMode = normalizeUserMode(req.body.userMode);

  const job = await createQueuedAnalysisJob({
    files,
    region,
    userMode,
    metadata: {
      userAgent: req.get('user-agent') || null,
      ipAddress: req.ip || req.socket?.remoteAddress || null
    }
  });

  await enqueueJob(job.jobId);

  return res.status(202).json({
    success: true,
    message: 'Analysis queued',
    data: {
      jobId: job.jobId,
      status: job.status,
      requestType: job.requestType,
      fileCount: job.fileCount,
      userMode: job.userMode,
      warnings: job.warnings
    }
  });
});

export const getAnalysisJob = asyncHandler(async (req, res) => {
  const job = await getAnalysisJobById(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: { message: 'Analysis job not found' }
    });
  }

  return res.json({
    success: true,
    data: {
      ...job,
      pdfAvailable: Boolean(job.pdf?.path && fs.existsSync(job.pdf.path))
    }
  });
});

export const streamPdf = asyncHandler(async (req, res) => {
  const job = await AnalysisJob.findOne({ jobId: req.params.jobId });
  if (!job) {
    return res.status(404).json({
      success: false,
      error: { message: 'Analysis job not found' }
    });
  }

  const pdfPath = job.pdf?.path || pdfPathForJob(job.jobId);
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({
      success: false,
      error: { message: 'PDF not available for this job' }
    });
  }

  res.type('pdf');
  return res.sendFile(pdfPath);
});

export const regeneratePdf = asyncHandler(async (req, res) => {
  const job = await AnalysisJob.findOne({ jobId: req.params.jobId });
  if (!job) {
    return res.status(404).json({
      success: false,
      error: { message: 'Analysis job not found' }
    });
  }

  if (!job.mlResponse) {
    return res.status(409).json({
      success: false,
      error: { message: 'PDF can only be regenerated after analysis completes' }
    });
  }

  job.status = 'REGENERATING_PDF';
  job.addEvent('REGENERATING_PDF', 'Regenerating analysis PDF');
  await job.save();

  const pdfPath = await generateAnalysisPdf(job);
  job.pdf = job.pdf || {};
  job.status = 'PDF_READY';
  job.pdf.path = pdfPath;
  job.pdf.regeneratedAt = new Date();
  job.addEvent('PDF_READY', 'PDF regenerated successfully');
  await job.save();

  return res.json({
    success: true,
    message: 'PDF regenerated',
    data: {
      jobId: job.jobId,
      pdfPath
    }
  });
});

export const getQueueSnapshot = asyncHandler(async (req, res) => {
  return res.json({
    success: true,
    data: getQueueSnapshotSync()
  });
});
