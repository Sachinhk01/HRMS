import { normalizeDate, formatDate, todayISO } from './dateUtils';

/** FULL_TIME -> "Full Time", MALE -> "Male". Returns '' for empty values. */
export function formatEnum(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** "YYYY-MM-DD" -> "DD-MM-YYYY". '' when invalid. */
export function displayDate(iso) {
  return formatDate(iso) || '';
}

/** Value for a table / info cell: shows an em dash instead of an empty string. */
export function orDash(value) {
  return value === null || value === undefined || String(value).trim() === '' ? '—' : value;
}

function parts(iso) {
  const value = normalizeDate(iso);
  return value
    ? { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)) }
    : null;
}

/** Completed years / months / days between two ISO dates (to defaults to today). */
function diffYMD(fromIso, toIso = todayISO()) {
  const from = parts(fromIso);
  const to = parts(toIso);
  if (!from || !to) return null;

  let years = to.year - from.year;
  let months = to.month - from.month;
  let days = to.day - from.day;

  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(to.year, to.month - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  return { years, months, days };
}

/** Age in whole years from a date of birth. '' when unknown. */
export function calcAge(dobIso) {
  const diff = diffYMD(dobIso);
  return diff ? `${diff.years} years` : '';
}

/** "2 yrs 3 mos", "5 mos", "12 days" from a date of joining. '' when unknown. */
export function calcTenure(dojIso) {
  const diff = diffYMD(dojIso);
  if (!diff) return '';
  const result = [];
  if (diff.years) result.push(`${diff.years} ${diff.years === 1 ? 'yr' : 'yrs'}`);
  if (diff.months) result.push(`${diff.months} ${diff.months === 1 ? 'mo' : 'mos'}`);
  if (!result.length) result.push(`${diff.days} ${diff.days === 1 ? 'day' : 'days'}`);
  return result.join(' ');
}

/** ISO date -> Excel serial number, without timezone-related date shifts. */
export function toExcelSerial(iso) {
  const value = parts(iso);
  if (!value) return null;
  return (Date.UTC(value.year, value.month - 1, value.day) - Date.UTC(1899, 11, 30)) / 86400000;
}
