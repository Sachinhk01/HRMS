import { motion, MotionConfig } from 'framer-motion';
import CountUp from './CountUp';
import { EASE_OUT } from './Motion';
import './PageHero.css';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const rise = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } } };

export default function StatCards({ items = [] }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="sc-grid" style={{ '--sc-cols': items.length }} variants={stagger} initial="hidden" animate="show">
        {items.map(({ label, value, icon: Icon, tone = 'blue', note, suffix, format }) => (
          <motion.div key={label} className={`sc-card sc-${tone}`} variants={rise} whileHover={{ y: -5 }}>
            {Icon && <span className="sc-icon"><Icon size={19} /></span>}
            <span className="sc-label">{label}</span>
            <strong><CountUp value={value} format={format} />{suffix}</strong>
            {note && <small>{note}</small>}
          </motion.div>
        ))}
      </motion.div>
    </MotionConfig>
  );
}
