import { emptyStore, STORAGE_VERSION } from '../data/seedData';

const ROOT_KEY = 'myhourly-data';
const VERSION_KEY = 'myhourly-data-version';
const LEGACY_ROOT_KEY = 'hourlyrecruit-data';
const LEGACY_VERSION_KEY = 'hourlyrecruit-data-version';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function initializeStorage() {
  if (!localStorage.getItem(ROOT_KEY) && localStorage.getItem(LEGACY_ROOT_KEY)) {
    localStorage.setItem(ROOT_KEY, localStorage.getItem(LEGACY_ROOT_KEY));
    localStorage.setItem(VERSION_KEY, localStorage.getItem(LEGACY_VERSION_KEY) || '0');
  }
  const currentVersion = Number(localStorage.getItem(VERSION_KEY) || 0);
  if (!localStorage.getItem(ROOT_KEY) || currentVersion !== STORAGE_VERSION) {
    localStorage.setItem(ROOT_KEY, JSON.stringify(clone(emptyStore)));
    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
    localStorage.removeItem('hrms-user');
    localStorage.removeItem('hrms-token');
  }
}

export function readStore() {
  initializeStorage();
  try {
    const parsed = JSON.parse(localStorage.getItem(ROOT_KEY));
    return parsed && typeof parsed === 'object' ? parsed : clone(emptyStore);
  } catch {
    localStorage.setItem(ROOT_KEY, JSON.stringify(clone(emptyStore)));
    return clone(emptyStore);
  }
}

export function writeStore(next) {
  localStorage.setItem(ROOT_KEY, JSON.stringify(next));
  return next;
}

export function getSection(section) {
  const store = readStore();
  return clone(store[section] ?? emptyStore[section] ?? null);
}

export function setSection(section, value) {
  const store = readStore();
  store[section] = clone(value);
  writeStore(store);
  return clone(value);
}

export function updateSection(section, updater) {
  const current = getSection(section);
  return setSection(section, updater(current));
}

export function resetStorage() {
  localStorage.setItem(ROOT_KEY, JSON.stringify(clone(emptyStore)));
  localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
  localStorage.removeItem('hrms-user');
  localStorage.removeItem('hrms-token');
  return clone(emptyStore);
}
