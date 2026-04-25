import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { pdfPathForJob } from './storage.service.js';

function writeKeyValue(doc, label, value) {
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(String(value ?? 'N/A'));
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export async function generateAnalysisPdf(job) {
  const pdfPath = pdfPathForJob(job.jobId);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = fs.createWriteStream(pdfPath);

  doc.pipe(stream);

  doc.fontSize(20).font('Helvetica-Bold').text('Rice Grain Analysis Report');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').text(`Job ID: ${job.jobId}`);
  doc.text(`Status: ${job.status}`);
  doc.text(`Created At: ${new Date(job.createdAt).toISOString()}`);
  doc.text(`Region: ${job.region}`);
  doc.text(`Request Type: ${job.requestType}`);
  doc.text(`File Count: ${job.fileCount}`);
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text('Upload Summary');
  doc.moveDown(0.25);
  writeKeyValue(doc, 'Total Bytes', job.totalBytes);
  writeKeyValue(doc, 'Queue Weight', job.queueWeight);
  writeKeyValue(doc, 'Queue Priority', job.queuePriority);

  if (job.warnings?.length) {
    doc.moveDown(0.25);
    doc.font('Helvetica-Bold').text('Warnings');
    doc.font('Helvetica');
    for (const warning of job.warnings) {
      doc.text(`- ${warning}`);
    }
  }

  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('Files');
  doc.font('Helvetica');
  for (const file of job.files) {
    doc.text(`- ${file.originalName} (${file.mimeType}, ${file.size} bytes)`);
    doc.text(`  Dimensions: ${file.width || 'unknown'} x ${file.height || 'unknown'}`);
    doc.text(`  Stego score: ${file.steganography.score} | suspicious: ${file.steganography.suspicious}`);
    if (file.steganography.reasons?.length) {
      for (const reason of file.steganography.reasons) {
        doc.text(`  - ${reason}`);
      }
    }
  }

  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('ML Response');
  doc.font('Courier').fontSize(8);
  doc.text(safeJson(job.mlResponse || {}), {
    width: doc.page.width - 80
  });

  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(14).text('Error Details');
  doc.font('Helvetica').fontSize(10);
  writeKeyValue(doc, 'Error Message', job.error?.message || 'None');

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return pdfPath;
}
