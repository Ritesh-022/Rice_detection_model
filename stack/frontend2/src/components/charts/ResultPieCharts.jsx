import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

/* ── palette ── */
const C = {
  green:  '#16a34a',
  amber:  '#d97706',
  red:    '#dc2626',
  blue:   '#2563eb',
  purple: '#7c3aed',
  teal:   '#0d9488',
  slate:  '#e5e7eb',
};

const TOOLTIP = {
  contentStyle: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 12,
    color: '#111827',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
};

const LEGEND_STYLE = { fontSize: 12, color: '#6b7280' };

const UNHEALTHY_LABELS = new Set(['broken_high', 'discoloured_high']);

/* ── data builders — all use real ML data ── */
function healthSegments(result) {
  const healthy   = Number(result.healthy_count)   || 0;
  const unhealthy = Number(result.unhealthy_count) || 0;
  const total     = Number(result.grain_count)     || (healthy + unhealthy);

  const hPct = total > 0 ? Math.round((healthy   / total) * 100) : 0;
  const uPct = total > 0 ? Math.round((unhealthy / total) * 100) : 0;
  const fill = hPct >= 90 ? C.green : hPct >= 75 ? C.green : hPct >= 50 ? C.amber : C.red;

  const segs = [];
  if (hPct > 0) segs.push({ name: `Healthy — ${hPct}%`,   value: hPct,        fill });
  if (uPct > 0) segs.push({ name: `Defective — ${uPct}%`, value: uPct,        fill: C.red });
  if (segs.length === 0) segs.push({ name: 'Healthy — 100%', value: 100, fill: C.green });
  return segs;
}

// Chart 2: actual health label distribution — unhealthy labels red, healthy labels green
function riskSegments(result) {
  const hd = result.health_distribution;
  const total = Number(result.grain_count) || 0;
  if (hd && typeof hd === 'object') {
    const entries = Object.entries(hd).filter(([, v]) => Number(v) > 0);
    if (entries.length) {
      return entries.map(([name, value]) => {
        const norm = name.trim().toLowerCase().replace(/[\s-]/g, '_');
        const pct  = total > 0 ? Math.round((Number(value) / total) * 100) : Number(value);
        return {
          name: `${name.replace(/_/g, ' ')} — ${pct}%`,
          value: pct,
          fill: UNHEALTHY_LABELS.has(norm) ? C.red : C.green,
        };
      });
    }
  }
  const h = Math.min(100, Math.max(0, Number(result.health) || 0));
  return [
    { name: `Healthy ${Math.round(h)}%`,       value: Math.round(h),       fill: C.green },
    { name: `Unhealthy ${Math.round(100-h)}%`, value: Math.round(100 - h), fill: C.red   },
  ].filter(s => s.value > 0);
}

const GRAIN_PALETTE = [C.blue, C.purple, C.teal, C.green, C.amber, C.red];

// Chart 3: rice type distribution (BD39, Ipsala, Jasmine etc.)
function grainSegments(result) {
  const cd = result.class_distribution;
  const total = Number(result.grain_count) || 0;
  if (cd && typeof cd === 'object') {
    const entries = Object.entries(cd).filter(([, v]) => Number(v) > 0);
    if (entries.length) {
      return entries.map(([name, value], i) => {
        const pct = total > 0 ? Math.round((Number(value) / total) * 100) : Number(value);
        return {
          name: `${name} — ${pct}%`,
          value: pct,
          fill: GRAIN_PALETTE[i % GRAIN_PALETTE.length],
        };
      });
    }
  }
  // fallback to grain_counts (health_distribution)
  const gc = result.grain_counts;
  if (gc && typeof gc === 'object') {
    const entries = Object.entries(gc).filter(([, v]) => Number(v) > 0);
    if (entries.length) {
      return entries.map(([name, value], i) => ({
        name: `${name.replace(/_/g, ' ')} (${total > 0 ? Math.round((Number(value)/total)*100) : Number(value)}%)`,
        value: total > 0 ? Math.round((Number(value) / total) * 100) : Number(value),
        fill: GRAIN_PALETTE[i % GRAIN_PALETTE.length],
      }));
    }
  }
  return [{ name: result.type || 'Unknown', value: 100, fill: C.blue }];
}

/* ── sub-chart ── */
function ChartBox({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-l)',
      padding: '16px 12px 8px',
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

/* ── main export ── */
export default function ResultPieCharts({ result }) {
  const { t } = useTranslation();
  if (!result) return null;

  const hSegs = healthSegments(result);
  const rSegs = riskSegments(result);
  const gSegs = grainSegments(result);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>

      {/* 1 — Health Score donut */}
      <ChartBox title={t('chart_health')}>
        <div style={{ position: 'relative', height: 190 }}>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={hSegs}
                cx="50%" cy="45%"
                innerRadius={52} outerRadius={72}
                startAngle={90} endAngle={-270}
                dataKey="value"
                paddingAngle={2}
                label={false}
                labelLine={false}
              >
                {hSegs.map((s, i) => <Cell key={i} fill={s.fill} />)}
              </Pie>
              <Tooltip {...TOOLTIP} formatter={(v, n) => [`${v}%`, n]} />
              <Legend wrapperStyle={LEGEND_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label — absolutely positioned over the donut hole */}
          <div style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            textAlign: 'center',
            lineHeight: 1,
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>
              {Math.round(Number(result.health) || 0)}%
            </span>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
          {result.quality}
        </p>
      </ChartBox>

      {/* 2 — Health Label Distribution */}
      <ChartBox title="Health Breakdown">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie data={rSegs} cx="50%" cy="45%" outerRadius={68} dataKey="value" paddingAngle={3}>
              {rSegs.map((s, i) => <Cell key={i} fill={s.fill} />)}
            </Pie>
            <Tooltip {...TOOLTIP} formatter={(v, n) => [`${v}%`, n]} />
            <Legend wrapperStyle={LEGEND_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </ChartBox>

      {/* 3 — Rice Type Distribution */}
      <ChartBox title="Rice Types">
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie data={gSegs} cx="50%" cy="45%" outerRadius={68} dataKey="value" paddingAngle={3}>
              {gSegs.map((s, i) => <Cell key={i} fill={s.fill} />)}
            </Pie>
            <Tooltip {...TOOLTIP} formatter={(v, n) => [`${v}%`, n]} />
            <Legend wrapperStyle={LEGEND_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </ChartBox>

    </div>
  );
}

/* Named exports for reuse in PDF-print view */
export { healthSegments, riskSegments, grainSegments };
