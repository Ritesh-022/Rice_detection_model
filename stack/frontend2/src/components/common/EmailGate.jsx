/**
 * components/common/EmailGate.jsx
 *
 * Mandatory email form — the only way to receive the PDF.
 * Calls services/pdf.emailReport() which owns error mapping.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailReport } from '../../services/pdf';

export default function EmailGate({ uuid, disabled }) {
  const { t } = useTranslation();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || loading || disabled) return;
    setLoading(true);
    setError('');

    const res = await emailReport(uuid, email);
    setLoading(false);

    if (res.ok) {
      setSent(true);
    } else {
      setError(res.error || t('error_generic'));
    }
  };

  if (sent) {
    return (
      <div className="alert alert-success fadein" role="status">
        {t('email_sent')}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
        Enter your email to receive the PDF report as a download.
      </p>

      <div className="row" style={{ gap: 8 }}>
        <input
          type="email"
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder={t('email_placeholder')}
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          disabled={loading || disabled}
          required
          autoComplete="email"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!valid || loading || disabled}
        >
          {loading
            ? <><span className="spinner spinner-sm" />{t('email_sending')}</>
            : 'Send PDF'}
        </button>
      </div>

      {error && (
        <p className="alert alert-error" role="alert">{error}</p>
      )}
      {disabled && !error && (
        <p style={{ fontSize: 13, color: 'var(--subtle)' }}>
          Available once the analysis is complete.
        </p>
      )}
    </form>
  );
}
