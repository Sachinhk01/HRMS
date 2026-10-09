import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowUpRight, BookOpen, CalendarDays, FileText, Sparkles } from 'lucide-react';
import { openPdfDocument } from '../utils/openPdf';
import { EASE_OUT } from './Motion';
import './MagazineCard.css';

const MAGAZINE_PHOTO =
  'https://images.unsplash.com/photo-1769794371055-54436b54577e?fm=jpg&q=80&w=800&auto=format&fit=crop';

const NEW_WINDOW_DAYS = 30;

function isRecent(value) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// Parent reveals children one after another; children fade up.
const contentVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.25 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT } },
};

export default function MagazineCard({ magazine }) {
  const reduceMotion = useReducedMotion();
  const coverRef = useRef(null);

  // Cursor-driven 3D tilt for the book cover (springs keep it smooth).
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-16, 16]), { stiffness: 140, damping: 16 });
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), { stiffness: 140, damping: 16 });
  const shineX = useTransform(mx, [-0.5, 0.5], ['-20%', '120%']);

  function handleMove(event) {
    if (reduceMotion || !coverRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    mx.set((event.clientX - rect.left) / rect.width - 0.5);
    my.set((event.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  const hasMagazine = Boolean(magazine?.title);
  const canRead = Boolean(magazine?.documentUrl);
  const fresh = hasMagazine && isRecent(magazine?.updatedAt);

  return (
    <motion.article
      className="hl-card hl-magazine mg-card"
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
    >
      {/* animated background glow */}
      <span className="mg-orb mg-orb--a" aria-hidden="true" />
      <span className="mg-orb mg-orb--b" aria-hidden="true" />
      <span className="mg-grid" aria-hidden="true" />

      {/* ---------- 3D book cover ---------- */}
      <div
        className="mg-stage"
        ref={coverRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={() => canRead && openPdfDocument(magazine.documentUrl)}
        role={canRead ? 'button' : undefined}
        tabIndex={canRead ? 0 : -1}
        onKeyDown={(e) => {
          if (canRead && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openPdfDocument(magazine.documentUrl);
          }
        }}
        aria-label={canRead ? `Open ${magazine.title}` : undefined}
      >
        <motion.div
          className="mg-float"
          animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className={`mg-book${hasMagazine ? '' : ' mg-book--empty'}`}
            style={reduceMotion ? undefined : { rotateX, rotateY }}
            initial={reduceMotion ? false : { opacity: 0, rotateY: -40, x: -24 }}
            whileInView={{ opacity: 1, rotateY: 0, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 }}
          >
            <span className="mg-spine" aria-hidden="true" />
            <span className="mg-pages" aria-hidden="true" />
            <div className="mg-cover">
              {hasMagazine ? (
                <>
                  <img src={MAGAZINE_PHOTO} alt="Monthly magazine cover" />
                  <div className="mg-cover-shade" />
                  <div className="mg-cover-label">
                    <span>Monthly</span>
                    <strong>{magazine.month || 'Edition'}</strong>
                  </div>
                  <motion.span
                    className="mg-shine"
                    aria-hidden="true"
                    style={reduceMotion ? undefined : { left: shineX }}
                  />
                </>
              ) : (
                <div className="mg-cover-empty">
                  <BookOpen size={34} strokeWidth={1.6} />
                </div>
              )}
            </div>
          </motion.div>
          <span className="mg-shadow" aria-hidden="true" />
        </motion.div>
      </div>

      {/* ---------- Content ---------- */}
      <motion.div
        className="mg-content"
        variants={contentVariants}
        initial={reduceMotion ? false : 'hidden'}
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div className="mg-badges" variants={itemVariants}>
          <span className="mg-badge">
            <BookOpen size={14} /> Monthly Magazine
          </span>
          {fresh && (
            <span className="mg-badge mg-badge--new">
              <Sparkles size={12} /> New
            </span>
          )}
        </motion.div>

        <motion.h3 className="mg-title" variants={itemVariants}>
          {magazine?.title || 'No Magazine Published Yet'}
        </motion.h3>

        <motion.p className="mg-desc" variants={itemVariants}>
          {magazine?.description ||
            'HR or Manager can publish the company magazine here for everyone to read.'}
        </motion.p>

        {hasMagazine && (
          <motion.div className="mg-meta" variants={itemVariants}>
            {magazine.month && (
              <span className="mg-chip">
                <CalendarDays size={13} /> {magazine.month}
              </span>
            )}
            {canRead && (
              <span className="mg-chip">
                <FileText size={13} /> PDF
              </span>
            )}
          </motion.div>
        )}

        {canRead && (
          <motion.div variants={itemVariants}>
            <motion.button
              type="button"
              className="mg-cta"
              onClick={() => openPdfDocument(magazine.documentUrl)}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <span>Read this edition</span>
              <span className="mg-cta-icon">
                <ArrowUpRight size={15} />
              </span>
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </motion.article>
  );
}