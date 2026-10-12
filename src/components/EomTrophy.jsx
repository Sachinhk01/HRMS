import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { EASE_OUT } from './Motion';

function starPoints(r) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`);
  }
  return pts.join(' ');
}

const CUP = 'M42 40 H118 V68 C118 100 100 120 80 120 C60 120 42 100 42 68 Z';

/** Animated 3D golden trophy shown when nobody has been picked yet. */
export default function EomTrophy() {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-22, 22]), { stiffness: 120, damping: 14 });
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 120, damping: 14 });

  function onMove(e) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div className="eom-trophy" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} aria-hidden="true">
      <span className="eom-trophy-glow" />

      <motion.div
        className="eom-trophy-float"
        animate={reduce ? undefined : { y: [0, -9, 0] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="eom-trophy-3d"
          style={reduce ? undefined : { rotateX, rotateY }}
          initial={reduce ? false : { opacity: 0, rotateY: -100, scale: 0.6 }}
          whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.15 }}
        >
          <svg viewBox="0 0 160 190" width="150" height="178" fill="none">
            <defs>
              <linearGradient id="eomGold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff3b0" />
                <stop offset="0.35" stopColor="#fbbf24" />
                <stop offset="0.75" stopColor="#d97706" />
                <stop offset="1" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id="eomGoldSide" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#92400e" />
                <stop offset="0.45" stopColor="#fcd34d" />
                <stop offset="1" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id="eomBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5a3714" />
                <stop offset="1" stopColor="#24150a" />
              </linearGradient>
              <linearGradient id="eomSheen" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <clipPath id="eomCupClip"><path d={CUP} /></clipPath>
            </defs>

            <ellipse cx="80" cy="182" rx="46" ry="6" fill="#000" opacity="0.35" />

            <rect x="34" y="162" width="92" height="18" rx="4" fill="url(#eomBase)" stroke="#b45309" strokeWidth="1.2" />
            <rect x="34" y="162" width="92" height="3" rx="1.5" fill="#fbbf24" opacity="0.8" />
            <rect x="46" y="148" width="68" height="15" rx="3" fill="url(#eomBase)" stroke="#b45309" strokeWidth="1.2" />
            <rect x="46" y="148" width="68" height="2.5" rx="1.2" fill="#fbbf24" opacity="0.8" />
            <g transform="translate(80 171)"><polygon points={starPoints(5)} fill="#fbbf24" /></g>

            <path d="M72 122 H88 L91 142 H69 Z" fill="url(#eomGoldSide)" />
            <ellipse cx="80" cy="144" rx="19" ry="5" fill="url(#eomGold)" />

            <path d="M43 50 C16 48 16 92 48 94" stroke="url(#eomGoldSide)" strokeWidth="7" strokeLinecap="round" />
            <path d="M117 50 C144 48 144 92 112 94" stroke="url(#eomGoldSide)" strokeWidth="7" strokeLinecap="round" />

            <path d={CUP} fill="url(#eomGold)" />
            <path d="M52 48 C50 78 62 104 74 112" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="80" cy="40" rx="38" ry="8" fill="#fde68a" />
            <ellipse cx="80" cy="41" rx="32" ry="5.2" fill="#7c3f0a" />
            <g transform="translate(80 74)">
              <circle r="15" fill="#fff7d6" opacity="0.25" />
              <polygon points={starPoints(11)} fill="#fff7d6" />
            </g>

            {!reduce && (
              <g clipPath="url(#eomCupClip)">
                <motion.rect
                  y="30" width="34" height="100" fill="url(#eomSheen)"
                  style={{ skewX: -18 }}
                  initial={{ x: -50 }}
                  animate={{ x: [-50, 170] }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
                />
              </g>
            )}
          </svg>

          {!reduce && (
            <motion.div
              className="eom-orbit"
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            >
              <i style={{ top: '2%', left: '50%' }} />
              <i style={{ top: '50%', left: '98%' }} />
              <i style={{ top: '96%', left: '30%' }} />
              <i style={{ top: '40%', left: '0%' }} />
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
