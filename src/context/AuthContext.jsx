import { createContext, useContext, useMemo, useState } from 'react';
import api from '../services/api';
import { getSection, initializeStorage, setSection } from '../services/localStorageService';

const AuthContext = createContext(null);
initializeStorage();

const normalizeEmail = (email = '') => email.trim().toLowerCase();
const initialsFromName = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hrms-user')) || null;
    } catch {
      return null;
    }
  });

  // ==========================
  // Backend Login
  // ==========================
  const login = async ({ email, password }) => {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const response = await api.post('/auth/login', {
      usernameOrEmail: email,
      password,
    });


    const data = response.data.data;

    const normalizedUser = {
      ...data.user,
      role: data.user.roles?.[0] || data.user.role,
      name: data.user.name || data.user.fullName || data.user.username,
    };

    localStorage.setItem('hrms-token', data.accessToken);
    localStorage.setItem('hrms-refresh-token', data.refreshToken);
    localStorage.setItem('hrms-user', JSON.stringify(normalizedUser));

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

    localStorage.setItem('hrms-user', JSON.stringify(safeUser));
    localStorage.setItem('hrms-token', `local-${safeUser.id}-${Date.now()}`);

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
    localStorage.setItem('hrms-user', JSON.stringify(next));
    setUser(next);
  };

  const logout = () => {
    localStorage.removeItem('hrms-user');
    localStorage.removeItem('hrms-token');
    localStorage.removeItem('hrms-refresh-token');
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