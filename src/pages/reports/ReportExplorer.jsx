import { useEffect, useMemo, useState } from 'react';
import {
  Users, UserCheck, UserX, Clock3, CalendarDays, Percent, CheckCircle2, Hourglass,
  XCircle, Ban, Timer, ArrowUp, ArrowDown, ChevronsUpDown, AlertTriangle, Info, RotateCcw,
} from 'lucide-react';
import DatePicker, { MonthPicker } from '../../components/DatePicker';
import ExportMenu from '../../components/ExportMenu';
import AttendanceMix from './AttendanceMix';
import EmployeePicker from './EmployeePicker';
import Pagination from '../../components/Pagination';
import { useToast } from '../../context/ToastContext';
import { daysInMonth, formatDate, makeISO, pad } from '../../utils/dateUtils';
import {
  ATTENDANCE_STATUSES, LEAVE_STATUSES, PAGE_SIZES, EMPTY,
  calculateAttendanceShare, defaultReportFilters, validateReportFilters, fetchReport, downloadReportFile,
  getReportDepartments, getReportEmployees, formatMinutes, timeOfDay, statusLabel,
} from '../../services/reportService';
import './Reportexplorer.css';

const pillClass = (status) => `rx-pill rx-s-${String(status).toLowerCase().replace(/_/g, '-')}`;
const dateOnly = (iso) => (iso ? formatDate(iso.slice(0, 10)) || EMPTY : EMPTY);
const trimName = (name) => (name || '').trim() || EMPTY;

function EmployeeCell({ row }) {
  return (
    <div className="rx-emp">
      <strong>{trimName(row.employeeName)}</strong>
      <small>{row.employeeCode || EMPTY}</small>
    </div>
  );
}

// Columns without `sortField` are NOT sortable: the backend 500s on name / department sorts.
const CONFIG = {
  attendance: {
    title: 'Attendance Report',
    statuses: ATTENDANCE_STATUSES,
    rowKey: (r) => `${r.employeeId}-${r.attendanceDate}`,
    columns: [
      { key: 'emp', label: 'Employee', render: (r) => <EmployeeCell row={r} /> },
      { key: 'dept', label: 'Department', render: (r) => r.departmentName || EMPTY },
      { key: 'date', label: 'Date', sortField: 'attendanceDate', render: (r) => dateOnly(r.attendanceDate) },
      { key: 'in', label: 'Check In', sortField: 'checkInTime', render: (r) => timeOfDay(r.checkInTime) },
      { key: 'out', label: 'Check Out', sortField: 'checkOutTime', render: (r) => timeOfDay(r.checkOutTime) },
      { align: 'right', key: 'work', label: 'Working', sortField: 'workingMinutes', render: (r) => formatMinutes(r.workingMinutes) },
      { align: 'right', key: 'break', label: 'Break', sortField: 'totalBreakMinutes', render: (r) => (r.checkInTime ? formatMinutes(r.breakMinutes) : EMPTY) },
      {
        key: 'status', label: 'Status', sortField: 'attendanceStatus',
        render: (r) => <span className={pillClass(r.attendanceStatus)}>{statusLabel(r.attendanceStatus)}</span>,
      },
    ],
    cards: (s) => [
      { icon: Users, tone: 'blue', label: 'Records', value: s.totalRecords, desc: 'Person-days in range' },
      { icon: UserCheck, tone: 'green', label: 'Present', value: s.presentCount },
      { icon: Clock3, tone: 'orange', label: 'Late', value: s.lateCount },
      { icon: UserX, tone: 'red', label: 'Absent', value: s.absentCount },
      { icon: CalendarDays, tone: 'pink', label: 'On Leave', value: s.leaveCount },
      {
        icon: Percent, tone: 'teal', label: 'Present-Day Share',
        value: s.attendanceShare == null ? '—' : `${s.attendanceShare.toFixed(1)}%`,
        desc: 'Of all person-days',
        hint: '((Present + Half Days / 2 + Late + Missed Checkouts) / All Rows) × 100',
      },
    ],
    note: null,
  },
  leave: {
    title: 'Leave Report',
    statuses: LEAVE_STATUSES,
    rowKey: (r) => r.leaveId,
    columns: [
      { key: 'emp', label: 'Employee', render: (r) => <EmployeeCell row={r} /> },
      { key: 'dept', label: 'Department', render: (r) => r.departmentName || EMPTY },
      { key: 'type', label: 'Leave Type', render: (r) => r.leaveType || EMPTY },
      {
        key: 'status', label: 'Status', sortField: 'status',
        render: (r) => <span className={pillClass(r.leaveStatus)}>{statusLabel(r.leaveStatus)}</span>,
      },
      { key: 'from', label: 'From', sortField: 'startDate', render: (r) => dateOnly(r.startDate) },
      { key: 'to', label: 'To', sortField: 'endDate', render: (r) => dateOnly(r.endDate) },
      { align: 'right', key: 'days', label: 'Days', sortField: 'totalDays', render: (r) => r.totalDays ?? EMPTY },
      { key: 'reason', label: 'Reason', render: (r) => <span className="rx-reason" title={r.reason}>{r.reason || EMPTY}</span> },
      { key: 'req', label: 'Requested', sortField: 'createdAt', render: (r) => dateOnly(r.createdAt) },
    ],
    cards: (s) => [
      { icon: Timer, tone: 'blue', label: 'Requests', value: s.totalLeaves },
      { icon: CheckCircle2, tone: 'green', label: 'Approved', value: s.approvedLeaves },
      { icon: Hourglass, tone: 'orange', label: 'Pending', value: s.pendingLeaves },
      { icon: XCircle, tone: 'red', label: 'Rejected', value: s.rejectedLeaves },
      { icon: Ban, tone: 'teal', label: 'Cancelled', value: s.cancelledLeaves },
      // Includes pending / rejected / cancelled, so it is "requested", not "taken".
      { icon: CalendarDays, tone: 'pink', label: 'Days Requested', value: s.totalLeaveDays, desc: 'All statuses' },
      { icon: Percent, tone: 'blue', label: 'Avg Days / Request', value: Number(s.averageLeaveDays || 0).toFixed(1) },
      { icon: Users, tone: 'green', label: 'Employees', value: s.uniqueEmployees, desc: 'With a request in range' },
    ],
    note: 'Only leave requests that start and end inside the selected period are listed. A leave that begins before, or ends after, the period will not appear.',
  },
};

export default function ReportExplorer({ kind }) {
  const cfg = CONFIG[kind];
  const { showToast } = useToast();

  const [filters, setFilters] = useState(() => defaultReportFilters(kind));
  const [data, setData] = useState(null);
  const [missedCheckoutCount, setMissedCheckoutCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const validation = validateReportFilters(filters);

  // Lookups (departments + employee picker) — failures just leave the dropdowns empty.
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getReportDepartments(), getReportEmployees()]).then(([d, e]) => {
      if (cancelled) return;
      setDepartments(d.status === 'fulfilled' ? d.value || [] : []);
      setEmployees(e.status === 'fulfilled' ? e.value || [] : []);
    });
    return () => { cancelled = true; };
  }, []);

  // One request per filter change. Invalid filters never reach the backend.
  useEffect(() => {
    if (validation) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      fetchReport(kind, filters),
      kind === 'attendance'
        ? fetchReport(kind, { ...filters, status: 'MISSED_CHECKOUT', page: 0, size: 1 })
        : Promise.resolve(null),
    ])
      .then(([res, missedResult]) => {
        if (cancelled) return;
        setData(res);
        setMissedCheckoutCount(
          kind === 'attendance'
            ? missedResult?.totalElements ?? missedResult?.summary?.totalRecords ?? 0
            : null
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setMissedCheckoutCount(null);
        setError(err.message || 'Unable to load the report.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, filters, validation, reloadKey]);

  // Any filter change goes back to the first page.
  const change = (patch) => setFilters((f) => ({ ...f, ...patch, page: 0 }));

  function switchPeriodMode(mode) {
    if (mode === filters.periodMode) return;
    if (mode === 'range' && (!filters.startDate || !filters.endDate) && filters.month && filters.year) {
      change({
        periodMode: 'range',
        startDate: makeISO(filters.year, filters.month - 1, 1),
        endDate: makeISO(filters.year, filters.month - 1, daysInMonth(filters.year, filters.month - 1)),
      });
    } else {
      change({ periodMode: mode });
    }
  }

  function onMonthChange(value) {
    const match = /^(\d{4})-(\d{2})$/.exec(value || '');
    if (!match) return change({ month: '', year: '' });
    return change({ year: Number(match[1]), month: Number(match[2]) });
  }

  function sortBy(field) {
    setFilters((f) => (f.sortBy === field
      ? { ...f, sortDir: f.sortDir === 'ASC' ? 'DESC' : 'ASC', page: 0 }
      : { ...f, sortBy: field, sortDir: 'ASC', page: 0 }));
  }

  async function handleExport(format) {
    if (validation) { showToast(validation, 'error'); return; }
    try {
      const name = await downloadReportFile(kind, filters, format);
      showToast(`${name} downloaded.`, 'success');
    } catch (err) {
      showToast(err.message || 'Export failed.', 'error');
    }
  }

  const rows = data?.content || [];
  const attendanceShare = kind === 'attendance'
    ? calculateAttendanceShare(data?.summary, missedCheckoutCount)
    : null;
  const cards = kind === 'attendance'
    ? cfg.cards({
      ...data?.summary,
      attendanceShare,
    })
    : cfg.cards(data?.summary || {});
  const showLoading = loading && !validation;
  const monthValue = filters.month && filters.year ? `${filters.year}-${pad(filters.month)}` : '';
  const defaults = useMemo(() => defaultReportFilters(kind), [kind]);
  const isDirty = ['departmentId', 'employeeId', 'status', 'periodMode', 'month', 'year', 'startDate', 'endDate']
    .some((key) => String(filters[key]) !== String(defaults[key]));

  function resetFilters() {
    setFilters({ ...defaults, size: filters.size, sortBy: filters.sortBy, sortDir: filters.sortDir });
  }

  return (
    <div className="rx-wrap">
      <section className="panel rx-panel">
        <div className="rx-filter-grid">
          <label className="rx-field">
            <span>Department</span>
            <select className="compact-select" value={filters.departmentId} onChange={(e) => change({ departmentId: e.target.value })}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>

          <label className="rx-field">
            <span>Status</span>
            <select className="compact-select" value={filters.status} onChange={(e) => change({ status: e.target.value })}>
              <option value="">All statuses</option>
              {cfg.statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </label>

          <div className="rx-field rx-field-wide">
            <span>Employee</span>
            <EmployeePicker
              employees={employees}
              value={filters.employeeId}
              onChange={(id) => change({ employeeId: id })}
            />
          </div>
        </div>

        <div className="rx-filter-bar">
          <div className="rx-field rx-field-inline">
            <span>Period</span>
            <div className="rx-period">
              <div className="rx-toggle" role="group" aria-label="Period type">
                <button type="button" className={filters.periodMode === 'month' ? 'active' : ''} onClick={() => switchPeriodMode('month')}>Month</button>
                <button type="button" className={filters.periodMode === 'range' ? 'active' : ''} onClick={() => switchPeriodMode('range')}>Custom range</button>
              </div>
              {filters.periodMode === 'month' ? (
                <div className="rx-picker"><MonthPicker value={monthValue} min="2000-01" max="2100-12" onChange={(e) => onMonthChange(e.target.value)} /></div>
              ) : (
                <div className="rx-range">
                  <div className="rx-picker"><DatePicker value={filters.startDate} max={filters.endDate || undefined} onChange={(e) => change({ startDate: e.target.value })} /></div>
                  <span>to</span>
                  <div className="rx-picker"><DatePicker value={filters.endDate} min={filters.startDate || undefined} onChange={(e) => change({ endDate: e.target.value })} /></div>
                </div>
              )}
            </div>
          </div>

          <div className="rx-actions">
            {isDirty && (
              <button type="button" className="rx-reset" onClick={resetFilters}><RotateCcw size={14} />Reset</button>
            )}
            <ExportMenu label="Export" disabled={Boolean(validation) || showLoading || !data?.totalElements} onExport={handleExport} />
          </div>
        </div>

        {validation && <div className="rx-alert rx-alert-warn"><AlertTriangle size={15} />{validation}</div>}
        {cfg.note && <div className="rx-alert rx-alert-info"><Info size={15} />{cfg.note}</div>}
      </section>

      {!validation && data?.summary && (
        <section className="panel rx-panel rx-stats-panel">
          <div className="rx-stats" data-count={cards.length}>
            {cards.map((card) => (
              <div key={card.label} className={`rx-stat tone-${card.tone}`} title={card.hint}>
                <div className="kpi-icon"><card.icon size={17} /></div>
                <div className="rx-stat-text">
                  <strong>{card.value ?? 0}</strong>
                  <span>{card.label}</span>
                  {card.desc && <small>{card.desc}</small>}
                </div>
              </div>
            ))}
          </div>
          {kind === 'attendance' && <AttendanceMix summary={data.summary} />}
        </section>
      )}

      <section className="panel rx-panel">
        <div className="rx-table-head">
          <div>
            <span className="eyebrow">{kind === 'attendance' ? 'One row per person-day' : 'One row per leave request'}</span>
            <h2>{cfg.title}</h2>
          </div>
          <div className="rx-table-meta">
            <label className="rx-size">
              <span>Rows</span>
              <select className="compact-select" value={filters.size} onChange={(e) => change({ size: Number(e.target.value) })}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>

        {error && !validation && (
          <div className="rx-alert rx-alert-error">
            <AlertTriangle size={15} />{error}
            <button type="button" className="rx-retry" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
          </div>
        )}

        <div className="rx-table-wrap">
          <table className="rx-table">
            <thead>
              <tr>
                {cfg.columns.map((col) => (
                  <th key={col.key} className={col.align ? `rx-${col.align}` : ''}>
                    {col.sortField ? (
                      <button type="button" className="rx-sort" onClick={() => sortBy(col.sortField)}>
                        {col.label}
                        {filters.sortBy === col.sortField
                          ? (filters.sortDir === 'ASC' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)
                          : <ChevronsUpDown size={13} className="rx-sort-idle" />}
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr className="rx-skeleton" key={i}>
                  {cfg.columns.map((col) => <td key={col.key}><div className="skeleton-bar" /></td>)}
                </tr>
              ))}
              {!showLoading && !validation && rows.map((row) => (
                <tr key={cfg.rowKey(row)}>
                  {cfg.columns.map((col) => <td key={col.key} className={col.align ? `rx-${col.align}` : ''}>{col.render(row)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {!showLoading && !validation && !error && rows.length === 0 && (
            <div className="rx-empty">
              <Users size={28} />
              <p>No records match these filters.</p>
              <small>Try a different period, department or status.</small>
            </div>
          )}
        </div>

        {!validation && data && (
          <Pagination
            page={(data.page ?? 0) + 1}
            totalItems={data.totalElements || 0}
            pageSize={data.size || filters.size}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: Math.max(0, p - 1) }))}
          />
        )}
      </section>
    </div>
  );
}