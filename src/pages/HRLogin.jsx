import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '../components/Logo.jsx';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Megaphone,
  ShieldCheck,
} from 'lucide-react';

import { StaffAccess } from '../components/StaffAccess.jsx';
import { useAuth } from '../context/AuthContext';
import './EmployeeLogin.css';
import './HRLogin.css';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const cardRise = {
  hidden: { opacity: 0, scale: 0.94, y: 24 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export function HRLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setIsSubmitting(true);
    try {
      await login({ email, password, expectedRole: 'HR_ADMIN', rememberMe });
      navigate('/dashboard');
    } catch (error) {
      setServerError(error.message || 'Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="hrms-login hrms-login--hr">
      <div className="hrms-login__bg" aria-hidden="true" />

      <Link to="/" className="hrms-login__back">
        <ArrowLeft />
        Staff Access
      </Link>

      <motion.button
        type="button"
        className="hrms-login__shield"
        aria-label="Staff access"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setStaffOpen(true)}
      >
        <ShieldCheck />
        <span className="hrms-login__shield-dot" />
      </motion.button>

      <div className="hrms-login__cols">
        <motion.div
          className="hrms-login__aside"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <div className="hrms-login__aside-bg" aria-hidden="true" />

          <div className="hrms-login__aside-content">
            <motion.div variants={rise}>
              <Logo size={90} />
            </motion.div>
            <motion.h2 className="hrms-login__headline" variants={rise}>
              Run HR,
              <br />
              Without The <em>Chaos.</em>
            </motion.h2>

            <motion.p className="hrms-login__subtext" variants={rise}>
              Manage Employees, Broadcast Announcements, And Coordinate Events
              From One Calm Console.
            </motion.p>

            <motion.div className="hrms-login__floatcard-wrap" variants={cardRise}>
              <motion.div
                className="hrms-login__floatcard"
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                whileHover={{
                  scale: 1.03,
                  boxShadow: '0 30px 70px rgba(15,23,42,0.24)',
                  transition: { duration: 0.25 },
                }}
              >
                <div className="hrms-login__floatcard-head">
                  <span className="hrms-login__floatcard-label">Announcements</span>
                  <span className="hrms-login__floatcard-icon">
                    <Megaphone />
                  </span>
                </div>
                <div className="hrms-login__floatcard-body">
                  <div className="hrms-login__floatcard-title">2 New</div>
                  <div className="hrms-login__floatcard-meta">Team-Wide · This Week</div>
                  <span className="hrms-login__floatcard-status">
                    <ShieldCheck />
                    Live
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="hrms-login__form-side"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div className="hrms-login__card" variants={rise}>
            <div className="hrms-login__card-head">
              <span className="hrms-login__card-lock">
                <Lock />
              </span>
              <h1 className="hrms-login__card-title">Sign In</h1>
              <p className="hrms-login__card-sub">
                Use Your HR Credentials To Continue.
              </p>
            </div>

            <form className="hrms-login__form" onSubmit={handleSubmit}>
              <label className="hrms-field">
                <span className="hrms-field__label">Email</span>
                <span className="hrms-field__wrap">
                  <Mail />
                  <input
                    type="text"
                    placeholder="name@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </span>
              </label>

              <label className="hrms-field">
                <span className="hrms-field__label">Password</span>
                <span className="hrms-field__wrap">
                  <Lock />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="hrms-field__toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </span>
              </label>

              <div className="hrms-login__row">
                <label className="hrms-check">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    autoComplete="off"
                  />
                  <span className={`hrms-check__box${rememberMe ? ' hrms-check__box--checked' : ''}`}>
                    <Check strokeWidth={3} />
                  </span>
                  Remember me
                </label>
                <Link to="/forgot-password" className="hrms-login__forgot">
                  Forgot Password?
                </Link>
              </div>

              {serverError && <div className="form-alert">{serverError}</div>}

              <button
                type="submit"
                className="hrms-btn hrms-btn--primary hrms-btn--block"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing In...' : 'Sign In'}
                <ArrowRight />
              </button>
            </form>
          </motion.div>
        </motion.div>
      </div>

      <StaffAccess isOpen={staffOpen} onClose={() => setStaffOpen(false)} />
    </div>
  );
}

export default HRLogin;