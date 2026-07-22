import { useEffect, useState } from 'react';
import { Camera, KeyRound, Save } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { hrmsService } from '../services/hrmsService';
import { getEmployees } from '../services/employeeService';
import './Profile.css';

const TABS = ['Personal Info', 'Employment Details', 'Change Password'];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedUserId = searchParams.get('user');
  const isOwnProfile = !requestedUserId || requestedUserId === user?.id;
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState(TABS[0]);

  useEffect(() => {
    if (isOwnProfile) {
      hrmsService.getProfile(user?.email)
        .then(setProfile)
        .catch((err) => console.error('Profile fetch failed:', err.message));
    } else {
      setProfile(getEmployees().find((employee) => employee.id === requestedUserId) || null);
    }
  }, [user?.email, requestedUserId, isOwnProfile]);

  const persist = async (updates) => {
    const next = await hrmsService.saveProfile(updates);
    const saved = next.find ? next.find((item) => item.id === updates.id) : next;
    setProfile(saved || updates);
    return saved || updates;
  };

  const save = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updates = {
      ...profile,
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone'),
      dob: form.get('dob'),
      gender: form.get('gender'),
      emergencyContact: form.get('emergencyContact'),
      address: form.get('address'),
    };

    await persist(updates);
    updateUser({ ...user, name: updates.name, email: updates.email, phone: updates.phone });
    setMessage('Profile updated.');
  };

  const saveEmployment = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updates = {
      ...profile,
      title: form.get('title'),
      department: form.get('department'),
      doj: form.get('doj'),
    };

    await persist(updates);
    setMessage('Employment details updated.');
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    const form = new FormData(event.currentTarget);
    const currentPassword = form.get('currentPassword');
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      if (typeof hrmsService.changePassword === 'function') {
        await hrmsService.changePassword(profile.id, { currentPassword, newPassword });
      } else {
        await persist({ ...profile, password: newPassword });
      }
      setMessage('Password changed successfully.');
      event.currentTarget.reset();
    } catch (err) {
      setPasswordError(err.message || 'Could not change password.');
    }
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const updates = { ...profile, photoUrl: reader.result };
      await persist(updates);
      if (isOwnProfile) updateUser({ ...user, photoUrl: reader.result });
      setMessage('Profile photo updated.');
    };
    reader.readAsDataURL(file);
  };

  if (!profile) return <section className="panel"><p className="empty-inline">Profile not found.</p></section>;

  const photoUrl = profile.photoUrl || '';

  return (
    <div className="page-stack profile-page page-reveal">
      <PageHeader
        eyebrow="Employee Profile"
        title={isOwnProfile ? 'My profile' : profile.name}
        description="View and manage your personal information."
      />

      <section className="panel profile-card">
        <div className="profile-avatar-wrap">
          {photoUrl
            ? <img className="profile-avatar" src={photoUrl} alt={profile.name} />
            : <div className="profile-avatar">{profile.initials || 'HR'}</div>}
          {isOwnProfile && (
            <label className="profile-avatar-edit" title="Change photo">
              <Camera size={14} />
              <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
            </label>
          )}
        </div>
        <div className="profile-card-body">
          <h2>{profile.name}</h2>
          <span>{profile.title || profile.position || profile.role}{profile.department ? ` · ${profile.department}` : ''}</span>
        </div>
      </section>

      <section className="panel">
        <div className="profile-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'active' : ''}
              onClick={() => { setActiveTab(tab); setMessage(''); setPasswordError(''); }}
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
                <label>Full Name<input name="name" defaultValue={profile.name} /></label>
                <label>Email<input name="email" type="email" defaultValue={profile.email} /></label>
                <label>Phone<input name="phone" defaultValue={profile.phone} /></label>
                <label>Date of Birth<input name="dob" type="date" defaultValue={profile.dob} /></label>
                <label>
                  Gender
                  <select name="gender" defaultValue={profile.gender || ''}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>Emergency Contact<input name="emergencyContact" defaultValue={profile.emergencyContact} /></label>
                <label className="full-span">Address<input name="address" defaultValue={profile.address} /></label>
                {message && <div className="success-alert full-span">{message}</div>}
                <button className="btn btn-primary full-span"><Save size={18} />Save changes</button>
              </form>
            ) : (
              <div className="profile-info-grid">
                <div><span>Full Name</span><strong>{profile.name}</strong></div>
                <div><span>Email</span><strong>{profile.email}</strong></div>
                <div><span>Phone</span><strong>{profile.phone || 'Not provided'}</strong></div>
                <div><span>Date of Birth</span><strong>{profile.dob || 'Not provided'}</strong></div>
                <div><span>Gender</span><strong>{profile.gender || 'Not provided'}</strong></div>
                <div><span>Emergency Contact</span><strong>{profile.emergencyContact || 'Not provided'}</strong></div>
                <div className="full-span"><span>Address</span><strong>{profile.address || 'Not provided'}</strong></div>
              </div>
            )
          )}

          {activeTab === 'Employment Details' && (
            isOwnProfile ? (
              <form className="form-grid" onSubmit={saveEmployment}>
                <label>Designation<input name="title" defaultValue={profile.title || profile.position || ''} placeholder="e.g. Software Engineer" /></label>
                <label>Department<input name="department" defaultValue={profile.department || ''} placeholder="e.g. Engineering" /></label>
                <label>Date of Joining<input name="doj" type="date" defaultValue={profile.doj || ''} /></label>
                {message && <div className="success-alert full-span">{message}</div>}
                <button className="btn btn-primary full-span"><Save size={18} />Save changes</button>
              </form>
            ) : (
              <div className="profile-info-grid">
                <div><span>Designation</span><strong>{profile.title || profile.position || profile.role}</strong></div>
                <div><span>Department</span><strong>{profile.department || 'Not provided'}</strong></div>
                <div><span>Date of Joining</span><strong>{profile.doj || 'Not provided'}</strong></div>
              </div>
            )
          )}

          {activeTab === 'Change Password' && isOwnProfile && (
            <form className="form-grid" onSubmit={changePassword}>
              <label className="full-span">Current Password<input name="currentPassword" type="password" required /></label>
              <label>New Password<input name="newPassword" type="password" required minLength={6} /></label>
              <label>Confirm New Password<input name="confirmPassword" type="password" required minLength={6} /></label>
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