import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  CalendarCheck2,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PartyPopper,
  Target,
  UserRound,
  Users,
  UserSearch,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { ROLE_MENUS } from '../config';
import './Sidebar.css';

const icons = {
  '/dashboard': LayoutDashboard,
  '/celebrations': PartyPopper,
  '/attendance': Clock3,
  '/leave': CalendarDays,
  '/performance': Target,
  '/reports': BarChart3,
  '/profile': UserRound,
  '/employees': Users,
  '/leave-approvals': ClipboardCheck,
  '/announcements': Megaphone,
  '/events': CalendarRange,
  '/candidates': UserSearch,
  '/holidays': CalendarCheck2,
};

function formatRole(role) {
  if (role === 'HR_ADMIN') return 'HR';
  if (role === 'MANAGER') return 'Manager';
  if (role === 'EMPLOYEE') return 'Employee';
  return role || '';
}

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const items = ROLE_MENUS[user?.role] || [];

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate('/login', { replace: true });
  };

  const goToDashboard = () => {
    navigate('/dashboard');
    onClose?.();
  };

  return (
    <>
      <button
        className={`sidebar-backdrop ${open ? 'show' : ''}`}
        onClick={onClose}
        aria-label="Close navigation"
      />

      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar-head">
          <Logo size={75} linkTo="/dashboard" />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {items.map(([path, label]) => {
            const Icon = icons[path] || LayoutDashboard;

            return (
              <NavLink
                key={path}
                to={path}
                onClick={onClose}
                className={({ isActive }) =>
                  isActive ? 'nav-link active' : 'nav-link'
                }
              >
                <Icon size={19} />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="mini-avatar">{user?.initials || 'HR'}</div>
            <div className="sidebar-user-copy">
              <strong title={user?.name || ''}>{user?.name || 'User'}</strong>
              <span>{formatRole(user?.role)}</span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}