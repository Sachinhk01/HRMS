import api from './api';
import { getDepartments } from './employeeService';
import { todayISO } from '../utils/dateUtils';

/**
 * Reports & Analytics — GET /api/v1/reports/{attendance|leave}
 *
 * Rules taken from the backend guide:
 *  - JSON success bodies are NOT wrapped in ApiResponse -> use `data`, never `data.data`.
 *  - Send month+year OR startDate+endDate, never both.
 *  - startDate > endDate answers 500 (not 400) -> validate before calling.
 *  - Only the sort fields below are safe; anything else 500s.
 *  - page/size are ignored for excel/pdf (the whole filtered set is exported).
 */

export const ATTENDANCE_STATUSES = [
  'PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'LEAVE', 'HOLIDAY', 'WEEKEND', 'MISSED_CHECKOUT',
];
export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

// JPA entity property names (NOT the response field names).
export const ATTENDANCE_SORT_FIELDS = [
  'attendanceDate', 'checkInTime', 'checkOutTime', 'workingMinutes', 'totalBreakMinutes', 'attendanceStatus',
];
export const LEAVE_SORT_FIELDS = ['createdAt', 'updatedAt', 'startDate', 'endDate', 'totalDays', 'status'];

const KINDS = {
  attendance: { statusParam: 'attendanceStatus', sortFields: ATTENDANCE_SORT_FIELDS, defaultSort: 'attendanceDate' },
  leave: { statusParam: 'leaveStatus', sortFields: LEAVE_SORT_FIELDS, defaultSort: 'createdAt' },
};

export const PAGE_SIZES = [10, 20, 50, 100];

/** Default filters: current month (keeps the backend summary query cheap). */
export function defaultReportFilters(kind) {
  const today = todayISO();
  return {
    departmentId: '',
    employeeId: '',
    status: '',
    periodMode: 'month', // 'month' | 'range'
    month: Number(today.slice(5, 7)),
    year: Number(today.slice(0, 4)),
    startDate: '',
    endDate: '',
    page: 0, // 0-based, like the backend
    size: 20,
    sortBy: KINDS[kind].defaultSort,
    sortDir: 'DESC',
  };
}

/** Returns an error message, or '' when the filters are safe to send. */
export function validateReportFilters(f) {
  if (f.periodMode === 'month') {
    if (!f.month || !f.year) return 'Select a month and year.';
    if (f.month < 1 || f.month > 12) return 'Month must be between 1 and 12.';
    if (f.year < 2000 || f.year > 2100) return 'Year must be between 2000 and 2100.';
    return '';
  }
  if (!f.startDate || !f.endDate) return 'Select both a start date and an end date.';
  if (f.startDate > f.endDate) return 'Start date cannot be after the end date.';
  return '';
}

/** Builds the query params. `format` is json | excel | pdf. */
export function buildReportParams(kind, f, format = 'json') {
  const cfg = KINDS[kind];
  const params = { format };

  if (f.departmentId) params.departmentId = Number(f.departmentId);
  if (f.employeeId) params.employeeId = Number(f.employeeId);
  if (f.status) params[cfg.statusParam] = f.status;

  // Never send month/year together with an explicit date range.
  if (f.periodMode === 'month') {
    params.month = Number(f.month);
    params.year = Number(f.year);
  } else {
    params.startDate = f.startDate;
    params.endDate = f.endDate;
  }

  params.sortBy = cfg.sortFields.includes(f.sortBy) ? f.sortBy : cfg.defaultSort;
  params.sortDir = f.sortDir === 'ASC' ? 'ASC' : 'DESC';

  if (format === 'json') {
    params.page = Math.max(0, Number(f.page) || 0);
    params.size = Math.min(100, Math.max(1, Number(f.size) || 20));
  }
  return params;
}

/** One JSON page: { content, summary, page, size, totalElements, totalPages, ... } */
export async function fetchReport(kind, filters) {
  const { data } = await api.get(`/reports/${kind}`, { params: buildReportParams(kind, filters, 'json') });
  return data; // NOT wrapped in ApiResponse
}

export function calculateAttendanceShare(summary, missedCheckoutCount) {
  const totalRecords = Number(summary?.totalRecords);
  if (!Number.isFinite(totalRecords) || totalRecords <= 0 || missedCheckoutCount == null) return null;

  const presentCount = Number(summary?.presentCount) || 0;
  const halfDayCount = Number(summary?.halfDayCount) || 0;
  const lateCount = Number(summary?.lateCount) || 0;
  const missedCount = Number(missedCheckoutCount) || 0;
  return ((presentCount + halfDayCount / 2 + lateCount + missedCount) / totalRecords) * 100;
}

function periodStamp(f) {
  return f.periodMode === 'month'
    ? `${f.year}-${String(f.month).padStart(2, '0')}`
    : `${f.startDate}_${f.endDate}`;
}

/**
 * Downloads the full filtered report as .xlsx / .pdf.
 * The filename is built here: Content-Disposition is not readable cross-origin.
 */
export async function downloadReportFile(kind, filters, format) {
  const response = await api.get(`/reports/${kind}`, {
    params: buildReportParams(kind, filters, format),
    responseType: 'blob',
    timeout: 120000, // big exports are built in memory on the server
  });

  const blob = response.data;
  if (blob?.type?.includes('json')) {
    throw new Error('The server returned data instead of a file. Please try again.');
  }

  const ext = format === 'excel' ? 'xlsx' : 'pdf';
  const filename = `${kind}-report-${periodStamp(filters)}.${ext}`;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return filename;
}

// ---- Lookups (wrapped in ApiResponse: { success, message, data }) ----

export async function getReportDepartments() {
  return getDepartments(); // [{ id, name }]
}

export async function getReportEmployees() {
  const { data } = await api.get('/lookups/employee-id-name');
  return data.data || []; // [{ id, employeeCode, employeeName }]
}

// ---- Display helpers ----

export const EMPTY = '—';

export const formatMinutes = (m) =>
  m == null ? EMPTY : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

/** "2026-07-27T09:04:11" -> "09:04". Values are local wall-clock: no timezone conversion. */
export const timeOfDay = (iso) => (iso ? iso.slice(11, 16) : EMPTY);

export const statusLabel = (s) =>
  String(s || '').toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');