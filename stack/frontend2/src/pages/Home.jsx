import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Shell from '../components/layout/Shell';
import { getHistory, deleteHistoryEntry, clearHistory } from '../services/storage';
import { checkHealth } from '../services/api';
import { formatPrice, statusBadgeClass } from '../utils/normalise';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function getMonthlyCount(history) {
  const now = new Date();
  return history.filter((h) => {
    const d = new Date(h.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}
function getCounts(history) {
  return history.reduce((acc, h) => {
    const s = (h.status || '').toLowerCase();
    if (s === 'completed') acc.completed++;
    else if (s === 'failed') acc.failed++;
    else acc.pending++;
    return acc;
  }, { completed: 0, failed: 0, pending: 0 });
}

// ── StatBox ───────────────────────────────────────────────────────────────────
function StatBox({ label, value, color = 'var(--primary)' }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '18px 20px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

// ── Ideology ──────────────────────────────────────────────────────────────────
const IDEOLOGY = [
  { emoji: '🌾', title: 'Empowering Farmers',  body: 'Instant AI-powered grain quality grading — no lab, no expert, no delay.' },
  { emoji: '🤖', title: 'AI at the Edge',       body: 'A custom CNN model analyses grain images and returns results in seconds.' },
  { emoji: '🔓', title: 'Transparent & Open',   body: 'No login, no server-side data storage. History lives in your browser.' },
  { emoji: '🇮🇳', title: 'Built for India',      body: 'Supports 6 Indian languages, 20 regional markets, and major rice varieties.' },
];

function IdeologySection() {
  return (
    <section className="card">
      <p className="section-title">Our Mission</p>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Why RiceAI exists</h2>
      <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 560, marginBottom: 20 }}>
        Rice is the staple crop for over a billion people in India. Yet quality grading still relies on manual inspection — slow, inconsistent, and inaccessible to small farmers. RiceAI changes that.
      </p>
      <div className="grid-4">
        {IDEOLOGY.map(({ emoji, title, body }) => (
          <div key={title} style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-l)', background: 'var(--bg)' }}>
            <p style={{ fontSize: 20, marginBottom: 8 }}>{emoji}</p>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{title}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65 }}>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Session modal ─────────────────────────────────────────────────────────────
function SessionModal({ session, onClose, onDelete }) {
  const navigate = useNavigate();
  const r = session.result || {};
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const rows = [
    ['Date',         fmtDate(session.date)],
    ['Time',         fmtTime(session.date)],
    ['Images',       `${session.fileCount ?? 1} file${(session.fileCount ?? 1) !== 1 ? 's' : ''}`],
    ['Region',       session.region || '—'],
    ['Rice Type',    r.type       || '—'],
    ['Quality',      r.quality    || '—'],
    ['Confidence',   r.health != null ? `${Math.round(r.health)}%` : '—'],
    ['Market Price', r.price      ? formatPrice(r.price) : '—'],
    ['Shelf Life',   r.shelf_life || '—'],
  ];

  const isCompleted = session.status?.toLowerCase() === 'completed';

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card fadein"
        style={{ width: '100%', maxWidth: 480, display: 'grid', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* header */}
        <div className="row-sb">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--primary)', marginBottom: 3 }}>Scan Detail</p>
            <p style={{ fontWeight: 700, fontSize: 16 }}>{r.type || 'Rice Scan'}</p>
            <p className="mono" style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 2, wordBreak: 'break-all' }}>{session.uuid}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close" style={{ flexShrink: 0 }}>✕</button>
        </div>

        {/* status badge */}
        <span className={`badge ${statusBadgeClass(session.status)}`} style={{ width: 'fit-content', textTransform: 'capitalize' }}>
          {session.status || 'idle'}
        </span>

        {/* key-value grid */}
        <div className="grid-2" style={{ gap: 8 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-m)', background: 'var(--bg)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--subtle)', marginBottom: 3 }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* storage advice */}
        {r.storage && (
          <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-m)', background: 'var(--bg)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--subtle)', marginBottom: 4 }}>Storage Advice</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>{r.storage}</p>
          </div>
        )}

        {/* actions */}
        <div className="row-sb" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            {isCompleted && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { navigate(`/result/${session.uuid}`); onClose(); }}
              >
                Full Report →
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>

          {/* delete */}
          {!confirmDelete ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)' }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          ) : (
            <div className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sure?</span>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => { onDelete(session.uuid); onClose(); }}
              >
                Yes, delete
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyHistory({ onScan }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 'var(--radius-l)' }}>
      <p style={{ fontSize: 32, marginBottom: 12 }}>🌾</p>
      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No scans yet</p>
      <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20, maxWidth: 320, margin: '0 auto 20px' }}>
        Upload rice grain images to get instant quality analysis, market price, and storage advice.
      </p>
      <button className="btn btn-primary" onClick={onScan}>
        Start your first scan →
      </button>
    </div>
  );
}

// ── Scan history table ────────────────────────────────────────────────────────
function ScanHistory({ history, onView, onDeleteAll, onScan }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? history.filter((h) => h.uuid?.toLowerCase().includes(trimmed))
    : history;

  function handleSearch(e) {
    e.preventDefault();
    if (!trimmed) return;
    // If exact match in local history, open modal via onView
    const match = history.find((h) => h.uuid?.toLowerCase() === trimmed);
    if (match) { onView(match); return; }
    // Otherwise navigate directly to result page by UUID
    navigate(`/result/${query.trim()}`);
  }

  return (
    <section className="card">
      <div className="row-sb" style={{ marginBottom: 16 }}>
        <div>
          <p className="section-title" style={{ marginBottom: 2 }}>Scan History</p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {history.length} session{history.length !== 1 ? 's' : ''} stored locally
          </p>
        </div>
        {history.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)', fontSize: 12 }}
            onClick={onDeleteAll}
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Search bar ── */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by Reference ID (UUID)…"
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 13,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-m)',
            background: 'var(--bg)',
            color: 'var(--text)',
            outline: 'none',
          }}
        />
        <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
          Go →
        </button>
        {query && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQuery('')}>
            ✕
          </button>
        )}
      </form>

      {history.length === 0 && !trimmed ? (
        <EmptyHistory onScan={onScan} />
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>
          No results found for <span className="mono">{query}</span>
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['UUID', 'Date', 'Images', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--subtle)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.uuid}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background 120ms' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="mono" style={{ padding: '10px 10px', color: 'var(--subtle)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.uuid}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(item.date)}</td>
                  <td style={{ padding: '10px 10px', color: 'var(--muted)' }}>{item.fileCount ?? 1}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span className={`badge ${statusBadgeClass(item.status)}`} style={{ textTransform: 'capitalize' }}>
                      {item.status || 'idle'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => onView(item)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [history,       setHistory]       = useState(() => getHistory());
  const [apiStatus,     setApiStatus]     = useState('checking');
  const [activeSession, setActiveSession] = useState(null);

  const monthly = getMonthlyCount(history);
  const counts  = getCounts(history);

  useEffect(() => {
    checkHealth()
      .then((res) => setApiStatus(res.ok ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'));
  }, []);

  const handleDelete = (uuid) => {
    deleteHistoryEntry(uuid);
    setHistory(getHistory());
  };

  const handleClearAll = () => {
    if (!window.confirm('Delete all scan history? This cannot be undone.')) return;
    clearHistory();
    setHistory([]);
  };

  return (
    <Shell>
      <div className="page" style={{ display: 'grid', gap: 28 }}>

        {/* ── Header ── */}
        <div className="row-sb">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--primary)', marginBottom: 6 }}>
              RiceAI Dashboard
            </p>
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 6 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 480 }}>
              {t('upload_sub')}
            </p>
          </div>
          <div className="row" style={{ gap: 6, flexShrink: 0, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: apiStatus === 'online' ? 'var(--primary)' : apiStatus === 'offline' ? 'var(--danger)' : 'var(--warn)', display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>API {apiStatus}</span>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid-4">
          <StatBox label="Scans this month" value={monthly} />
          <StatBox label="Completed"        value={counts.completed} color="var(--success)" />
          <StatBox label="Pending"          value={counts.pending}   color="var(--warn)" />
          <StatBox label="Failed"           value={counts.failed}    color="var(--danger)" />
        </div>

        {/* ── Ideology ── */}
        <IdeologySection />

        {/* ── History ── */}
        <ScanHistory
          history={history}
          onView={setActiveSession}
          onDeleteAll={handleClearAll}
          onScan={() => navigate('/scan')}
        />

        {/* ── CTA ── */}
        {history.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => navigate('/scan')}>
              New Scan →
            </button>
          </div>
        )}

      </div>

      {/* ── Modal ── */}
      {activeSession && (
        <SessionModal
          session={activeSession}
          onClose={() => setActiveSession(null)}
          onDelete={handleDelete}
        />
      )}
    </Shell>
  );
}
