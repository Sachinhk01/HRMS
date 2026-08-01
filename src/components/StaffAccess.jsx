import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimationControls } from 'framer-motion';
import { ArrowLeft, ArrowRight, Briefcase, ShieldCheck, Users } from 'lucide-react';

import './StaffAccess.css';

export function StaffAccess({ isOpen, onClose }) {
  const [stage, setStage] = useState('idle');
  const [vh, setVh] = useState(0);

  const iconControls = useAnimationControls();
  const scanControls = useAnimationControls();
  const scrimControls = useAnimationControls();
  const panelControls = useAnimationControls();

  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (isOpen && stage === 'idle') {
      openSequence();
    } else if (!isOpen && stage === 'open') {
      closeSequence();
    }
  }, [isOpen, stage]);

  async function openSequence() {
    setStage('opening');

    await iconControls.start({
      scale: [1, 1.18, 1],
      opacity: [0, 1, 0],
      transition: { duration: 0.15, ease: 'easeOut' },
    });

    await Promise.all([
      scanControls.start({
        y: [-12, vh + 12],
        transition: { duration: 0.35, ease: [0.65, 0, 0.35, 1] },
      }),
      scrimControls.start({
        backgroundColor: ['rgba(15,23,42,0)', 'rgba(15,23,42,0.94)'],
        transition: { duration: 0.35, ease: [0.65, 0, 0.35, 1] },
      }),
    ]);

    panelControls.start({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
    });
    setStage('open');
  }

  async function closeSequence() {
    setStage('closing');
    panelControls.start({
      opacity: 0,
      y: 16,
      scale: 0.96,
      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
    });
    await new Promise((r) => setTimeout(r, 100));
    await Promise.all([
      scanControls.start({
        y: [vh + 12, -12],
        transition: { duration: 0.3, ease: [0.65, 0, 0.35, 1] },
      }),
      scrimControls.start({
        backgroundColor: ['rgba(15,23,42,0.94)', 'rgba(15,23,42,0)'],
        transition: { duration: 0.3, ease: [0.65, 0, 0.35, 1] },
      }),
    ]);
    setStage('idle');
  }

  const isVisible = stage !== 'idle';

  return (
    <div
      className="staff-access"
      role="dialog"
      aria-modal="true"
      aria-label="Staff access"
      style={{ visibility: isVisible ? 'visible' : 'hidden' }}
    >
      <motion.div
        className="staff-access__scrim"
        initial={{ backgroundColor: 'rgba(15,23,42,0)' }}
        animate={scrimControls}
        style={{ pointerEvents: stage === 'open' ? 'auto' : 'none' }}
        onClick={onClose}
      />

      <motion.div
        className="staff-access__scanline"
        initial={{ y: -12 }}
        animate={scanControls}
      />

      <div className="staff-access__icon-pulse-wrap">
        <motion.div
          className="staff-access__icon-pulse"
          initial={{ scale: 1, opacity: 0 }}
          animate={iconControls}
        >
          <ShieldCheck />
        </motion.div>
      </div>

      <motion.div
        className="staff-access__panel"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={panelControls}
        style={{ pointerEvents: stage === 'open' || stage === 'closing' ? 'auto' : 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="staff-access__head">
          <div>
            <div className="staff-access__title">
              <ShieldCheck />
              Staff Access
            </div>
            <div className="staff-access__sub">Choose your workspace to continue</div>
          </div>
          <button
            type="button"
            className="staff-access__close"
            aria-label="Close staff access"
            onClick={onClose}
          >
            <ArrowLeft />
          </button>
        </div>

        <div className="staff-access__roles">
          <Link to="/login/manager" className="staff-role" onClick={onClose}>
            <span className="staff-role__icon">
              <Briefcase />
            </span>
            <span className="staff-role__text">
              <span className="staff-role__label">Manager</span>
              <span className="staff-role__desc">Approvals &amp; team view</span>
            </span>
            <span className="staff-role__arrow">
              <ArrowRight />
            </span>
          </Link>

          <Link to="/login/hr-admin" className="staff-role" onClick={onClose}>
            <span className="staff-role__icon">
              <Users />
            </span>
            <span className="staff-role__text">
              <span className="staff-role__label">HR</span>
              <span className="staff-role__desc">People operations console</span>
            </span>
            <span className="staff-role__arrow">
              <ArrowRight />
            </span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default StaffAccess;