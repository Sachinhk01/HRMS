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
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const menuRef = useRef(null);
  const avatarSrc = user?.photoUrl || user?.profilePhotoUrl || user?.avatarUrl;

  useEffect(() => {
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/login", { replace: true });
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
          <Bell size={19} />
        </Link>
        <div className="profile-menu" ref={menuRef}>
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <div className="avatar">
              {avatarSrc ? (
                <img src={avatarSrc} alt={user?.name || 'User'} />
              ) : (
                user?.initials || (user?.name || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="profile-copy">
              <strong style={{ textTransform: "capitalize" }}>
                {user?.name}
              </strong>
              <span>{user?.title}</span>
            </div>
            <ChevronDown size={16} className={open ? "rotate-180" : ""} />
          </button>
          {open && (
            <div className="profile-dropdown" role="menu">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/profile");
                }}
              >
                <UserRound size={17} /> My Profile
              </button>
              <button type="button" className="danger" onClick={handleLogout}>
                <LogOut size={17} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}