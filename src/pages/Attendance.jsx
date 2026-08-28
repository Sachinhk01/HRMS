import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  LocateFixed,
  LogIn,
  LogOut,
  Play,
  CheckCircle2,
  XCircle,
  Search,
  CalendarCheck,
  Timer,
  Briefcase,
  MapPin,
  Sparkles,
  TrendingUp,
  Target,
  Hourglass,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import ExportMenu from '../components/ExportMenu';
import { useAuth } from '../context/AuthContext';
import {
  ATTENDANCE_STATE,
  checkIn,
  checkOut,
  endBreak,
  getAttendanceCalendar,
  getAttendanceDashboard,
  getAttendanceHistory,
  startBreak,
} from '../services/attendanceService';
import './Attendance.css';

const STATUS_LABELS = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  LEAVE: 'Leave',
  HOLIDAY: 'Holiday',
  LATE: 'Late',
  WEEKEND: 'Weekend',
  MISSED_CHECKOUT: 'Missed Checkout',
};

function normalizeAttendanceStatus(status) {
  return String(status || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function statusClass(status) {
  return normalizeAttendanceStatus(status).toLowerCase();
}

function statusCode(status) {
  const normalized = normalizeAttendanceStatus(status);
  if (normalized === 'ABSENT') return 'A';
  if (normalized === 'HALF_DAY') return 'HD';
  if (normalized === 'PRESENT' || normalized === 'LATE') return 'P';
  if (normalized === 'HOLIDAY') return 'H';
  if (normalized === 'WEEKEND') return 'W';
  if (normalized === 'LEAVE') return 'L';
  if (normalized === 'MISSED_CHECKOUT') return 'MC';
  return '';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PAGE_SIZE = 6;

function dateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Backend already sends pre-formatted "hh:mm a" strings (or "--" when not set).
function displayTime(value) {
  if (!value || value === '--') return '—';
  return value;
}

// Backend already sends pre-formatted "Xh Ym" duration strings.
function displayDuration(value) {
  return value || '0h 0m';
}

// ---------------------------------------------------------------------
// Client-side attendance export (PDF / Excel).
//
// The backend's /reports/attendance endpoint currently rejects HR users
// with a 403 (its @PreAuthorize checks a role name that doesn't match
// what HR accounts are actually granted), and that's backend code we're
// not touching here. /attendance/history is already correctly permissioned
// for EMPLOYEE, MANAGER and HR_ADMIN, so instead of calling the broken
// report endpoint we fetch the same rows the table already shows (just for
// the chosen month/date range) and build the PDF/Excel file in the browser.
// ---------------------------------------------------------------------
const EXPORT_HEADER = ['Date', 'Check In', 'Check Out', 'Worked', 'Break', 'Status'];

function attendanceRowsToAoA(rows) {
  return rows.map((r) => [
    r.attendanceDate || '',
    displayTime(r.checkInTime),
    displayTime(r.checkOutTime),
    displayDuration(r.todayWorkingHours),
    displayDuration(r.todayBreakHours),
    STATUS_LABELS[normalizeAttendanceStatus(r.attendanceStatus)] || r.attendanceStatus || '',
  ]);
}

function downloadAttendanceExcel(rows, fileLabel) {
  const worksheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADER, ...attendanceRowsToAoA(rows)]);
  worksheet['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  XLSX.writeFile(workbook, `attendance-${fileLabel}.xlsx`);
}

function downloadAttendancePdf(rows, fileLabel, title) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    head: [EXPORT_HEADER],
    body: attendanceRowsToAoA(rows),
    startY: 22,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`attendance-${fileLabel}.pdf`);
}

// Mirrors backend TimeUtil.formatMinutes — used only for "Total elapsed",
// derived from dashboard's numeric workingMinutes + breakMinutes.
function formatMinutesLabel(totalMinutes) {
  const minutes = Number(totalMinutes) || 0;
  if (minutes <= 0) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

// The location line shows placeholder/error text while permission is
// pending or denied — only treat it as a real location once resolved.
function isResolvedLocation(text) {
  return Boolean(text) && text !== 'Fetching location...' && text !== 'Location unavailable' && text !== 'Location permission denied';
}

function formatLiveClock(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatLiveDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_ICONS = {
  PRESENT: CheckCircle2,
  ABSENT: XCircle,
  HALF_DAY: Hourglass,
  LEAVE: CalendarDays,
  HOLIDAY: Sparkles,
  LATE: Clock3,
  WEEKEND: CalendarCheck,
  MISSED_CHECKOUT: XCircle,
};

const LEGEND = [
  { code: 'P', label: 'Present', cls: 'present', icon: CheckCircle2 },
  { code: 'A', label: 'Absent', cls: 'absent', icon: XCircle },
  { code: 'HD', label: 'Half Day', cls: 'half', icon: Hourglass },
  { code: 'H', label: 'Holiday', cls: 'holiday', icon: Sparkles },
  { code: 'L', label: 'Leave', cls: 'leave', icon: CalendarDays },
  { code: 'W', label: 'Weekend', cls: 'weekend', icon: CalendarCheck },
];

const easeOut = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export default function Attendance() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dashboard, setDashboard] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyTotalItems, setHistoryTotalItems] = useState(0);
  const [calendarEntries, setCalendarEntries] = useState([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [locationText, setLocationText] = useState('Fetching location...');
  const [activeTab, setActiveTab] = useState('mark');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [historyPage, setHistoryPage] = useState(1);
  const canViewAll = user.role === 'HR_ADMIN' || user.role === 'MANAGER';
  // Overtime for today only — sourced from the existing /attendance/check-out
  // response (CheckOutResponse.overtimeMinutes), which is the only endpoint
  // that returns it. Reset on each mount/day since it only applies to today.
  const [todayOvertimeMinutes, setTodayOvertimeMinutes] = useState(null);

  // ---- UI-only state (no logic impact) ----
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeLegend, setActiveLegend] = useState(null);

  // ---- Export filters (HR/Manager only — matches backend /reports/attendance) ----
  // 'month' sends year+month, 'range' sends startDate+endDate. Employees never
  // see these controls since only HR/Manager can hit that endpoint at all.
  const [exportRangeType, setExportRangeType] = useState('month');
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');

  useEffect(() => {
    const clockTimer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationText('Location unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const address = data.address || {};
          const readable = [address.suburb || address.neighbourhood, address.city || address.town, address.state]
            .filter(Boolean)
            .join(', ');
          setLocationText(readable || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setLocationText(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      () => setLocationText('Location permission denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  async function loadAttendanceData() {
    setError('');
    setIsLoading(true);
    try {
      const monthStartStr = dateKey(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
      const daysInVisibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
      const monthEndStr = dateKey(visibleMonth.getFullYear(), visibleMonth.getMonth(), daysInVisibleMonth);

      const [dashboardResult, historyResult, calendarResult, monthDetailResult] =
  await Promise.allSettled([
    getAttendanceDashboard(),
    getAttendanceHistory({
      page: historyPage - 1,
      size: PAGE_SIZE,
      sortBy: "attendanceDate",
      sortDirection: "desc",
    }),
    getAttendanceCalendar(
      visibleMonth.getMonth() + 1,
      visibleMonth.getFullYear()
    ),
    // Existing /attendance/history endpoint, just scoped to the visible month
    // via its already-supported fromDate/toDate params. Used only to enrich
    // the "Selected day" panel with check-in/out/working/break details that
    // the lightweight /attendance/calendar endpoint doesn't return.
    getAttendanceHistory({
      page: 0,
      size: daysInVisibleMonth,
      sortBy: "attendanceDate",
      sortDirection: "asc",
      fromDate: monthStartStr,
      toDate: monthEndStr,
    }),
  ]);

const failures = [];

if (dashboardResult.status === "fulfilled") {
  setDashboard(dashboardResult.value);
} else {
  failures.push(`dashboard (${dashboardResult.reason?.message || 'request failed'})`);
}

if (historyResult.status === "fulfilled") {
  setHistoryItems(historyResult.value?.content || []);
  setHistoryTotalItems(historyResult.value?.totalElements ?? 0);
} else {
  setHistoryItems([]);
  setHistoryTotalItems(0);
  failures.push(`history (${historyResult.reason?.message || 'request failed'})`);
}

if (calendarResult.status === "fulfilled") {
  // Best-effort enrichment map keyed by date; if this call failed we simply
  // fall back to status-only entries, same as before.
  const detailByDate = new Map();
  if (monthDetailResult.status === "fulfilled") {
    (monthDetailResult.value?.content || []).forEach((record) => {
      detailByDate.set(record.attendanceDate, record);
    });
  }
  setCalendarEntries(
    (calendarResult.value || []).map((entry) => {
      const detail = detailByDate.get(entry.attendanceDate);
      return {
        date: entry.attendanceDate,
        status: normalizeAttendanceStatus(entry.attendanceStatus),
        checkInTime: detail?.checkInTime || null,
        checkOutTime: detail?.checkOutTime || null,
        workingHours: detail?.todayWorkingHours || null,
        breakHours: detail?.todayBreakHours || null,
      };
    })
  );
} else {
  setCalendarEntries([]);
  failures.push(`calendar (${calendarResult.reason?.message || 'request failed'})`);
}

// Promise.allSettled never rejects, so a failed call would otherwise be
// silently dropped (e.g. history staying empty with no indication why).
// Surface it the same way a thrown error would be.
if (failures.length) {
  setError(`Failed to load: ${failures.join(', ')}.`);
  console.error('Attendance load failures:', {
    dashboard: dashboardResult.status === 'rejected' ? dashboardResult.reason : null,
    history: historyResult.status === 'rejected' ? historyResult.reason : null,
    calendar: calendarResult.status === 'rejected' ? calendarResult.reason : null,
  });
}

    } catch (loadError) {
      setError(loadError.message || 'Unable to load attendance details.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAttendanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyPage, visibleMonth]);

  const recordsByDate = useMemo(() => new Map(calendarEntries.map((entry) => [entry.date, entry])), [calendarEntries]);

  const calendarCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const monthIndex = visibleMonth.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, monthIndex, day);
      cells.push({ day, key: dateKey(year, monthIndex, day), isSunday: date.getDay() === 0 });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleMonth]);

  const selectedEntry = recordsByDate.get(selectedDate) || null;

  const state = dashboard?.employeeStatus || null;
  const hasCheckedIn = Boolean(dashboard?.checkedIn);
  const hasCheckedOut = Boolean(dashboard?.checkedOut);
  const isLateToday = normalizeAttendanceStatus(dashboard?.attendanceStatus) === 'LATE'
    && (state === ATTENDANCE_STATE.WORKING || state === ATTENDANCE_STATE.ON_BREAK || hasCheckedOut);
  const totalElapsedLabel = formatMinutesLabel((dashboard?.workingMinutes || 0) + (dashboard?.breakMinutes || 0));

  // ---- UI-only derived views (do not touch data flow) ----
  const filteredHistory = useMemo(() => {
    let rows = historyItems;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((r) => String(r.attendanceDate || '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'ALL') {
      rows = rows.filter((r) => normalizeAttendanceStatus(r.attendanceStatus) === statusFilter);
    }
    return rows;
  }, [historyItems, searchQuery, statusFilter]);

  const progressPercent = useMemo(() => {
    const mins = Number(dashboard?.workingMinutes || 0);
    return Math.min(100, Math.round((mins / 480) * 100));
  }, [dashboard?.workingMinutes]);

  const ringColor =
    state === ATTENDANCE_STATE.ON_BREAK ? '#f59e0b'
    : state === ATTENDANCE_STATE.WORKING ? '#10b981'
    : state === ATTENDANCE_STATE.CHECKED_OUT ? '#64748b'
    : '#94a3b8';

  const ringCircumference = 2 * Math.PI * 78;
  const ringOffset = ringCircumference - (progressPercent / 100) * ringCircumference;

  async function handleLocationAwareAction(action, actionName) {
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const coords = actionName === 'checkIn' || actionName === 'checkOut'
        ? await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Location Access is Unavailable On This Browser.'));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
              (geoError) => reject(new Error(geoError.code === 1 ? 'Location Permission Denied.' : 'Unable to Fetch Your Current Location.')),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          })
        : null;
      const actionResult = await action(coords);
      if (actionName === 'checkOut' && actionResult && actionResult.overtimeMinutes != null) {
        setTodayOvertimeMinutes(actionResult.overtimeMinutes);
      }
      await loadAttendanceData();
      setSuccessMessage(
        actionName === 'checkIn'
          ? 'Checked in successfully.'
          : actionName === 'checkOut'
          ? 'Checked out successfully.'
          : actionName === 'startBreak'
          ? 'Break started.'
          : 'Break ended.'
      );
    } catch (attendanceError) {
      setError(attendanceError.message || `Unable to ${actionName}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCheckIn() {
    return handleLocationAwareAction((coords) => checkIn(coords), 'checkIn');
  }

  function handleCheckOut() {
    return handleLocationAwareAction((coords) => checkOut(coords), 'checkOut');
  }

  function handleStartBreak() {
    return handleLocationAwareAction(() => startBreak('LUNCH'), 'startBreak');
  }

  function handleEndBreak() {
    return handleLocationAwareAction(() => endBreak(), 'endBreak');
  }

  async function handleExport(format) {
    setError('');
    setSuccessMessage('');
    try {
      // Resolve the month-wise or date-range filter picked in the toolbar
      // into a concrete fromDate/toDate pair.
      let fromDate;
      let toDate;
      let fileLabel;
      let title;

      if (exportRangeType === 'month' && exportMonth) {
        const [yearStr, monthStr] = exportMonth.split('-');
        const year = Number(yearStr);
        const monthIndex = Number(monthStr) - 1;
        const lastDay = new Date(year, monthIndex + 1, 0).getDate();
        fromDate = dateKey(year, monthIndex, 1);
        toDate = dateKey(year, monthIndex, lastDay);
        fileLabel = exportMonth;
        title = `Attendance Report — ${exportMonth}`;
      } else {
        fromDate = exportFromDate || undefined;
        toDate = exportToDate || undefined;
        fileLabel = [fromDate, toDate].filter(Boolean).join('_to_') || 'all';
        title = `Attendance Report — ${fromDate || 'Start'} to ${toDate || 'Today'}`;
      }

      // /attendance/history is correctly permissioned for EMPLOYEE, MANAGER
      // and HR_ADMIN, so pull every row in range from it (looping pages
      // since the backend caps page size at 100) and build the file here.
      const rows = [];
      let page = 0;
      let totalPages = 1;
      do {
        const result = await getAttendanceHistory({
          page,
          size: 100,
          sortBy: 'attendanceDate',
          sortDirection: 'asc',
          fromDate,
          toDate,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
        });
        rows.push(...(result?.content || []));
        totalPages = result?.totalPages ?? 1;
        page += 1;
      } while (page < totalPages);

      if (!rows.length) {
        setError('No attendance records found for the selected range.');
        return;
      }

      if (format === 'excel') {
        downloadAttendanceExcel(rows, fileLabel);
      } else {
        downloadAttendancePdf(rows, fileLabel, title);
      }
      setSuccessMessage(`Attendance report downloaded as ${format === 'excel' ? 'Excel' : 'PDF'}.`);
    } catch (exportError) {
      setError(exportError.message || 'Unable to export attendance report.');
    }
  }

  const todayKey = dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <div className="page-stack attendance-page page-reveal">
      {/* ---------- Hero banner ---------- */}
      <motion.section
        className="attendance-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
      >
        <div className="attendance-hero-text">
          <span className="eyebrow">Attendance</span>
          <h1>Track Your Workday</h1>
          <p>Monitor Attendance, Manage Breaks And Review Work History.</p>
          <div className="attendance-hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-icon"><Clock3 size={16} /></span>
              <div><strong>{displayDuration(dashboard?.workingHours)}</strong><small>Today</small></div>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-icon"><CalendarCheck size={16} /></span>
              <div><strong>{state === ATTENDANCE_STATE.WORKING ? (normalizeAttendanceStatus(dashboard?.attendanceStatus) === 'LATE' ? 'Late' : 'Present') : state === ATTENDANCE_STATE.ON_BREAK ? 'On Break' : hasCheckedOut ? (normalizeAttendanceStatus(dashboard?.attendanceStatus) === 'LATE' ? 'Late' : 'Checked Out') : 'Not In'}</strong><small>Status</small></div>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-icon"><Timer size={16} /></span>
              <div><strong>{totalElapsedLabel}</strong><small>Elapsed</small></div>
            </div>
          </div>
        </div>
        {isLateToday ? (
          <div className="attendance-hero-illustration attendance-hero-illustration--late" aria-hidden="true">
            <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="250" cy="46" r="54" fill="#fef3c7" opacity="0.6" />
              <circle cx="56" cy="158" r="40" fill="#fde68a" opacity="0.35" />
              <path d="M18 168 H302" stroke="#fcd34d" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" opacity="0.6" />
              <g transform="translate(238,58)">
                <circle r="30" fill="#fff" stroke="#f59e0b" strokeWidth="4" />
                <path d="M0 -16 V0 L12 8" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M-30 34 q-8 -6 -14 0" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M-34 44 q-8 -6 -14 0" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
              </g>
              <g transform="translate(70,128)">
                <ellipse cx="-24" cy="30" rx="8" ry="6" fill="#65a30d" />
                <ellipse cx="26" cy="30" rx="8" ry="6" fill="#65a30d" />
                <ellipse cx="0" cy="8" rx="46" ry="30" fill="#84cc16" />
                <path d="M-30 8 a30 22 0 0 1 60 0" fill="none" stroke="#4d7c0f" strokeWidth="2" opacity="0.5" />
                <path d="M-20 -2 L-8 12 M0 -8 V14 M20 -2 L8 12" stroke="#4d7c0f" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                <circle cx="52" cy="4" r="14" fill="#a3e635" />
                <circle cx="58" cy="0" r="2" fill="#365314" />
                <path d="M40 -14 q4 6 0 10 q-4 -4 0 -10 Z" fill="#38bdf8" />
                <circle cx="-46" cy="18" r="3" fill="#bef264" opacity="0.7" />
                <circle cx="-56" cy="24" r="2" fill="#bef264" opacity="0.5" />
              </g>
            </svg>
            <p className="attendance-late-caption">Looks like you’re running a little late today! ⏰</p>
          </div>
        ) : (
          <div className="attendance-hero-illustration" aria-hidden="true">
            <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="250" cy="50" r="60" fill="#dbeafe" opacity="0.5" />
              <circle cx="60" cy="160" r="44" fill="#bfdbfe" opacity="0.4" />
              <rect x="120" y="50" width="130" height="100" rx="16" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
              <circle cx="185" cy="92" r="30" fill="none" stroke="#2563eb" strokeWidth="4" />
              <path d="M185 76 V92 L196 100" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="140" y="120" width="30" height="6" rx="3" fill="#dbeafe" />
              <rect x="180" y="120" width="50" height="6" rx="3" fill="#eef2ff" />
              <circle cx="250" cy="150" r="14" fill="#10b981" opacity="0.8" />
              <path d="M244 150 l4 5 l8 -9" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </motion.section>

      {/* ---------- Segmented tabs ---------- */}
      <motion.div
        className="attendance-seg"
        role="tablist"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeOut, delay: 0.1 }}
      >
        <div className="attendance-seg-track">
          <AnimatePresence>
            {activeTab === 'mark' && (
              <motion.div
                className="attendance-seg-indicator"
                layoutId="seg-indicator"
                initial={false}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
          </AnimatePresence>
          <button
            type="button"
            className={`attendance-seg-btn ${activeTab === 'mark' ? 'active' : ''}`}
            onClick={() => setActiveTab('mark')}
            role="tab"
            aria-selected={activeTab === 'mark'}
          >
            <Clock3 size={17} /> Mark Attendance
          </button>
          <AnimatePresence>
            {activeTab === 'calendar' && (
              <motion.div
                className="attendance-seg-indicator"
                layoutId="seg-indicator"
                initial={false}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
          </AnimatePresence>
          <button
            type="button"
            className={`attendance-seg-btn ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
            role="tab"
            aria-selected={activeTab === 'calendar'}
          >
            <CalendarDays size={17} /> Attendance Calendar
          </button>
        </div>
      </motion.div>

      {/* ---------- Toasts ---------- */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="toast toast-error"
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.96 }}
            transition={{ duration: 0.3, ease: easeOut }}
          >
            <XCircle size={18} /> {error}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {successMessage && (
          <motion.div
            className="toast toast-success"
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.96 }}
            transition={{ duration: 0.3, ease: easeOut }}
            onAnimationComplete={() => {
              if (successMessage) window.setTimeout(() => setSuccessMessage(''), 3500);
            }}
          >
            <CheckCircle2 size={18} /> {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- MARK ATTENDANCE TAB ---------- */}
      <AnimatePresence mode="wait">
        {activeTab === 'mark' && (
          <motion.div
            key="mark-tab"
            className="attendance-layout"
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }}
            variants={stagger}
          >
            {/* Live attendance card */}
            <motion.section className="panel live-attendance-card" variants={fadeUp}>
              <div className="live-att-header">
                <span className="eyebrow">Today</span>
                <h2>Live Attendance</h2>
              </div>

              <div className="live-clock">
                <strong>{formatLiveClock(currentTime)}</strong>
                <span>{formatLiveDate(currentTime)}</span>
              </div>

              {/* Animated circular progress ring */}
              <div className="ring-wrap">
                <svg className="ring-svg" viewBox="0 0 180 180">
                  <circle cx="90" cy="90" r="78" fill="none" stroke="#eef2f7" strokeWidth="12" />
                  <motion.circle
                    cx="90" cy="90" r="78" fill="none"
                    stroke={ringColor} strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    initial={{ strokeDashoffset: ringCircumference }}
                    animate={{ strokeDashoffset: ringOffset }}
                    transition={{ duration: 0.9, ease: easeOut }}
                    transform="rotate(-90 90 90)"
                  />
                </svg>
                <div className="ring-center">
                  <Clock3 size={26} color={ringColor} />
                  <strong>{displayDuration(dashboard?.workingHours)}</strong>
                  <span style={{ color: ringColor }}>
                    {state === ATTENDANCE_STATE.ON_BREAK ? 'On Break'
                      : state === ATTENDANCE_STATE.CHECKED_OUT ? 'Checked Out'
                      : state === ATTENDANCE_STATE.WORKING ? 'Working'
                      : 'Not Checked In'}
                  </span>
                  <small>{progressPercent}% of 8h Day</small>
                </div>
              </div>

              {/* Three stat cards */}
              <div className="live-stat-grid">
                <div className="live-stat">
                  <span className="live-stat-icon green"><Briefcase size={16} /></span>
                  <strong>{displayDuration(dashboard?.workingHours)}</strong>
                  <small>Worked</small>
                </div>
                <div className="live-stat">
                  <span className="live-stat-icon orange"><Coffee size={16} /></span>
                  <strong>{displayDuration(dashboard?.breakHours)}</strong>
                  <small>Break</small>
                </div>
                <div className="live-stat">
                  <span className="live-stat-icon blue"><Timer size={16} /></span>
                  <strong>{totalElapsedLabel}</strong>
                  <small>Total</small>
                </div>
              </div>

              <div className="location-line"><LocateFixed size={16} /><span>{locationText}</span></div>

              <div className="attendance-action-grid">
                {!hasCheckedIn && (
                  <motion.button type="button" className="btn btn-gradient btn-ripple" disabled={isSubmitting} onClick={() => handleCheckIn()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <LogIn size={18} /> Check In
                  </motion.button>
                )}
                {state === ATTENDANCE_STATE.WORKING && (
                  <motion.button type="button" className="btn btn-warm-soft btn-ripple" disabled={isSubmitting} onClick={() => handleStartBreak()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Coffee size={18} /> Start Break
                  </motion.button>
                )}
                {state === ATTENDANCE_STATE.ON_BREAK && (
                  <motion.button type="button" className="btn btn-gradient btn-ripple" disabled={isSubmitting} onClick={() => handleEndBreak()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Play size={18} /> End Break
                  </motion.button>
                )}
                {state === ATTENDANCE_STATE.WORKING && (
                  <motion.button type="button" className="btn btn-danger-soft btn-ripple" disabled={isSubmitting} onClick={() => handleCheckOut()} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <LogOut size={18} /> Check Out
                  </motion.button>
                )}
                {hasCheckedOut && <p className="empty-inline">You're Checked Out For Today.</p>}
              </div>
            </motion.section>

            {/* History table */}
            <motion.section className="panel history-panel" variants={fadeUp}>
              <div className="panel-title attendance-history-title">
                <h2>{canViewAll ? 'Attendance Records' : 'My Attendance History'}</h2>
                <span className="eyebrow">{user.name}</span>
              </div>

              <div className="history-toolbar">
                <label className="history-search">
                  <Search size={15} />
                  <input
                    type="text"
                    placeholder="Search by date..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </label>
                <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All Statuses</option>
                  {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>

                {/* Export is HR/Manager-only — matches the backend's
                    @PreAuthorize("hasAnyRole('HR','MANAGER')") on
                    /reports/attendance. Employees never see these controls. */}
                {canViewAll && (
                  <>
                    <select
                      className="compact-select"
                      value={exportRangeType}
                      onChange={(e) => setExportRangeType(e.target.value)}
                    >
                      <option value="month">Month-wise</option>
                      <option value="range">Date-wise</option>
                    </select>

                    {exportRangeType === 'month' ? (
                      <input
                        type="month"
                        className="compact-select"
                        value={exportMonth}
                        onChange={(e) => setExportMonth(e.target.value)}
                      />
                    ) : (
                      <>
                        <input
                          type="date"
                          className="compact-select"
                          value={exportFromDate}
                          max={exportToDate || undefined}
                          onChange={(e) => setExportFromDate(e.target.value)}
                        />
                        <input
                          type="date"
                          className="compact-select"
                          value={exportToDate}
                          min={exportFromDate || undefined}
                          onChange={(e) => setExportToDate(e.target.value)}
                        />
                      </>
                    )}

                    <ExportMenu onExport={handleExport} />
                  </>
                )}
              </div>

              <div className="table-wrap">
                <table className="history-table">
                  <thead>
                    <tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Worked</th><th>Break</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {isLoading && Array.from({ length: 4 }).map((_, i) => (
                      <tr key={`sk-${i}`} className="skeleton-row">
                        <td colSpan={6}><div className="skeleton-bar" /></td>
                      </tr>
                    ))}
                    {!isLoading && filteredHistory.map((record, i) => {
                      const SIcon = STATUS_ICONS[normalizeAttendanceStatus(record.attendanceStatus)] || Clock3;
                      return (
                        <motion.tr
                          key={record.AttendanceId ?? `row-${i}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.04, ease: easeOut }}
                        >
                          <td>{record.attendanceDate}</td>
                          <td>{displayTime(record.checkInTime)}</td>
                          <td>{displayTime(record.checkOutTime)}</td>
                          <td>{displayDuration(record.todayWorkingHours)}</td>
                          <td>{displayDuration(record.todayBreakHours)}</td>
                          <td>
                            <span className={`status-pill status-${statusClass(record.attendanceStatus)}`}>
                              <SIcon size={12} /> {STATUS_LABELS[normalizeAttendanceStatus(record.attendanceStatus)] || record.attendanceStatus}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
                {!isLoading && !filteredHistory.length && (
                  <div className="empty-state">
                    <CalendarCheck size={32} />
                    <p>No Attendance Records Found.</p>
                  </div>
                )}
              </div>
              <Pagination page={historyPage} totalItems={historyTotalItems} pageSize={PAGE_SIZE} onPageChange={setHistoryPage} />
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- CALENDAR TAB ---------- */}
      <AnimatePresence mode="wait">
        {activeTab === 'calendar' && (
          <motion.div
            key="calendar-tab"
            className="attendance-calendar-layout"
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }}
            variants={stagger}
          >
            <motion.section className="panel attendance-calendar-panel" variants={fadeUp}>
              <div className="calendar-toolbar">
                <div className="calendar-toolbar-left">
                  <button type="button" className="calendar-nav-button" onClick={() => setVisibleMonth((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={20} /></button>
                  <div className="calendar-title-block">
                    <span className="eyebrow">Monthly Overview</span>
                    <h2>{visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2>
                  </div>
                  <button type="button" className="calendar-nav-button" onClick={() => setVisibleMonth((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={20} /></button>
                </div>
                <div className="calendar-toolbar-right">
                  <button type="button" className="btn btn-soft btn-today" onClick={() => setVisibleMonth(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
                    <Target size={14} /> Today
                  </button>
                </div>
              </div>

              <div className="attendance-calendar">
                {WEEKDAYS.map((weekday) => <div className="calendar-weekday" key={weekday}>{weekday}</div>)}
                {calendarCells.map((cell, index) => {
                  if (!cell) return <div className="calendar-day empty" key={`empty-${index}`} />;
                  const dayEntry = recordsByDate.get(cell.key);
                  const code = dayEntry ? statusCode(dayEntry.status) : '';
                  const SIcon = dayEntry ? STATUS_ICONS[dayEntry.status] : null;
                  const isToday = cell.key === todayKey;
                  const dimmed = activeLegend && dayEntry && dayEntry.status !== activeLegend && dayEntry.status !== 'WEEKEND';
                  return (
                    <motion.button
                      type="button"
                      key={cell.key}
                      className={`calendar-day ${cell.isSunday ? 'sunday' : ''} ${selectedDate === cell.key ? 'selected' : ''} ${dayEntry ? `status-${statusClass(dayEntry.status)}` : ''} ${isToday ? 'is-today' : ''} ${dimmed ? 'dimmed' : ''}`}
                      onClick={() => setSelectedDate(cell.key)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25, delay: Math.min(index * 0.012, 0.3), ease: easeOut }}
                      whileHover={{ scale: 1.05 }}
                      title={dayEntry ? `${cell.key} — ${STATUS_LABELS[dayEntry.status] || dayEntry.status}` : cell.key}
                    >
                      <span className="cal-day-num">{cell.day}</span>
                      {SIcon && <SIcon size={13} className="cal-day-icon" />}
                      {code && <i className={`attendance-marker status-${statusClass(dayEntry.status)}`}>{code}</i>}
                    </motion.button>
                  );
                })}
              </div>

              {/* Legend pills */}
              <div className="legend-pills">
                {LEGEND.map((item) => {
                  const LIcon = item.icon;
                  const active = activeLegend === item.cls || activeLegend === null;
                  return (
                    <button
                      key={item.code}
                      className={`legend-pill ${item.cls} ${active ? 'active' : 'inactive'}`}
                      onClick={() => setActiveLegend((cur) => (cur === item.cls ? null : item.cls))}
                    >
                      <LIcon size={13} /> {item.label}
                    </button>
                  );
                })}
              </div>
            </motion.section>

            {/* Selected day panel */}
            <motion.aside className="panel selected-attendance-panel" variants={fadeUp}>
              <span className="eyebrow">Selected Day</span>
              <h2>{selectedDate || 'Choose a date'}</h2>
              {selectedEntry ? (
                <div className="selected-attendance-details">
                  <div className="sad-row">
                    <span><CheckCircle2 size={14} /> Status</span>
                    <span className={`status-pill status-${statusClass(selectedEntry.status)}`}>{STATUS_LABELS[selectedEntry.status] || selectedEntry.status}</span>
                  </div>
                  <div className="sad-row"><span><LogIn size={14} /> Check In</span><strong>{displayTime(selectedEntry.checkInTime)}</strong></div>
                  <div className="sad-row"><span><LogOut size={14} /> Check Out</span><strong>{displayTime(selectedEntry.checkOutTime)}</strong></div>
                  <div className="sad-row"><span><Briefcase size={14} /> Working Hours</span><strong>{selectedEntry.workingHours ? displayDuration(selectedEntry.workingHours) : '—'}</strong></div>
                  <div className="sad-row"><span><Coffee size={14} /> Break Time</span><strong>{selectedEntry.breakHours ? displayDuration(selectedEntry.breakHours) : '—'}</strong></div>
                  <div className="sad-row"><span><TrendingUp size={14} /> Overtime</span><strong>{selectedDate === todayKey && todayOvertimeMinutes != null ? formatMinutesLabel(todayOvertimeMinutes) : '—'}</strong></div>
                  <div className="sad-row"><span><MapPin size={14} /> Location</span><strong>{selectedDate === todayKey && isResolvedLocation(locationText) ? locationText : '—'}</strong></div>
                  <div className="sad-row"><span><Sparkles size={14} /> Remarks</span><strong>—</strong></div>
                </div>
              ) : (
                <div className="empty-state">
                  <CalendarDays size={32} />
                  <p>No Attendance Found.</p>
                  <small>This Day Has No Recorded Attendance.</small>
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}