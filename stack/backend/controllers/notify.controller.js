import { AnalysisJob } from '../src/models/analysisJob.model.js';
import { sendReportEmail } from '../services/email.service.js';

export async function notifyByEmail(req, res, next) {
  try {
    const uuid = String(req.body?.uuid || '').trim();
    const email = String(req.body?.email || '').trim();

    if (!uuid) {
      return res.status(400).json({ success: false, error: { message: 'UUID is required' } });
    }

    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'A valid email address is required' } });
    }

    const job = await AnalysisJob.findOne({ jobId: uuid }).lean();
    if (!job) {
      return res.status(404).json({ success: false, error: { message: 'Analysis job not found' } });
    }

    if (String(job.status || '').toLowerCase() !== 'completed') {
      return res.status(409).json({ success: false, error: { message: 'Analysis is not completed yet' } });
    }

    const result = await sendReportEmail({ uuid, email });

    if (!result.success) {
      return res.status(result.error?.statusCode || 500).json({
        success: false,
        error: { message: result.error?.message || 'Failed to send notification' }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        uuid,
        emailSent: true,
        resultLink: result.data.resultLink,
        pdfRegenerated: result.data.pdfRegenerated,
        accepted: result.data.accepted,
        rejected: result.data.rejected
      }
    });
  } catch (error) {
    return next(error);
  }
}
