/**
 * services/storage.js
 *
 * localStorage history + sessionStorage active UUID.
 */

const ACTIVE_KEY  = 'riceai_active_uuid';
const HISTORY_KEY = 'riceai_history';

// ── Active UUID (sessionStorage) ─────────────────────────────────────────────
export function saveActiveUuid(uuid) {
  try { sessionStorage.setItem(ACTIVE_KEY, uuid); } catch { /* ignore */ }
}
export function loadActiveUuid() {
  try { return sessionStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
}
export function clearActiveUuid() {
  try { sessionStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
}

// ── Scan history (localStorage) ──────────────────────────────────────────────
export function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

export function saveHistory(entry) {
  const history = getHistory();
  // Replace existing entry for same uuid, otherwise prepend
  const idx = history.findIndex((h) => h.uuid === entry.uuid);
  if (idx !== -1) history[idx] = { ...history[idx], ...entry };
  else history.unshift({ ...entry, date: entry.date || new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}

export function updateHistory(uuid, patch) {
  const history = getHistory();
  const next = history.map((h) => h.uuid === uuid ? { ...h, ...patch } : h);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function deleteHistoryEntry(uuid) {
  const next = getHistory().filter((h) => h.uuid !== uuid);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}
