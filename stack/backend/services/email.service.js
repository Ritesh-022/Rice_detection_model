import fs from 'node:fs';
import nodemailer from 'nodemailer';
import { env } from '../src/config/env.js';
import { AnalysisJob } from '../src/models/analysisJob.model.js';
import { getOrCreatePdf } from './pdf.service.js';
import { buildEmailHtml, buildEmailText } from './email.template.js';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function buildResultLink(uuid) {
  const base = env.FRONTEND_URL || 'http://localhost:5173';
  return `${base}/result/${uuid}`;
}

function createTransporter() {
  if (!env.SMTP_HOST && !env.SMTP_SERVICE) {
    throw new Error('SMTP configuration is missing');
  }

  const config = env.SMTP_SERVICE
    ? { service: env.SMTP_SERVICE }
    : {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE
      };

  if (env.SMTP_USER) {
    config.auth = {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    };
  }

  return nodemailer.createTransport(config);
}

async function resolvePdf(job) {
  // Always regenerate so the PDF reflects the latest ML + LangChain data
  const pdfResult = await getOrCreatePdf(job, true);
  if (!pdfResult?.pdfPath || !fs.existsSync(pdfResult.pdfPath)) {
    const error = new Error('PDF is not available for this job');
    error.statusCode = 404;
    throw error;
  }
  return {
    pdfPath: pdfResult.pdfPath,
    regenerated: Boolean(pdfResult.generated)
  };
}

export async function sendReportEmail({ uuid, email, subject, text } = {}) {
  const cleanedUuid = String(uuid || '').trim();
  const cleanedEmail = String(email || '').trim();

  if (!cleanedUuid) {
    return {
      success: false,
      error: {
        message: 'UUID is required',
        statusCode: 400
      }
    };
  }

  if (!isValidEmail(cleanedEmail)) {
    return {
      success: false,
      error: {
        message: 'A valid email address is required',
        statusCode: 400
      }
    };
  }

  try {
    const job = await AnalysisJob.findOne({ jobId: cleanedUuid });
    if (!job) {
      return {
        success: false,
        error: {
          message: 'Analysis job not found',
          statusCode: 404
        }
      };
    }

    if (!job.mlResponse) {
      return {
        success: false,
        error: {
          message: 'ML data is not available for this job',
          statusCode: 409
        }
      };
    }

    const resolvedPdf = await resolvePdf(job);
    const transporter = createTransporter();
    const fromAddress = env.SMTP_FROM || env.SMTP_USER;

    if (!fromAddress) {
      return {
        success: false,
        error: {
          message: 'SMTP_FROM is not configured',
          statusCode: 500
        }
      };
    }

    const resultLink = buildResultLink(cleanedUuid);
    const mailSubject = subject || `Your Rice Quality Report`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: cleanedEmail,
      subject: mailSubject,
      text: text || buildEmailText(cleanedUuid, resultLink),
      html: buildEmailHtml(cleanedUuid, resultLink),
      attachments: [
        {
          filename: `${cleanedUuid}.pdf`,
          path: resolvedPdf.pdfPath
        }
      ]
    });

    return {
      success: true,
      data: {
        uuid: cleanedUuid,
        resultLink,
        messageId: info.messageId,
        accepted: info.accepted || [],
        rejected: info.rejected || [],
        pdfPath: resolvedPdf.pdfPath,
        pdfRegenerated: resolvedPdf.regenerated
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message || 'Failed to send report email',
        statusCode: error.statusCode || 500
      }
    };
  }
}
