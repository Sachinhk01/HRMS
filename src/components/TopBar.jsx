import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, Moon, Search, Sun, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import './TopBar.css';

export default function TopBar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
<<<<<<< HEAD
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState('');
=======
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const menuRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getUnreadCount()
      .then((count) => { if (!cancelled) setUnreadCount(count || 0); })
      .catch(() => { if (!cancelled) setUnreadCount(0); });
    return () => { cancelled = true; };
  }, []);

  // Works the same way for every role — pulls the logged-in user's own
  // profile photo (if one has been uploaded) so the top-right circle shows
  // a real picture instead of always falling back to initials.
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
      <label className="searchbox">
        <Search size={17} />
        <input placeholder="Search anything..." />
      </label>
      <div className="topbar-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
        </button>
        <Link
          className={`icon-btn${unreadCount > 0 ? " notification-dot" : ""}`}
          to="/notifications"
          aria-label="Notifications"
        >
>>>>>>> af52e15aa012133d798d7b76d92f991999ff0985
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