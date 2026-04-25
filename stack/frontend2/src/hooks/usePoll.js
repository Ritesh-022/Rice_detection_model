/**
 * hooks/usePoll.js
 *
 * Polls a job UUID until terminal.
 * Used by pages that receive a UUID from the URL query string
 * and need to track it independently of the upload form.
 *
 * Writes completed result into JobContext so other pages can read it.
 */
import { useEffect, useRef } from 'react';
import { useJobContext } from '../context/JobContext';
import { tickPoll } from '../services/analysis';

const POLL_MS   = 2500;
const MAX_POLLS = 120;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string} uuid  — job UUID to poll (from URL)
 * @param {object} opts
 *   skip — if true, do not start polling (e.g. result already in context)
 */
export function usePoll(uuid, { skip = false } = {}) {
  const ctx      = useJobContext();
  const activeRef = useRef(false);

  useEffect(() => {
    if (!uuid || skip) return;

    // If context already has a completed result for THIS exact uuid, skip
    if (ctx.uuid === uuid && ctx.status === 'completed' && ctx.result) return;

    // Clear previous result immediately so stale data never shows
    ctx.setResult(null);
    ctx.setRawMl(null);
    ctx.setError('');
    activeRef.current = true;
    ctx.setUuid(uuid);
    ctx.setStatus('queued');
    ctx.setLoading(true);

    let count = 0;

    const run = async () => {
      while (activeRef.current && count < MAX_POLLS) {
        await delay(POLL_MS);
        if (!activeRef.current) break;

        count++;
        const tick = await tickPoll(uuid);
        if (!activeRef.current) break;

        if (tick.status) ctx.setStatus(tick.status);

        if (tick.done) {
          if (tick.result) { ctx.setResult(tick.result); ctx.setRawMl(tick.result.raw); }
          if (tick.error)  ctx.setError(tick.error);
          ctx.setLoading(false);
          return;
        }
      }

      if (count >= MAX_POLLS) {
        ctx.setError('Polling timed out. Please refresh.');
        ctx.setStatus('failed');
        ctx.setLoading(false);
      }
    };

    run();

    return () => { activeRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);
}
