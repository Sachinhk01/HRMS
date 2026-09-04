// Centralizes where the login session lives, so "Remember me" can actually
// do something: checked -> localStorage (survives closing the browser),
// unchecked -> sessionStorage (cleared as soon as the tab/browser closes).
// Everything that reads/writes the session (AuthContext, the axios
// interceptor in api.js) goes through here so both storages are always
// checked/cleared together and never end up out of sync.

const TOKEN_KEY = 'hrms-token';
const REFRESH_KEY = 'hrms-refresh-token';
const USER_KEY = 'hrms-user';

function activeStore() {
  // Whichever storage currently holds a token is the one in use for this
  // session; defaults to localStorage when nothing is stored yet.
  return sessionStorage.getItem(TOKEN_KEY) ? sessionStorage : localStorage;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession({ accessToken, refreshToken, user, rememberMe }) {
  clearSession();
  const store = rememberMe ? localStorage : sessionStorage;
  if (accessToken) store.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) store.setItem(REFRESH_KEY, refreshToken);
  if (user) store.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredUser(user) {
  activeStore().setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  [localStorage, sessionStorage].forEach((store) => {
    store.removeItem(TOKEN_KEY);
    store.removeItem(REFRESH_KEY);
    store.removeItem(USER_KEY);
  });
}

// ==========================
// "Remember me" (email only)
// ==========================
// This is separate from saveSession/clearSession above, which only decide
// where the *active* session token lives and always get wiped on logout.
// "Remember me" instead needs to survive logout entirely, so the person's
// email is pre-filled the next time they land on the login page. Stored per
// portal (EMPLOYEE / MANAGER / HR_ADMIN) since the same browser may be used
// to sign in to more than one portal with different accounts. Only the
// email is remembered - never the password - since persisting a plaintext
// password in browser storage is a security risk.
const REMEMBER_EMAIL_PREFIX = 'hrms-remember-email-';

export function getRememberedEmail(role = 'default') {
  return localStorage.getItem(REMEMBER_EMAIL_PREFIX + role) || '';
}

export function setRememberedEmail(role = 'default', email = '') {
  const key = REMEMBER_EMAIL_PREFIX + role;
  if (email) {
    localStorage.setItem(key, email);
  } else {
    localStorage.removeItem(key);
  }
}