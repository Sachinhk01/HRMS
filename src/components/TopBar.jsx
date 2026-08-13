import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUnreadCount } from "../services/notificationService";
import "./TopBar.css";

export default function TopBar({ onMenu }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getUnreadCount()
      .then((count) => {
        if (!cancelled) setUnreadCount(count || 0);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
            <div className="avatar">{user?.initials}</div>
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
