import { motion } from 'framer-motion';
import { Plane } from 'lucide-react';

const easeOut = [0.16, 1, 0.3, 1];

export default function LeaveHero({ onApply }) {
  return (
    <motion.section
      className="leave-hero lv2-hero"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeOut }}
    >
      <div className="leave-hero-text">
        <span className="eyebrow">Leave Management</span>
        <h1>Plan Your Time Away</h1>
        <p>Apply for leave, monitor your balance and track approval progress.</p>
        <motion.button
          type="button"
          className="lv2-cta"
          onClick={onApply}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plane size={17} className="lv2-cta-plane" />
          Apply for Leave
        </motion.button>
      </div>

      <div className="leave-hero-illustration" aria-hidden="true">
        <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lvCard" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#f1f5ff" />
            </linearGradient>
            <linearGradient id="lvHead" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#2563eb" />
              <stop offset="1" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="lvPlane" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#60a5fa" />
              <stop offset="1" stopColor="#2563eb" />
            </linearGradient>
          </defs>

          <ellipse className="lv-cloud" cx="70" cy="40" rx="22" ry="8" fill="#dbeafe" />
          <ellipse className="lv-cloud lv-cloud--b" cx="268" cy="86" rx="18" ry="6" fill="#e0e7ff" />

          <path className="lv-trail" d="M40 78 C110 8, 210 8, 292 52" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
          <g>
            <path d="M-12 0 L10 -4 L14 0 L10 4 Z" fill="url(#lvPlane)" />
            <path d="M-2 0 L-8 -9 L-4 -9 L4 0 Z" fill="#60a5fa" />
            <path d="M-2 0 L-8 9 L-4 9 L4 0 Z" fill="#3b82f6" />
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" path="M40 78 C110 8, 210 8, 292 52" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.9;1" dur="7s" repeatCount="indefinite" />
          </g>

          <circle cx="268" cy="138" r="11" fill="#fbbf24" />
          <circle className="lv-sun-ring" cx="268" cy="138" r="18" stroke="#fcd34d" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />

          <g className="lv-cal">
            <rect x="84" y="44" width="150" height="116" rx="18" fill="url(#lvCard)" stroke="#c7d2fe" strokeWidth="1.5" />
            <path d="M84 62 a18 18 0 0 1 18 -18 h114 a18 18 0 0 1 18 18 v10 h-150 Z" fill="url(#lvHead)" />
            <circle cx="106" cy="58" r="4" fill="#fff" />
            <circle cx="124" cy="58" r="4" fill="#fff" opacity="0.65" />

            <rect className="lv-cell" style={{ '--i': 0 }} x="104" y="80" width="16" height="14" rx="4" fill="#eef2ff" />
            <rect className="lv-cell" style={{ '--i': 1 }} x="128" y="80" width="16" height="14" rx="4" fill="#eef2ff" />
            <rect className="lv-cell" style={{ '--i': 2 }} x="152" y="80" width="16" height="14" rx="4" fill="#e0e7ff" />
            <rect className="lv-cell" style={{ '--i': 3 }} x="176" y="80" width="16" height="14" rx="4" fill="#eef2ff" />
            <rect className="lv-cell" style={{ '--i': 4 }} x="200" y="80" width="16" height="14" rx="4" fill="#eef2ff" />

            <rect className="lv-cell" style={{ '--i': 5 }} x="104" y="98" width="16" height="14" rx="4" fill="#eef2ff" />
            <rect className="lv-range" style={{ '--i': 0 }} x="128" y="98" width="16" height="14" rx="4" fill="#2563eb" />
            <rect className="lv-range" style={{ '--i': 1 }} x="152" y="98" width="16" height="14" rx="4" fill="#4f46e5" />
            <rect className="lv-range" style={{ '--i': 2 }} x="176" y="98" width="16" height="14" rx="4" fill="#6366f1" />
            <rect className="lv-cell" style={{ '--i': 6 }} x="200" y="98" width="16" height="14" rx="4" fill="#eef2ff" />

            <rect className="lv-cell" style={{ '--i': 7 }} x="104" y="116" width="16" height="14" rx="4" fill="#eef2ff" />
            <rect className="lv-cell" style={{ '--i': 8 }} x="128" y="116" width="16" height="14" rx="4" fill="#eef2ff" />
            <rect className="lv-cell" style={{ '--i': 9 }} x="152" y="116" width="16" height="14" rx="4" fill="#eef2ff" />
            <rect className="lv-cell" style={{ '--i': 10 }} x="176" y="116" width="16" height="14" rx="4" fill="#eef2ff" />
            <rect className="lv-cell" style={{ '--i': 11 }} x="200" y="116" width="16" height="14" rx="4" fill="#eef2ff" />

            <rect x="104" y="138" width="112" height="10" rx="5" fill="#eef2ff" />
          </g>

          <g className="lv-palm">
            <path d="M52 176 Q50 152 64 138" stroke="#16a34a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M64 138 Q50 128 40 136 M64 138 Q78 128 88 136 M64 138 Q64 124 74 120 M64 138 Q54 124 49 120" stroke="#22c55e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>

          <g>
            <circle className="lv-pulse" cx="236" cy="158" r="14" fill="#10b981" />
            <g className="lv-badge">
              <circle cx="236" cy="158" r="13" fill="#10b981" stroke="#fff" strokeWidth="3" />
              <path className="lv-check" d="M230 158 l4 5 l8 -10" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        </svg>
      </div>
    </motion.section>
  );
}
