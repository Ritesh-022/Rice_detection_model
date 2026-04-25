/**
 * components/iot/IotRow.jsx
 * A single labelled sensor reading row.
 */
export default function IotRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
      padding: '11px 0',
      borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--muted)',
        minWidth: 160,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 14,
        color: 'var(--text)',
        textAlign: 'right',
        wordBreak: 'break-word',
        flex: 1,
      }}>
        {String(value ?? 'N/A')}
      </span>
    </div>
  );
}
