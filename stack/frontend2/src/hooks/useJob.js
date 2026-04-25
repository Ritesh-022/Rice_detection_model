/**
 * hooks/useJob.js
 *
 * Write interface for job state.
 * Reads/writes through JobContext so all pages share the same job.
 * Calls services/analysis.js — never api/client directly.
 *
 * State strategy:
 *   JobContext  — owns the state atoms (uuid, status, result, …)
 *   useJob      — owns files + region (upload-form-local state)
 *                 and exposes submit() / reset()
 */
import { useCallback, useRef, useState } from 'react';
import { useJobContext } from '../context/JobContext';
import { startJob, pollUntilDone } from '../services/analysis';
import { saveHistory, updateHistory } from '../services/storage';

export function useJob() {
  const ctx = useJobContext();

  const [files,  setFiles]  = useState([]);
  const [region, setRegion] = useState('Karnataka');
  const [userMode, setUserMode] = useState('farmer');

  const abortCtrl = useRef(null);

  /* ── submit ─────────────────────────────────────────────────────────────── */
  const submit = useCallback(async () => {
    if (!files.length || ctx.loading) return null;

    // Cancel any in-flight poll
    abortCtrl.current?.abort();
    abortCtrl.current = new AbortController();

    ctx.setLoading(true);
    ctx.setError('');
    ctx.setResult(null);
    ctx.setRawMl(null);
    ctx.setStatus('queued');
    ctx.setUuid('');

    // 1. Upload
    const upload = await startJob(files, region, userMode);
    if (!upload.ok) {
      ctx.setError(upload.error);
      ctx.setStatus('failed');
      ctx.setLoading(false);
      return null;
    }

    ctx.setUuid(upload.uuid);
    ctx.setStatus(upload.status);

    // Save initial history entry
    saveHistory({ uuid: upload.uuid, status: upload.status, fileCount: files.length, region, userMode });

    // 2. Poll in background — return uuid immediately so caller can navigate
    pollUntilDone(upload.uuid, {
      signal:  abortCtrl.current.signal,
      onTick:  (s) => ctx.setStatus(s),
    }).then(({ status, result, error }) => {
      ctx.setStatus(status);
      if (result) {
        ctx.setResult(result);
        ctx.setRawMl(result.raw);
        updateHistory(upload.uuid, {
          status,
          result: {
            type:       result.type,
            quality:    result.quality,
            health:     result.health,
            price:      result.price,
            shelf_life: result.shelf_life,
            storage:    result.llm_output,
            userMode:   result.userMode,
            priceBreakdown: result.priceBreakdown,
          },
        });
      }
      if (error) {
        ctx.setError(error);
        updateHistory(upload.uuid, { status: 'failed' });
      }
      ctx.setLoading(false);
    });

    return { uuid: upload.uuid };
  }, [files, region, userMode, ctx]);

  /* ── reset ───────────────────────────────────────────────────────────────── */
  const reset = useCallback(() => {
    abortCtrl.current?.abort();
    setFiles([]);
    ctx.resetJob();
  }, [ctx]);

  return {
    // upload-form state
    files, setFiles,
    region, setRegion,
    userMode, setUserMode,
    // job state (from context — read-only here)
    uuid:    ctx.uuid,
    status:  ctx.status,
    result:  ctx.result,
    rawMl:   ctx.rawMl,
    error:   ctx.error,
    loading: ctx.loading,
    // actions
    submit,
    reset,
  };
}
