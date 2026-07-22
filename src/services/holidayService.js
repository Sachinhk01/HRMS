import { getSection, setSection } from './localStorageService';

const SECTION = 'holidays';
const DELETED_DEFAULTS_SECTION = 'deletedDefaultHolidays';

const DEFAULT_HOLIDAY_TEMPLATES = [
  ['01-01', "New Year's Day", 'National Holiday'],
  ['01-14', 'Makar Sankranti', 'Festival'],
  ['01-26', 'Republic Day', 'National Holiday'],
  ['04-14', 'Dr. B. R. Ambedkar Jayanti', 'National Holiday'],
  ['05-01', 'Labour Day', 'National Holiday'],
  ['08-15', 'Independence Day', 'National Holiday'],
  ['10-02', 'Gandhi Jayanti', 'National Holiday'],
  ['11-01', 'Karnataka Rajyotsava', 'State Holiday'],
  ['12-25', 'Christmas', 'Festival'],
];

function defaultHolidays() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
  return years.flatMap((year) => DEFAULT_HOLIDAY_TEMPLATES.map(([monthDay, name, type]) => ({
    id: `india-${year}-${monthDay}`,
    name,
    date: `${year}-${monthDay}`,
    type,
    description: 'Built-in India holiday. HR or Manager may edit or delete it.',
    builtIn: true,
    createdAt: `${year}-01-01T00:00:00.000Z`,
    updatedAt: `${year}-01-01T00:00:00.000Z`,
  })));
}

function stored() {
  return getSection(SECTION) || [];
}

function deletedDefaultIds() {
  return getSection(DELETED_DEFAULTS_SECTION) || [];
}

function all() {
  const overrides = new Map(stored().map((item) => [item.id, item]));
  const deleted = new Set(deletedDefaultIds());
  const defaults = defaultHolidays()
    .filter((item) => !deleted.has(item.id))
    .map((item) => overrides.get(item.id) || item);
  const defaultIds = new Set(defaults.map((item) => item.id));
  const custom = stored().filter((item) => !defaultIds.has(item.id) && !deleted.has(item.id));
  return [...defaults, ...custom];
}

function save(items) {
  return setSection(SECTION, items);
}

function normalizeDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : value;
}

export function getHolidays() {
  return all().sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function getHolidayByDate(date) {
  return all().find((holiday) => holiday.date === date) || null;
}

export function addHoliday(user, data) {
  if (!['HR_ADMIN', 'MANAGER'].includes(user?.role)) throw new Error('Only HR and Manager can add holidays.');
  const name = data.name?.trim();
  const date = normalizeDate(data.date);
  const type = data.type?.trim() || 'Company Holiday';
  if (!name || !date) throw new Error('Holiday name and date are required.');
  if (all().some((item) => item.date === date)) throw new Error('A holiday already exists on this date.');
  const item = {
    id: `holiday-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name, date, type, description: data.description?.trim() || '', builtIn: false,
    createdBy: user.id, createdByName: user.name,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  save([item, ...stored()]);
  return item;
}

export function updateHoliday(user, id, data) {
  if (!['HR_ADMIN', 'MANAGER'].includes(user?.role)) throw new Error('Only HR and Manager can edit holidays.');
  const name = data.name?.trim();
  const date = normalizeDate(data.date);
  if (!name || !date) throw new Error('Holiday name and date are required.');
  if (all().some((item) => item.id !== id && item.date === date)) throw new Error('A holiday already exists on this date.');
  const current = all().find((item) => item.id === id);
  if (!current) throw new Error('Holiday was not found.');
  const updated = {
    ...current, name, date,
    type: data.type?.trim() || 'Company Holiday',
    description: data.description?.trim() || '',
    builtIn: current.builtIn === true,
    updatedBy: user.id, updatedByName: user.name, updatedAt: new Date().toISOString(),
  };
  const nextStored = stored().filter((item) => item.id !== id);
  save([updated, ...nextStored]);
  return updated;
}

export function deleteHoliday(user, id) {
  if (!['HR_ADMIN', 'MANAGER'].includes(user?.role)) throw new Error('Only HR and Manager can delete holidays.');
  const current = all().find((item) => item.id === id);
  if (!current) throw new Error('Holiday was not found.');
  save(stored().filter((item) => item.id !== id));
  if (current.builtIn || String(id).startsWith('india-')) {
    const deleted = new Set(deletedDefaultIds());
    deleted.add(id);
    setSection(DELETED_DEFAULTS_SECTION, Array.from(deleted));
  }
  return true;
}

export function getUpcomingHoliday(from = new Date()) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  return getHolidays().find((holiday) => new Date(`${holiday.date}T00:00:00`) >= start) || null;
}
