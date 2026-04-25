/**
 * services/api.js
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC API SERVICE LAYER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is the ONLY file that pages and hooks should import for API calls.
 * It owns:
 *   - Request construction (FormData, JSON body)
 *   - Response unwrapping (backend envelope → flat data)
 *   - Consistent ApiResponse shape for every function
 *
 * ApiResponse shape (every function returns this):
 * {
 *   ok:     boolean          — true on success, false on any error
 *   status: number           — HTTP status code (0 = network error)
 *   data:   object | null    — unwrapped payload on success, null on error
 *   error:  string | null    — user-friendly error message, null on success
 * }
 *
 * Backend base URL: http://localhost:6532/api  (set via VITE_API_BASE)
 *
 * Endpoints consumed:
 *   POST /api/v1/analyze          → analyzeImages()
 *   GET  /api/v1/result/:uuid     → getResult()
 *   GET  /api/v1/pdf/:uuid        → getPDF()  [returns URL, not blob]
 *   POST /api/v1/notify/email     → sendEmail()
 *   GET  /api/v1/health           → checkHealth()
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { httpPost, httpGet, BASE } from '../api/client';
import { friendlyMessage } from '../api/errors';

/* ── Shared helpers ──────────────────────────────────────────────────────── */

/**
 * Unwrap the backend's data envelope.
 * Backend always wraps in: { success, data: { ... } }
 * Some endpoints nest one level deeper: { success, data: { data: { ... } } }
 */
function unwrap(responseData) {
  return responseData?.data?.data ?? responseData?.data ?? responseData ?? {};
}

/* ═══════════════════════════════════════════════════════════════════════════
 * analyzeImages(files, region, userMode)
 *
 * POST /api/v1/analyze
 * Submits 1–5 image files for ML analysis.
 *
 * Request:  multipart/form-data
 *   images        File[]   — image files (JPG / PNG, max 10 MB each, max 5 files)
 *   region        string   — Indian state name, e.g. "Karnataka"
 *   userMode      string   — "farmer" or "consumer" (default: "farmer")
 *
 * Response on success:
 *   data.uuid    string  — job UUID for polling
 *   data.status  string  — initial status, always "queued"
 *
 * HTTP 202 Accepted
 * ═══════════════════════════════════════════════════════════════════════════ */
export async function analyzeImages(files = [], region = 'Karnataka', userMode = 'farmer') {
  if (!files.length) {
    return { ok: false, status: 0, data: null, error: 'No files provided.' };
  }

  const fd = new FormData();
  files.forEach((f) => fd.append('images', f, f.name));
  fd.append('region', String(region || 'Karnataka').trim());
  fd.append('userMode', String(userMode || 'farmer').toLowerCase().trim());

  const res = await httpPost('/v1/analyze', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!res.ok) return res;

  const payload = unwrap(res.data);
  const uuid    = payload.uuid   ?? null;
  const status  = payload.status ?? 'queued';

  if (!uuid) {
    return {
      ok:     false,
      status: res.status,
      data:   null,
      error:  'Server did not return a job ID. Please try again.',
    };
  }

  return {
    ok:     true,
    status: res.status,
    data:   { uuid, status },
    error:  null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * getResult(uuid)
 *
 * GET /api/v1/result/:uuid
 * Polls the status of an analysis job.
 *
 * Response shape varies by job status:
 *
 *   queued / processing:
 *     data.uuid    string
 *     data.status  "queued" | "processing"
 *
 *   completed:
 *     data.uuid         string
 *     data.status       "completed"
 *     data.ml_response  object  — raw ML output from Flask
 *       ml_response.summary.health_percentage  number   0–100
 *       ml_response.summary.dominant_type      string
 *       ml_response.summary.grain_counts       object   { [type]: count }
 *       ml_response.market_price               string | number
 *       ml_response.shelf_life                 string
 *       ml_response.supply_chain               string
 *       ml_response.llm_response               string   AI narrative
 *       ml_response.iot_data                   object | null
 *
 *   failed:
 *     data.uuid    string
 *     data.status  "failed"
 *     data.error   string
 *
 * HTTP 200 (all statuses), 404 if uuid unknown
 * ═══════════════════════════════════════════════════════════════════════════ */
export async function getResult(uuid) {
  if (!uuid) {
    return { ok: false, status: 0, data: null, error: 'UUID is required.' };
  }

  const res = await httpGet(`/v1/result/${uuid}`);

  if (!res.ok) return res;

  const payload    = unwrap(res.data);
  const jobStatus  = String(payload.status || '').toLowerCase();

  // Failed jobs come back as HTTP 500 from the backend
  if (jobStatus === 'failed') {
    return {
      ok:     false,
      status: res.status,
      data:   { uuid: payload.uuid ?? uuid, status: 'failed' },
      error:  friendlyMessage(payload.error || 'Analysis failed', res.status),
    };
  }

  return {
    ok:     true,
    status: res.status,
    data:   {
      uuid:        payload.uuid        ?? uuid,
      status:      jobStatus,
      ml_response: payload.ml_response ?? null,
    },
    error: null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * getPDF(uuid, regenerate?)
 *
 * GET /api/v1/pdf/:uuid[?regenerate=true]
 *
 * The backend streams the PDF directly (Content-Type: application/pdf).
 * This function returns the direct URL string — the caller uses it as
 * an <a href> or window.open() target.
 *
 * Pass regenerate=true to force the backend to rebuild the PDF.
 *
 * Returns:
 *   { ok: true, data: { url: string }, ... }
 *
 * HTTP 200 PDF stream, 404 if not ready, 409 if job not completed
 * ═══════════════════════════════════════════════════════════════════════════ */
export function getPDF(uuid, regenerate = false) {
  if (!uuid) {
    return { ok: false, status: 0, data: null, error: 'UUID is required.' };
  }

  const url = `${BASE}/v1/pdf/${uuid}${regenerate ? '?regenerate=true' : ''}`;

  return {
    ok:     true,
    status: 200,
    data:   { url },
    error:  null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * sendEmail(uuid, email)
 *
 * POST /api/v1/notify/email
 * Sends the PDF report to the given email address.
 *
 * Request body (JSON):
 *   uuid   string  — job UUID
 *   email  string  — recipient email address
 *
 * Response on success:
 *   data.uuid         string
 *   data.emailSent    boolean
 *   data.resultLink   string   — shareable result URL
 *   data.accepted     string[] — addresses accepted by SMTP
 *   data.rejected     string[] — addresses rejected by SMTP
 *
 * Error codes:
 *   400 — missing uuid or invalid email
 *   404 — job not found
 *   409 — job not completed yet
 *   429 — rate limited (5 requests / minute per IP)
 *   500 — SMTP failure
 *
 * HTTP 200 on success
 * ═══════════════════════════════════════════════════════════════════════════ */
export async function sendEmail(uuid, email) {
  if (!uuid) {
    return { ok: false, status: 0, data: null, error: 'UUID is required.' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 0, data: null, error: 'Please enter a valid email address.' };
  }

  const res = await httpPost('/v1/notify/email', { uuid, email });

  if (!res.ok) return res;

  const payload = unwrap(res.data);

  return {
    ok:     true,
    status: res.status,
    data:   {
      uuid:        payload.uuid        ?? uuid,
      emailSent:   payload.emailSent   ?? true,
      resultLink:  payload.resultLink  ?? null,
      accepted:    payload.accepted    ?? [],
      rejected:    payload.rejected    ?? [],
    },
    error: null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * checkHealth()
 *
 * GET /api/v1/health
 * Returns server, MongoDB, Flask, and queue status.
 *
 * Response on success:
 *   data.server.status    "running"
 *   data.server.uptime    number (seconds)
 *   data.mongodb.connected boolean
 *   data.flask.healthy    boolean
 *   data.queue.pending    number
 *   data.queue.active     number
 * ═══════════════════════════════════════════════════════════════════════════ */
export async function checkHealth() {
  const res = await httpGet('/v1/health');
  if (!res.ok) return res;

  const payload = unwrap(res.data);
  return {
    ok:     true,
    status: res.status,
    data:   payload,
    error:  null,
  };
}
