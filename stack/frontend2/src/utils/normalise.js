/**
 * Normalise the raw ml_response from the backend into a stable shape.
 * The backend stores whatever Flask returns, so we defensively extract fields.
 */

function decodeEntities(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

export function normaliseResult(raw = {}) {
  // Guard: if ml_response is empty/null, return null so UI shows loading not stale data
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) return null;

  const summary = raw?.summary ?? {};
  // Guard: summary must have grain_count to be a real ML response
  if (!summary.grain_count && !summary.dominant_type && !raw.market_price) return null;

  const grainCount     = Number(summary.grain_count     ?? 0);
  const healthDist     = summary.health_distribution ?? {};

  const UNHEALTHY_LABELS = new Set(['broken_high', 'discoloured_high']);

  // Always recompute from health_distribution using current rules
  // (do not trust summary.healthy_count which may be from old server logic)
  let healthyCount, unhealthyCount;
  if (Object.keys(healthDist).length > 0) {
    healthyCount   = 0;
    unhealthyCount = 0;
    for (const [label, cnt] of Object.entries(healthDist)) {
      const norm = label.trim().toLowerCase().replace(/[\s-]/g, '_');
      if (UNHEALTHY_LABELS.has(norm)) {
        unhealthyCount += Number(cnt);
      } else {
        healthyCount += Number(cnt);
      }
    }
  } else {
    healthyCount   = Number(summary.healthy_count   ?? 0);
    unhealthyCount = Number(summary.unhealthy_count ?? 0);
  }
  const healthPct = grainCount > 0 ? Math.round((healthyCount / grainCount) * 100) : Number(summary.health_percentage ?? raw.health_percentage ?? 0);
  // quality grade from health % — short label for badge
  const quality = healthToQuality(healthPct);

  return {
    type:            summary.dominant_type || raw.type || 'Unknown',
    health:          healthPct,
    quality,
    price:           raw.market_price != null ? Number(raw.market_price) * 1000 : null,
    shelf_life:      decodeEntities(raw.shelf_life ?? null),
    supply_chain:    decodeEntities(raw.supply_chain ?? null),
    llm_output:      decodeEntities(raw.llm_response ?? raw.llm_output ?? ''),
    iot_data:        raw.iot_data ?? null,
    grain_counts:    summary.health_distribution ?? summary.class_distribution ?? summary.grain_counts ?? raw.grain_counts ?? null,
    healthy_count:   healthyCount,
    unhealthy_count: unhealthyCount,
    grain_count:     grainCount,
    health_distribution: summary.health_distribution ?? null,
    class_distribution:  summary.class_distribution  ?? null,
    userMode:        raw.user_mode ?? 'farmer',
    priceBreakdown:  raw.price_breakdown ?? null,
    priceSource:     raw.price_source ?? null,
    summary,
    raw,
  };
}

export function healthToQuality(h) {
  // Used only when supply_chain is not available from ML
  // Thresholds match APEDA/FCI grade definitions
  if (h >= 90) return 'Premium Export';
  if (h >= 75) return 'Local Market';
  if (h >= 50) return 'Processing Grade';
  return 'Animal Feed';
}

export function qualityBadgeClass(quality) {
  const q = String(quality || '').toLowerCase();
  if (q.includes('premium') || q.includes('export')) return 'badge-green';
  if (q.includes('local') || q.includes('retail') || q.includes('good')) return 'badge-green';
  if (q.includes('processing') || q.includes('milling') || q.includes('standard')) return 'badge-amber';
  if (q.includes('animal') || q.includes('waste') || q.includes('feed') || q.includes('poor')) return 'badge-red';
  return 'badge-gray';
}

export function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'badge-green';
  if (s === 'processing') return 'badge-amber';
  if (s === 'queued')     return 'badge-blue';
  if (s === 'failed')     return 'badge-red';
  return 'badge-gray';
}

export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const n = Number(value);
  if (Number.isFinite(n)) return `₹${n.toLocaleString('en-IN')} / 1000 kg`;
  return String(value);
}
