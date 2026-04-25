/**
 * components/layout/Nav.jsx
 *
 * Persistent top navbar shown on every page.
 * All 4 pages are always visible.
 * Result and IoT links carry the active uuid from JobContext when available.
 *
 * Desktop : horizontal link row + language picker
 * Mobile  : hamburger → slide-down full-width menu
 */
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangPicker from '../common/LangPicker';
import { useJobContext } from '../../context/JobContext';

function GrainIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <ellipse cx="12" cy="12" rx="10" ry="5.5" />
      <line x1="12" y1="6.5" x2="12" y2="17.5" />
      <line x1="5"  y1="9.5" x2="19" y2="9.5"  />
      <line x1="5"  y1="14.5" x2="19" y2="14.5" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6"  x2="21" y2="6"  />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  );
}

export default function Nav() {
  const { t } = useTranslation();
  const location = useLocation();
  const { uuid } = useJobContext();
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);

  // Build links — Result and IoT carry uuid when one is active
  const LINKS = [
    { to: '/',                              label: t('nav_home'),   end: true  },
    { to: '/scan',                          label: 'New Scan',      end: true  },
    { to: uuid ? `/result/${uuid}` : '/result-placeholder', label: t('nav_result'), end: false, disabled: !uuid },
    { to: uuid ? `/iot/${uuid}`    : '/iot',                label: t('nav_iot'),    end: false },
    { to: '/about',                         label: t('nav_about'),  end: false },
  ];

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  return (
    <header
      ref={navRef}
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 0 var(--border)',
      }}
    >
      {/* ── Top bar ── */}
      <div style={{
        maxWidth: 'var(--page-max)',
        margin: '0 auto',
        padding: '0 20px',
        height: 'var(--nav-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>

        {/* Logo */}
        <NavLink to="/" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontWeight: 800, fontSize: 17,
          color: 'var(--primary)',
          textDecoration: 'none',
          flexShrink: 0,
          letterSpacing: '-0.3px',
        }}>
          <GrainIcon />
          RiceAI
        </NavLink>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="nav-desktop" style={{
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          {LINKS.map(({ to, label, end, disabled }) =>
            disabled ? (
              <span key={to} style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-m)',
                fontSize: 14, fontWeight: 500,
                color: 'var(--border-2)',
                cursor: 'not-allowed',
                userSelect: 'none',
              }}>
                {label}
              </span>
            ) : (
              <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
                padding: '6px 12px',
                borderRadius: 'var(--radius-m)',
                fontSize: 14, fontWeight: 500,
                color: isActive ? 'var(--primary)' : 'var(--muted)',
                background: isActive ? 'var(--primary-s)' : 'transparent',
                textDecoration: 'none',
                transition: 'color 120ms, background 120ms',
                whiteSpace: 'nowrap',
              })}>
                {label}
              </NavLink>
            )
          )}
          <div style={{ marginLeft: 8 }}>
            <LangPicker />
          </div>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'none',
            background: 'none', border: 'none',
            cursor: 'pointer', padding: 6,
            borderRadius: 'var(--radius-s)',
            color: 'var(--text)',
            lineHeight: 0,
          }}
        >
          {open ? <CloseIcon /> : <HamburgerIcon />}
        </button>
      </div>

      {/* ── Mobile dropdown ── */}
      <div
        id="mobile-nav"
        role="navigation"
        aria-label="Mobile navigation"
        style={{
          display: open ? 'flex' : 'none',
          flexDirection: 'column',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '8px 12px 16px',
          gap: 2,
        }}
      >
        {LINKS.map(({ to, label, end, disabled }) =>
          disabled ? (
            <span key={to} style={{
              padding: '11px 14px',
              borderRadius: 'var(--radius-m)',
              fontSize: 15, fontWeight: 500,
              color: 'var(--border-2)',
              cursor: 'not-allowed',
            }}>
              {label}
            </span>
          ) : (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              display: 'block',
              padding: '11px 14px',
              borderRadius: 'var(--radius-m)',
              fontSize: 15, fontWeight: 500,
              color: isActive ? 'var(--primary)' : 'var(--text)',
              background: isActive ? 'var(--primary-s)' : 'transparent',
              textDecoration: 'none',
              transition: 'background 120ms',
            })}>
              {label}
            </NavLink>
          )
        )}
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <LangPicker />
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .nav-desktop   { display: none !important; }
          .nav-hamburger { display: block !important; }
        }
      `}</style>
    </header>
  );
}
