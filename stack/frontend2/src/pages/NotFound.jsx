import { Link } from 'react-router-dom';
import Shell from '../components/layout/Shell';

export default function NotFound() {
  return (
    <Shell>
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p style={{ fontSize: 64, fontWeight: 800, color: 'var(--border-2)', lineHeight: 1, marginBottom: 16 }}>
          404
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Page not found</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/" className="btn btn-primary">Go to Home</Link>
      </div>
    </Shell>
  );
}
