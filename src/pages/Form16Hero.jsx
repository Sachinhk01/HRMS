import { motion } from 'framer-motion';
import { EASE_OUT } from '../components/Motion';

function Form16Art() {
  return (
    <svg viewBox="0 0 220 170" aria-hidden="true">
      <defs>
        <linearGradient id="f16Doc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e8f0ff" />
        </linearGradient>
      </defs>
      <g className="f16-float">
        <rect x="46" y="16" width="112" height="138" rx="14" fill="url(#f16Doc)" stroke="#bfdbfe" strokeWidth="1.5" />
        <rect x="60" y="32" width="44" height="9" rx="4.5" fill="#2563eb" opacity=".85" />
        <path className="f16-draw" d="M60 58h82" stroke="#93c5fd" strokeWidth="5" strokeLinecap="round" />
        <path className="f16-draw f16-draw-2" d="M60 76h66" stroke="#bfdbfe" strokeWidth="5" strokeLinecap="round" />
        <path className="f16-draw f16-draw-3" d="M60 94h76" stroke="#bfdbfe" strokeWidth="5" strokeLinecap="round" />
        <path className="f16-draw f16-draw-3" d="M60 112h50" stroke="#dbeafe" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g className="f16-float-2">
        <circle cx="160" cy="122" r="25" fill="#dcfce7" stroke="#86efac" strokeWidth="2" />
        <path className="f16-tick" d="M149 122l8 8 15-17" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export default function Form16Hero({ description }) {
  return (
    <motion.section
      className="f16-hero"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
    >
      <div className="f16-hero-text">
        <span className="eyebrow">Payroll &amp; Tax</span>
        <h1>Form 16</h1>
        <p>{description}</p>
      </div>
      <div className="f16-hero-art"><Form16Art /></div>
    </motion.section>
  );
}
