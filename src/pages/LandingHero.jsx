import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Fingerprint,
  Megaphone,
  ShieldCheck,
  Users,
  Eye,
  Zap,
} from 'lucide-react';

import { StaffAccess } from '../components/StaffAccess.jsx';
import './LandingHero.css';

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.06 },
  },
};

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
};

const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const cardRise = {
  hidden: { opacity: 0, scale: 0.94, y: 24 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.05.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.21.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
  </svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
  </svg>
);

export function LandingHero() {
  const [staffOpen, setStaffOpen] = useState(false);

  const stats = [
    { icon: Eye, label: 'Real-time attendance' },
    { icon: Zap, label: 'One-click approvals' },
    { icon: Users, label: 'Team-wide visibility' },
  ];

  const features = [
    { icon: Fingerprint, title: 'Attendance', sub: 'Check-in & timesheets' },
    { icon: CalendarDays, title: 'Leave Management', sub: 'Balances & requests' },
    { icon: ClipboardCheck, title: 'Approvals', sub: 'One-click workflows' },
    { icon: Megaphone, title: 'Announcements', sub: 'Team-wide updates' },
  ];

  return (
    <div className="hrms-landing">
      <div className="hrms-landing__bg" aria-hidden="true" />

      {/* ===== Top navigation ===== */}
      <nav className="hrms-nav">
        <div className="hrms-nav__inner">
<Logo size={65} />

          <div className="hrms-nav__actions">
            <Link to="/login" className="hrms-btn hrms-btn--primary">
              Employee Login
              <ArrowRight />
            </Link>
            <motion.button
              type="button"
              className="hrms-iconbtn"
              aria-label="Staff access"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setStaffOpen(true)}
            >
              <ShieldCheck />
              <span className="hrms-iconbtn__dot" />
            </motion.button>
          </div>
        </div>
      </nav>

      {/* ===== Hero ===== */}
      <header className="hrms-hero">
        <div className="hrms-hero__grid">
          <motion.div
            className="hrms-hero__copy"
            variants={container}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={rise}>
              <span className="hrms-eyebrow">
                <span className="hrms-eyebrow__pulse" />
                Internal HRMS platform
              </span>
            </motion.div>

            <motion.h1 className="hrms-hero__headline" variants={rise}>
              People Operations,
              <br />
              <em>On The Clock.</em>
            </motion.h1>

            <motion.p className="hrms-hero__subtext" variants={rise}>
              MyHourly HRMS brings attendance, leave, approvals, and announcements
              into one calm, reliable workspace for your whole team.
            </motion.p>

            <motion.div className="hrms-hero__cta-row" variants={rise}>
              <Link to="/login" className="hrms-btn hrms-btn--primary hrms-btn--lg">
                Employee Login
                <ArrowRight />
              </Link>
            </motion.div>
          </motion.div>

          {/* Floating UI cards — exactly 2, drifting independently */}
          <motion.div
            className="hrms-hero__visual"
            variants={container}
            initial="hidden"
            animate="show"
          >
            <div className="hrms-visual__halo" aria-hidden="true" />

            {/* Back card — Leave, slightly blurred & dimmed */}
            <motion.div
              className="hrms-visual__cardwrap hrms-visual__cardwrap--back"
              variants={cardRise}
            >
              <motion.div
                className="hrms-floatcard hrms-floatcard--back"
                animate={{ y: [0, -13, 0] }}
                transition={{
                  duration: 4.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.9,
                }}
                whileHover={{
                  scale: 1.04,
                  boxShadow: '0 24px 60px rgba(15,23,42,0.2)',
                  transition: { duration: 0.25 },
                }}
              >
                <div className="hrms-floatcard__head">
                  <span className="hrms-floatcard__label">Leave</span>
                  <span className="hrms-floatcard__icon hrms-floatcard__icon--blue">
                    <CalendarCheck />
                  </span>
                </div>
                <div className="hrms-floatcard__body">
                  <div className="hrms-floatcard__title">Approved</div>
                  <div className="hrms-floatcard__meta">2 days · Personal</div>
                  <span className="hrms-floatcard__status hrms-floatcard__status--emerald">
                    <ShieldCheck />
                    Confirmed
                  </span>
                </div>
              </motion.div>
            </motion.div>

            {/* Front card — Attendance, sharp & full opacity */}
            <motion.div
              className="hrms-visual__cardwrap hrms-visual__cardwrap--front"
              variants={cardRise}
            >
              <motion.div
                className="hrms-floatcard hrms-floatcard--front"
                animate={{ y: [0, -17, 0] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.2,
                }}
                whileHover={{
                  scale: 1.03,
                  boxShadow: '0 30px 70px rgba(15,23,42,0.24)',
                  transition: { duration: 0.25 },
                }}
              >
                <div className="hrms-floatcard__head">
                  <span className="hrms-floatcard__label">Attendance</span>
                  <span className="hrms-floatcard__icon">
                    <Fingerprint />
                  </span>
                </div>
                <div className="hrms-floatcard__body">
                  <div className="hrms-floatcard__title">Checked In</div>
                  <div className="hrms-floatcard__meta">09:02 AM · Today</div>
                  <span className="hrms-floatcard__status hrms-floatcard__status--emerald">
                    <ShieldCheck />
                    On time
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </header>

      {/* ===== Stats strip ===== */}
      <motion.section
        className="hrms-stats"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
      >
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <motion.div className="hrms-stat" key={s.label} variants={reveal}>
              <span className="hrms-stat__ring">
                <Icon />
              </span>
              <span className="hrms-stat__label">{s.label}</span>
            </motion.div>
          );
        })}
      </motion.section>

      {/* ===== Feature strip ===== */}
      <section className="hrms-features">
        <motion.h2
          className="hrms-features__title"
          variants={reveal}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.6 }}
        >
          Everything for your people, in one place
        </motion.h2>
        <motion.div
          className="hrms-features__grid"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                className="hrms-feature"
                key={f.title}
                variants={reveal}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <span className="hrms-feature__icon">
                  <Icon />
                </span>
                <span className="hrms-feature__text">
                  <span className="hrms-feature__name">{f.title}</span>
                  <span className="hrms-feature__sub">{f.sub}</span>
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ===== Footer ===== */}
      <motion.footer
        className="hrms-footer"
        variants={reveal}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="hrms-footer__top">
          <div className="hrms-footer__left">
            <Logo size={80} />
            <p className="hrms-footer__tagline">
              Calm, reliable tools for busy teams.
            </p>
            <div className="hrms-footer__socials">
              <motion.a
                href="#"
                className="hrms-social"
                aria-label="GitHub"
                whileHover={{ y: -2, scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
              >
                <GitHubIcon />
              </motion.a>
              <motion.a
                href="#"
                className="hrms-social"
                aria-label="LinkedIn"
                whileHover={{ y: -2, scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
              >
                <LinkedInIcon />
              </motion.a>
              <motion.a
                href="#"
                className="hrms-social"
                aria-label="Twitter"
                whileHover={{ y: -2, scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
              >
                <TwitterIcon />
              </motion.a>
            </div>
          </div>

          <div className="hrms-footer__cols">
            <div className="hrms-footer__col">
              <span className="hrms-footer__col-title">Platform</span>
              <Link to="/" className="hrms-footer__link">Dashboard</Link>
              <Link to="/" className="hrms-footer__link">Features</Link>
            </div>
            <div className="hrms-footer__col">
              <span className="hrms-footer__col-title">Account</span>
              <Link to="/login" className="hrms-footer__link">Employee Login</Link>
              <Link to="/" className="hrms-footer__link">Staff Access</Link>
            </div>
          </div>
        </div>

        <div className="hrms-footer__bottom">
          © 2026 HourlyRecruit Tech Labs. All rights reserved.
        </div>
      </motion.footer>

      <StaffAccess isOpen={staffOpen} onClose={() => setStaffOpen(false)} />
    </div>
  );
}

export default LandingHero;
