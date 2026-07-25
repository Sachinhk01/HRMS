import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
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

// Mirrors backend TimeUtil.formatMinutes — used only for "Total elapsed",
// derived from dashboard's numeric workingMinutes + breakMinutes.
function formatMinutesLabel(totalMinutes) {
  const minutes = Number(totalMinutes) || 0;
  if (minutes <= 0) return '0h 0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatLiveClock(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatLiveDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

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
      const [dashboardResult, historyResult, calendarResult] =
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
  ]);

if (dashboardResult.status === "fulfilled") {
  setDashboard(dashboardResult.value);
}

if (historyResult.status === "fulfilled") {
  setHistoryItems(historyResult.value?.content || []);
  setHistoryTotalItems(historyResult.value?.totalElements ?? 0);
}

if (calendarResult.status === "fulfilled") {
  setCalendarEntries(
    (calendarResult.value || []).map((entry) => ({
      date: entry.attendanceDate,
      status: normalizeAttendanceStatus(entry.attendanceStatus),
    }))
  );
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
  const totalElapsedLabel = formatMinutesLabel((dashboard?.workingMinutes || 0) + (dashboard?.breakMinutes || 0));

  async function handleLocationAwareAction(action, actionName) {
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      const coords = actionName === 'checkIn' || actionName === 'checkOut'
        ? await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Location access is unavailable on this browser.'));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
              (geoError) => reject(new Error(geoError.code === 1 ? 'Location permission denied.' : 'Unable to fetch your current location.')),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          })
        : null;
      await action(coords);
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

  return (
    <div className="page-stack attendance-page page-reveal">
      <PageHeader eyebrow="Attendance" title="Track your workday" description="Check in, take breaks, check out and review monthly attendance." />

      <div className="attendance-tabs" role="tablist">
        <button type="button" className={activeTab === 'mark' ? 'active' : ''} onClick={() => setActiveTab('mark')}><Clock3 size={18} /> Mark Attendance</button>
        <button type="button" className={activeTab === 'calendar' ? 'active' : ''} onClick={() => setActiveTab('calendar')}><CalendarDays size={18} /> Attendance Calendar</button>
      </div>

      {activeTab === 'mark' && (
        <div className="attendance-layout">
          <section className="panel mark-attendance">
            <span className="eyebrow">Today</span>
            <h2>Live Attendance</h2>
            <div className="attendance-live-clock">
              <strong>{formatLiveClock(currentTime)}</strong>
              <span>{formatLiveDate(currentTime)}</span>
            </div>
            <div className={`attendance-ring ${state === ATTENDANCE_STATE.WORKING ? 'active' : ''} ${state === ATTENDANCE_STATE.ON_BREAK ? 'on-break' : ''}`}>
              <Clock3 size={28} />
              <strong>{displayDuration(dashboard?.workingHours)}</strong>
              <span>{state === ATTENDANCE_STATE.ON_BREAK ? 'On break' : state === ATTENDANCE_STATE.CHECKED_OUT ? 'Checked out' : state === ATTENDANCE_STATE.WORKING ? 'Working' : 'Not checked in'}</span>
            </div>

            <div className="attendance-time-grid">
              <div><span>Worked time</span><strong>{displayDuration(dashboard?.workingHours)}</strong></div>
              <div><span>Break time</span><strong>{displayDuration(dashboard?.breakHours)}</strong></div>
              <div><span>Total elapsed</span><strong>{totalElapsedLabel}</strong></div>
            </div>

            <div className="location-line"><LocateFixed size={17} /><span>{locationText}</span></div>
            {error && <div className="form-alert">{error}</div>}
            {successMessage && <div className="success-alert">{successMessage}</div>}

            <div className="attendance-action-grid">
              {!hasCheckedIn && <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={() => handleCheckIn()}><LogIn size={18} /> Check In</button>}
              {state === ATTENDANCE_STATE.WORKING && <button type="button" className="btn btn-warning-soft" disabled={isSubmitting} onClick={() => handleStartBreak()}><Coffee size={18} /> Start Break</button>}
              {state === ATTENDANCE_STATE.ON_BREAK && <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={() => handleEndBreak()}><Play size={18} /> End Break</button>}
              {state === ATTENDANCE_STATE.WORKING && <button type="button" className="btn btn-danger-soft" disabled={isSubmitting} onClick={() => handleCheckOut()}><LogOut size={18} /> Check Out</button>}
              {hasCheckedOut && <p className="empty-inline">You're checked out for today.</p>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title attendance-history-title">
              <h2>{canViewAll ? 'Attendance records' : 'My attendance history'}</h2>
              <span className="eyebrow">{user.name}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Worked</th><th>Break</th><th>Status</th></tr></thead>
                <tbody>
                  {historyItems.map((record) => (
                    <tr key={record.id}>
                      <td>{record.attendanceDate}</td>
                      <td>{displayTime(record.checkInTime)}</td>
                      <td>{displayTime(record.checkOutTime)}</td>
                      <td>{displayDuration(record.todayWorkingHours)}</td>
                      <td>{displayDuration(record.todayBreakHours)}</td>
                      <td><span className={`attendance-status status-${statusClass(record.attendanceStatus)}`}>{STATUS_LABELS[normalizeAttendanceStatus(record.attendanceStatus)] || record.attendanceStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isLoading && !historyItems.length && <p className="empty-inline">No attendance records yet.</p>}
              {isLoading && <p className="empty-inline">Loading attendance...</p>}
            </div>
            <Pagination page={historyPage} totalItems={historyTotalItems} pageSize={PAGE_SIZE} onPageChange={setHistoryPage} />
          </section>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="attendance-calendar-layout">
          <section className="panel attendance-calendar-panel">
            <div className="calendar-toolbar">
              <button type="button" className="calendar-nav-button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={20} /></button>
              <div><span className="eyebrow">Monthly overview</span><h2>{visibleMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2></div>
              <button type="button" className="calendar-nav-button" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={20} /></button>
            </div>

            <div className="attendance-calendar">
              {WEEKDAYS.map((weekday) => <div className="calendar-weekday" key={weekday}>{weekday}</div>)}
              {calendarCells.map((cell, index) => {
                if (!cell) return <div className={`calendar-day empty ${index % 7 === 0 ? 'sunday-column' : ''}`} key={`empty-${index}`} />;
                const dayEntry = recordsByDate.get(cell.key);
                const code = dayEntry ? statusCode(dayEntry.status) : '';
                return (
                  <button
                    type="button"
                    key={cell.key}
                    className={`calendar-day ${cell.isSunday ? 'sunday sunday-column' : ''} ${selectedDate === cell.key ? 'selected' : ''} ${dayEntry ? `status-${statusClass(dayEntry.status)}` : ''}`}
                    onClick={() => setSelectedDate(cell.key)}
                  >
                    <span>{cell.day}</span>
                    {code && <i className={`attendance-marker status-${statusClass(dayEntry.status)}`}>{code}</i>}
                  </button>
                );
              })}
            </div>
            <div className="attendance-legend enhanced">
              <span><i className="legend-marker present">P</i>Present</span>
              <span><i className="legend-marker absent">A</i>Absent</span>
              <span><i className="legend-marker half">HD</i>Half Day</span>
              <span><i className="legend-marker holiday">H</i>Holiday</span>
              <span><i className="legend-marker casual">L</i>Leave</span>
              <span><i className="legend-marker sick">W</i>Weekend</span>
            </div>
          </section>

          <aside className="panel selected-attendance-panel">
            <span className="eyebrow">Selected day</span>
            <h2>{selectedDate || 'Choose a date'}</h2>
            {selectedEntry ? (
              <div className="selected-attendance-details">
                <div><span>Status</span><strong>{STATUS_LABELS[selectedEntry.status] || selectedEntry.status}</strong></div>
              </div>
            ) : (
              <p className="empty-inline">No attendance recorded for this date.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}