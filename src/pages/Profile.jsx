import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, KeyRound, Save, Mail, Phone, CalendarDays, User, Briefcase,
  Building2, IdCard, Users, CheckCircle2, AlertTriangle, Eye, EyeOff,
  ShieldCheck, Award, FileText, Target, TrendingUp,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { hrmsService } from '../services/hrmsService';
import { getEmployeeById, getProfilePhotoUrl } from '../services/employeeService';
import './Profile.css';

const TABS = ['Personal Info', 'Employment Details', 'Change Password'];

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedUserId = searchParams.get('user');
  const isOwnProfile = !requestedUserId || requestedUserId === String(user?.id);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [photoObjectUrl, setPhotoObjectUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  // UI-only additions
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPwd, setNewPwd] = useState('');

  const loadProfile = () => {
    setLoading(true);
    setError('');
    const loader = isOwnProfile ? hrmsService.getProfile() : getEmployeeById(requestedUserId);
    loader
      .then(setProfile)
      .catch((err) => {
        setProfile(null);
        setError(err?.response?.data?.message || err.message || 'Failed to load profile.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let objectUrl;
    if (profile?.hasProfilePhoto) {
      getProfilePhotoUrl(profile.id)
        .then((url) => { objectUrl = url; setPhotoObjectUrl(url); })
        .catch(() => setPhotoObjectUrl(''));
    } else {
      setPhotoObjectUrl('');
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [profile?.id, profile?.hasProfilePhoto]);

  useEffect(loadProfile, [user?.id, requestedUserId, isOwnProfile]);

  const save = async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    setMessage('');
    setError('');
    const form = new FormData(formEl);
    const updates = {
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      phoneNumber: form.get('phoneNumber'),
      gender: form.get('gender'),
      dateOfBirth: form.get('dateOfBirth'),
    };
    try {
      const saved = await hrmsService.saveProfile(updates);
      setProfile(saved);
      updateUser({ ...user, name: `${saved.firstName} ${saved.lastName || ''}`.trim() });
      setMessage('Profile updated.');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to update profile.');
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    setPasswordError('');
    setMessage('');
    const form = new FormData(formEl);
    const oldPassword = form.get('oldPassword');
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    try {
      await hrmsService.changePassword({ oldPassword, newPassword, confirmPassword });
      setMessage('Password changed successfully.');
      formEl.reset();
      setNewPwd('');
    } catch (err) {
      setPasswordError(err?.response?.data?.message || err.message || 'Could not change password.');
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setPhotoUploading(true);
    try {
      const saved = await hrmsService.uploadPhoto(file);
      setProfile(saved);
      if (isOwnProfile) updateUser({ ...user, photoUrl: saved.profilePhotoUrl });
      setMessage('Profile photo updated.');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to upload photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  if (loading) return (
    <div className="page-stack profile-page page-reveal">
      <div className="profile-cover-skeleton" />
      <section className="panel"><div className="skeleton-bar" style={{ width: '40%' }} /><div className="skeleton-bar" style={{ width: '70%' }} /><div className="skeleton-bar" style={{ width: '50%' }} /></section>
    </div>
  );
  if (!profile) return <section className="panel"><p className="empty-inline">{error || 'Profile not found.'}</p></section>;

  const fullName = `${profile.firstName} ${profile.lastName || ''}`.trim();
  const initials = fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const photoUrl = photoObjectUrl;

  // UI-only completion estimate
  const completionFields = ['firstName', 'lastName', 'phoneNumber', 'dateOfBirth', 'gender', 'email'];
  const filledCount = completionFields.filter((f) => profile[f]).length;
  const completion = Math.round((filledCount / completionFields.length) * 100);

  // UI-only password strength
  const pwdStrength = (() => {
    const len = newPwd.length;
    if (len === 0) return { label: '', pct: 0, color: '#e2e8f0' };
    if (len < 8) return { label: 'Too short', pct: 25, color: '#dc2626' };
    const hasUpper = /[A-Z]/.test(newPwd), hasNum = /[0-9]/.test(newPwd), hasSym = /[^A-Za-z0-9]/.test(newPwd);
    const score = 1 + hasUpper + hasNum + hasSym;
    if (score <= 2) return { label: 'Weak', pct: 50, color: '#d97706' };
    if (score === 3) return { label: 'Good', pct: 75, color: '#2563eb' };
    return { label: 'Strong', pct: 100, color: '#16a34a' };
  })();

  const STATS = [
    { icon: CheckCircle2, label: 'Attendance %', value: '92%', tone: 'green' },
    { icon: CalendarDays, label: 'Leave Balance', value: '12d', tone: 'blue' },
    { icon: Target, label: 'Projects', value: '5', tone: 'orange' },
    { icon: Award, label: 'Perf. Score', value: '4.2', tone: 'pink' },
    { icon: TrendingUp, label: 'Experience', value: '3y', tone: 'teal' },
  ];

  return (
    <div className="page-stack profile-page page-reveal">
      <PageHeader eyebrow="Employee Profile" title={isOwnProfile ? 'My profile' : fullName} description="View and manage your personal information." />

      {/* ---------- Toasts ---------- */}
      <AnimatePresence>
        {error && <motion.div className="toast toast-error" initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -24, scale: 0.96 }} transition={{ duration: 0.3, ease: easeOut }}><AlertTriangle size={18} /> {error}</motion.div>}
      </AnimatePresence>
      <AnimatePresence>
        {message && <motion.div className="toast toast-success" initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -24, scale: 0.96 }} transition={{ duration: 0.3, ease: easeOut }} onAnimationComplete={() => { if (message) window.setTimeout(() => setMessage(''), 3500); }}><CheckCircle2 size={18} /> {message}</motion.div>}
      </AnimatePresence>

      {/* ---------- Profile hero with cover ---------- */}
      <motion.section className="profile-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }}>
        <div className="profile-cover">
          <svg className="profile-cover-pattern" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="coverGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2563eb" /><stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <rect width="800" height="200" fill="url(#coverGrad)" />
            <circle cx="120" cy="40" r="60" fill="#fff" opacity="0.08" />
            <circle cx="680" cy="160" r="80" fill="#fff" opacity="0.06" />
            <circle cx="400" cy="100" r="30" fill="#fff" opacity="0.05" />
          </svg>
        </div>
        <div className="profile-hero-content">
          <div className="profile-avatar-wrap">
            {photoUrl
              ? <img className="profile-avatar" src={photoUrl} alt={fullName} />
              : <div className="profile-avatar">{initials || 'HR'}</div>}
            {isOwnProfile && (
              <label className="profile-avatar-edit" title="Change photo">
                <Camera size={14} />
                <input type="file" accept="image/*" onChange={handlePhotoChange} hidden disabled={photoUploading} />
              </label>
            )}
          </div>
          <div className="profile-hero-info">
            <h1>{fullName}</h1>
            <span className="profile-hero-role">{profile.jobTitle || profile.designationName || '—'}{profile.departmentName ? ` · ${profile.departmentName}` : ''}</span>
            <div className="profile-hero-meta">
              <span><Mail size={13} /> {profile.email}</span>
              {profile.phoneNumber && <span><Phone size={13} /> {profile.phoneNumber}</span>}
              {profile.dateOfJoining && <span><CalendarDays size={13} /> Joined {profile.dateOfJoining}</span>}
              <span className={`profile-status ${profile.active ? 'active' : 'inactive'}`}>{profile.active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ---------- Stats cards ---------- */}
      <motion.div className="profile-stats-grid" initial="hidden" animate="show" variants={stagger}>
        {STATS.map((stat) => (
          <motion.div key={stat.label} className={`profile-stat-card tone-${stat.tone}`} variants={fadeUp} whileHover={{ y: -5 }}>
            <div className="loc-icon"><stat.icon size={18} /></div>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </motion.div>
        ))}
      </motion.div>

      {/* ---------- Main + sidebar layout ---------- */}
      <div className="profile-layout">
        <motion.section className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}>
          <div className="profile-tabs" role="tablist">
            {TABS.map((tab) => (
              <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => { setActiveTab(tab); setMessage(''); setError(''); setPasswordError(''); }} role="tab" aria-selected={activeTab === tab}>{tab}</button>
            ))}
          </div>

          <div className="profile-tab-content">
            {activeTab === 'Personal Info' && (
              isOwnProfile ? (
                <form className="profile-form-grid" onSubmit={save}>
                  <label className="pf-field"><span className="pf-label"><User size={14} /> First Name</span><input name="firstName" defaultValue={profile.firstName} required /></label>
                  <label className="pf-field"><span className="pf-label"><User size={14} /> Last Name</span><input name="lastName" defaultValue={profile.lastName} /></label>
                  <label className="pf-field full-span"><span className="pf-label"><Mail size={14} /> Email</span><input value={profile.email} disabled /></label>
                  <label className="pf-field"><span className="pf-label"><Phone size={14} /> Phone</span><input name="phoneNumber" defaultValue={profile.phoneNumber} /></label>
                  <label className="pf-field"><span className="pf-label"><CalendarDays size={14} /> Date of Birth</span><input name="dateOfBirth" type="date" defaultValue={profile.dateOfBirth} /></label>
                  <label className="pf-field"><span className="pf-label"><User size={14} /> Gender</span>
                    <div className="pf-select-wrap"><select name="gender" defaultValue={profile.gender || ''}><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></div>
                  </label>
                  <motion.button type="submit" className="btn btn-gradient btn-ripple full-span" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}><Save size={17} /> Save changes</motion.button>
                </form>
              ) : (
                <div className="profile-info-grid">
                  <div className="pi-item"><span>Full Name</span><strong>{fullName}</strong></div>
                  <div className="pi-item"><span>Email</span><strong>{profile.email}</strong></div>
                  <div className="pi-item"><span>Phone</span><strong>{profile.phoneNumber || 'Not provided'}</strong></div>
                  <div className="pi-item"><span>Date of Birth</span><strong>{profile.dateOfBirth || 'Not provided'}</strong></div>
                  <div className="pi-item"><span>Gender</span><strong>{profile.gender || 'Not provided'}</strong></div>
                </div>
              )
            )}

            {activeTab === 'Employment Details' && (
              <div className="profile-info-grid">
                <div className="pi-item"><IdCard size={15} /><span>Employee Code</span><strong>{profile.employeeCode}</strong></div>
                <div className="pi-item"><Briefcase size={15} /><span>Job Title</span><strong>{profile.jobTitle || 'Not provided'}</strong></div>
                <div className="pi-item"><Award size={15} /><span>Designation</span><strong>{profile.designationName || 'Not provided'}</strong></div>
                <div className="pi-item"><Building2 size={15} /><span>Department</span><strong>{profile.departmentName || 'Not provided'}</strong></div>
                <div className="pi-item"><CalendarDays size={15} /><span>Date of Joining</span><strong>{profile.dateOfJoining || 'Not provided'}</strong></div>
                <div className="pi-item"><Briefcase size={15} /><span>Employment Type</span><strong>{profile.employmentType || 'Not provided'}</strong></div>
                <div className="pi-item"><Users size={15} /><span>Reporting Manager</span><strong>{profile.reportingManagerName || 'Not assigned'}</strong></div>
                <div className="pi-note full-span"><ShieldCheck size={14} /> Employment details can only be updated by HR from the Employees page.</div>
              </div>
            )}

            {activeTab === 'Change Password' && isOwnProfile && (
              <form className="profile-form-grid" onSubmit={changePassword}>
                <label className="pf-field full-span">
                  <span className="pf-label"><KeyRound size={14} /> Current Password</span>
                  <div className="pwd-wrap"><input name="oldPassword" type={showOld ? 'text' : 'password'} required /><button type="button" className="pwd-toggle" onClick={() => setShowOld((s) => !s)}>{showOld ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                </label>
                <label className="pf-field">
                  <span className="pf-label"><KeyRound size={14} /> New Password</span>
                  <div className="pwd-wrap"><input name="newPassword" type={showNew ? 'text' : 'password'} required minLength={8} maxLength={20} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /><button type="button" className="pwd-toggle" onClick={() => setShowNew((s) => !s)}>{showNew ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                </label>
                <label className="pf-field">
                  <span className="pf-label"><KeyRound size={14} /> Confirm New Password</span>
                  <div className="pwd-wrap"><input name="confirmPassword" type={showConfirm ? 'text' : 'password'} required minLength={8} maxLength={20} /><button type="button" className="pwd-toggle" onClick={() => setShowConfirm((s) => !s)}>{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                </label>
                {/* Password strength */}
                {newPwd && (
                  <div className="pwd-strength full-span">
                    <div className="pwd-strength-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${pwdStrength.pct}%` }} transition={{ duration: 0.3 }} style={{ background: pwdStrength.color }} /></div>
                    <span style={{ color: pwdStrength.color }}>{pwdStrength.label}</span>
                  </div>
                )}
                <ul className="pwd-reqs full-span">
                  <li className={newPwd.length >= 8 ? 'met' : ''}>At least 8 characters</li>
                  <li className={/[A-Z]/.test(newPwd) ? 'met' : ''}>One uppercase letter</li>
                  <li className={/[0-9]/.test(newPwd) ? 'met' : ''}>One number</li>
                  <li className={/[^A-Za-z0-9]/.test(newPwd) ? 'met' : ''}>One symbol</li>
                </ul>
                {passwordError && <div className="form-alert full-span">{passwordError}</div>}
                <motion.button type="submit" className="btn btn-gradient btn-ripple full-span" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}><KeyRound size={17} /> Update password</motion.button>
              </form>
            )}
          </div>
        </motion.section>

        {/* ---------- Sidebar ---------- */}
        <aside className="profile-side">
          {/* Completion */}
          <motion.section className="panel side-widget" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }} whileHover={{ y: -4 }}>
            <div className="side-widget-head"><span className="side-widget-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><Target size={18} /></span><h2>Profile Completion</h2></div>
            <div className="completion-ring-wrap">
              <svg viewBox="0 0 80 80" className="completion-ring">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#eef2f7" strokeWidth="8" />
                <motion.circle cx="40" cy="40" r="34" fill="none" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeDasharray="213.6" initial={{ strokeDashoffset: 213.6 }} animate={{ strokeDashoffset: 213.6 - 213.6 * (completion / 100) }} transition={{ duration: 0.9, ease: easeOut }} transform="rotate(-90 40 40)" />
              </svg>
              <strong>{completion}%</strong>
            </div>
            <p className="side-desc">{completion === 100 ? 'Your profile is complete!' : 'Complete your profile to improve visibility.'}</p>
          </motion.section>

          {/* Quick actions */}
          <motion.section className="panel side-widget" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.18 }} whileHover={{ y: -4 }}>
            <div className="side-widget-head"><span className="side-widget-icon" style={{ background: '#dcfce7', color: '#16a34a' }}><ShieldCheck size={18} /></span><h2>Quick Actions</h2></div>
            <div className="quick-links">
              <button className="quick-link"><FileText size={15} /> Download profile</button>
              <button className="quick-link"><Award size={15} /> Certificates</button>
              <button className="quick-link"><Users size={15} /> Emergency contacts</button>
            </div>
          </motion.section>

          {/* Skills placeholder */}
          <motion.section className="panel side-widget" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.26 }} whileHover={{ y: -4 }}>
            <div className="side-widget-head"><span className="side-widget-icon" style={{ background: '#fef3c7', color: '#d97706' }}><Award size={18} /></span><h2>Skills</h2></div>
            <div className="skill-chips">
              <span className="skill-chip">Communication</span>
              <span className="skill-chip">Leadership</span>
              <span className="skill-chip">Project Management</span>
              <span className="skill-chip">Teamwork</span>
            </div>
          </motion.section>

          {/* Documents placeholder */}
          <motion.section className="panel side-widget" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.34 }} whileHover={{ y: -4 }}>
            <div className="side-widget-head"><span className="side-widget-icon" style={{ background: '#fce7f3', color: '#db2777' }}><FileText size={18} /></span><h2>Documents</h2></div>
            <p className="empty-inline">No documents uploaded.</p>
          </motion.section>
        </aside>
      </div>
    </div>
  );
}
