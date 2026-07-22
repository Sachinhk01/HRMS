import {
  generateId,
  readStorage,
  removeStorage,
  writeStorage,
} from "./localStorageService";

const USERS_KEY = "users";
const SESSION_KEY = "session";

export const USER_ROLES = {
  EMPLOYEE: "EMPLOYEE",
  MANAGER: "MANAGER",
  HR_ADMIN: "HR_ADMIN",
  PAYROLL_ADMIN: "PAYROLL_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  CLIENT: "CLIENT",
};

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function getUsers() {
  return readStorage(USERS_KEY, []);
}

export function getUserById(userId) {
  return getUsers().find((user) => user.id === userId) || null;
}

export function getUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  return (
    getUsers().find(
      (user) => normalizeEmail(user.email) === normalizedEmail
    ) || null
  );
}

export function createUser(userData) {
  const users = getUsers();
  const email = normalizeEmail(userData.email);

  if (!userData.name?.trim()) {
    throw new Error("Name is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  if (!userData.password || userData.password.length < 6) {
    throw new Error("Password must contain at least 6 characters.");
  }

  if (!Object.values(USER_ROLES).includes(userData.role)) {
    throw new Error("A valid user role is required.");
  }

  const existingUser = users.find(
    (user) => normalizeEmail(user.email) === email
  );

  if (existingUser) {
    throw new Error("An account already exists with this email.");
  }

  const newUser = {
    id: generateId("user"),
    employeeCode: userData.employeeCode?.trim() || "",
    name: userData.name.trim(),
    email,
    password: userData.password,
    role: userData.role,
    department: userData.department?.trim() || "",
    designation: userData.designation?.trim() || "",
    managerId: userData.managerId || null,
    profileImage: userData.profileImage || "",
    active: userData.active !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeStorage(USERS_KEY, [...users, newUser]);

  return sanitizeUser(newUser);
}

export function updateUser(userId, updates) {
  const users = getUsers();
  const currentUser = users.find((user) => user.id === userId);

  if (!currentUser) {
    throw new Error("User not found.");
  }

  const updatedUsers = users.map((user) =>
    user.id === userId
      ? {
          ...user,
          ...updates,
          id: user.id,
          email: updates.email
            ? normalizeEmail(updates.email)
            : user.email,
          updatedAt: new Date().toISOString(),
        }
      : user
  );

  writeStorage(USERS_KEY, updatedUsers);

  const updatedUser = updatedUsers.find((user) => user.id === userId);

  const currentSession = getCurrentUser();

  if (currentSession?.id === userId) {
    writeStorage(SESSION_KEY, sanitizeUser(updatedUser));
  }

  return sanitizeUser(updatedUser);
}

export function deleteUser(userId) {
  const users = getUsers();
  const updatedUsers = users.filter((user) => user.id !== userId);

  writeStorage(USERS_KEY, updatedUsers);

  const session = getCurrentUser();

  if (session?.id === userId) {
    logout();
  }

  return true;
}

export function login({ email, password, expectedRole }) {
  const normalizedEmail = normalizeEmail(email);

  const user = getUsers().find(
    (item) =>
      normalizeEmail(item.email) === normalizedEmail &&
      item.password === password
  );

  if (!user) {
    throw new Error("Invalid email address or password.");
  }

  if (!user.active) {
    throw new Error("This account has been disabled.");
  }

  if (expectedRole && user.role !== expectedRole) {
    throw new Error("This account cannot access the selected login portal.");
  }

  const sessionUser = sanitizeUser(user);

  writeStorage(SESSION_KEY, sessionUser);

  return sessionUser;
}

export function logout() {
  removeStorage(SESSION_KEY);
}

export function getCurrentUser() {
  return readStorage(SESSION_KEY, null);
}

export function isAuthenticated() {
  return Boolean(getCurrentUser());
}

export function changePassword(userId, currentPassword, newPassword) {
  const users = getUsers();
  const user = users.find((item) => item.id === userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.password !== currentPassword) {
    throw new Error("Current password is incorrect.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must contain at least 6 characters.");
  }

  const updatedUsers = users.map((item) =>
    item.id === userId
      ? {
          ...item,
          password: newPassword,
          updatedAt: new Date().toISOString(),
        }
      : item
  );

  writeStorage(USERS_KEY, updatedUsers);
  return true;
}