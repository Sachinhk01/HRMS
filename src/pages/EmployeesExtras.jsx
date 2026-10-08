import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, animate } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';

// Counts up to `value` (skips animation for reduced-motion users).
export function AnimatedCount({ value }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setShown(target);
      return undefined;
    }
    const controls = animate(from.current, target, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { from.current = v; setShown(Math.round(v)); },
    });
    return () => controls.stop();
  }, [target]);

  return <>{shown}</>;
}

// "Showing X of Y" + removable chips for every filter that is currently applied.
// chips: [{ key, label, onRemove }]
export function ActiveFilters({ chips, shown, total, loading, onClearAll }) {
  if (loading) return null;
  const hasChips = chips.length > 0;
  return (
    <div className="emp-filterbar">
      <span className="emp-result-count">
        <SlidersHorizontal size={14} />
        Showing <strong><AnimatedCount value={shown} /></strong> of {total} employees
      </span>
      <div className="emp-chips">
        <AnimatePresence mode="popLayout">
          {chips.map((chip) => (
            <motion.button
              key={chip.key}
              type="button"
              layout
              className="emp-chip"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 460, damping: 32 }}
              onClick={chip.onRemove}
              title="Remove filter"
            >
              {chip.label}
              <X size={12} />
            </motion.button>
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {hasChips && (
            <motion.button
              key="clear"
              type="button"
              className="emp-chip-clear"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClearAll}
            >
              Clear all
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
