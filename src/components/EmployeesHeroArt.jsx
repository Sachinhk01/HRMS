import { motion, useReducedMotion } from 'framer-motion';
import './EmployeesHeroArt.css';

const EASE = [0.16, 1, 0.3, 1];

const LINKS = [
  { d: 'M160 72 V100 H70 V112', delay: 0.5 },
  { d: 'M160 72 V112', delay: 0.6 },
  { d: 'M160 72 V100 H250 V112', delay: 0.7 },
  { d: 'M70 148 V160 H44 V172', delay: 1.0 },
  { d: 'M70 148 V160 H96 V172', delay: 1.05 },
  { d: 'M250 148 V160 H224 V172', delay: 1.1 },
  { d: 'M250 148 V160 H276 V172', delay: 1.15 },
];

const MEMBERS = [
  { x: 70, y: 130, r: 18, color: '#0891b2', delay: 0.9, float: 4.6 },
  { x: 160, y: 130, r: 18, color: '#16a34a', delay: 1.0, float: 5.4 },
  { x: 250, y: 130, r: 18, color: '#7c3aed', delay: 1.1, float: 5 },
];

const LEAVES = [
  { x: 44, y: 182, delay: 1.35 },
  { x: 96, y: 182, delay: 1.4 },
  { x: 224, y: 182, delay: 1.45 },
  { x: 276, y: 182, delay: 1.5 },
];

function Person({ r, color }) {
  const scale = r / 18;
  return (
    <g transform={`scale(${scale})`}>
      <circle r="18" fill={color} />
      <circle cy="-4.5" r="5.2" fill="#fff" />
      <path d="M-9.5 11.5 C-9.5 5.5 -5 3.2 0 3.2 C5 3.2 9.5 5.5 9.5 11.5 Z" fill="#fff" />
    </g>
  );
}

export default function EmployeesHeroArt() {
  const reduce = useReducedMotion();
  const loop = (duration, extra = {}) =>
    reduce ? undefined : { duration, repeat: Infinity, ease: 'easeInOut', ...extra };

  return (
    <svg className="emp-art" viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g>
        <motion.circle
          cx="262" cy="48" r="52" fill="#dbeafe" opacity="0.55"
          animate={reduce ? undefined : { x: [0, -10, 0], y: [0, 8, 0] }}
          transition={loop(8)}
        />
        <motion.circle
          cx="42" cy="150" r="36" fill="#bfdbfe" opacity="0.45"
          animate={reduce ? undefined : { x: [0, 10, 0], y: [0, -8, 0] }}
          transition={loop(9)}
        />
      </g>

      <g strokeLinecap="round" strokeLinejoin="round">
        {LINKS.map((link) => (
          <motion.path
            key={link.d}
            d={link.d}
            stroke="#bfdbfe"
            strokeWidth="2"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : link.delay, ease: EASE }}
          />
        ))}
        {!reduce && LINKS.map((link) => (
          <motion.path
            key={`flow-${link.d}`}
            d={link.d}
            stroke="#2563eb"
            strokeWidth="2"
            strokeDasharray="2 14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9, strokeDashoffset: [0, -32] }}
            transition={{
              opacity: { delay: link.delay + 0.8, duration: 0.4 },
              strokeDashoffset: { duration: 1.6, repeat: Infinity, ease: 'linear' },
            }}
          />
        ))}
      </g>

      {LEAVES.map((node) => (
        <motion.g
          key={`${node.x}-${node.y}`}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: reduce ? 0 : node.delay }}
        >
          <circle cx={node.x} cy={node.y} r="9" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
          <circle cx={node.x} cy={node.y - 1.8} r="2.4" fill="#93c5fd" />
          <path
            d={`M${node.x - 4.4} ${node.y + 5} C${node.x - 4.4} ${node.y + 2.2} ${node.x - 2} ${node.y + 1.2} ${node.x} ${node.y + 1.2} C${node.x + 2} ${node.y + 1.2} ${node.x + 4.4} ${node.y + 2.2} ${node.x + 4.4} ${node.y + 5} Z`}
            fill="#93c5fd"
          />
        </motion.g>
      ))}

      {MEMBERS.map((member) => (
        <motion.g
          key={member.x}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 14, delay: reduce ? 0 : member.delay }}
        >
          <motion.g
            animate={reduce ? undefined : { y: [0, -4, 0] }}
            transition={loop(member.float, { delay: member.delay + 0.6 })}
          >
            <circle cx={member.x} cy={member.y} r={member.r + 5} fill="#fff" stroke="#e0edff" strokeWidth="2" />
            <g transform={`translate(${member.x} ${member.y})`}>
              <Person r={member.r} color={member.color} />
            </g>
          </motion.g>
        </motion.g>
      ))}

      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14, delay: reduce ? 0 : 0.2 }}
      >
        {!reduce && (
          <motion.circle
            cx="160" cy="48" r="26" stroke="#2563eb" strokeWidth="2" fill="none"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={{ scale: [1, 1.7], opacity: [0.45, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <motion.g animate={reduce ? undefined : { y: [0, -3, 0] }} transition={loop(5)}>
          <circle cx="160" cy="48" r="28" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
          <g transform="translate(160 48)">
            <Person r={22} color="#2563eb" />
          </g>
          <g transform="translate(176 28)">
            <circle r="8" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
            <path d="M-3.6 2 L-4.2 -2.4 L-1.6 -0.4 L0 -3.4 L1.6 -0.4 L4.2 -2.4 L3.6 2 Z" fill="#fff" />
          </g>
        </motion.g>
      </motion.g>

      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={reduce
          ? { scale: 1, opacity: 1 }
          : { scale: [0, 1, 1, 0], opacity: [0, 1, 1, 0], y: [6, 0, 0, -6] }}
        transition={reduce
          ? { duration: 0 }
          : { duration: 3.4, times: [0, 0.15, 0.8, 1], repeat: Infinity, repeatDelay: 2.4, delay: 2 }}
      >
        <rect x="224" y="30" width="58" height="24" rx="12" fill="#fff" stroke="#bbf7d0" strokeWidth="2" />
        <circle cx="238" cy="42" r="7" fill="#16a34a" />
        <path d="M238 38.6 V45.4 M234.6 42 H241.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="249" y="38" width="26" height="8" rx="4" fill="#dcfce7" />
      </motion.g>
    </svg>
  );
}
