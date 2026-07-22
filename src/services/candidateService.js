import { getSection, setSection } from './localStorageService';

const CANDIDATES_KEY = 'candidates';
const USERS_KEY = 'users';

const allCandidates = () => getSection(CANDIDATES_KEY) || [];
const saveCandidates = (items) => setSection(CANDIDATES_KEY, items);
const allUsers = () => getSection(USERS_KEY) || [];
const saveUsers = (items) => setSection(USERS_KEY, items);

const requireManager = (actor) => {
  if (actor?.role !== 'MANAGER') throw new Error('Only Manager can manage candidates.');
};

export function generateTemporaryPassword(length = 10) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$!';
  const all = upper + lower + digits + symbols;
  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (required.length < length) required.push(pick(all));
  return required.sort(() => Math.random() - 0.5).join('');
}

export const getCandidates = () => allCandidates();

export function addCandidate(actor, data) {
  requireManager(actor);
  const name = data.name?.trim();
  const email = data.email?.trim().toLowerCase();
  const dob = data.dob;
  const password = data.password || generateTemporaryPassword();
  if (!name || !email || !dob) throw new Error('Name, email and date of birth are required.');
  if (allCandidates().some((item) => item.email === email) || allUsers().some((item) => item.email === email)) {
    throw new Error('This email already exists.');
  }

  const now = new Date().toISOString();
  const userId = `user-${Date.now()}`;
  const candidate = {
    id: `candidate-${Date.now()}`,
    userId,
    name,
    email,
    dob,
    phone: data.phone?.trim() || '',
    position: data.position?.trim() || '',
    department: data.department?.trim() || '',
    experience: data.experience?.trim() || '',
    status: data.status || 'SCREENING',
    temporaryPassword: password,
    credentialsGeneratedBy: actor.id,
    credentialsGeneratedByName: actor.name,
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: now,
    updatedAt: now,
  };

  const user = {
    id: userId,
    name,
    email,
    password,
    role: 'EMPLOYEE',
    title: data.position?.trim() || 'Candidate',
    department: data.department?.trim() || '',
    dob,
    phone: data.phone?.trim() || '',
    location: '',
    about: '',
    candidateId: candidate.id,
    active: true,
    mustChangePassword: true,
    initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    createdAt: now,
    updatedAt: now,
  };

  saveCandidates([candidate, ...allCandidates()]);
  saveUsers([...allUsers(), user]);
  return candidate;
}

export function updateCandidate(actor, id, updates) {
  requireManager(actor);
  const now = new Date().toISOString();
  let updated;
  const next = allCandidates().map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, ...updates, id: item.id, email: updates.email?.trim().toLowerCase() || item.email, updatedAt: now };
    return updated;
  });
  if (!updated) throw new Error('Candidate not found.');
  saveCandidates(next);
  saveUsers(allUsers().map((user) => user.id === updated.userId ? {
    ...user,
    name: updated.name,
    email: updated.email,
    dob: updated.dob,
    phone: updated.phone,
    title: updated.position || user.title,
    department: updated.department,
    updatedAt: now,
  } : user));
  return updated;
}

export function regenerateCandidateCredentials(actor, id) {
  requireManager(actor);
  const password = generateTemporaryPassword();
  const candidate = allCandidates().find((item) => item.id === id);
  if (!candidate) throw new Error('Candidate not found.');
  saveCandidates(allCandidates().map((item) => item.id === id ? {
    ...item,
    temporaryPassword: password,
    credentialsGeneratedBy: actor.id,
    credentialsGeneratedByName: actor.name,
    updatedAt: new Date().toISOString(),
  } : item));
  saveUsers(allUsers().map((user) => user.id === candidate.userId ? { ...user, password, mustChangePassword: true, updatedAt: new Date().toISOString() } : user));
  return { email: candidate.email, password };
}

export function deleteCandidate(actor, id) {
  requireManager(actor);
  const candidate = allCandidates().find((item) => item.id === id);
  if (!candidate) throw new Error('Candidate not found.');
  saveCandidates(allCandidates().filter((item) => item.id !== id));
  saveUsers(allUsers().filter((user) => user.id !== candidate.userId));
  return true;
}
