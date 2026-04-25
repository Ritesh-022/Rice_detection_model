import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Shell from '../components/layout/Shell';
import Dropzone from '../components/upload/Dropzone';
import StatusPill from '../components/common/StatusPill';
import { useJob } from '../hooks/useJob';

const REGIONS = [
  'Karnataka','Punjab','Haryana','Uttar Pradesh','West Bengal',
  'Andhra Pradesh','Telangana','Tamil Nadu','Odisha','Chhattisgarh',
  'Bihar','Assam','Kerala','Madhya Pradesh','Maharashtra',
  'Gujarat','Rajasthan','Jharkhand','Uttarakhand','Himachal Pradesh',
];

export default function Scan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const job = useJob();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!job.files.length || job.loading) return;
    console.log('[Scan.jsx] Submitting with userMode:', job.userMode);
    const result = await job.submit();
    if (result?.uuid) navigate(`/result/${result.uuid}`);
  };

  return (
    <Shell>
      <div className="page">

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--primary)', marginBottom: 6 }}>
            New Scan
          </p>
          <h1 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, lineHeight: 1.2, marginBottom: 8 }}>
            {t('upload_heading')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 520, lineHeight: 1.7 }}>
            {t('upload_sub')}
          </p>
        </div>

        {/* Upload form */}
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>

            {/* User Mode Toggle */}
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>User Mode</span>
              <div style={{ display: 'flex', gap: 8, padding: 4, background: 'var(--surface)', borderRadius: 'var(--radius-m)', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => job.setUserMode('farmer')}
                  disabled={job.loading}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 'var(--radius-s)',
                    background: job.userMode === 'farmer' ? 'var(--primary)' : 'transparent',
                    color: job.userMode === 'farmer' ? 'white' : 'var(--text)',
                    cursor: job.loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  👨🌾 Farmer
                </button>
                <button
                  type="button"
                  onClick={() => job.setUserMode('consumer')}
                  disabled={job.loading}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 'var(--radius-s)',
                    background: job.userMode === 'consumer' ? 'var(--primary)' : 'transparent',
                    color: job.userMode === 'consumer' ? 'white' : 'var(--text)',
                    cursor: job.loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  🛒 Consumer
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                {job.userMode === 'farmer' 
                  ? '💰 Farmer: Shows selling price (what you receive from market)' 
                  : '🛒 Consumer: Shows buying price (includes 12-15% service margin)'}
              </p>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('region_label')}</span>
              <select
                className="input"
                value={job.region}
                onChange={(e) => job.setRegion(e.target.value)}
                disabled={job.loading}
              >
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>

            <Dropzone files={job.files} onChange={job.setFiles} />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!job.files.length || job.loading}
              >
                {job.loading ? <><span className="spinner" />{t('analysing')}</> : t('upload_cta')}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={job.reset}
                disabled={job.loading && !job.files.length}
              >
                {t('upload_reset')}
              </button>

              {job.status !== 'idle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                  <StatusPill status={job.status} />
                  {job.uuid && (
                    <span className="mono" style={{ fontSize: 12, color: 'var(--subtle)' }}>
                      {job.uuid.slice(0, 8)}…
                    </span>
                  )}
                </div>
              )}
            </div>

            {job.loading && (
              <div className="progress-track">
                <div className="progress-fill" style={{ width: job.status === 'processing' ? '65%' : '30%' }} />
              </div>
            )}

            {job.error && <p className="alert alert-error" role="alert">{job.error}</p>}
          </div>
        </form>

        {/* Capture guide */}
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('guide_heading')}</h2>
          <div className="grid-4">
            {[
              { n: '01', tKey: 'guide_1_title', dKey: 'guide_1_desc' },
              { n: '02', tKey: 'guide_2_title', dKey: 'guide_2_desc' },
              { n: '03', tKey: 'guide_3_title', dKey: 'guide_3_desc' },
              { n: '04', tKey: 'guide_4_title', dKey: 'guide_4_desc' },
            ].map(({ n, tKey, dKey }) => (
              <div key={n} style={{ padding: '16px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-l)', background: 'var(--surface)' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.06em', marginBottom: 6 }}>STEP {n}</p>
                <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{t(tKey)}</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{t(dKey)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Shell>
  );
}
