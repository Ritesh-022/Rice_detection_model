/**
 * context/JobContext.jsx
 *
 * Global job state.
 * Wraps the entire app so any page can read the current job without
 * prop-drilling or re-fetching from the server.
 *
 * State strategy:
 *   - JobContext owns: uuid, status, result, rawMl, error, loading
 *   - useJob hook (hooks/useJob.js) is the write interface — it calls
 *     startJob() / pollUntilDone() from services/analysis.js and
 *     dispatches updates into this context via setters.
 *   - Pages read from useJobContext() and write via useJob().
 *   - UUID is also persisted to sessionStorage so a hard-refresh on
 *     /result?uuid=... still has context available.
 */
import { createContext, useCallback, useContext, useState } from 'react';
import { saveActiveUuid, clearActiveUuid } from '../services/storage';

const JobContext = createContext(null);

export function JobProvider({ children }) {
  const [uuid,    setUuidState]  = useState('');
  const [status,  setStatus]     = useState('idle');
  const [result,  setResult]     = useState(null);   // normalised
  const [rawMl,   setRawMl]      = useState(null);   // raw ml_response
  const [error,   setError]      = useState('');
  const [loading, setLoading]    = useState(false);

  const setUuid = useCallback((id) => {
    setUuidState(id);
    if (id) saveActiveUuid(id); else clearActiveUuid();
  }, []);

  const resetJob = useCallback(() => {
    setUuidState('');
    setStatus('idle');
    setResult(null);
    setRawMl(null);
    setError('');
    setLoading(false);
    clearActiveUuid();
  }, []);

  return (
    <JobContext.Provider value={{
      uuid, setUuid,
      status, setStatus,
      result, setResult,
      rawMl,  setRawMl,
      error,  setError,
      loading, setLoading,
      resetJob,
    }}>
      {children}
    </JobContext.Provider>
  );
}

/** Read-only access to the current job state from any component. */
export function useJobContext() {
  const ctx = useContext(JobContext);
  if (!ctx) throw new Error('useJobContext must be used inside <JobProvider>');
  return ctx;
}
