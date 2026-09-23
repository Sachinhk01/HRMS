import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './EmployeeLogin.css';
import './ForgotPassword.css';

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;

export function ResetPassword() {
  const { resetPassword } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const lengthValid = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
  const matchValid = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!lengthValid) {
      showToast(`Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`, 'error');
      return;
    }
    if (!matchValid) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (error) {
      showToast(error.message || 'Unable to reset password. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // No token in the URL at all — the person didn't arrive here via the
  // emailed reset link, so there's nothing to submit against.
  if (!token) {
    return (
      <div className="hrms-login hrms-login--centered">
        <div className="hrms-login__bg" aria-hidden="true" />
        <div className="hrms-login__cols hrms-login__cols--single">
          <motion.div className="hrms-login__form-side" initial="hidden" animate="show">
            <motion.div className="hrms-login__card" variants={rise} initial="hidden" animate="show">
              <Link to="/login" className="fp-back-link">
                <ArrowLeft size={15} />
                Back to Login
              </Link>

              <div className="hrms-login__card-head">
                <span className="hrms-login__card-lock hrms-login__card-lock--warn">
                  <TriangleAlert />
                </span>
                <h1 className="hrms-login__card-title">Invalid reset link</h1>
                <p className="hrms-login__card-sub">
                  This link is missing or broken. Request a new one to reset your password.
                </p>
              </div>

              <Link
                to="/forgot-password"
                className="hrms-btn hrms-btn--primary hrms-btn--block fp-link-btn"
              >
                Request New Link
                <ArrowRight />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="hrms-login hrms-login--centered">
      <div className="hrms-login__bg" aria-hidden="true" />

      <div className="hrms-login__cols hrms-login__cols--single">
        <motion.div className="hrms-login__form-side" initial="hidden" animate="show">
          <motion.div className="hrms-login__card" variants={rise} initial="hidden" animate="show">
            {!done && (
              <Link to="/login" className="fp-back-link">
                <ArrowLeft size={15} />
                Back to Login
              </Link>
            )}

            <div className="hrms-login__card-head">
              <span className="hrms-login__card-lock">
                {done ? <CheckCircle /> : <KeyRound />}
              </span>
              <h1 className="hrms-login__card-title">
                {done ? 'Password reset' : 'Set a new password'}
              </h1>
              <p className="hrms-login__card-sub">
                {done
                  ? 'Your password has been changed successfully.'
                  : 'Choose a new password for your account.'}
              </p>
            </div>

            {!done && (
              <form className="hrms-login__form" onSubmit={handleSubmit}>
                <label className="hrms-field">
                  <span className="hrms-field__label">New Password</span>
                  <span className="hrms-field__wrap">
                    <Lock />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={PASSWORD_MIN}
                      maxLength={PASSWORD_MAX}
                      required
                    />
                    <button
                      type="button"
                      className="hrms-field__toggle"
                      aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </span>
                </label>

                <label className="hrms-field">
                  <span className="hrms-field__label">Confirm New Password</span>
                  <span className="hrms-field__wrap">
                    <Lock />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={PASSWORD_MIN}
                      maxLength={PASSWORD_MAX}
                      required
                    />
                    <button
                      type="button"
                      className="hrms-field__toggle"
                      aria-label={showConfirmPassword ? 'Hide Password' : 'Show Password'}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                    >
                      {showConfirmPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </span>
                </label>

                <p className="fp-hint">
                  {PASSWORD_MIN}-{PASSWORD_MAX} characters.
                  {confirmPassword.length > 0 && !matchValid ? ' Passwords do not match yet.' : ''}
                </p>

                <button
                  type="submit"
                  className="hrms-btn hrms-btn--primary hrms-btn--block"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                  <ArrowRight />
                </button>
              </form>
            )}

            {done && (
              <>
                <div className="fp-success">
                  <ShieldCheck size={18} />
                  <span>You can now sign in with your new password.</span>
                </div>
                <button
                  type="button"
                  className="hrms-btn hrms-btn--primary hrms-btn--block fp-link-btn"
                  onClick={() => navigate('/login')}
                >
                  Go to Login
                  <ArrowRight />
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default ResetPassword;