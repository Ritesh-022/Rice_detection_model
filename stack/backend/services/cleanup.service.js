import { AnalysisJob } from '../src/models/analysisJob.model.js';
import { removeFiles } from '../src/services/storage.service.js';

function collectImagePaths(job) {
  const files = Array.isArray(job?.files) ? job.files : [];
  return files
    .flatMap((file) => [file?.tempPath, file?.sanitizedPath])
    .filter(Boolean);
}

async function deleteJobImages(job) {
  const filePaths = collectImagePaths(job);
  if (!filePaths.length) {
    return {
      deleted: 0,
      failed: 0
    };
  }

  const results = await Promise.allSettled(
    filePaths.map((filePath) => removeFiles([filePath]))
  );

  return {
    deleted: filePaths.length,
    failed: results.filter((result) => result.status === 'rejected').length
  };
}

export async function cleanupProcessedJobArtifacts(jobOrId) {
  const job = typeof jobOrId === 'string'
    ? await AnalysisJob.findOne({ jobId: jobOrId })
    : jobOrId;

  if (!job) {
    return {
      deleted: 0,
      missing: true
    };
  }

  return deleteJobImages(job);
}

async function getRetainedSessions(limit = 10) {
  return AnalysisJob.find({
    status: { $in: ['COMPLETED', 'FAILED', 'PDF_READY'] }
  })
    .sort({ completedAt: -1, createdAt: -1 })
    .limit(Math.max(1, limit))
    .lean();
}

export async function retainLatestImageSessions(limit = 10) {
  const retained = await getRetainedSessions(limit);
  const retainedIds = new Set(retained.map((job) => job.jobId));

  const oldJobs = await AnalysisJob.find({
    jobId: { $nin: [...retainedIds] },
    status: { $in: ['COMPLETED', 'FAILED', 'PDF_READY'] }
  }).sort({ completedAt: -1, createdAt: -1 });

  const results = await Promise.allSettled(
    oldJobs.map((job) => deleteJobImages(job))
  );

  return {
    retained: retained.length,
    pruned: oldJobs.length,
    failed: results.filter((result) => result.status === 'rejected').length
  };
}
