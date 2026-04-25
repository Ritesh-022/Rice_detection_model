import { statusBadgeClass } from '../../utils/normalise';
import { statusLabel } from '../../utils/status';

export default function StatusPill({ status }) {
  return (
    <span className={`badge ${statusBadgeClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}
