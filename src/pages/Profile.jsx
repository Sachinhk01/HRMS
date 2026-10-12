import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import {
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
  Users,
  Venus,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { hrmsService } from '../services/hrmsService';
import { getEmployeeById, getProfilePhotoUrl } from '../services/employeeService';
import { capitalizeName } from '../utils/formatName';
import { formatEnum, displayDate, orDash, calcAge, calcTenure } from '../utils/employeeFormat';
import './Profile.css';
import './ProfileRedesign.css';
import { INPUT_LIMITS } from '../utils/inputLimits';
import DatePicker from '../components/DatePicker';

const TABS = [
  { id: 'personal', label: 'Personal info', Icon: User },
  { id: 'employment', label: 'Employment details', Icon: Briefcase },
  { id: 'security', label: 'Security', Icon: ShieldCheck },
];

const COMPLETENESS_FIELDS = [
  (profile) => profile.hasProfilePhoto,
  (profile) => profile.email,
  (profile) => profile.phoneNumber,
  (profile) => profile.dateOfBirth,
  (profile) => profile.gender,
  (profile) => profile.employeeCode,
  (profile) => profile.departmentName,
  (profile) => profile.designationName || profile.jobTitle,
  (profile) => profile.dateOfJoining,
  (profile) => profile.reportingManagerName,
];

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
};
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

function InfoRow({ Icon, label, value }) {
  return (
    <motion.div className="pf-row" variants={rowVariants}>
      <span className="pf-row-icon"><Icon size={17} /></span>
      <div>
        <dt>{label}</dt>
        <dd>{value || 'Not provided'}</dd>
      </div>
    </motion.div>
  );
}

function getPasswordStrength(password) {
  if (!password) return 0;
  return [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}

export default function Profile() {
  const { user, updateUser, refreshAvatar } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const requestedUserId = searchParams.get('user');
  const isOwnProfile = !requestedUserId || requestedUserId === String(user?.id);
  const reduceMotion = useReducedMotion();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [photoObjectUrl, setPhotoObjectUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const savedTimer = useRef(null);

  const completionCount = useMotionValue(0);
  const completionPercent = useTransform(completionCount, (value) => Math.round(value));
  const ringOffset = useTransform(completionCount, (value) => 339.3 * (1 - value / 100));

  const loadProfile = useCallback(() => {
    setLoading(true);
    const loader = isOwnProfile ? hrmsService.getProfile() : getEmployeeById(requestedUserId);
    loader
      .then(setProfile)
      .catch((err) => {
        setProfile(null);
        showToast(err?.response?.data?.message || err.message || 'Failed to load profile.', 'error');
      })
      .finally(() => setLoading(false));
  }, [isOwnProfile, requestedUserId, showToast]);

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

  useEffect(loadProfile, [loadProfile, user?.id]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  useEffect(() => {
    if (!isOwnProfile && activeTab === 'security') setActiveTab('personal');
  }, [activeTab, isOwnProfile]);

  const completion = profile
    ? Math.round((COMPLETENESS_FIELDS.filter((field) => Boolean(field(profile))).length / COMPLETENESS_FIELDS.length) * 100)
    : 0;

  useEffect(() => {
    const controls = animate(completionCount, completion, {
      duration: reduceMotion ? 0 : 0.9,
      ease: 'easeOut',
    });
    return controls.stop;
  }, [completion, completionCount, reduceMotion]);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const updates = {
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      phoneNumber: form.get('phoneNumber'),
      gender: form.get('gender'),
      dateOfBirth: form.get('dateOfBirth'),
    };

    setSaving(true);
    setSaved(false);
    try {
      const savedProfile = await hrmsService.saveProfile(updates);
      setProfile(savedProfile);
      updateUser({ ...user, name: `${savedProfile.firstName} ${savedProfile.lastName || ''}`.trim() });
      showToast('Profile updated.', 'success');
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to update profile.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const oldPassword = form.get('oldPassword');
    const nextPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (nextPassword.length < 8) {
      showToast('New password must be at least 8 characters.', 'error');
      return;
    }
    if (nextPassword !== confirmPassword) {
      showToast('New password and confirmation do not match.', 'error');
      return;
    }

    try {
      await hrmsService.changePassword({ oldPassword, newPassword: nextPassword, confirmPassword });
      showToast('Password changed successfully.', 'success');
      formEl.reset();
      setNewPassword('');
      setShowPassword(false);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Could not change password.';
      showToast(msg, 'error');
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Only JPG, JPEG and PNG images are allowed.', 'error');
      event.target.value = '';
      return;
    }
    const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

    if (file.size > MAX_PHOTO_SIZE) {
      showToast('Profile photo size cannot exceed 5 MB.', 'error');
      event.target.value = '';
      return;
    }
    setPhotoUploading(true);
    try {
      const savedProfile = await hrmsService.uploadPhoto(file);
      setProfile(savedProfile);
      if (isOwnProfile) {
        updateUser({ ...user, photoUrl: savedProfile.profilePhotoUrl });
        refreshAvatar?.();
      }
      showToast('Profile Photo Updated.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to upload photo.';
      showToast(msg, 'error');
    } finally {
      setPhotoUploading(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <main className="page-stack pf-page">
        <section className="pf-panel pf-loading" aria-label="Loading profile">
          <div className="pf-skeleton pf-skeleton--avatar" />
          <div className="pf-skeleton pf-skeleton--text" />
          <div className="pf-skeleton pf-skeleton--panel" />
        </section>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="page-stack pf-page">
        <section className="pf-panel pf-not-found">
          <Users size={30} />
          <h1>Profile not found</h1>
          <p>This employee profile could not be loaded.</p>
        </section>
      </main>
    );
  }

  const fullName = capitalizeName(`${profile.firstName} ${profile.lastName || ''}`.trim());
  const initials = fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const title = profile.jobTitle || profile.designationName || 'Employee';
  const visibleTabs = isOwnProfile ? TABS : TABS.filter((tab) => tab.id !== 'security');
  const safeValue = (value) => value || 'Not provided';
  const strength = getPasswordStrength(newPassword);
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const personalRows = [
    { Icon: User, label: 'First name', value: capitalizeName(profile.firstName) },
    { Icon: User, label: 'Last name', value: capitalizeName(profile.lastName) },
    { Icon: Mail, label: 'Email', value: orDash(profile.email) },
    { Icon: Phone, label: 'Phone number', value: profile.phoneNumber },
    { Icon: CalendarDays, label: 'Date of birth', value: displayDate(profile.dateOfBirth) },
    { Icon: Clock3, label: 'Age', value: calcAge(profile.dateOfBirth) },
    { Icon: Venus, label: 'Gender', value: formatEnum(profile.gender) },
    { Icon: IdCard, label: 'Employee code', value: orDash(profile.employeeCode) },
  ];
  const employmentRows = [
    { Icon: IdCard, label: 'Employee code', value: orDash(profile.employeeCode) },
    { Icon: ShieldCheck, label: 'Status', value: profile.active ? 'Active' : 'Inactive' },
    { Icon: Briefcase, label: 'Employment type', value: formatEnum(profile.employmentType) },
    { Icon: CalendarDays, label: 'Date of joining', value: displayDate(profile.dateOfJoining) },
    { Icon: Clock3, label: 'Tenure', value: calcTenure(profile.dateOfJoining) },
    { Icon: Building2, label: 'Department', value: profile.departmentName },
    { Icon: Briefcase, label: 'Designation', value: profile.designationName },
    { Icon: Briefcase, label: 'Job title', value: profile.jobTitle },
    { Icon: Users, label: 'Reporting manager', value: capitalizeName(profile.reportingManagerName) || 'Not assigned' },
    { Icon: Mail, label: 'Work email', value: orDash(profile.email) },
    { Icon: Phone, label: 'Mobile', value: profile.phoneNumber },
  ];

  return (
    <main className="page-stack pf-page">
      <motion.section
        className="pf-hero"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="pf-avatar-wrap">
          <svg className="pf-ring" viewBox="0 0 124 124" aria-hidden="true">
            <defs>
              <linearGradient id="pfRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2563eb" />
                <stop offset="1" stopColor="#818cf8" />
              </linearGradient>
            </defs>
            <circle className="pf-ring-track" cx="62" cy="62" r="54" />
            <motion.circle
              className="pf-ring-bar"
              cx="62" cy="62" r="54"
              strokeDasharray="339.3"
              style={{ strokeDashoffset: ringOffset }}
            />
          </svg>
          {photoObjectUrl ? (
            <img className="pf-avatar" src={photoObjectUrl} alt={fullName} />
          ) : (
            <div className="pf-avatar" aria-label={`${fullName} initials`}>{initials || 'HR'}</div>
          )}
          {isOwnProfile && (
            <label className="pf-avatar-edit" title="Change profile photo">
              {photoUploading ? <Loader2 size={18} className="pf-spin" /> : <Camera size={18} />}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={handlePhotoChange}
                disabled={photoUploading}
                aria-label="Upload profile photo"
              />
            </label>
          )}
          <span className="pf-complete"><motion.span>{completionPercent}</motion.span>% complete</span>
        </div>

        <div className="pf-hero-text">
          <span className="pf-eyebrow">Employee profile</span>
          <h1>{isOwnProfile ? `Welcome, ${fullName.split(' ')[0] || 'there'}` : fullName}</h1>
          <p>{title}{profile.departmentName ? ` · ${profile.departmentName}` : ''}</p>
          <div className="pf-chips">
            {profile.employeeCode && <span className="pf-chip"><IdCard size={14} />{profile.employeeCode}</span>}
            {profile.employmentType && <span className="pf-chip"><Briefcase size={14} />{formatEnum(profile.employmentType)}</span>}
            <span className={`pf-chip ${profile.active ? 'pf-chip--ok' : 'pf-chip--off'}`}>
              <i className="pf-dot" />{profile.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <dl className="pf-facts">
          <div><dt>Department</dt><dd>{safeValue(profile.departmentName)}</dd></div>
          <div><dt>Joined</dt><dd>{displayDate(profile.dateOfJoining) || 'Not provided'}</dd></div>
          <div><dt>Tenure</dt><dd>{calcTenure(profile.dateOfJoining) || 'Not provided'}</dd></div>
        </dl>
      </motion.section>

      <div className="pf-body">
        <nav className="pf-nav" role="tablist" aria-label="Profile sections">
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              id={`profile-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`profile-panel-${id}`}
              className={activeTab === id ? 'is-active' : ''}
              onClick={() => setActiveTab(id)}
            >
              {activeTab === id && (
                <motion.span className="pf-pill" layoutId="profile-tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
              )}
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="pf-panel">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              id={`profile-panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`profile-tab-${activeTab}`}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {activeTab === 'personal' && (
                <>
                  <header className="pf-panel-head">
                    <div>
                      <h2>Personal information</h2>
                      <p>{isOwnProfile ? 'Keep your contact and personal details up to date.' : 'Personal details for this employee.'}</p>
                    </div>
                    {isOwnProfile && <span className="pf-private"><ShieldCheck size={14} /> Private to you</span>}
                  </header>

                  {isOwnProfile ? (
                    <form className="pf-form" onSubmit={save}>
                      <label className="pf-field">
                        <span>First name</span>
                        <input maxLength={INPUT_LIMITS.NAME} name="firstName" defaultValue={profile.firstName} placeholder="Enter your first name" required />
                      </label>
                      <label className="pf-field">
                        <span>Last name</span>
                        <input maxLength={INPUT_LIMITS.NAME} name="lastName" defaultValue={profile.lastName} placeholder="Enter your last name" />
                      </label>
                      <label className="pf-field">
                        <span>Email address</span>
                        <input value={profile.email || ''} placeholder="Email address" disabled />
                      </label>
                      <label className="pf-field">
                        <span>Phone number</span>
                        <input maxLength={INPUT_LIMITS.PHONE} name="phoneNumber" defaultValue={profile.phoneNumber} placeholder="Enter your phone number" />
                      </label>
                      <label className="pf-field">
                        <span>Date of birth</span>
                        <DatePicker id="profile-dob" name="dateOfBirth" defaultValue={profile.dateOfBirth} placeholder="Select date of birth" />
                      </label>
                      <label className="pf-field">
                        <span>Gender</span>
                        <select name="gender" defaultValue={profile.gender || ''}>
                          <option value="">Select gender</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                        </select>
                      </label>
                      <label className="pf-field">
                        <span>Employee code</span>
                        <input value={profile.employeeCode || ''} placeholder="Employee code" disabled />
                      </label>
                      <label className="pf-field">
                        <span>Age</span>
                        <input value={calcAge(profile.dateOfBirth) || 'Not provided'} disabled />
                      </label>
                      <div className="pf-actions">
                        <motion.button
                          className={`pf-button pf-save${saved ? ' is-saved' : ''}`}
                          type="submit"
                          disabled={saving}
                          whileHover={reduceMotion || saving ? undefined : { y: -2 }}
                          whileTap={reduceMotion || saving ? undefined : { scale: 0.98 }}
                        >
                          {saving ? <Loader2 size={17} className="pf-spin" /> : saved ? <Check size={17} /> : <Save size={17} />}
                          {saving ? 'Saving changes…' : saved ? 'Saved' : 'Save changes'}
                        </motion.button>
                      </div>
                    </form>
                  ) : (
                    <motion.dl
                      className="pf-list"
                      variants={listVariants}
                      initial={reduceMotion ? false : 'hidden'}
                      animate="show"
                    >
                      {personalRows.map((row) => <InfoRow key={row.label} {...row} />)}
                    </motion.dl>
                  )}
                </>
              )}

              {activeTab === 'employment' && (
                <>
                  <header className="pf-panel-head">
                    <div>
                      <h2>Employment details</h2>
                      <p>Role and workplace information associated with this profile.</p>
                    </div>
                    <span className="pf-readonly"><ShieldCheck size={14} /> HR managed</span>
                  </header>
                  <motion.dl
                    className="pf-list"
                    variants={listVariants}
                    initial={reduceMotion ? false : 'hidden'}
                    animate="show"
                  >
                    {employmentRows.map((row) => <InfoRow key={row.label} {...row} />)}
                  </motion.dl>
                  <p className="pf-note">Employment details can only be updated by HR from the Employees page.</p>
                </>
              )}

              {activeTab === 'security' && isOwnProfile && (
                <>
                  <header className="pf-panel-head">
                    <div>
                      <h2>Security</h2>
                      <p>Update your password to help keep your account secure.</p>
                    </div>
                    <span className="pf-readonly"><ShieldCheck size={14} /> Secure account</span>
                  </header>
                  <form className="pf-form pf-form--narrow" onSubmit={changePassword}>
                    <label className="pf-field">
                      <span>Current password</span>
                      <input maxLength={INPUT_LIMITS.LOGIN_PASSWORD} name="oldPassword" type="password" placeholder="Enter your current password" required />
                    </label>
                    <label className="pf-field">
                      <span>New password</span>
                      <div className="pf-pw">
                        <input
                          name="newPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          required
                          minLength={8}
                          maxLength={20}
                          placeholder="At least 8 characters"
                        />
                        <button
                          type="button"
                          className="pf-pw-toggle"
                          onClick={() => setShowPassword((visible) => !visible)}
                          aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      <div className="pf-meter" data-level={strength} aria-live="polite">
                        <div className="pf-meter-track"><motion.i animate={{ width: `${strength * 25}%` }} transition={{ duration: 0.25 }} /></div>
                        <small>{strengthLabels[strength] || 'Password strength'}</small>
                      </div>
                    </label>
                    <label className="pf-field">
                      <span>Confirm new password</span>
                      <input name="confirmPassword" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={20} placeholder="Re-enter your new password" />
                    </label>
                    <div className="pf-actions">
                      <button className="pf-button pf-button--secondary" type="submit"><KeyRound size={17} />Update password</button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
