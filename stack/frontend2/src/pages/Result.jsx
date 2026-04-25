/**
 * pages/Result.jsx
 *
 * Route: /result/:uuid
 * Reads uuid from path param via useParams.
 * Delegates polling to usePoll() → writes into JobContext.
 */
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Shell from '../components/layout/Shell';
import StatusPill from '../components/common/StatusPill';
import MetricGrid from '../components/result/MetricGrid';
import AISummary from '../components/result/AISummary';
import ResultPieCharts from '../components/charts/ResultPieCharts';
import EmailGate from '../components/common/EmailGate';
import ShareBar from '../components/common/ShareBar';
import { useJobContext } from '../context/JobContext';
import { usePoll } from '../hooks/usePoll';

export default function Result() {
  const { t } = useTranslation();
  const { uuid } = useParams();

  const navigate = useNavigate();
  const ctx = useJobContext();
  const { status, result, error, loading } = ctx;

  // Always poll when uuid changes or context doesn't have a completed result for this uuid.
  const alreadyDone = ctx.uuid === uuid && ctx.status === 'completed' && !!ctx.result;
  usePoll(uuid, { skip: alreadyDone });

  if (!uuid) {
    return (
      <Shell>
        <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No result to show</p>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>{t('no_result')}</p>
          <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => navigate('/scan')}>Start a new scan →</button>
            <Link to="/" className="btn btn-outline">{t('nav_home')}</Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="page fadein">

        {/* ── Page header ── */}
        <div className="row-sb" style={{ marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: 6 }}>
              {t('result_heading')}
            </h1>
            <div className="row" style={{ gap: 10 }}>
              <StatusPill status={status} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--subtle)', wordBreak: 'break-all' }}>
                {uuid}
              </span>
            </div>
          </div>
          <Link to="/" className="btn btn-outline btn-sm">{t('nav_home')}</Link>
        </div>

        {/* ── Polling state ── */}
        {loading && (
          <>
            <div className="card row" style={{ marginBottom: 16 }}>
              <span className="spinner" />
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                {status === 'processing' ? 'AI is analysing your images…' : 'Waiting in queue…'}
              </p>
            </div>
            <div className="progress-track" style={{ marginBottom: 20 }}>
              <div
                className="progress-fill"
                style={{ width: status === 'processing' ? '65%' : '30%' }}
              />
            </div>
          </>
        )}

        {/* ── Error ── */}
        {error && (
          <p className="alert alert-error" style={{ marginBottom: 20 }} role="alert">
            {error}
          </p>
        )}

        {/* ── Result ── */}
        {result && (
          <div className="col" style={{ gap: 20 }}>

            <section className="card">
              <p className="section-title">Key Metrics</p>
              <MetricGrid result={result} />
            </section>

            <section className="card">
              <p className="section-title">Quality Charts</p>
              <ResultPieCharts result={result} />
            </section>

            <section className="card">
              <AISummary text={result.llm_output} />
            </section>

            <div className="alert alert-info" style={{ fontSize: 13 }}>
              <strong>{t('transparency')}: </strong>{t('transparency_note')}
            </div>

            <section className="card">
              <p className="section-title">{t('share_heading')}</p>
              <ShareBar uuid={uuid} />
            </section>

            <section className="card">
              <p className="section-title">{t('email_heading')}</p>
              <EmailGate uuid={uuid} disabled={status !== 'completed'} />
            </section>

            {result.iot_data && (
              <div style={{ textAlign: 'right' }}>
                <Link
                  to={`/iot/${uuid}`}
                  style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600 }}
                >
                  View IoT Insights →
                </Link>
              </div>
            )}

          </div>
        )}

        {!result && !error && !loading && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>{t('no_result')}</p>
            <button className="btn btn-primary" onClick={() => navigate('/scan')}>Start a new scan →</button>
          </div>
        )}

      </div>
    </Shell>
  );
}
