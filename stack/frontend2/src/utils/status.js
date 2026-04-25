export const TERMINAL = new Set(['completed', 'failed']);

export function isTerminal(status) {
  return TERMINAL.has(String(status || '').toLowerCase());
}

export function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    idle:       'Idle',
    queued:     'Queued',
    processing: 'Processing',
    completed:  'Completed',
    failed:     'Failed',
  };
  return map[s] ?? s;
}
