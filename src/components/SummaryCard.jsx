import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

// Counts a numeric value up to its target. Strings (times, "View", "...")
// are shown as-is, so existing cards keep working unchanged.
function useCountUp(target, duration = 900) {
  const isNumber = typeof target === 'number' && Number.isFinite(target);
  const [display, setDisplay] = useState(isNumber ? 0 : target);
  const shown = useRef(0);

  useEffect(() => {
    if (!isNumber) {
      shown.current = 0;
      return undefined;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = shown.current;
    if (reduceMotion || from === target) {
      shown.current = target;
      setDisplay(target);
      return undefined;
    }

    const decimals = Number.isInteger(target) ? 0 : 1;
    const startedAt = performance.now();
    let frame;

    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      const value = Number((from + (target - from) * eased).toFixed(decimals));
      shown.current = value;
      setDisplay(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, isNumber, duration]);

  return isNumber ? display : target;
}

export default function SummaryCard({ icon: Icon, label, value, meta, tone, onClick }) {
  const shownValue = useCountUp(value);
  const isLoading = value === '...';

  return (
    <button type="button" className={`summary-card tone-${tone || 'blue'}`} onClick={onClick}>
      <div className="summary-icon"><Icon size={22} /></div>
      <div className="summary-copy">
        <span>{label}</span>
        {isLoading ? (
          <span className="summary-skeleton" aria-label="Loading" />
        ) : (
          <strong>{shownValue}</strong>
        )}
        <small>{meta}</small>
      </div>
      <ArrowUpRight size={18} className="summary-arrow" />
    </button>
  );
}