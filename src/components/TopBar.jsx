import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getProfilePhotoUrl } from '../services/employeeService';
import { hrmsService } from '../services/hrmsService';
import './TopBar.css';

// utils/formatName.js was never actually added to the repo on either
// branch, so build the name capitalization inline instead of importing it.
function capitalizeName(name) {
  if (!name) return '';
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function TopBar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const [avatarUrl, setAvatarUrl] = useState('');
  const menuRef = useRef(null);

  // Pulls the logged-in user's own profile photo (if one has been
  // uploaded) so the top-right circle shows a real picture instead of
  // always falling back to initials.
  useEffect(() => {
    let cancelled = false;
    let objectUrl;

    hrmsService.getProfile()
      .then((profile) => {
        if (cancelled || !profile?.hasProfilePhoto) return;
        return getProfilePhotoUrl(profile.id).then((url) => {
          if (cancelled) return;
          objectUrl = url;
          setAvatarUrl(url);
        });
      })
      .catch(() => { if (!cancelled) setAvatarUrl(''); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.id]);

  useEffect(() => {
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <button
        className="icon-btn mobile-menu"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu size={21} />
      </button>
      <label className="searchbox">
        <Search size={17} />
        <input placeholder="Search anything..." />
      </label>
      <div className="topbar-actions">
        <Link
          className={`icon-btn${unreadCount > 0 ? ' notification-dot' : ''}`}
          to="/notifications"
          aria-label="Notifications"
        >
          <Bell size={19} />
        </Link>
        <div className="profile-menu" ref={menuRef}>
          <button type="button" className="profile-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
            <div className="avatar">
              {avatarUrl ? <img className="avatar-img" src={avatarUrl} alt={user?.name || 'Profile'} /> : user?.initials}
            </div>
            <div className="profile-copy"><strong>{capitalizeName(user?.name)}</strong><span>{user?.title}</span></div>
            <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
          </button>
          {open && (
            <div className="profile-dropdown" role="menu">
              <button type="button" onClick={() => { setOpen(false); navigate('/profile'); }}><UserRound size={17} /> My Profile</button>
              <button type="button" className="danger" onClick={handleLogout}><LogOut size={17} /> Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}