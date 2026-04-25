/**
 * components/upload/Dropzone.jsx
 *
 * Drag-and-drop upload zone.
 * - Accepts JPG / PNG only
 * - Max 5 files, max 10 MB each
 * - Deduplicates by filename + size
 * - Shows per-file validation errors
 * - Keyboard accessible (Enter / Space to open picker)
 */
import { useRef, useState } from 'react';

const ACCEPT_MIME  = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ACCEPT_EXT   = '.jpg,.jpeg,.png';
const MAX_FILES    = 1;
const MAX_BYTES    = 10 * 1024 * 1024; // 10 MB

export function fmtBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function validate(file, existing) {
  if (!ACCEPT_MIME.has(file.type))
    return `"${file.name}" is not supported. Use JPG or PNG.`;
  if (file.size > MAX_BYTES)
    return `"${file.name}" is ${fmtBytes(file.size)} — max is 10 MB.`;
  if (existing.some((f) => f.name === file.name && f.size === file.size))
    return `"${file.name}" is already added.`;
  return null;
}

export default function Dropzone({ files = [], onChange, disabled = false }) {
  const inputRef  = useRef(null);
  const [drag,    setDrag]    = useState(false);
  const [errors,  setErrors]  = useState([]);

  const open = () => !disabled && inputRef.current?.click();

  const process = (incoming) => {
    const errs  = [];
    const valid = [];

    for (const f of incoming) {
      const err = validate(f, [...files, ...valid]);
      if (err) { errs.push(err); continue; }
      if (files.length + valid.length >= MAX_FILES) {
        errs.push(`Maximum ${MAX_FILES} images allowed.`);
        break;
      }
      valid.push(f);
    }

    setErrors(errs);
    if (valid.length) onChange([...files, ...valid]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    process([...e.dataTransfer.files]);
  };

  const onInputChange = (e) => {
    process([...e.target.files]);
    e.target.value = '';
  };

  const remove = (idx) => {
    setErrors([]);
    onChange(files.filter((_, i) => i !== idx));
  };

  const slots = MAX_FILES - files.length;

  return (
    <div style={{ display: 'grid', gap: 10 }}>

      {/* ── Drop zone ── */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Upload area. ${files.length} of ${MAX_FILES} images selected.`}
        aria-disabled={disabled}
        onClick={open}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${drag ? 'var(--primary)' : files.length ? 'var(--primary-b)' : 'var(--border-2)'}`,
          borderRadius: 'var(--radius-l)',
          padding: '28px 20px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: drag ? 'var(--primary-s)' : 'var(--bg)',
          opacity: disabled ? 0.55 : 1,
          transition: 'border-color 140ms, background 140ms',
          userSelect: 'none',
        }}
      >
        {/* Upload icon */}
        <svg
          width="36" height="36" viewBox="0 0 24 24"
          fill="none" stroke={drag ? 'var(--primary)' : 'var(--subtle)'}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ margin: '0 auto 10px', transition: 'stroke 140ms' }}
        >
          <polyline points="16 16 12 12 8 16" />
          <line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>

        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>
          {drag ? 'Drop to add images' : 'Drag & drop images here'}
        </p>
        <p style={{ fontSize: 13, color: 'var(--subtle)', marginBottom: 12 }}>
          or click to browse · JPG / PNG · max 10 MB · single image
        </p>

        {/* Slot counter */}
        <span style={{
          display: 'inline-block',
          padding: '3px 12px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          background: files.length >= MAX_FILES ? 'rgba(220,38,38,0.08)' : 'var(--primary-s)',
          color: files.length >= MAX_FILES ? 'var(--danger)' : 'var(--primary)',
          border: `1px solid ${files.length >= MAX_FILES ? 'rgba(220,38,38,0.2)' : 'var(--primary-b)'}`,
        }}>
          {files.length === 0 ? 'No image selected' : '1 image selected'}
        </span>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_EXT}
          multiple
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled || files.length >= MAX_FILES}
          tabIndex={-1}
        />
      </div>

      {/* ── Validation errors ── */}
      {errors.length > 0 && (
        <ul style={{ display: 'grid', gap: 4, listStyle: 'none' }}>
          {errors.map((e, i) => (
            <li key={i} className="alert alert-error" role="alert" style={{ padding: '8px 12px', fontSize: 13 }}>
              {e}
            </li>
          ))}
        </ul>
      )}

      {/* ── File list ── */}
      {files.length > 0 && (
        <ul style={{ display: 'grid', gap: 8, listStyle: 'none' }}>
          {files.map((f, i) => (
            <FileRow key={`${f.name}-${f.size}`} file={f} index={i} onRemove={remove} disabled={disabled} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({ file, index, onRemove, disabled }) {
  const [src] = useState(() => URL.createObjectURL(file));

  return (
    <li style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-m)',
      background: 'var(--surface)',
    }}>
      <img
        src={src}
        alt={file.name}
        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </p>
        <p style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 2 }}>
          {fmtBytes(file.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(index)}
        disabled={disabled}
        aria-label={`Remove ${file.name}`}
        style={{
          background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--subtle)', padding: '4px 6px', borderRadius: 6,
          fontSize: 16, lineHeight: 1, flexShrink: 0,
          transition: 'color 120ms',
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.color = 'var(--danger)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--subtle)'; }}
      >
        ✕
      </button>
    </li>
  );
}
