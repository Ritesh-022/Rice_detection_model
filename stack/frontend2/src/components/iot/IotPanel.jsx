/**
 * components/iot/IotPanel.jsx
 *
 * Renders iot_data from the normalised result.
 * Handles three shapes:
 *   null / undefined  → empty state
 *   string            → plain text block
 *   object            → flattened key-value rows
 */
import { useTranslation } from 'react-i18next';
import IotRow from './IotRow';

function flatten(obj, prefix = '') {
  const rows = [];
  for (const [k, v] of Object.entries(obj)) {
    const label = prefix ? `${prefix} › ${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      rows.push(...flatten(v, label));
    } else {
      rows.push({ label, value: Array.isArray(v) ? v.join(', ') : v });
    }
  }
  return rows;
}

export default function IotPanel({ iotData }) {
  const { t } = useTranslation();

  if (!iotData) {
    return (
      <div className="card">
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>{t('iot_empty')}</p>
      </div>
    );
  }

  if (typeof iotData === 'string') {
    return (
      <div className="card">
        <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {iotData}
        </p>
      </div>
    );
  }

  const rows = flatten(iotData);

  return (
    <section className="card">
      <p className="section-title">Sensor Readings</p>
      {rows.map(({ label, value }) => (
        <IotRow key={label} label={label} value={value} />
      ))}
    </section>
  );
}
