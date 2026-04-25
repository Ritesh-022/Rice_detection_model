/**
 * pages/IoT.jsx
 *
 * Route: /iot/:uuid  (uuid optional — shows empty state if missing)
 * Reads iot_data from JobContext. Falls back to polling if context is cold.
 */
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Shell from '../components/layout/Shell';
import IotPanel from '../components/iot/IotPanel';
import StatusPill from '../components/common/StatusPill';
import { useJobContext } from '../context/JobContext';
import { usePoll } from '../hooks/usePoll';

export default function IoT() {
  const { t } = useTranslation();
  const { uuid } = useParams();

  const ctx = useJobContext();
  const { status, result, error, loading } = ctx;

  usePoll(uuid, {
    skip: !uuid || (ctx.uuid === uuid && ctx.status === 'completed' && !!ctx.result),
  });

  const iotData = result?.iot_data ?? null;

  return (
    <Shell>
      <div className="page fadein">

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: 6 }}>
            {t('iot_heading')}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7 }}>
            {t('iot_sub')}
          </p>
          {uuid && (
            <div className="row" style={{ marginTop: 10 }}>
              <StatusPill status={status} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--subtle)', wordBreak: 'break-all' }}>
                {uuid}
              </span>
            </div>
          )}
        </div>

        {/* ── No UUID ── */}
        {!uuid && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>No job selected.</p>
            <Link to="/" className="btn btn-primary">Go to Home</Link>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="card row" style={{ marginBottom: 16 }}>
            <span className="spinner" />
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>Loading IoT data…</span>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <p className="alert alert-error" style={{ marginBottom: 16 }}>{error}</p>
        )}

        {/* ── IoT panel ── */}
        {!loading && uuid && <IotPanel iotData={iotData} />}

        {/* ── Navigation ── */}
        {uuid && (
          <div style={{ marginTop: 24 }}>
            <Link
              to={`/result/${uuid}`}
              style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600 }}
            >
              ← Back to Result
            </Link>
          </div>
        )}

      </div>
    </Shell>
  );
}
