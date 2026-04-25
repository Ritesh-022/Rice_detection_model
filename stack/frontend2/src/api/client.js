/**
 * api/client.js
 *
 * Raw HTTP transport layer.
 * Responsibilities:
 *   - Create and configure the axios instance
 *   - Attach request/response interceptors for logging
 *   - Expose low-level fetch functions used by services/api.js
 *
 * Rules:
 *   - No business logic here
 *   - No error message mapping here (that lives in api/errors.js)
 *   - Nothing outside api/ should import this file directly
 */
import axios from 'axios';
import { failResponse } from './errors';

const BASE    = import.meta.env.VITE_API_BASE || 'http://localhost:6532/api';
const TIMEOUT = 180_000; // 3 min — long enough for ML processing

export const http = axios.create({
  baseURL: BASE,
  timeout: TIMEOUT,
});

/* ── Request interceptor — attach common headers ── */
http.interceptors.request.use((config) => {
  config.headers['X-Client'] = 'riceai-web';
  return config;
});

/* ── Response interceptor — log errors in dev ── */
http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (import.meta.env.DEV) {
      console.warn(
        `[API] ${err?.config?.method?.toUpperCase()} ${err?.config?.url}`,
        err?.response?.status,
        err?.response?.data,
      );
    }
    return Promise.reject(err);
  },
);

/** Wrap a successful axios response into the standard ApiResponse shape */
function ok(res) {
  return {
    ok:     true,
    status: res.status,
    data:   res.data,
    error:  null,
    _raw:   null,
  };
}

/* ── Transport functions ─────────────────────────────────────────────────── */

export async function httpPost(path, body, config = {}) {
  try {
    return ok(await http.post(path, body, config));
  } catch (err) {
    return failResponse(err);
  }
}

export async function httpGet(path, config = {}) {
  try {
    return ok(await http.get(path, config));
  } catch (err) {
    return failResponse(err);
  }
}

/** Expose the base URL so services can build direct asset URLs (e.g. PDF) */
export { BASE };
