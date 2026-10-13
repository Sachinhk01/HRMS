import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { initialsOf } from '../utils/leaveFormat';

export function StatusChip({ status }) {
  const key = String(status || '').toLowerCase();
  const label = key ? key[0].toUpperCase() + key.slice(1) : '—';
  return <span className={`lr-chip lr-chip--${key}`}><i />{label}</span>;
}

export function PaidLop({ row }) {
  const paid = Number(row?.paidDays) || 0;
  const lop = Number(row?.lopDays) || 0;
  if (row?.paidDays == null && row?.lopDays == null) return <span className="lr-dim">–</span>;
  if (!paid && !lop) return <span className="lr-dim">–</span>;
  return (
    <span className="lr-paidlop">
      {paid > 0 && <b className="lr-paid">{paid} Paid</b>}
      {paid > 0 && lop > 0 && <span className="lr-dot">•</span>}
      {lop > 0 && <b className="lr-lop">{lop} LOP</b>}
    </span>
  );
}

export function Avatar({ name, size = 34 }) {
  return (
    <span className="lr-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initialsOf(name) || '?'}
    </span>
  );
}

export function KebabMenu({ items, label = 'Row actions' }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const visibleItems = items.filter(Boolean);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 6, left: Math.max(8, rect.right - 170) });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  if (!visibleItems.length) return null;
  return (
    <>
      <button ref={buttonRef} type="button" className="lr-kebab" aria-label={label} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <MoreVertical size={16} />
      </button>
      {open && createPortal(
        <ul ref={menuRef} className="lr-menu" style={position} role="menu">
          {visibleItems.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={item.danger ? 'is-danger' : undefined}
                onClick={() => { setOpen(false); item.onClick(); }}
              >
                {item.icon}{item.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
