import { useEffect, useState } from 'react';
import { Camera, KeyRound, Save } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { hrmsService } from '../services/hrmsService';

import { getEmployeeById, getProfilePhotoUrl } from '../services/employeeService';
import './Profile.css';

const TABS = ['Personal Info', 'Employment Details', 'Change Password'];

export default function Profile() {
  const { user, updateUser, refreshAvatar } = useAuth();
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
    } catch (err) {
      setPasswordError(err?.response?.data?.message || err.message || 'Could not change password.');
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, JPEG and PNG images are allowed.');
      event.target.value = '';
      return;
    }
    const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

    if (file.size > MAX_PHOTO_SIZE) {
      setError('Profile photo size cannot exceed 5 MB.');
      event.target.value = '';
      return;
    }
    setPhotoUploading(true);
    try {
      const saved = await hrmsService.uploadPhoto(file);
      setProfile(saved);
      if (isOwnProfile) {
        updateUser({ ...user, photoUrl: saved.profilePhotoUrl });
        refreshAvatar?.()
      }
      setMessage('Profile photo updated.');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to upload photo.');
    } finally {
      setPhotoUploading(false);
      event.target.value = '';
    }
  };

  if (loading) return <section className="panel"><p className="empty-inline">Loading profile…</p></section>;
  if (!profile) return <section className="panel"><p className="empty-inline">{error || 'Profile not found.'}</p></section>;

  const fullName = `${profile.firstName} ${profile.lastName || ''}`.trim();
  const initials = fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const photoUrl = photoObjectUrl;

  return (
    <div className="page-stack profile-page page-reveal">
      <PageHeader
        eyebrow="Employee Profile"
        title={isOwnProfile ? 'My Profile' : fullName}
        description="View And Manage Your Personal Information."
      />

      {error && <div className="form-alert">{error}</div>}

      <section className="panel profile-card">
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
        <div className="profile-card-body">
          <h2>{fullName}</h2>
          <span>{profile.jobTitle || profile.designationName}{profile.departmentName ? ` · ${profile.departmentName}` : ''}</span>
        </div>
      </section>

      <section className="panel">
        <div className="profile-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'active' : ''}
              onClick={() => { setActiveTab(tab); setMessage(''); setError(''); setPasswordError(''); }}
              role="tab"
              aria-selected={activeTab === tab}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="profile-tab-content">
          {activeTab === 'Personal Info' && (
            isOwnProfile ? (
              <form className="form-grid" onSubmit={save}>
                <label>First Name<input name="firstName" defaultValue={profile.firstName} required /></label>
                <label>Last Name<input name="lastName" defaultValue={profile.lastName} /></label>
                <label>Email<input value={profile.email} disabled /></label>
                <label>Phone<input name="phoneNumber" defaultValue={profile.phoneNumber} /></label>
                <label>Date of Birth<input name="dateOfBirth" type="date" defaultValue={profile.dateOfBirth} /></label>
                <label>
                  Gender
                  <select name="gender" defaultValue={profile.gender || ''}>
                    <option value="">Select</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </label>
                {message && <div className="success-alert full-span">{message}</div>}
                <button className="btn btn-primary full-span"><Save size={18} />Save Changes</button>
              </form>
            ) : (
              <div className="profile-info-grid">
                <div><span>Full Name</span><strong>{fullName}</strong></div>
                <div><span>Email</span><strong>{profile.email}</strong></div>
                <div><span>Phone</span><strong>{profile.phoneNumber || 'Not provided'}</strong></div>
                <div><span>Date of Birth</span><strong>{profile.dateOfBirth || 'Not provided'}</strong></div>
                <div><span>Gender</span><strong>{profile.gender || 'Not provided'}</strong></div>
              </div>
            )
          )}

          {activeTab === 'Employment Details' && (
            <div className="profile-info-grid">
              <div><span>Employee Code</span><strong>{profile.employeeCode}</strong></div>
              <div><span>Job Title</span><strong>{profile.jobTitle || 'Not provided'}</strong></div>
              <div><span>Designation</span><strong>{profile.designationName || 'Not provided'}</strong></div>
              <div><span>Department</span><strong>{profile.departmentName || 'Not provided'}</strong></div>
              <div><span>Date of Joining</span><strong>{profile.dateOfJoining || 'Not provided'}</strong></div>
              <div><span>Employment Type</span><strong>{profile.employmentType || 'Not provided'}</strong></div>
              <div><span>Reporting Manager</span><strong>{profile.reportingManagerName || 'Not assigned'}</strong></div>
              <div className="full-span"><small>Employment Details Can Only Be Updated By HR From The Employees Page.</small></div>
            </div>
          )}

          {activeTab === 'Change Password' && isOwnProfile && (
            <form className="form-grid" onSubmit={changePassword}>
              <label className="full-span">Current Password<input name="oldPassword" type="password" required /></label>
              <label>New Password<input name="newPassword" type="password" required minLength={8} maxLength={20} /></label>
              <label>Confirm New Password<input name="confirmPassword" type="password" required minLength={8} maxLength={20} /></label>
              {passwordError && <div className="form-alert full-span">{passwordError}</div>}
              {message && !passwordError && <div className="success-alert full-span">{message}</div>}
              <button className="btn btn-primary full-span"><KeyRound size={18} />Update password</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}