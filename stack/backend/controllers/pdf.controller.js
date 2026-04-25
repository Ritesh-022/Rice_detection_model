import fs from 'node:fs';
import { AnalysisJob } from '../src/models/analysisJob.model.js';
import { getOrCreatePdf } from '../services/pdf.service.js';
import { sendReportEmail } from '../services/email.service.js';

export async function getPdf(req, res, next) {
  try {
    const job = await AnalysisJob.findOne({ jobId: req.params.uuid });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { message: 'Analysis job not found' }
      });
    }

    const regenerate = String(req.query.regenerate || '').toLowerCase() === 'true';
    const result = await getOrCreatePdf(job, regenerate);

    if (!fs.existsSync(result.pdfPath)) {
      return res.status(404).json({
        success: false,
        error: { message: 'PDF not available' }
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${job.jobId}.pdf"`);
    return res.sendFile(result.pdfPath);
  } catch (error) {
    return next(error);
  }
}

export async function emailPdf(req, res, next) {
  try {
    const { email } = req.body || {};
    const result = await sendReportEmail({
      uuid: req.params.uuid,
      email,
    });

    if (!result.success) {
      return res.status(result.error?.statusCode || 500).json({
        success: false,
        error: {
          message: result.error?.message || 'Failed to send report email'
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        uuid: req.params.uuid,
        emailSent: true,
        resultLink: result.data.resultLink,
        accepted: result.data.accepted,
        rejected: result.data.rejected
      }
    });
  } catch (error) {
    return next(error);
  }
}
