// Shared framer-motion presets so every page reveals the same way.
export const EASE_OUT = [0.16, 1, 0.3, 1];

// Child item: fades up. Use inside a parent that uses `staggerGrid`.
export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

// Parent: reveals its children one after another.
export const staggerGrid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};