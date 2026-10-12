import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Award, Briefcase, Building2, CalendarDays, Crown, Quote, Sparkles, Star } from 'lucide-react';
import { capitalizeName } from '../utils/formatName';
import { EASE_OUT } from './Motion';
import EomTrophy from './EomTrophy';
import './EmployeeOfMonthCard.css';

// The Employee of the Month form saves month as a raw "YYYY-MM" string
// (native <input type="month"> value), so show it as e.g. "July 2026".
function formatMonth(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  }
  return value;
}

function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

// Fixed confetti layout (deterministic, so it never reshuffles on re-render).
const CONFETTI = [
  { x: 6, d: 7.5, delay: 0, r: 160, c: '#fbbf24' },
  { x: 14, d: 9, delay: 2.2, r: -200, c: '#fde68a' },
  { x: 23, d: 8, delay: 4.1, r: 240, c: '#f59e0b' },
  { x: 33, d: 10, delay: 1.1, r: -180, c: '#fff7d6' },
  { x: 44, d: 7, delay: 3.3, r: 220, c: '#fbbf24' },
  { x: 55, d: 9.5, delay: 5.2, r: -260, c: '#fde68a' },
  { x: 64, d: 8.5, delay: 0.7, r: 190, c: '#f59e0b' },
  { x: 73, d: 7.8, delay: 2.9, r: -210, c: '#fff7d6' },
  { x: 82, d: 9.2, delay: 4.6, r: 250, c: '#fbbf24' },
  { x: 91, d: 8, delay: 1.7, r: -170, c: '#fde68a' },
];

const SPARKLES = [
  { top: '6%', left: '8%', size: 14, delay: 0 },
  { top: '16%', right: '4%', size: 18, delay: 0.8 },
  { bottom: '12%', left: '2%', size: 12, delay: 1.5 },
  { bottom: '6%', right: '10%', size: 15, delay: 2.1 },
];

const contentVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.3 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

export default function EmployeeOfMonthCard({ employeeOfMonth }) {
  const reduce = useReducedMotion();
  const [failedPhotoUrl, setFailedPhotoUrl] = useState('');

  const name = employeeOfMonth?.employeeName ? capitalizeName(employeeOfMonth.employeeName) : '';
  const hasWinner = Boolean(name);
  const showPhoto = hasWinner && employeeOfMonth?.photoUrl && failedPhotoUrl !== employeeOfMonth.photoUrl;
  const month = formatMonth(employeeOfMonth?.month);

  return (
    <motion.article
      className="hl-card hl-employee eom-card"
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.08 }}
    >
      <span className="eom-beam" aria-hidden="true" />
      {hasWinner && !reduce && (
        <div className="eom-confetti" aria-hidden="true">
          {CONFETTI.map((p) => (
            <i
              key={p.x}
              style={{ '--x': `${p.x}%`, '--d': `${p.d}s`, '--delay': `${p.delay}s`, '--r': `${p.r}deg`, '--c': p.c }}
            />
          ))}
        </div>
      )}

      <div className={`eom-stage${hasWinner ? '' : ' eom-stage--empty'}`}>
        {hasWinner && !reduce &&
          SPARKLES.map((s, i) => (
            <motion.span
              key={i}
              className="eom-sparkle"
              style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom }}
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], rotate: [0, 90, 180] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
            >
              <Sparkles size={s.size} />
            </motion.span>
          ))}

        {hasWinner ? (
          <motion.div
            className="eom-portrait-wrap"
            initial={reduce ? false : { opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.15 }}
          >
            <motion.span
              className="eom-crown"
              animate={reduce ? undefined : { y: [0, -4, 0], rotate: [-6, 6, -6] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Crown size={17} />
            </motion.span>

            <span className="eom-glow" aria-hidden="true" />
            <span className="eom-ring" aria-hidden="true" />

            <div className="eom-portrait">
              {showPhoto ? (
                <img src={employeeOfMonth.photoUrl} alt={name} onError={() => setFailedPhotoUrl(employeeOfMonth.photoUrl)} />
              ) : (
                <span className="eom-initials">{initialsOf(name)}</span>
              )}
            </div>
          </motion.div>
        ) : (
          <EomTrophy />
        )}
      </div>

      <motion.div
        className="eom-content"
        variants={contentVariants}
        initial={reduce ? false : 'hidden'}
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div className="eom-badges" variants={itemVariants}>
          <span className="eom-badge">
            <Award size={14} /> Employee of the Month
          </span>
          {month && (
            <span className="eom-badge eom-badge--soft">
              <CalendarDays size={13} /> {month}
            </span>
          )}
        </motion.div>

        {hasWinner ? (
          <>
            <motion.h3 className="eom-name" variants={itemVariants}>{name}</motion.h3>

            {(employeeOfMonth.designation || employeeOfMonth.department) && (
              <motion.div className="eom-meta" variants={itemVariants}>
                {employeeOfMonth.designation && (
                  <span className="eom-chip"><Briefcase size={13} /> {employeeOfMonth.designation}</span>
                )}
                {employeeOfMonth.department && (
                  <span className="eom-chip"><Building2 size={13} /> {employeeOfMonth.department}</span>
                )}
              </motion.div>
            )}

            {employeeOfMonth.message && (
              <motion.blockquote className="eom-quote" variants={itemVariants}>
                <Quote size={16} className="eom-quote-icon" />
                {employeeOfMonth.message}
              </motion.blockquote>
            )}

            <motion.div className="eom-stars" variants={itemVariants}>
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={i}
                  initial={reduce ? false : { opacity: 0, scale: 0, rotate: -90 }}
                  whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.9 + i * 0.1 }}
                >
                  <Star size={16} fill="#fbbf24" color="#fbbf24" />
                </motion.span>
              ))}
              <em>Recognised</em>
            </motion.div>
          </>
        ) : (
          <>
            <motion.h3 className="eom-name eom-name--empty" variants={itemVariants}>Not Selected Yet</motion.h3>
            <motion.p className="eom-desc" variants={itemVariants}>
              HR or Manager can recognise an outstanding employee here.
            </motion.p>
          </>
        )}
      </motion.div>
    </motion.article>
  );
}
