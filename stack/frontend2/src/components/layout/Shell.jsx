/**
 * components/layout/Shell.jsx
 *
 * Page wrapper used by every page.
 * Provides: sticky Nav, skip-to-content link, main landmark, footer.
 */
import Nav from './Nav';

export default function Shell({ children }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Accessibility: skip to main content */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: -999,
          left: 0,
          padding: '8px 16px',
          background: 'var(--primary)',
          color: '#fff',
          fontWeight: 600,
          fontSize: 14,
          borderRadius: '0 0 var(--radius-m) 0',
          zIndex: 200,
          transition: 'top 120ms',
        }}
        onFocus={(e) => { e.currentTarget.style.top = '0'; }}
        onBlur={(e)  => { e.currentTarget.style.top = '-999px'; }}
      >
        Skip to content
      </a>

      <Nav />

      <main id="main-content" style={{ flex: 1 }} tabIndex={-1}>
        {children}
      </main>

      <footer
        role="contentinfo"
        style={{
          borderTop: '1px solid var(--border)',
          padding: '16px',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--subtle)',
          lineHeight: 1.6,
        }}
      >
        © {new Date().getFullYear()} RiceAI · Open-source grain quality platform
      </footer>

    </div>
  );
}
