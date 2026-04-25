import { useTranslation } from 'react-i18next';
import Shell from '../components/layout/Shell';

function Section({ title, children }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>{title}</h2>
      {children}
    </section>
  );
}

const API_ENDPOINTS = [
  { method: 'POST', path: '/api/v1/analyze',       desc: 'Submit images for analysis. Returns a UUID and queued status.' },
  { method: 'GET',  path: '/api/v1/result/:uuid',  desc: 'Poll job status. Returns ml_response when completed.' },
  { method: 'GET',  path: '/api/v1/pdf/:uuid',     desc: 'Stream the generated PDF report.' },
  { method: 'POST', path: '/api/v1/notify/email',  desc: 'Send the PDF report to an email address.' },
];

export default function About() {
  const { t } = useTranslation();

  return (
    <Shell>
      <div className="page fadein">
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>{t('about_heading')}</h1>

        <Section title="What is RiceAI?">
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 10 }}>{t('about_p1')}</p>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 10 }}>{t('about_p2')}</p>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.8 }}>{t('about_p3')}</p>
        </Section>

        <Section title={t('transparency')}>
          <div className="alert alert-info" style={{ fontSize: 14 }}>
            {t('transparency_note')}
          </div>
          <ul style={{ marginTop: 14, paddingLeft: 20, display: 'grid', gap: 8 }}>
            {[
              'Results are AI estimates — not certified laboratory measurements.',
              'Image quality, lighting, and grain variety affect accuracy.',
              'Always verify with physical inspection before commercial decisions.',
              'We do not sell or share your data with third parties.',
              'Images are deleted after processing. Job metadata is retained for 30 days.',
            ].map((item) => (
              <li key={item} style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{item}</li>
            ))}
          </ul>
        </Section>

        <Section title="API Reference">
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            Backend runs on <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>http://localhost:6532</code>
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {API_ENDPOINTS.map(({ method, path, desc }) => (
              <div key={path} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap',
                padding: '12px 14px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-m)',
                background: 'var(--bg)',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '2px 8px',
                  borderRadius: 4, flexShrink: 0,
                  background: method === 'POST' ? 'rgba(22,163,74,0.1)' : 'rgba(37,99,235,0.1)',
                  color: method === 'POST' ? 'var(--primary-h)' : 'var(--info)',
                  border: `1px solid ${method === 'POST' ? 'rgba(22,163,74,0.2)' : 'rgba(37,99,235,0.2)'}`,
                }}>
                  {method}
                </span>
                <div style={{ flex: 1 }}>
                  <code style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{path}</code>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tech Stack">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            {['React 18', 'Vite 5', 'React Router 6', 'Recharts 2', 'i18next', 'Web Speech API', 'Node.js / Express', 'MongoDB', 'PDFKit', 'Flask (ML)'].map((item) => (
              <div key={item} style={{
                padding: '10px 14px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-m)', fontSize: 13, fontWeight: 500,
                color: 'var(--text)', background: 'var(--surface)',
              }}>
                {item}
              </div>
            ))}
          </div>
        </Section>

      </div>
    </Shell>
  );
}
