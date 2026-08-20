import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import './EmployeeLogin.css';
import './ForgotPassword.css';

const rise = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function ForgotPassword() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setIsSubmitting(true);
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (error) {
      setServerError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="hrms-login hrms-login--centered">
      <div className="hrms-login__bg" aria-hidden="true" />

      <div className="hrms-login__cols hrms-login__cols--single">
        <motion.div
          className="hrms-login__form-side"
          initial="hidden"
          animate="show"
        >
          <motion.div className="hrms-login__card" variants={rise} initial="hidden" animate="show">
            <Link to="/login" className="fp-back-link">
              <ArrowLeft size={15} />
              Back to Login
            </Link>

            <div className="hrms-login__card-head">
              <span className="hrms-login__card-lock">
                <Lock />
              </span>
              <h1 className="hrms-login__card-title">
                {sent ? 'Check your email' : 'Forgot password'}
              </h1>
              <p className="hrms-login__card-sub">
                {sent
                  ? "If an account exists for that email, we've sent a reset link."
                  : "Enter your email and we'll send you a reset link."}
              </p>
            </div>

            {!sent && (
              <form className="hrms-login__form" onSubmit={handleSubmit}>
                <label className="hrms-field">
                  <span className="hrms-field__label">Email</span>
                  <span className="hrms-field__wrap">
                    <Mail />
                    <input
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </span>
                </label>

                {serverError && <div className="form-alert">{serverError}</div>}

                <button
                  type="submit"
                  className="hrms-btn hrms-btn--primary hrms-btn--block"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                  <ArrowRight />
                </button>
              </form>
            )}

            {sent && (
              <div className="fp-success">
                <ShieldCheck size={18} />
                <span>Didn't Get It? Check Spam, or Try Again in a Few Minutes.</span>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default ForgotPassword;