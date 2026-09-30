/**
 * Pure date helpers for <DatePicker />.
 * Everything works on plain strings ("YYYY-MM-DD" / "YYYY-MM") so there are
 * no timezone surprises, and ISO strings compare correctly with < and >.
 */
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DEFAULT_MIN = '1900-01-01';
export const DEFAULT_MAX = '2100-12-31';

export const pad = (n) => String(n).padStart(2, '0');

/** Real (y, m0, d) -> "YYYY-MM-DD" */
export const makeISO = (y, m0, d) => `${String(y).padStart(4, '0')}-${pad(m0 + 1)}-${pad(d)}`;

export const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Today in the user's local timezone as "YYYY-MM-DD". */
export const todayISO = () => {
  const n = new Date();
  return makeISO(n.getFullYear(), n.getMonth(), n.getDate());
};

/** Accepts "YYYY-MM-DD" (or an ISO datetime) and returns a valid "YYYY-MM-DD" or "". */
export const normalizeDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!m) return '';
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  if (mo < 0 || mo > 11 || d < 1 || d > daysInMonth(y, mo)) return '';
  return makeISO(y, mo, d);
};

/** Accepts "YYYY-MM" (or a longer ISO string) and returns a valid "YYYY-MM" or "". */
export const normalizeMonth = (value) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(value ?? ''));
  if (!m || +m[2] < 1 || +m[2] > 12) return '';
  return `${m[1]}-${m[2]}`;
};

export const formatDate = (iso) => {
  const v = normalizeDate(iso);
  return v ? `${v.slice(8, 10)}-${v.slice(5, 7)}-${v.slice(0, 4)}` : '';
};

export const formatMonth = (ym) => {
  const v = normalizeMonth(ym);
  return v ? `${MONTHS[+v.slice(5, 7) - 1]} ${v.slice(0, 4)}` : '';
};

/** Long, screen-reader friendly label, e.g. "Monday, 15 March 2027". */
export const longDateLabel = (iso) => {
  const y = +iso.slice(0, 4), m0 = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10);
  const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(Date.UTC(y, m0, d)).getUTCDay()
  ];
  return `${wd}, ${d} ${MONTHS[m0]} ${y}`;
};

export const addDaysISO = (iso, n) => {
  const y = +iso.slice(0, 4), m0 = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10);
  const t = new Date(Date.UTC(y, m0, d + n));
  return makeISO(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};

export const addMonthsISO = (iso, n) => {
  const y = +iso.slice(0, 4), m0 = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10);
  const total = y * 12 + m0 + n;
  const ny = Math.floor(total / 12), nm = ((total % 12) + 12) % 12;
  return makeISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
};

/** Cells for one month: leading nulls (Sunday-first) followed by "YYYY-MM-DD" strings. */
export const buildMonthCells = (y, m0) => {
  const lead = new Date(Date.UTC(y, m0, 1)).getUTCDay();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth(y, m0); d++) cells.push(makeISO(y, m0, d));
  return cells;
};

export const clampISO = (iso, min, max) => (iso < min ? min : iso > max ? max : iso);