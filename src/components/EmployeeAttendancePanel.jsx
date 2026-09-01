import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, TimerOff, TriangleAlert } from 'lucide-react';
import { getEmployeeAttendanceHistory } from '../services/attendanceService';

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

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function displayTime(value) {
  return value || '—';
}

function monthOptionValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Parses the backend's "Xh Ym" working-hours string into minutes.
function parseHoursToMinutes(label) {
  if (!label) return 0;
  const match = String(label).match(/(\d+)h\s*(\d+)m/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutes(mins) {
  if (!mins) return '0h 0m';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Summary stats aren't provided by any backend endpoint for another
// employee — only the raw paginated history is (GET
// /api/v1/admin/attendance/employee/{employeeId}) — so they're derived here
// from that month's rows.
function computeSummary(rows) {
  let present = 0;
  let absent = 0;
  let late = 0;
  let totalMinutes = 0;
  let workedDays = 0;

  rows.forEach((r) => {
    const status = normalizeStatus(r.attendanceStatus);
    if (status === 'PRESENT') present += 1;
    if (status === 'ABSENT') absent += 1;
    if (status === 'LATE') { present += 1; late += 1; }
    const mins = parseHoursToMinutes(r.todayWorkingHours);
    if (mins > 0) { totalMinutes += mins; workedDays += 1; }
  });

  return {
    presentDays: present,
    absentDays: absent,
    lateDays: late,
    averageWorkingHours: workedDays ? formatMinutes(Math.round(totalMinutes / workedDays)) : '—',
  };
}

// Shown inside the Employees "View" drawer's Attendance tab. Fetches a
// single employee's attendance for the selected month via the admin-scoped
// endpoint (Manager/HR_ADMIN/SUPER_ADMIN only — see attendanceService.js).
export default function EmployeeAttendancePanel({ employeeId }) {
  const [monthValue, setMonthValue] = useState(() => monthOptionValue(new Date()));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState('');

  const [year, month] = useMemo(
    () => monthValue.split('-').map(Number),
    [monthValue],
  );

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setLoading(true);
    setErr('');
    setForbidden(false);

    const fromDate = `${monthValue}-01`;
    const toDate = new Date(year, month, 0).toISOString().slice(0, 10);

    getEmployeeAttendanceHistory(employeeId, {
      fromDate,
      toDate,
      size: 100,
      sortBy: 'attendanceDate',
      sortDirection: 'asc',
    })
      .then((historyRes) => {
        if (cancelled) return;
        setRows(historyRes?.content || []);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.response?.status === 403) {
          setForbidden(true);
        } else {
          setErr(error?.response?.data?.message || error?.message || 'Failed to load attendance.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [employeeId, monthValue, month, year]);

  const summary = useMemo(() => computeSummary(rows), [rows]);

  if (forbidden) {
    return (
      <div className="emp-attn-empty">
        <TriangleAlert size={22} />
        <p><strong>You don't have access to this employee's attendance.</strong></p>
      </div>
    );
  }

  return (
    <div className="emp-attn">
      <div className="emp-attn-toolbar">
        <label className="emp-attn-month">
          <CalendarDays size={14} />
          <input
            type="month"
            value={monthValue}
            max={monthOptionValue(new Date())}
            onChange={(e) => setMonthValue(e.target.value)}
          />
        </label>
      </div>

      {err && <div className="emp-attn-error">{err}</div>}

      <div className="emp-attn-summary">
        <div className="emp-attn-stat">
          <CheckCircle2 size={16} />
          <strong>{loading ? '—' : summary.presentDays}</strong>
          <span>Present</span>
        </div>
        <div className="emp-attn-stat">
          <TimerOff size={16} />
          <strong>{loading ? '—' : summary.absentDays}</strong>
          <span>Absent</span>
        </div>
        <div className="emp-attn-stat">
          <Clock3 size={16} />
          <strong>{loading ? '—' : summary.lateDays}</strong>
          <span>Late</span>
        </div>
        <div className="emp-attn-stat">
          <Clock3 size={16} />
          <strong>{loading ? '—' : summary.averageWorkingHours}</strong>
          <span>Avg Hours</span>
        </div>
      </div>

      <div className="emp-attn-table-wrap">
        <table className="emp-attn-table">
          <thead>
            <tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Worked</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={`sk-${i}`}><td colSpan={5}><div className="emp-attn-skeleton" /></td></tr>
            ))}
            {!loading && rows.length === 0 && !err && (
              <tr><td colSpan={5} className="emp-attn-no-rows">No attendance records for this month.</td></tr>
            )}
            {!loading && rows.map((record, i) => (
              <tr key={record.AttendanceId ?? `row-${i}`}>
                <td>{record.attendanceDate}</td>
                <td>{displayTime(record.checkInTime)}</td>
                <td>{displayTime(record.checkOutTime)}</td>
                <td>{record.todayWorkingHours || '—'}</td>
                <td>{STATUS_LABELS[normalizeStatus(record.attendanceStatus)] || record.attendanceStatus || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}