import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { AnalysisJob } from '../src/models/analysisJob.model.js';
import { pdfPathForJob } from '../src/services/storage.service.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function asObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function textValue(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

// ── chart drawing ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
  [34, 197, 94],
  [248, 113, 113],
  [245, 158, 11],
  [96, 165, 250],
  [167, 139, 250],
  [52, 211, 153],
  [251, 191, 36],
  [244, 114, 182],
];

function drawPieChart(doc, cx, cy, radius, segments, innerRadius = 0) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;

  segments.forEach((seg, i) => {
    const slice = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + slice;
    const [r, g, b] = seg.color || CHART_COLORS[i % CHART_COLORS.length];

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = slice > Math.PI ? 1 : 0;

    if (innerRadius > 0) {
      const ix1 = cx + innerRadius * Math.cos(endAngle);
      const iy1 = cy + innerRadius * Math.sin(endAngle);
      const ix2 = cx + innerRadius * Math.cos(startAngle);
      const iy2 = cy + innerRadius * Math.sin(startAngle);
      doc.save().fillColor([r, g, b])
        .path(`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`)
        .fill().restore();
    } else {
      doc.save().fillColor([r, g, b])
        .path(`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`)
        .fill().restore();
    }
    startAngle = endAngle;
  });

  doc.save().circle(cx, cy, radius).lineWidth(1).strokeColor([15, 23, 42]).stroke().restore();
  if (innerRadius > 0) {
    doc.save().circle(cx, cy, innerRadius).lineWidth(1).strokeColor([15, 23, 42]).stroke().restore();
  }
}

function drawLegend(doc, x, y, items, total) {
  items.forEach((item, i) => {
    const [r, g, b] = item.color || CHART_COLORS[i % CHART_COLORS.length];
    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
    doc.save().rect(x, y + i * 18, 10, 10).fillColor([r, g, b]).fill().restore();
    doc.fontSize(9).fillColor('#334155').font('Helvetica')
      .text(`${item.label} — ${pct}%`, x + 14, y + i * 18 + 1);
  });
}

// ── section helpers ───────────────────────────────────────────────────────────

function addSection(doc, title) {
  doc.moveDown(0.6);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(title);
  doc.moveDown(0.2)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  doc.moveDown(0.3);
}

function kv(doc, label, value) {
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569').text(`${label}: `, { continued: true });
  doc.font('Helvetica').fillColor('#0f172a').text(String(value ?? 'N/A'));
}

// ── chart segment builders — all from real ML data ────────────────────────────

function buildQualitySegments(summary) {
  const health    = Math.min(100, Math.max(0, Number(summary.health_percentage) || 0));
  const remaining = Math.max(0, 100 - health);
  const fill = health >= 75 ? [34,197,94] : health >= 50 ? [245,158,11] : [248,113,113];
  return [
    { label: `Healthy (${Math.round(health)}%)`,   value: Math.round(health),    color: fill       },
    { label: `Unhealthy (${Math.round(remaining)}%)`, value: Math.round(remaining), color: [248,113,113] },
  ].filter(s => s.value > 0);
}

function buildRiskSegments(summary) {
  const health    = Math.min(100, Math.max(0, Number(summary.health_percentage) || 0));
  const remaining = Math.max(0, 100 - health);
  return [
    { label: `Healthy ${Math.round(health)}%`,   value: Math.round(health),    color: [34,197,94]   },
    { label: `Unhealthy ${Math.round(remaining)}%`, value: Math.round(remaining), color: [248,113,113] },
  ].filter(s => s.value > 0);
}

function buildGrainSegments(summary) {
  const grainCount = Number(summary.grain_count) || 0;
  const healthDist = summary.health_distribution;
  if (healthDist && typeof healthDist === 'object' && Object.keys(healthDist).length > 0) {
    return Object.entries(healthDist)
      .filter(([, v]) => Number(v) > 0)
      .map(([name, value], i) => {
        const pct = grainCount > 0 ? Math.round((Number(value) / grainCount) * 100) : Number(value);
        return {
          label: `${name.replace(/_/g, ' ')} (${pct}%)`,
          value: pct,
          color: CHART_COLORS[i % CHART_COLORS.length],
        };
      });
  }
  const classDist = summary.class_distribution;
  if (classDist && typeof classDist === 'object' && Object.keys(classDist).length > 0) {
    return Object.entries(classDist)
      .filter(([, v]) => Number(v) > 0)
      .map(([name, value], i) => {
        const pct = grainCount > 0 ? Math.round((Number(value) / grainCount) * 100) : Number(value);
        return { label: `${name} (${pct}%)`, value: pct, color: CHART_COLORS[i % CHART_COLORS.length] };
      });
  }
  const health = Math.min(100, Math.max(0, Number(summary.health_percentage) || 0));
  return [{ label: `${summary.dominant_type || 'Unknown'} (${Math.round(health)}%)`, value: Math.round(health) || 1, color: [96,165,250] }];
}

// ── main export ───────────────────────────────────────────────────────────────

export async function generatePdfFromMlResponse(jobOrId) {
  const job = typeof jobOrId === 'string'
    ? await AnalysisJob.findOne({ jobId: jobOrId })
    : jobOrId;

  if (!job) throw new Error('Analysis job not found');

  // ml is the raw Flask response — market_price, shelf_life, supply_chain,
  // llm_response are all top-level fields on it.
  const ml      = asObject(job.mlResponse);
  const summary = asObject(ml.summary);
  const iot     = asObject(ml.iot_data);

  const health       = Number(summary.health_percentage ?? 0);
  const grainCount   = Number(summary.grain_count       ?? 0);
  const healthyCount = Number(summary.healthy_count     ?? 0);
  const unhealthyCount = Number(summary.unhealthy_count ?? 0);
  const dominantType = summary.dominant_type || 'N/A';
  const marketPrice  = ml.market_price != null ? `₹${(Number(ml.market_price) * 1000).toLocaleString('en-IN')} / 1000 kg` : 'N/A';
  const shelfLife    = textValue(ml.shelf_life);
  const supplyChain  = textValue(ml.supply_chain);
  const llmResponse  = textValue(ml.llm_response);
  const region       = summary.region || job.region || 'N/A';

  const qualitySegs = buildQualitySegments(summary);
  const riskSegs    = buildRiskSegments(summary);
  const grainSegs   = buildGrainSegments(summary);

  const pdfPath = pdfPathForJob(job.jobId);
  const doc     = new PDFDocument({ margin: 48, size: 'A4' });
  const stream  = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 80).fill('#0f172a');
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#f8fafc')
    .text('Rice Quality Analysis Report', doc.page.margins.left, 24);
  doc.fontSize(10).font('Helvetica').fillColor('#94a3b8')
    .text(`Generated: ${new Date().toLocaleString('en-IN')}`, doc.page.margins.left, 52);
  doc.y = 100;

  // ── Job Details ───────────────────────────────────────────────────────────
  addSection(doc, 'Job Details');
  kv(doc, 'Job ID',       job.jobId);
  kv(doc, 'Region',       region);
  kv(doc, 'Status',       job.status);
  kv(doc, 'Request Type', job.requestType);
  kv(doc, 'File Count',   job.fileCount);
  kv(doc, 'Created At',   new Date(job.createdAt).toLocaleString('en-IN'));

  // ── Analysis Summary ──────────────────────────────────────────────────────
  addSection(doc, 'Analysis Summary');
  kv(doc, 'Rice Type',      dominantType);
  kv(doc, 'Total Grains',   grainCount);
  kv(doc, 'Healthy Grains', healthyCount);
  kv(doc, 'Unhealthy Grains', unhealthyCount);
  kv(doc, 'Health Score',   `${Math.round(health)}%`);
  kv(doc, 'Quality Grade',  supplyChain !== 'N/A' ? supplyChain : (health >= 90 ? 'Premium Export' : health >= 75 ? 'Local Market' : health >= 50 ? 'Processing Industry' : 'Animal Feed / Waste'));
  kv(doc, 'Market Price',   marketPrice);
  kv(doc, 'Shelf Life',     shelfLife);
  kv(doc, 'Supply Chain',   supplyChain);

  // Health distribution breakdown
  const healthDist = summary.health_distribution;
  if (healthDist && typeof healthDist === 'object') {
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569').text('Health Breakdown:');
    Object.entries(healthDist).forEach(([label, count]) => {
      const pct = grainCount > 0 ? Math.round((Number(count) / grainCount) * 100) : 0;
      doc.fontSize(10).font('Helvetica').fillColor('#0f172a')
        .text(`  • ${label.replace(/_/g, ' ')}: ${count} grains (${pct}%)`);
    });
  }

  // ── Charts ────────────────────────────────────────────────────────────────
  addSection(doc, 'Quality Charts');

  const chartY      = doc.y + 10;
  const chartRadius = 52;
  const innerRadius = 28;
  const chartSpacing = pageW / 3;
  const cx1 = doc.page.margins.left + chartSpacing * 0.5;
  const cx2 = doc.page.margins.left + chartSpacing * 1.5;
  const cx3 = doc.page.margins.left + chartSpacing * 2.5;
  const cy  = chartY + chartRadius + 10;

  // Chart 1 — Health Score donut
  drawPieChart(doc, cx1, cy, chartRadius, qualitySegs, innerRadius);
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a')
    .text(`${Math.round(health)}%`, cx1 - 18, cy - 9, { width: 36, align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b')
    .text('Health Score', cx1 - 36, cy + chartRadius + 8, { width: 72, align: 'center' });

  // Chart 2 — Healthy vs Unhealthy grain count
  drawPieChart(doc, cx2, cy, chartRadius, riskSegs, 0);
  doc.fontSize(8).font('Helvetica').fillColor('#64748b')
    .text('Grain Health', cx2 - 36, cy + chartRadius + 8, { width: 72, align: 'center' });

  // Chart 3 — Health distribution (discoloured_high, unhulled, healthy, etc.)
  drawPieChart(doc, cx3, cy, chartRadius, grainSegs, 0);
  doc.fontSize(8).font('Helvetica').fillColor('#64748b')
    .text('Health Distribution', cx3 - 40, cy + chartRadius + 8, { width: 80, align: 'center' });

  const legendY    = cy + chartRadius + 26;
  const legendColW = pageW / 3;
  drawLegend(doc, doc.page.margins.left + legendColW * 0 + 8, legendY, qualitySegs, qualitySegs.reduce((a, s) => a + s.value, 0));
  drawLegend(doc, doc.page.margins.left + legendColW * 1 + 8, legendY, riskSegs,    riskSegs.reduce((a, s) => a + s.value, 0));
  drawLegend(doc, doc.page.margins.left + legendColW * 2 + 8, legendY, grainSegs,   grainSegs.reduce((a, s) => a + s.value, 0));

  doc.y = legendY + Math.max(qualitySegs.length, riskSegs.length, grainSegs.length) * 18 + 20;

  // ── LangChain AI Advice ───────────────────────────────────────────────────
  addSection(doc, 'AI Storage & Handling Advice (LangChain / Ollama)');
  doc.fontSize(10).font('Helvetica').fillColor('#334155').text(llmResponse, { lineGap: 4 });

  // ── IoT Data ──────────────────────────────────────────────────────────────
  if (ml.iot_data) {
    addSection(doc, 'IoT Sensor Data');
    kv(doc, 'Location',               iot.location        ?? 'N/A');
    kv(doc, 'Grain Count',            iot.grain_count     ?? 'N/A');
    kv(doc, 'Healthy %',              iot.healthy_percentage != null ? `${iot.healthy_percentage}%` : 'N/A');
    kv(doc, 'Dominant Type',          iot.dominant_type   ?? 'N/A');
    kv(doc, 'Avg Type Confidence',    iot.avg_type_confidence   != null ? `${(iot.avg_type_confidence * 100).toFixed(1)}%` : 'N/A');
    kv(doc, 'Avg Health Confidence',  iot.avg_health_confidence != null ? `${(iot.avg_health_confidence * 100).toFixed(1)}%` : 'N/A');
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
    .text(
      'This report is generated by RiceAI. Results are AI-estimated and may vary based on image quality.',
      doc.page.margins.left,
      doc.page.height - 40,
      { width: pageW, align: 'center' }
    );

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  await AnalysisJob.updateOne(
    { jobId: job.jobId },
    { $set: { 'pdf.path': pdfPath, 'pdf.generatedAt': new Date() } }
  );

  return pdfPath;
}

export async function getOrCreatePdf(jobOrId, regenerate = false) {
  const job = typeof jobOrId === 'string'
    ? await AnalysisJob.findOne({ jobId: jobOrId })
    : jobOrId;

  if (!job) throw new Error('Analysis job not found');

  if (!job.mlResponse) {
    const error = new Error('ML data is not available for this job');
    error.statusCode = 409;
    throw error;
  }

  const pdfPath  = pdfPathForJob(job.jobId);
  const pdfExists = fs.existsSync(pdfPath);

  const pdfGeneratedAt = job.pdf?.generatedAt ? new Date(job.pdf.generatedAt) : null;
  const jobCompletedAt = job.completedAt       ? new Date(job.completedAt)     : null;
  const stale = pdfGeneratedAt && jobCompletedAt && pdfGeneratedAt < jobCompletedAt;

  if (!pdfExists || regenerate || stale) {
    const regeneratedPath = await generatePdfFromMlResponse(job);
    return { job, pdfPath: regeneratedPath, generated: true };
  }

  return { job, pdfPath, generated: false };
}
