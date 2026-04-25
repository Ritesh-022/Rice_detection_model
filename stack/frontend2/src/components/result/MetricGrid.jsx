import { useTranslation } from 'react-i18next';
import { formatPrice, qualityBadgeClass } from '../../utils/normalise';

function Metric({ label, children }) {
  return (
    <div style={{
      padding: '14px 16px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-m)',
      background: 'var(--surface)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--subtle)', marginBottom: 6 }}>
        {label}
      </p>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
        {children}
      </div>
    </div>
  );
}

export default function MetricGrid({ result }) {
  const { t } = useTranslation();
  if (!result) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
      <Metric label={t('rice_type')}>
        {result.class_distribution && Object.keys(result.class_distribution).length > 0
          ? Object.entries(result.class_distribution)
              .sort(([,a],[,b]) => b - a)
              .map(([type, count]) => {
                const pct = result.grain_count > 0 ? Math.round((count / result.grain_count) * 100) : 0;
                return `${type} ${pct}%`;
              })
              .join(', ')
          : result.type}
      </Metric>
      <Metric label="Grain Count">
        {result.grain_count} grains
      </Metric>
      <Metric label={t('health_score')}>
        {result.healthy_count}/{result.grain_count} ({Math.round(result.health)}%)
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--subtle)', display: 'block', marginTop: 2 }}>
          {result.unhealthy_count} defective grains (broken high / discoloured high)
        </span>
      </Metric>
      <Metric label={t('quality_grade')}>
        <span className={`badge ${qualityBadgeClass(result.quality)}`}>{result.quality}</span>
      </Metric>
      <Metric label={t('market_price')}>
        {formatPrice(result.price)}
      </Metric>
      <Metric label={t('shelf_life')}>
        {result.shelf_life ?? 'N/A'}
      </Metric>
      {result.supply_chain && (
        <Metric label={t('supply_chain')}>
          {result.supply_chain}
        </Metric>
      )}
    </div>
  );
}
