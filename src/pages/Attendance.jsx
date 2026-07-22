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
import usePagination from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { getMyLeaves } from '../services/leaveService';
import { getHolidays } from '../services/holidayService';
import {
  ATTENDANCE_STATE,
  calculateBreakMs,
  calculateElapsedMs,
  calculateWorkedMs,
  checkIn,
  checkOut,
  endBreak,
  getAttendanceRecords,
  getTodayAttendance,
  startBreak,
} from '../services/attendanceService';
import './Attendance.css';

const STATUS_LABELS = { PRESENT: 'Present', ABSENT: 'Absent', HALF_DAY: 'Half Day', LEAVE: 'Leave', HOLIDAY: 'Holiday' };

function leaveCode(type) {
  const value = String(type || '').toLowerCase();
  if (value.includes('casual')) return 'CL';
  if (value.includes('sick')) return 'SL';
  if (value.includes('earned')) return 'EL';
  return 'L';
}

function statusCode(record) {
  const status = normalizeAttendanceStatus(record?.status);
  if (status === 'ABSENT') return 'A';
  if (status === 'HALF_DAY') return 'HD';
  if (status === 'PRESENT') return 'P';
  if (status === 'HOLIDAY') return 'H';
  if (status === 'LEAVE') return leaveCode(record?.leaveType);
  return '';
}

function recordStatusClass(record) {
  const status = statusClass(record?.status);
  if (status === 'leave') return `leave-${leaveCode(record?.leaveType).toLowerCase()}`;
  return status;
}

function normalizeAttendanceStatus(status) {
  return String(status || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function statusClass(status) {
  return normalizeAttendanceStatus(status).toLowerCase();
}

function expandDateRange(fromDate, toDate) {
  const dates = [];
  const cursor = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  while (!Number.isNaN(cursor.getTime()) && cursor <= end) {
    dates.push(dateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PAGE_SIZE = 6;

function dateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatClock(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


function formatLiveClock(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}
function formatLiveDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDuration(milliseconds = 0) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export default function Attendance() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState(() => getTodayAttendance(user.id));  const [records, setRecords] = useState(() => getAttendanceRecords());
  const [tick, setTick] = useState(Date.now());
  const [error, setError] = useState('');
  const [locationText, setLocationText] = useState('Fetching location...');
  const [activeTab, setActiveTab] = useState('mark');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const canViewAll = user.role === 'HR_ADMIN' || user.role === 'MANAGER';
  const [selectedUserId, setSelectedUserId] = useState(user.id);

  useEffect(() => {
    if (!todayRecord?.checkInAt || todayRecord?.checkOutAt) return undefined;
    const timerId = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [todayRecord]);

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
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
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

  const availableUsers = useMemo(() => {
    const users = new Map([[user.id, user.name]]);
    records.forEach((record) => record.userId && users.set(record.userId, record.userName || 'User'));
    return Array.from(users, ([id, name]) => ({ id, name }));
  }, [records, user.id, user.name]);

  const scopedRecords = useMemo(() => {
    const target = canViewAll ? selectedUserId : user.id;
    return records
      .filter((record) => record.userId === target)
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
  }, [canViewAll, records, selectedUserId, user.id]);

  const { page, setPage, pageItems, pageSize } = usePagination(scopedRecords, PAGE_SIZE);

  const monthRecords = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth() + 1;
    return scopedRecords.filter((record) => {
      const [recordYear, recordMonth] = String(record.date).split('-').map(Number);
      return recordYear === year && recordMonth === month;
    });
  }, [scopedRecords, visibleMonth]);

  const calendarRecords = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const monthIndex = visibleMonth.getMonth();
    const targetUserId = canViewAll ? selectedUserId : user.id;
    const merged = new Map();

    monthRecords.forEach((record) => {
      merged.set(record.date, {
        ...record,
        status: normalizeAttendanceStatus(record.status),
      });
    });

    getMyLeaves(targetUserId)
      .filter((leave) => leave.status === 'APPROVED')
      .forEach((leave) => {
        expandDateRange(leave.fromDate, leave.toDate).forEach((date) => {
          const [leaveYear, leaveMonth] = date.split('-').map(Number);
          if (leaveYear === year && leaveMonth === monthIndex + 1 && !merged.has(date)) {
            merged.set(date, {
              id: `leave-calendar-${leave.id}-${date}`,
              date,
              status: 'LEAVE',
              leaveType: leave.type,
              reason: leave.reason,
              isVirtual: true,
            });
          }
        });
      });

    const today = new Date();
    const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dateKey(year, monthIndex, day);
      const dayDate = new Date(year, monthIndex, day);
      const isPast = key < todayKey;
      const isWeekday = dayDate.getDay() !== 0 && dayDate.getDay() !== 6;
      if (isPast && isWeekday && !merged.has(key)) {
        merged.set(key, {
          id: `absence-${targetUserId}-${key}`,
          date: key,
          status: 'ABSENT',
          isVirtual: true,
        });
      }
    }

    getHolidays().forEach((holiday) => {
      const [holidayYear, holidayMonth] = String(holiday.date).split('-').map(Number);
      if (holidayYear === year && holidayMonth === monthIndex + 1 && !merged.has(holiday.date)) {
        merged.set(holiday.date, {
          id: `holiday-calendar-${holiday.id}`,
          date: holiday.date,
          status: 'HOLIDAY',
          holidayName: holiday.name,
          holidayType: holiday.type,
          isVirtual: true,
        });
      }
    });

    return Array.from(merged.values());
  }, [canViewAll, monthRecords, selectedUserId, user.id, visibleMonth]);

  const recordsByDate = useMemo(() => new Map(calendarRecords.map((record) => [record.date, record])), [calendarRecords]);
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

  const summary = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0, HOLIDAY: 0 };
    calendarRecords.forEach((record) => {
      const normalized = normalizeAttendanceStatus(record.status);
      if (counts[normalized] !== undefined) counts[normalized] += 1;
    });
    return counts;
  }, [calendarRecords]);

  const selectedRecord = recordsByDate.get(selectedDate) || null;
  const workedMs = calculateWorkedMs(todayRecord, tick);
  const breakMs = calculateBreakMs(todayRecord, tick);
  const elapsedMs = calculateElapsedMs(todayRecord, tick);
  const state = todayRecord?.state || (todayRecord?.checkOutAt ? ATTENDANCE_STATE.CHECKED_OUT : todayRecord?.checkInAt ? ATTENDANCE_STATE.WORKING : null);

  function refreshAttendance() {
    setRecords(getAttendanceRecords());
    setTodayRecord(getTodayAttendance(user.id));
    setTick(Date.now());
  }

  function runAction(action) {
    setError('');
    try {
      action(user);
      refreshAttendance();
    } catch (attendanceError) {
      setError(attendanceError.message);
    }
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
              <strong>{formatDuration(workedMs)}</strong>
              <span>{state === ATTENDANCE_STATE.ON_BREAK ? 'On break' : state === ATTENDANCE_STATE.CHECKED_OUT ? 'Checked out' : state === ATTENDANCE_STATE.WORKING ? 'Working' : 'Not checked in'}</span>
            </div>

            <div className="attendance-time-grid">
              <div><span>Worked time</span><strong>{formatDuration(workedMs)}</strong></div>
              <div><span>Break time</span><strong>{formatDuration(breakMs)}</strong></div>
              <div><span>Total elapsed</span><strong>{formatDuration(elapsedMs)}</strong></div>
            </div>

            <div className="location-line"><LocateFixed size={17} /><span>{locationText}</span></div>
            {error && <div className="form-alert">{error}</div>}

            <div className="attendance-action-grid">
              {!todayRecord?.checkInAt && <button type="button" className="btn btn-primary" onClick={() => runAction(checkIn)}><LogIn size={18} /> Check In</button>}
              {state === ATTENDANCE_STATE.WORKING && <button type="button" className="btn btn-warning-soft" onClick={() => runAction(startBreak)}><Coffee size={18} /> Start Break</button>}
              {state === ATTENDANCE_STATE.ON_BREAK && <button type="button" className="btn btn-primary" onClick={() => runAction(endBreak)}><Play size={18} /> End Break</button>}
              {state === ATTENDANCE_STATE.WORKING && <button type="button" className="btn btn-danger-soft" onClick={() => runAction(checkOut)}><LogOut size={18} /> Check Out</button>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title attendance-history-title">
              <h2>{canViewAll ? 'Attendance records' : 'My attendance history'}</h2>
              {canViewAll && availableUsers.length > 1 && (
                <select className="compact-select" value={selectedUserId} onChange={(event) => { setSelectedUserId(event.target.value); setPage(1); }}>
                  {availableUsers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Worked</th><th>Break</th><th>Status</th></tr></thead>
                <tbody>{pageItems.map((record) => <tr key={record.id}><td>{record.date}</td><td>{formatClock(record.checkInAt)}</td><td>{formatClock(record.checkOutAt)}</td><td>{formatDuration(record.totalWorkedMs || calculateWorkedMs(record))}</td><td>{formatDuration(record.totalBreakMs || calculateBreakMs(record))}</td><td><span className={`attendance-status status-${statusClass(record.status)}`}>{STATUS_LABELS[record.status] || record.status}</span></td></tr>)}</tbody>
              </table>
              {!scopedRecords.length && <p className="empty-inline">No attendance records yet.</p>}
            </div>
            <Pagination page={page} totalItems={scopedRecords.length} pageSize={pageSize} onPageChange={setPage} />
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

            {canViewAll && availableUsers.length > 1 && <div className="calendar-user-filter"><label>View attendance for</label><select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>{availableUsers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>}


            <div className="attendance-calendar">
              {WEEKDAYS.map((weekday) => <div className="calendar-weekday" key={weekday}>{weekday}</div>)}
              {calendarCells.map((cell, index) => {
                if (!cell) return <div className={`calendar-day empty ${index % 7 === 0 ? 'sunday-column' : ''}`} key={`empty-${index}`} />;
                const dayRecord = recordsByDate.get(cell.key);
                const code = statusCode(dayRecord);
                return <button type="button" key={cell.key} className={`calendar-day ${cell.isSunday ? 'sunday sunday-column' : ''} ${selectedDate === cell.key ? 'selected' : ''} ${dayRecord?.status ? `status-${statusClass(dayRecord.status)} ${recordStatusClass(dayRecord)}` : ''}`} onClick={() => setSelectedDate(cell.key)}><span>{cell.day}</span>{code && <i className={`attendance-marker status-${statusClass(dayRecord.status)} ${recordStatusClass(dayRecord)}`}>{code}</i>}</button>;
              })}
            </div>
            <div className="attendance-legend enhanced"><span><i className="legend-marker present">P</i>Present</span><span><i className="legend-marker absent">A</i>Absent</span><span><i className="legend-marker casual">CL</i>Casual Leave</span><span><i className="legend-marker sick">SL</i>Sick Leave</span><span><i className="legend-marker half">HD</i>Half Day</span><span><i className="legend-marker holiday">H</i>Holiday</span></div>
          </section>

          <aside className="panel selected-attendance-panel">
            <span className="eyebrow">Selected day</span>
            <h2>{selectedDate || 'Choose a date'}</h2>
            {selectedRecord ? <div className="selected-attendance-details"><div><span>Status</span><strong>{STATUS_LABELS[selectedRecord.status] || selectedRecord.status}</strong></div>{selectedRecord.leaveType && <div><span>Leave type</span><strong>{selectedRecord.leaveType} ({leaveCode(selectedRecord.leaveType)})</strong></div>}{selectedRecord.holidayName && <div><span>Holiday</span><strong>{selectedRecord.holidayName}</strong></div>}<div><span>Check in</span><strong>{formatClock(selectedRecord.checkInAt)}</strong></div><div><span>Check out</span><strong>{formatClock(selectedRecord.checkOutAt)}</strong></div><div><span>Worked time</span><strong>{selectedRecord.isVirtual ? '—' : formatDuration(selectedRecord.totalWorkedMs || calculateWorkedMs(selectedRecord))}</strong></div><div><span>Break time</span><strong>{selectedRecord.isVirtual ? '—' : formatDuration(selectedRecord.totalBreakMs || calculateBreakMs(selectedRecord))}</strong></div></div> : <p className="empty-inline">No attendance recorded for this date.</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
