import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Eye, EyeOff, Lock } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './EmployeeLogin.css';
import './ForgotPassword.css';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;

function validate(password, confirm) {
  const errors = {};

  if (!password) {
    errors.password = 'Enter a new password.';
  } else if (password.length < PASSWORD_MIN) {
    errors.password = `Use at least ${PASSWORD_MIN} characters.`;
  } else if (password.length > PASSWORD_MAX) {
    errors.password = `Use no more than ${PASSWORD_MAX} characters.`;
  }

  if (!confirm) {
    errors.confirm = 'Re-enter your new password.';
  } else if (password !== confirm) {
    errors.confirm = 'Passwords do not match.';
  }

  return errors;
}

function ResetPasswordCard({ children }) {
  return (
    <div className="hrms-login hrms-login--centered">
      <div className="hrms-login__bg" aria-hidden="true" />
      <div className="hrms-login__cols hrms-login__cols--single">
        <div className="hrms-login__form-side">
          <div className="hrms-login__card">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const { resetPassword } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const errors = validate(password, confirm);
  const isValid = Object.keys(errors).length === 0;
  const showError = (field) => touched[field] && errors[field];

  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => navigate('/login', { replace: true }), 2500);
    return () => clearTimeout(timer);
  }, [done, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched({ password: true, confirm: true });
    if (!isValid || submitting) return;

    setSubmitting(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (error) {
      showToast(
        error?.response?.data?.message || error.message || 'Could not reset your password. Please try again.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <ResetPasswordCard>
        <div className="hrms-login__card-head">
          <h1 className="hrms-login__card-title">This reset link is incomplete</h1>
          <p className="hrms-login__card-sub">
            Open the link from your email again, or request a new one.
          </p>
        </div>
        <Link to="/forgot-password" className="hrms-btn hrms-btn--primary hrms-btn--block fp-link-btn">
          Request a new link
        </Link>
      </ResetPasswordCard>
    );
  }

  if (done) {
    return (
      <ResetPasswordCard>
        <div className="hrms-login__card-head">
          <h1 className="hrms-login__card-title">Password updated</h1>
          <p className="hrms-login__card-sub">Taking you to the login page…</p>
        </div>
        <Link to="/login" className="hrms-btn hrms-btn--primary hrms-btn--block fp-link-btn">
          Go to login
        </Link>
      </ResetPasswordCard>
    );
  }

  const rules = [
    {
      label: `${PASSWORD_MIN} to ${PASSWORD_MAX} characters`,
      ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    },
    { label: 'Both passwords match', ok: password.length > 0 && password === confirm },
  ];

  return (
    <ResetPasswordCard>
      <div className="hrms-login__card-head">
        <span className="hrms-login__card-lock"><Lock /></span>
        <h1 className="hrms-login__card-title">Set a new password</h1>
        <p className="hrms-login__card-sub">Choose a password you haven't used here before.</p>
      </div>

      <form className="hrms-login__form" onSubmit={handleSubmit} noValidate>
        <label className="hrms-field">
          <span className="hrms-field__label">New password</span>
          <span className="hrms-field__wrap">
            <Lock />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              maxLength={PASSWORD_MAX + 10}
              autoComplete="new-password"
              aria-invalid={!!showError('password')}
              aria-describedby="rp-password-error"
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
            />
            <button
              type="button"
              className="hrms-field__toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          <span id="rp-password-error" role="alert" style={{ color: '#c0392b', fontSize: 13, minHeight: 18 }}>
            {showError('password') || ''}
          </span>
        </label>

        <label className="hrms-field">
          <span className="hrms-field__label">Confirm new password</span>
          <span className="hrms-field__wrap">
            <Lock />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              maxLength={PASSWORD_MAX + 10}
              autoComplete="new-password"
              aria-invalid={!!showError('confirm')}
              aria-describedby="rp-confirm-error"
              onChange={(event) => setConfirm(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, confirm: true }))}
            />
          </span>
          <span id="rp-confirm-error" role="alert" style={{ color: '#c0392b', fontSize: 13, minHeight: 18 }}>
            {showError('confirm') || ''}
          </span>
        </label>

        <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 16px', fontSize: 13 }}>
          {rules.map((rule) => (
            <li
              key={rule.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: rule.ok ? '#1e8e5a' : '#6b7280',
              }}
            >
              {rule.ok ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              {rule.label}
            </li>
          ))}
        </ul>

        <button
          type="submit"
          className="hrms-btn hrms-btn--primary hrms-btn--block"
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </ResetPasswordCard>
  );
}

export default ResetPassword;
