import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

// Counts up to `value` using the same easing as the Leave / Salary pages.
// Respects prefers-reduced-motion. `format` renders each frame (e.g. formatINR).
export default function CountUp({ value, format = (n) => String(n), duration = 0.9 }) {
  const target = Number(value) || 0;
  const from = useRef(0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target;
      setShown(target);
      return undefined;
    }
    const controls = animate(from.current, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { from.current = v; setShown(v); },
    });
    return () => controls.stop();
  }, [target, duration]);

  return <>{format(Math.round(shown))}</>;
}
