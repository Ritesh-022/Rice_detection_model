import { useTranslation } from 'react-i18next';
import TTSButton from '../common/TTSButton';

function decodeEntities(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

export default function AISummary({ text }) {
  const { t } = useTranslation();
  if (!text) return null;

  const decoded = decodeEntities(text);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <p className="section-title" style={{ margin: 0 }}>{t('ai_summary')}</p>
        <TTSButton text={decoded} />
      </div>
      <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
        {decoded}
      </p>
    </div>
  );
}
