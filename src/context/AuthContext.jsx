import { createContext, useContext, useMemo, useState } from 'react';
import api from '../services/api';
import { getSection, initializeStorage, setSection } from '../services/localStorageService';
import { getStoredUser, saveSession, updateStoredUser, clearSession } from '../services/authStorage';

const AuthContext = createContext(null);
initializeStorage();

const normalizeEmail = (email = '') => email.trim().toLowerCase();
const portalNames = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  HR_ADMIN: 'HR',
};
const initialsFromName = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  // ==========================
  // Backend Login
  // ==========================
  // rememberMe (from the login form's "Remember me" checkbox) decides
  // *where* the session is stored: checked -> localStorage, so the person
  // is still signed in after closing and reopening the browser; unchecked
  // -> sessionStorage, so the session disappears once the browser/tab is
  // closed. Defaults to false so an unchecked box behaves like a normal
  // session-only login, matching what the checkbox visually implies.
  const login = async ({ email, password, expectedRole, rememberMe = false }) => {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const response = await api.post('/auth/login', {
      usernameOrEmail: email,
      password,
    });


    const data = response.data.data;

    const backendRole = data.user.roles?.[0] || data.user.role;
    const normalizedRole = typeof backendRole === 'string' ? backendRole.toUpperCase() : backendRole;

    if (expectedRole && normalizedRole !== expectedRole) {
      clearSession();
      setUser(null);
      throw new Error(
        `You are not authorized to access the ${portalNames[expectedRole] || 'requested'} portal. Please use the correct login portal.`,
      );
    }

    const normalizedUser = {
      ...data.user,
      role: normalizedRole,
      name: data.user.name || data.user.fullName || data.user.username,
      photoUrl: data.user.photoUrl || data.user.profilePhotoUrl || data.user.avatarUrl || '',
      profilePhotoUrl: data.user.profilePhotoUrl || data.user.photoUrl || data.user.avatarUrl || '',
    };

    saveSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: normalizedUser,
      rememberMe,
    });

    setUser(normalizedUser);

    return normalizedUser;
  };

  // ==========================
  // Keep this temporarily
  // ==========================
  const registerLocalAccount = async ({ name, email, password, role }) => {
    if (!name?.trim() || !email?.trim() || !password) {
      throw new Error('Name, email and password are required.');
    }

    const users = getSection('users') || [];

    if (users.some((item) => normalizeEmail(item.email) === normalizeEmail(email))) {
      throw new Error('An account with this email already exists.');
    }

    const created = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: normalizeEmail(email),
      password,
      role,
      title: '',
      initials: initialsFromName(name),
      phone: '',
      location: '',
      department: '',
      about: '',
      createdAt: new Date().toISOString(),
    };

    setSection('users', [...users, created]);

    const { password: _password, ...safeUser } = created;

    saveSession({
      accessToken: `local-${safeUser.id}-${Date.now()}`,
      user: safeUser,
      rememberMe: true,
    });

    setUser(safeUser);

    return safeUser;
  };

  // ==========================
  // Forgot / Reset Password
  // ==========================
  const forgotPassword = async ({ email }) => {
    if (!email) {
      throw new Error('Email is required.');
    }
    await api.post('/auth/forgot-password', { email });
  };

  const resetPassword = async ({ token, password }) => {
    if (!token || !password) {
      throw new Error('Token and new password are required.');
    }
    await api.post('/auth/reset-password', { token, password });
  };

  const updateUser = (next) => {
    const merged = {
      ...user,
      ...next,
      photoUrl: next?.photoUrl || next?.profilePhotoUrl || user?.photoUrl || user?.profilePhotoUrl || '',
      profilePhotoUrl: next?.profilePhotoUrl || next?.photoUrl || user?.profilePhotoUrl || user?.photoUrl || '',
    };
    updateStoredUser(merged);
    setUser(merged);
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

const value = useMemo(
    () => ({
      user,
      login,
      registerLocalAccount,
      logout,
      updateUser,
      forgotPassword,
      resetPassword,
    }),
    [user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);