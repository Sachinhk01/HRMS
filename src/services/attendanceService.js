import { getSection, setSection } from './localStorageService';

const ATTENDANCE_KEY = 'attendanceRecords';

export const ATTENDANCE_STATE = {
  WORKING: 'WORKING',
  ON_BREAK: 'ON_BREAK',
  CHECKED_OUT: 'CHECKED_OUT',
};

function getAll() {
  const records = getSection(ATTENDANCE_KEY, []);
  return Array.isArray(records) ? records : [];
}

function saveAll(records) {
  setSection(ATTENDANCE_KEY, records);
  return records;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayAttendance(userId) {
  const today = getLocalDateKey();
  return getAll().find((record) => record.userId === userId && record.date === today) || null;
}

export function checkIn(user, location = 'Location unavailable') {
  if (!user?.id) throw new Error('A logged-in user is required.');
  const records = getAll();
  const current = getTodayAttendance(user.id);
  if (current?.checkInAt) throw new Error('You have already checked in today.');

  const now = new Date().toISOString();
  const item = {
    id: current?.id || `att-${Date.now()}`,
    userId: user.id,
    userName: user.name || 'User',
    userRole: user.role,
    date: getLocalDateKey(),
    checkInAt: now,
    checkOutAt: null,
    location,
    status: 'PRESENT',
    state: ATTENDANCE_STATE.WORKING,
    breaks: [],
    totalBreakMs: 0,
    totalWorkedMs: 0,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };

  saveAll(current ? records.map((record) => (record.id === current.id ? item : record)) : [item, ...records]);
  return item;
}

export function startBreak(user) {
  if (!user?.id) throw new Error('A logged-in user is required.');
  const records = getAll();
  const current = getTodayAttendance(user.id);
  if (!current?.checkInAt) throw new Error('Check in before starting a break.');
  if (current.checkOutAt) throw new Error('You have already checked out today.');
  if (current.state === ATTENDANCE_STATE.ON_BREAK) throw new Error('A break is already active.');

  const now = new Date().toISOString();
  const next = {
    ...current,
    state: ATTENDANCE_STATE.ON_BREAK,
    breaks: [...(current.breaks || []), { id: `break-${Date.now()}`, startAt: now, endAt: null }],
    updatedAt: now,
  };
  saveAll(records.map((record) => (record.id === current.id ? next : record)));
  return next;
}

export function endBreak(user) {
  if (!user?.id) throw new Error('A logged-in user is required.');
  const records = getAll();
  const current = getTodayAttendance(user.id);
  if (!current) throw new Error('Attendance record not found.');
  if (current.state !== ATTENDANCE_STATE.ON_BREAK) throw new Error('There is no active break.');

  const now = new Date().toISOString();
  const breaks = [...(current.breaks || [])];
  const activeIndex = breaks.findIndex((item) => item.startAt && !item.endAt);
  if (activeIndex < 0) throw new Error('Active break was not found.');
  breaks[activeIndex] = { ...breaks[activeIndex], endAt: now };

  const next = {
    ...current,
    state: ATTENDANCE_STATE.WORKING,
    breaks,
    totalBreakMs: calculateBreakMs({ ...current, breaks }),
    updatedAt: now,
  };
  saveAll(records.map((record) => (record.id === current.id ? next : record)));
  return next;
}

export function checkOut(user) {
  if (!user?.id) throw new Error('A logged-in user is required.');
  const records = getAll();
  const current = getTodayAttendance(user.id);
  if (!current) throw new Error('Check in first.');
  if (current.checkOutAt) throw new Error('You have already checked out today.');
  if (current.state === ATTENDANCE_STATE.ON_BREAK) throw new Error('End the active break before checking out.');

  const now = new Date().toISOString();
  const totalBreakMs = calculateBreakMs(current, new Date(now).getTime());
  const totalWorkedMs = Math.max(new Date(now).getTime() - new Date(current.checkInAt).getTime() - totalBreakMs, 0);
  const next = {
    ...current,
    checkOutAt: now,
    state: ATTENDANCE_STATE.CHECKED_OUT,
    totalBreakMs,
    totalWorkedMs,
    updatedAt: now,
  };
  saveAll(records.map((record) => (record.id === current.id ? next : record)));
  return next;
}

export function calculateBreakMs(record, now = Date.now()) {
  return (record?.breaks || []).reduce((total, item) => {
    if (!item.startAt) return total;
    const end = item.endAt ? new Date(item.endAt).getTime() : now;
    return total + Math.max(end - new Date(item.startAt).getTime(), 0);
  }, 0);
}

export function calculateWorkedMs(record, now = Date.now()) {
  if (!record?.checkInAt) return 0;
  const end = record.checkOutAt ? new Date(record.checkOutAt).getTime() : now;
  return Math.max(end - new Date(record.checkInAt).getTime() - calculateBreakMs(record, now), 0);
}

export function calculateElapsedMs(record, now = Date.now()) {
  if (!record?.checkInAt) return 0;
  const end = record.checkOutAt ? new Date(record.checkOutAt).getTime() : now;
  return Math.max(end - new Date(record.checkInAt).getTime(), 0);
}

export function getAttendanceRecords() {
  return getAll().sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
}

export function getUserAttendance(userId) {
  return getAttendanceRecords().filter((record) => record.userId === userId);
}

export function getMonthlyAttendance(userId, year, monthIndex) {
  return getUserAttendance(userId).filter((record) => {
    const [recordYear, recordMonth] = String(record.date).split('-').map(Number);
    return recordYear === year && recordMonth === monthIndex + 1;
  });
}

export function updateAttendanceStatus(recordId, status) {
  const allowedStatuses = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'];
  if (!allowedStatuses.includes(status)) throw new Error('Invalid attendance status.');
  const records = getAll();
  const record = records.find((item) => item.id === recordId);
  if (!record) throw new Error('Attendance record not found.');
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  saveAll(records.map((item) => (item.id === recordId ? updated : item)));
  return updated;
}
