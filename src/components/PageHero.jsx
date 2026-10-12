import { motion, MotionConfig } from 'framer-motion';
import CountUp from './CountUp';
import { EASE_OUT } from './Motion';
import './PageHero.css';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } } };
const tile = { hidden: { opacity: 0, y: 14, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_OUT } } };

export default function PageHero({ eyebrow, title, description, action, icon: Icon, stats = [] }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.section className="ph-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
        <div className="ph-text">
          {eyebrow && <span className="ph-eyebrow"><i />{eyebrow}</span>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
          {action && <div className="ph-action">{action}</div>}
        </div>
        {stats.length > 0 ? (
          <motion.div className="ph-stats" variants={list} initial="hidden" animate="show">
            {stats.map(({ label, value, format, icon: StatIcon }) => (
              <motion.div key={label} className="ph-stat" variants={tile} whileHover={{ y: -3 }}>
                {StatIcon && <StatIcon size={16} />}
                <strong><CountUp value={value} format={format} /></strong>
                <span>{label}</span>
              </motion.div>
            ))}
          </motion.div>
        ) : Icon && (
          <div className="ph-art" aria-hidden="true"><span className="ph-art-ring" /><Icon size={34} /></div>
        )}
      </motion.section>
    </MotionConfig>
  );
}
