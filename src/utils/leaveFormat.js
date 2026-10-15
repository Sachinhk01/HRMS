const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = MONTH_NAMES.map((month) => month.slice(0, 3));
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export { MONTH_NAMES };

export function parseIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

export function toIso(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayIso = () => toIso(new Date());

export function formatDate(value) {
  const date = parseIso(value);
  return date ? `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}` : '—';
}

export function weekday(value) {
  const date = parseIso(value);
  return date ? WEEKDAY_SHORT[date.getDay()] : '';
}

export function formatRange(start, end) {
  if (!start) return { main: '—', sub: '' };
  if (!end || start === end) return { main: formatDate(start), sub: `(${weekday(start)})` };
  const from = parseIso(start);
  const to = parseIso(end);
  if (!from || !to) return { main: '—', sub: '' };
  const first = from.getFullYear() === to.getFullYear()
    ? `${from.getDate()} ${MONTH_SHORT[from.getMonth()]}`
    : formatDate(start);
  return {
    main: `${first} - ${formatDate(end)}`,
    sub: `(${weekday(start)} - ${weekday(end)})`,
  };
}

export function appliedOnOf(row) {
  if (!row || typeof row !== 'object') return null;

  const candidates = [
    row.appliedOn,
    row.appliedAt,
    row.createdAt,
    row.submittedAt,
    row.requestedAt,
    row.requestDate,
    row.requestedOn,
    row.applicationDate,
    row.appliedDate,
    row.createdDate,
    row.applied_on,
    row.created_on,
    row.submitted_on,
    row.requested_on,
    row.application_date,
  ];

  const found = candidates.find((value) => value !== null && value !== undefined && value !== '' && value !== 'null');
  if (found) return found;

  const keyMatch = Object.entries(row).find(([key, value]) => {
    if (value === null || value === undefined || value === '') return false;
    return /(?:^|_)(?:applied|created|submitted|requested|application)(?:On|At|Date|AtDate|DateTime|Time|_on|_at|_date)?$/i.test(key)
      || /(?:^|_)(?:applied|created|submitted|requested|application)(?:On|At|Date|AtDate|DateTime|Time|_on|_at|_date)?/i.test(key);
  });

  return keyMatch ? keyMatch[1] : null;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const hours = date.getHours();
  const clockHour = hours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}, ${String(clockHour).padStart(2, '0')}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export function overlapsMonth(row, month, year) {
  const start = parseIso(row?.startDate);
  const end = parseIso(row?.endDate || row?.startDate);
  if (!start || !end) return false;
  return start <= new Date(year, month, 0) && end >= new Date(year, month - 1, 1);
}

export function approxWeekdays(startIso, endIso) {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  if (!start || !end || end < start) return 0;
  let count = 0;
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (date.getDay() !== 0 && date.getDay() !== 6) count += 1;
  }
  return count;
}

export const isPending = (row) => String(row?.status || '').toUpperCase() === 'PENDING';

export function isOwnRequest(row, user) {
  if (!row || !user) return false;
  const userIds = [user.employeeId, user.id]
    .filter((value) => value !== undefined && value !== null)
    .map(String);
  if (row.employeeId !== undefined && row.employeeId !== null && userIds.includes(String(row.employeeId))) return true;
  return Boolean(row.employeeCode && user.employeeCode && row.employeeCode === user.employeeCode);
}

export function initialsOf(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

export function leaveErrorMessage(error, fallback) {
  if (error?.errorCode === 'LEAVE_ALREADY_PROCESSED') {
    return 'Another approver already acted on this request. The list has been refreshed.';
  }
  if (error?.errorCode === 'LEAVE_ALREADY_EXIST') {
    return error.message || 'Another pending or approved request overlaps these dates.';
  }
  if (error?.errorCode === 'ACCESS_DENIED') return "You don't have permission to do that.";
  return error?.message || fallback;
}
