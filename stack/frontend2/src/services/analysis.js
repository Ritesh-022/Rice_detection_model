/**
 * services/analysis.js
 *
 * Polling and job-lifecycle logic built on top of services/api.js.
 * Hooks import from here — never from services/api.js directly for polling.
 */
import { analyzeImages, getResult } from './api';
import { normaliseResult } from '../utils/normalise';
import { isTerminal } from '../utils/status';

const POLL_MS   = 2500;
const MAX_POLLS = 120;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * startJob(files, region, userMode)
 * Submits images and returns { ok, uuid, status, error }.
 */
export async function startJob(files, region, userMode = 'farmer') {
  const res = await analyzeImages(files, region, userMode);
  if (!res.ok) return { ok: false, uuid: null, status: 'failed', error: res.error };
  return { ok: true, uuid: res.data.uuid, status: res.data.status, error: null };
}

/**
 * tickPoll(uuid)
 * Single poll tick. Returns { done, status, result, error }.
 */
export async function tickPoll(uuid) {
  const res = await getResult(uuid);

  if (!res.ok) {
    if (res.status === 404) {
      return { done: true, status: 'failed', result: null, error: res.error };
    }
    return { done: false, status: null, result: null, error: null };
  }

  const { status, ml_response } = res.data;

  if (status === 'completed') {
    const normalised = normaliseResult(ml_response ?? {});
    // If normaliseResult returns null, ml_response is empty — treat as still processing
    if (!normalised) {
      return { done: false, status: 'processing', result: null, error: null };
    }
    return {
      done:   true,
      status: 'completed',
      result: normalised,
      error:  null,
    };
  }

  if (status === 'failed') {
    return { done: true, status: 'failed', result: null, error: res.error || 'Analysis failed' };
  }

  if (isTerminal(status)) {
    return { done: true, status, result: null, error: null };
  }

  return { done: false, status, result: null, error: null };
}

/**
 * pollUntilDone(uuid, { onTick, signal })
 * Blocking poll loop. Returns { status, result, error }.
 * onTick(status) called on every non-terminal tick.
 * signal — AbortSignal to cancel.
 */
export async function pollUntilDone(uuid, { onTick, signal } = {}) {
  for (let i = 0; i < MAX_POLLS; i++) {
    if (signal?.aborted) break;
    await delay(POLL_MS);
    if (signal?.aborted) break;

    const tick = await tickPoll(uuid);
    if (tick.status && typeof onTick === 'function') onTick(tick.status);
    if (tick.done) return { status: tick.status, result: tick.result, error: tick.error };
  }

  return { status: 'failed', result: null, error: 'Analysis timed out. Please try again.' };
}
