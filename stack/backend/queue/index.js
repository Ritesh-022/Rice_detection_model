import { AnalysisJob } from '../src/models/analysisJob.model.js';
import { env } from '../src/config/env.js';
import { selectJobsWithKnapsack } from './knapsack.js';
import { processQueueJob } from './worker.js';

const pendingJobs = new Map();
const activeJobs = new Map();
let scheduler = null;

function normalizeJob(job) {
  if (!job) {
    return null;
  }

  if (typeof job === 'string') {
    return {
      uuid: job,
      image_count: 1,
      file_paths: [],
      enqueuedAt: new Date().toISOString()
    };
  }

  return {
    uuid: job.uuid || job.jobId,
    image_count: Number(job.image_count || job.fileCount || job.files?.length || 1),
    file_paths: Array.isArray(job.file_paths)
      ? job.file_paths
      : (job.files || []).map((file) => file.tempPath).filter(Boolean),
    files: job.files || [],
    region: job.region || 'Karnataka',
    enqueuedAt: job.enqueuedAt || new Date().toISOString()
  };
}

function getQueueCapacity() {
  return Math.max(1, Number(env.QUEUE_CAPACITY || 5));
}

function getConcurrencyLimit() {
  return Math.max(1, Number(env.QUEUE_CONCURRENCY || 2));
}

async function drainQueue() {
  const maxConcurrent = getConcurrencyLimit();
  if (activeJobs.size >= maxConcurrent) {
    return;
  }

  const candidates = [...pendingJobs.values()].filter((job) => !activeJobs.has(job.uuid));
  if (!candidates.length) {
    return;
  }

  const selected = selectJobsWithKnapsack(candidates, getQueueCapacity());

  for (const job of selected) {
    if (activeJobs.size >= maxConcurrent) {
      break;
    }

    if (activeJobs.has(job.uuid)) {
      continue;
    }

    activeJobs.set(job.uuid, job);
    pendingJobs.delete(job.uuid);

    void processQueueJob(job)
      .catch((error) => {
        console.error('Queue worker failed', {
          uuid: job.uuid,
          message: error.message
        });
      })
      .finally(() => {
        activeJobs.delete(job.uuid);
        drainQueue().catch((error) => {
          console.error('Queue drain failed', error);
        });
      });
  }
}

export async function enqueueJob(job) {
  const normalized = normalizeJob(job);
  if (!normalized?.uuid) {
    throw new Error('Queue job requires uuid');
  }

  pendingJobs.set(normalized.uuid, normalized);
  await drainQueue();
  return normalized;
}

export async function hydrateQueue() {
  const queuedJobs = await AnalysisJob.find({ status: 'QUEUED' }).sort({ createdAt: 1 }).lean();
  for (const job of queuedJobs) {
    pendingJobs.set(job.jobId, normalizeJob({
      uuid: job.jobId,
      image_count: job.fileCount,
      file_paths: (job.files || []).map((file) => file.tempPath).filter(Boolean),
      files: job.files || [],
      region: job.region,
      enqueuedAt: job.createdAt
    }));
  }
}

export function getQueueSnapshotSync() {
  return {
    pending: pendingJobs.size,
    active: activeJobs.size
  };
}

export async function getQueueSnapshot() {
  return getQueueSnapshotSync();
}

export function startQueueScheduler() {
  if (scheduler) {
    return scheduler;
  }

  scheduler = setInterval(() => {
    drainQueue().catch((error) => {
      console.error('Queue drain failed', error);
    });
  }, 1000);

  scheduler.unref?.();
  return scheduler;
}

export function stopQueueScheduler() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
}
