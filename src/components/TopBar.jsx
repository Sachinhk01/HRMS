import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, LayoutGrid, LogOut, Search, UserRound, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getEmployees, getProfilePhotoUrl } from '../services/employeeService';
import { hrmsService } from '../services/hrmsService';
import { ROLE_MENUS } from '../config';
import './TopBar.css';

// Roles that can see the Employees page/dropdown, mirrored from
// ROUTE_ROLES['/employees'] in config.js — kept here so the search box
// only ever calls GET /employees for roles actually allowed to.
const EMPLOYEE_SEARCH_ROLES = ['HR_ADMIN', 'MANAGER', 'SUPER_ADMIN'];

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

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const [avatarUrl, setAvatarUrl] = useState('');
  const menuRef = useRef(null);

  // ---------- Global "Search anything..." box ----------
  const userRole = user?.roles?.[0] || user?.role;
  const canSearchEmployees = EMPLOYEE_SEARCH_ROLES.includes(userRole);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [employeeMatches, setEmployeeMatches] = useState([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const searchRef = useRef(null);

  // Every page this user's role can actually reach, sourced from the same
  // menu config the Sidebar uses, so the two never drift apart.
  const searchablePages = useMemo(
    () => (ROLE_MENUS[userRole] || []).map(([path, label]) => ({ path, label })),
    [userRole]
  );

  const pageMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchablePages.filter(({ label }) => label.toLowerCase().includes(q)).slice(0, 5);
  }, [query, searchablePages]);

  // Employee lookup reuses the existing GET /employees endpoint (same one
  // the Employees page already calls) — no new backend calls, just debounced.
  useEffect(() => {
    const q = query.trim();

    if (!canSearchEmployees || q.length < 2) {
      setEmployeeMatches([]);
      setEmployeeLoading(false);
      return;
    }

    setEmployeeLoading(true);
    const timer = setTimeout(() => {
      getEmployees({ search: q, size: 5 })
        .then((result) => {
          setEmployeeMatches(result?.content || []);
        })
        .catch(() => {
          setEmployeeMatches([]);
        })
        .finally(() => setEmployeeLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query, canSearchEmployees]);

  const results = useMemo(
    () => [
      ...pageMatches.map((page) => ({ type: 'page', ...page })),
      ...employeeMatches.map((emp) => ({
        type: 'employee',
        id: emp.id,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee',
        code: emp.employeeCode,
      })),
    ],
    [pageMatches, employeeMatches]
  );

  useEffect(() => {
    setActiveIndex(results.length ? 0 : -1);
  }, [results]);

  const closeSearch = () => {
    setSearchOpen(false);
    setActiveIndex(-1);
  };

  const clearSearch = () => {
    setQuery('');
    setEmployeeMatches([]);
    closeSearch();
  };

  const goToResult = (result) => {
    if (!result) return;

    if (result.type === 'page') {
      navigate(result.path);
    } else {
      navigate(`/employees?search=${encodeURIComponent(result.name)}`);
    }

    clearSearch();
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.currentTarget.blur();
      closeSearch();
      return;
    }

    if (!results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      goToResult(results[activeIndex] ?? results[0]);
    }
  };

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
      .catch(() => {
        if (!cancelled) setAvatarUrl('');
      });

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [user?.id]);

  useEffect(() => {
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }

      if (!searchRef.current?.contains(event.target)) {
        closeSearch();
      }
    };

    document.addEventListener('mousedown', close);

    return () => {
      document.removeEventListener('mousedown', close);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar">
      <div className="searchbox-wrap" ref={searchRef}>
        <label className="searchbox">
          <Search size={17} />
          <input
            placeholder="Search anything..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search anything"
            aria-expanded={searchOpen && results.length > 0}
            aria-haspopup="listbox"
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </label>

        {searchOpen && query.trim() && (
          <div className="search-dropdown" role="listbox">
            {results.length === 0 && !employeeLoading && (
              <div className="search-empty">No matches for "{query.trim()}"</div>
            )}

            {pageMatches.length > 0 && (
              <div className="search-group">
                <span className="search-group-label">Pages</span>
                {pageMatches.map((page) => {
                  const index = results.findIndex((r) => r.type === 'page' && r.path === page.path);
                  return (
                    <button
                      type="button"
                      key={page.path}
                      className={`search-result${index === activeIndex ? ' active' : ''}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goToResult(results[index])}
                      role="option"
                      aria-selected={index === activeIndex}
                    >
                      <LayoutGrid size={15} />
                      <span>{page.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {canSearchEmployees && (employeeMatches.length > 0 || employeeLoading) && (
              <div className="search-group">
                <span className="search-group-label">Employees</span>
                {employeeLoading && <div className="search-loading">Searching employees...</div>}
                {!employeeLoading && employeeMatches.map((emp) => {
                  const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
                  const index = results.findIndex((r) => r.type === 'employee' && r.id === emp.id);
                  return (
                    <button
                      type="button"
                      key={emp.id}
                      className={`search-result${index === activeIndex ? ' active' : ''}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => goToResult(results[index])}
                      role="option"
                      aria-selected={index === activeIndex}
                    >
                      <UserRound size={15} />
                      <span>{name}</span>
                      {emp.employeeCode && <span className="search-result-meta">{emp.employeeCode}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="topbar-actions">
        <Link
          className={`icon-btn${unreadCount > 0 ? ' notification-dot' : ''}`}
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
              {avatarUrl ? (
                <img
                  className="avatar-img"
                  src={avatarUrl}
                  alt={user?.name || 'Profile'}
                />
              ) : (
                user?.initials
              )}
            </div>

            <div className="profile-copy">
              <strong>{capitalizeName(user?.name)}</strong>
              <span>{user?.title}</span>
            </div>

            <ChevronDown
              size={16}
              className={open ? 'rotate-180' : ''}
            />
          </button>

          {open && (
            <div className="profile-dropdown" role="menu">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/profile');
                }}
              >
                <UserRound size={17} />
                My Profile
              </button>

              <button
                type="button"
                className="danger"
                onClick={handleLogout}
              >
                <LogOut size={17} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}