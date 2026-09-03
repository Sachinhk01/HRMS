import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, CheckCircle2, Clock3, TimerOff, TriangleAlert,
  Search, Download, FileSpreadsheet, Printer, ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PRESENT', label: 'Present' },
  { value: 'LATE', label: 'Late' },
  { value: 'HALF_DAY', label: 'Half Day' },
  { value: 'LEAVE', label: 'Leave' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'WEEKEND', label: 'Weekend' },
  { value: 'MISSED_CHECKOUT', label: 'Missed Checkout' },
];

const STATUS_PILL_CLASS = {
  PRESENT: 'pill-present',
  LATE: 'pill-late',
  ABSENT: 'pill-absent',
  HALF_DAY: 'pill-halfday',
  LEAVE: 'pill-leave',
  HOLIDAY: 'pill-holiday',
  WEEKEND: 'pill-weekend',
  MISSED_CHECKOUT: 'pill-missed',
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

function StatusPill({ status }) {
  const norm = normalizeStatus(status);
  const cls = STATUS_PILL_CLASS[norm] || 'pill-default';
  const label = STATUS_LABELS[norm] || status || '—';
  return <span className={`emp-attn-pill ${cls}`}>{label}</span>;
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
export default function EmployeeAttendancePanel({ employeeId, employeeName }) {
  const [monthValue, setMonthValue] = useState(() => monthOptionValue(new Date()));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const printRef = useRef(null);

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

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter !== 'ALL' && normalizeStatus(row.attendanceStatus) !== statusFilter) return false;
    if (searchDate && !String(row.attendanceDate || '').includes(searchDate.trim())) return false;
    return true;
  }), [rows, searchDate, statusFilter]);

  function buildExportRows() {
    return filteredRows.map((row) => ({
      Date: row.attendanceDate || '—',
      'Check In': displayTime(row.checkInTime),
      'Check Out': displayTime(row.checkOutTime),
      Worked: row.todayWorkingHours || '—',
      Break: row.breakMinutes != null ? formatMinutes(row.breakMinutes) : '0h 0m',
      Status: STATUS_LABELS[normalizeStatus(row.attendanceStatus)] || row.attendanceStatus || '—',
    }));
  }

  function fileLabel() {
    return (employeeName ? employeeName.replace(/\s+/g, '_') : employeeId) || 'employee';
  }

  function handleExportExcel() {
    const worksheet = XLSX.utils.json_to_sheet(buildExportRows());
    worksheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    XLSX.writeFile(workbook, `attendance_${fileLabel()}_${monthValue}.xlsx`);
  }

  function handleExportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Attendance - ${employeeName || employeeId}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Month: ${monthValue}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Check In', 'Check Out', 'Worked', 'Break', 'Status']],
      body: buildExportRows().map((row) => [row.Date, row['Check In'], row['Check Out'], row.Worked, row.Break, row.Status]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`attendance_${fileLabel()}_${monthValue}.pdf`);
  }

  if (forbidden) {
    return (
      <div className="emp-attn-empty">
        <TriangleAlert size={22} />
        <p><strong>You don't have access to this employee's attendance.</strong></p>
      </div>
    );
  }

  return (
    <div className="emp-attn" ref={printRef}>
      <div className="emp-attn-toolbar">
        <label className="emp-attn-search">
          <Search size={14} />
          <input type="text" placeholder="Search by date..." value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
        </label>
        <label className="emp-attn-status-filter">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <label className="emp-attn-month">
          <CalendarDays size={14} />
          <input
            type="month"
            value={monthValue}
            max={monthOptionValue(new Date())}
            onChange={(e) => setMonthValue(e.target.value)}
          />
        </label>
        <div className="emp-attn-actions">
          <button type="button" className="emp-attn-btn" onClick={handleExportExcel} disabled={!filteredRows.length}><FileSpreadsheet size={14} /> Excel</button>
          <button type="button" className="emp-attn-btn" onClick={handleExportPdf} disabled={!filteredRows.length}><Download size={14} /> PDF</button>
          <button type="button" className="emp-attn-btn" onClick={() => window.print()} disabled={!filteredRows.length}><Printer size={14} /> Print</button>
        </div>
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
            <tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Worked</th><th>Break</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={`sk-${i}`}><td colSpan={6}><div className="emp-attn-skeleton" /></td></tr>
            ))}
            {!loading && filteredRows.length === 0 && !err && (
              <tr><td colSpan={6} className="emp-attn-no-rows">No attendance records match this filter.</td></tr>
            )}
            {!loading && filteredRows.map((record, i) => (
              <tr key={record.AttendanceId ?? `row-${i}`}>
                <td>{record.attendanceDate}</td>
                <td>{displayTime(record.checkInTime)}</td>
                <td>{displayTime(record.checkOutTime)}</td>
                <td>{record.todayWorkingHours || '—'}</td>
                <td>{record.breakMinutes != null ? formatMinutes(record.breakMinutes) : '0h 0m'}</td>
                <td><StatusPill status={record.attendanceStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}