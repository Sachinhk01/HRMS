import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import './ExportMenu.css';

const easeOut = [0.16, 1, 0.3, 1];

/**
 * Small "Export" button that opens a compact PDF / Excel picker.
 * onExport(format) is called with 'pdf' or 'excel' — the caller owns the
 * actual download logic (which endpoint to hit, filters to apply, etc.),
 * this component only owns the open/close + busy-state UI.
 */
export default function ExportMenu({ onExport, disabled, label = 'Export' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function pick(format) {
    setOpen(false);
    setBusy(true);
    try {
      await onExport(format);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-soft btn-export"
        disabled={disabled || busy}
        onClick={() => setOpen((v) => !v)}
      >
        <Download size={14} /> {busy ? 'Exporting…' : label} <ChevronDown size={12} className={open ? 'export-chevron open' : 'export-chevron'} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="export-menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: easeOut }}
          >
            <button type="button" className="export-menu-item" onClick={() => pick('pdf')}>
              <FileText size={14} />
              <span>Export as PDF</span>
            </button>
            <button type="button" className="export-menu-item" onClick={() => pick('excel')}>
              <FileSpreadsheet size={14} />
              <span>Export as Excel</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}