import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export default function ShareBar({ uuid }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!uuid) return null;

  const url = `${APP_URL}/result/${uuid}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{
        flex: 1, minWidth: 0,
        fontFamily: 'monospace', fontSize: 13,
        color: 'var(--muted)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '8px 12px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-m)',
        background: 'var(--bg)',
      }}>
        {url}
      </span>
      <button type="button" className="btn btn-outline btn-sm" onClick={copy}>
        {copied ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {t('share_copied')}
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {t('share_copy')}
          </>
        )}
      </button>
    </div>
  );
}
