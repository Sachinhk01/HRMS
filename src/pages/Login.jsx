import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft, BriefcaseBusiness, Eye, EyeOff, LockKeyhole,
  Mail, ShieldCheck, Sparkles, UserCog, UsersRound
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export const roleLogins = [
  { key:'employee', role:'EMPLOYEE', title:'Employee Login', subtitle:'Access your dashboard, attendance, leave, celebrations and profile.', icon:UsersRound },
  { key:'manager', role:'MANAGER', title:'Manager Login', subtitle:'Manage leave approvals, team attendance, performance and employees.', icon:BriefcaseBusiness },
  { key:'hr-admin', role:'HR_ADMIN', title:'HR Login', subtitle:'Manage employees, attendance, announcements, events and celebrations.', icon:UserCog },
];

export function LoginPortal() {
  return (
    <div className="role-login-page">
      <div className="role-login-orb role-login-orb-one" />
      <div className="role-login-orb role-login-orb-two" />
      <main className="role-login-shell fade-up">
        <header className="portal-topbar">
          <Logo />
          <span className="portal-secure"><ShieldCheck size={16} /> Secure HRMS Access</span>
        </header>
        <div className="role-login-heading">
          <span className="eyebrow"><Sparkles size={16} /> Employee Experience Platform</span>
          <h1>Choose your login portal</h1>
          <p>Each user role has a separate, secure entry point with role-specific access.</p>
        </div>
        <div className="role-card-grid">
          {roleLogins.map(({ key, title, subtitle, icon: Icon }) => (
            <Link className={`role-login-card role-${key}`} to={`/login/${key}`} key={key}>
              <span className="role-icon"><Icon size={24} /></span>
              <div><h2>{title}</h2><p>{subtitle}</p></div>
              <span className="role-card-action">Login <span>→</span></span>
            </Link>
          ))}
        </div>
        <p className="role-login-footer">MyHourly HRMS • Secure role-based access</p>
      </main>
    </div>
  );
}

export default function Login() {
  const { roleKey } = useParams();
  const config = useMemo(() => roleLogins.find((item) => item.key === roleKey), [roleKey]);
  const { login, registerLocalAccount } = useAuth();
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState('');
  const [createMode, setCreateMode] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: '', email: '', password: '' }
  });

  if (!config) return <Navigate to="/login" replace />;
  const Icon = config.icon;

  const onSubmit = async (data) => {
    setServerError('');
    try {
      if (createMode) {
        await registerLocalAccount({ ...data, role: config.role });
      } else {
        await login({ ...data, role: config.role });
      }
    } catch (error) {
      setServerError(error.message);
    }
  };

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="orb orb-one" /><div className="orb orb-two" />
        <div className="visual-copy fade-up">
          <div className="visual-mark"><Icon size={22} /> {config.title}</div>
          <h1>One platform.<br />Complete HR.<br /><span>Happy employees.</span></h1>
          <p>{config.subtitle}</p>
          <div className="feature-pills"><span><UsersRound size={17} /> Role-specific workspace</span><span><ShieldCheck size={17} /> Secure & compliant</span></div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card fade-up delay-1">
          <Link className="back-to-portals" to="/login"><ArrowLeft size={17} /> All login portals</Link>
          <Logo />
          <div className="login-heading">
            <span className="login-role-icon"><Icon size={21} /></span>
            <h2>{config.title}</h2>
            <p>{createMode ? 'Create a temporary local account until the backend is connected.' : 'Sign in to continue to your authorized workspace.'}</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {createMode && <>
              <label>Full name</label>
              <div className={`input-wrap ${errors.name ? 'has-error' : ''}`}>
                <UsersRound size={18} />
                <input type="text" placeholder="Enter your full name" {...register('name', { required: createMode ? 'Full name is required' : false })} />
              </div>
              {errors.name && <small className="field-error">{errors.name.message}</small>}
            </>}
            <label>Email address</label>
            <div className={`input-wrap ${errors.email ? 'has-error' : ''}`}>
              <Mail size={18} />
              <input type="email" placeholder="name@company.com" {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' }
              })} />
            </div>
            {errors.email && <small className="field-error">{errors.email.message}</small>}

            <label>Password</label>
            <div className={`input-wrap ${errors.password ? 'has-error' : ''}`}>
              <LockKeyhole size={18} />
              <input type={show ? 'text' : 'password'} placeholder="Enter password" {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Minimum 6 characters' }
              })} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}

            <div className="login-row">
              <label className="check-label"><input type="checkbox" /> Remember me</label>
              <button className="text-button" type="button">Forgot password?</button>
            </div>
            {serverError && <div className="form-alert">{serverError}</div>}
            <button className="btn btn-primary btn-block" disabled={isSubmitting}>{isSubmitting ? (createMode ? 'Creating account...' : 'Signing in...') : (createMode ? `Create ${config.title.replace(' Login', '')} account` : `Sign in as ${config.title.replace(' Login', '')}`)}</button>
          </form>
          <button className="text-button local-account-toggle" type="button" onClick={() => { setCreateMode(!createMode); setServerError(''); }}>
            {createMode ? 'Already have a local account? Sign in' : 'No backend yet? Create a local account'}
          </button>
        </div>
      </section>
    </div>
  );
}
