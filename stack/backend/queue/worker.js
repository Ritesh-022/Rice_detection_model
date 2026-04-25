import { AnalysisJob } from '../src/models/analysisJob.model.js';
import { callBatchApi, callPredictApi } from '../src/services/flaskClient.service.js';
import { generatePdfFromMlResponse } from '../services/pdf.service.js';
import { retainLatestImageSessions } from '../services/cleanup.service.js';
import { updateJobStatus } from '../src/services/analysis.service.js';

async function callFlaskForJob(job) {
  const files = job.files || [];
  const payloadFiles = files.map((file) => ({
    tempPath: file.tempPath,
    mimeType: file.mimeType,
    sanitizedName: file.sanitizedName || file.originalName || file.tempPath
  }));

  const userMode = job.userMode || 'farmer';
  console.log(`[Worker] Processing job ${job.jobId} with userMode: ${userMode}`);

  if (payloadFiles.length <= 1) {
    return callPredictApi(payloadFiles[0], job.region, userMode);
  }
  return callBatchApi(payloadFiles, job.region, userMode);
}

export async function processQueueJob(jobRef) {
  const uuid = typeof jobRef === 'string' ? jobRef : jobRef?.uuid;
  if (!uuid) {
    throw new Error('Queue job is missing uuid');
  }

  const job = await AnalysisJob.findOne({ jobId: uuid });
  if (!job) {
    return { uuid, status: 'missing' };
  }

  await updateJobStatus(uuid, {
    status: 'PROCESSING',
    startedAt: new Date(),
    message: 'Job moved to processing'
  });

  try {
    const mlResponse = await callFlaskForJob(job);

    await AnalysisJob.updateOne(
      { jobId: uuid },
      {
        $set: {
          mlResponse,
          status: 'COMPLETED',
          completedAt: new Date()
        },
        $push: {
          events: {
            status: 'COMPLETED',
            message: 'Flask API response stored',
            at: new Date()
          }
        }
      }
    );

    // Re-fetch the job so generatePdfFromMlResponse receives the saved mlResponse,
    // not the stale in-memory object that still has mlResponse: null.
    const updatedJob = await AnalysisJob.findOne({ jobId: uuid });
    const pdfPath = await generatePdfFromMlResponse(updatedJob);

    await AnalysisJob.updateOne(
      { jobId: uuid },
      {
        $set: {
          'pdf.path': pdfPath
        }
      }
    );

    return {
      uuid,
      status: 'completed',
      pdfPath
    };
  } catch (error) {
    await AnalysisJob.updateOne(
      { jobId: uuid },
      {
        $set: {
          status: 'FAILED',
          error: {
            message: error.message,
            stack: error.stack
          },
          completedAt: new Date()
        },
        $push: {
          events: {
            status: 'FAILED',
            message: error.message,
            at: new Date()
          }
        }
      }
    );

    throw error;
  } finally {
    await retainLatestImageSessions(10);
  }
}
