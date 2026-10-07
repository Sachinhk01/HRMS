import DatePicker from '../components/DatePicker';
import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  Clock3,
  CalendarDays,
  Hourglass,
  BarChart3,
  PieChart,
  Search,
  FolderOpen,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageHeader from '../components/PageHeader';
import ExportMenu from '../components/ExportMenu';
import { useToast } from '../context/ToastContext';
import { getEmployees } from '../services/employeeService';
import { getAttendanceReport } from '../services/attendanceService';
import { getLeaveReport } from '../services/leaveService';
import { capitalizeName } from '../utils/formatName';
import { formatEnum, displayDate, orDash, toExcelSerial } from '../utils/employeeFormat';
import { calculateAttendanceShare } from '../services/reportService';
import { todayISO } from '../utils/dateUtils';
import ReportExplorer from './reports/ReportExplorer';
import AttendanceMix from './reports/AttendanceMix';
import './Reports.css';
import './reports/Reportexplorer.css';
import { INPUT_LIMITS } from '../utils/inputLimits';

function initialsOf(first, last) {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';
}

const LEAVE_STATUS_META = {
  APPROVED: { label: 'Approved', color: '#16a34a' },
  PENDING: { label: 'Pending', color: '#d97706' },
  REJECTED: { label: 'Rejected', color: '#dc2626' },
  CANCELLED: { label: 'Cancelled', color: '#94a3b8' },
};

// The employee directory is exported client-side; one column list keeps both
// formats aligned. Date columns are written as real Excel date cells.
const REPORT_COLUMNS = [
  { header: 'S.No', wch: 6, value: (_employee, index) => index + 1 },
  { header: 'Employee Code', wch: 15, value: (x) => x.employeeCode || '' },
  { header: 'First Name', wch: 16, value: (x) => capitalizeName(x.firstName) },
  { header: 'Last Name', wch: 16, value: (x) => capitalizeName(x.lastName) },
  { header: 'Gender', wch: 9, value: (x) => formatEnum(x.gender) },
  { header: 'Date of Birth', wch: 14, date: true, value: (x) => x.dateOfBirth || '' },
  { header: 'Date of Joining', wch: 15, date: true, value: (x) => x.dateOfJoining || '' },
  { header: 'Employment Type', wch: 17, value: (x) => formatEnum(x.employmentType) },
  { header: 'Department', wch: 16, value: (x) => x.departmentName || '' },
  { header: 'Designation', wch: 22, value: (x) => x.designationName || '' },
  { header: 'Job Title', wch: 22, value: (x) => x.jobTitle || '' },
  { header: 'Reporting Manager', wch: 20, value: (x) => capitalizeName(x.reportingManagerName) },
  { header: 'Email', wch: 32, value: (x) => x.email || '' },
  { header: 'Mobile', wch: 14, value: (x) => x.phoneNumber || '' },
  { header: 'Status', wch: 10, value: (x) => (x.active ? 'Active' : 'Inactive') },
];

const exportStamp = () => new Date().toISOString().slice(0, 10);

function downloadExcel(rows) {
  const aoa = [
    REPORT_COLUMNS.map((column) => column.header),
    ...rows.map((row, index) =>
      REPORT_COLUMNS.map((column) => {
        const value = column.value(row, index);
        if (!column.date) return value;
        const serial = toExcelSerial(value);
        return serial === null ? '' : { t: 'n', v: serial, z: 'dd-mmm-yyyy' };
      }),
    ),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = REPORT_COLUMNS.map((column) => ({ wch: column.wch }));
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: aoa.length - 1, c: REPORT_COLUMNS.length - 1 },
    }),
  };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Directory');
  XLSX.writeFile(workbook, `employee-directory-${exportStamp()}.xlsx`);
}

function downloadPdf(rows) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });
  doc.setFontSize(14);
  doc.text('Employee Directory', 14, 16);
  doc.setFontSize(9);
  doc.text(`${rows.length} employees · generated ${displayDate(exportStamp())}`, 14, 22);
  autoTable(doc, {
    head: [REPORT_COLUMNS.map((column) => column.header)],
    body: rows.map((row, index) =>
      REPORT_COLUMNS.map((column) =>
        column.date ? displayDate(column.value(row, index)) : column.value(row, index),
      ),
    ),
    startY: 27,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`employee-directory-${exportStamp()}.pdf`);
}

async function fetchAllEmployees(pageSize = 100) {
  const employees = [];
  let page = 0;
  while (true) {
    const result = await getEmployees({ page, size: pageSize });
    const content = result?.content || [];
    employees.push(...content);
    if (result?.last !== false || content.length === 0) break;
    page += 1;
  }
  return employees;
}

const TABS = [
  ['overview', 'Overview'],
  ['attendance', 'Attendance Report'],
  ['leave', 'Leave Report'],
];

export default function Reports() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('overview');
  // Overview summaries cover the current month only: the backend builds the summary
  // over the whole filtered set, so an unfiltered (all-time) request is expensive.
  const { month: currentMonth, year: currentYear } = useMemo(() => {
    const today = todayISO();
    return { month: Number(today.slice(5, 7)), year: Number(today.slice(0, 4)) };
  }, []);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  const [leaveSummary, setLeaveSummary] = useState(null);
  const [loadingLeaves, setLoadingLeaves] = useState(true);

  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [missedCheckoutCount, setMissedCheckoutCount] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadEmployees() {
      try {
        const result = await fetchAllEmployees();
        if (!cancelled) setEmployees(result);
      } catch {
        if (!cancelled) {
          setEmployees([]);
          showToast('Failed to load employee directory.', 'error');
        }
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    }
    loadEmployees();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadLeaves() {
      setLoadingLeaves(true);
      try {
        // size: 1 — we only need `summary`, which is computed over the full
        // filtered set regardless of page size, not the row content.
        const result = await getLeaveReport({ size: 1, month: currentMonth, year: currentYear });
        if (!cancelled) setLeaveSummary(result?.summary || null);
      } catch {
        if (!cancelled) {
          setLeaveSummary(null);
          showToast('Failed to load leave report. HR / Manager access is required.', 'error');
        }
      } finally {
        if (!cancelled) setLoadingLeaves(false);
      }
    }
    loadLeaves();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAttendance() {
      setLoadingAttendance(true);
      try {
        const [result, missedResult] = await Promise.all([
          getAttendanceReport({ size: 1, month: currentMonth, year: currentYear }),
          getAttendanceReport({
            size: 1,
            month: currentMonth,
            year: currentYear,
            attendanceStatus: 'MISSED_CHECKOUT',
          }),
        ]);
        if (!cancelled) {
          setAttendanceSummary(result?.summary || null);
          setMissedCheckoutCount(missedResult?.totalElements ?? missedResult?.summary?.totalRecords ?? 0);
        }
      } catch {
        if (!cancelled) {
          setAttendanceSummary(null);
          setMissedCheckoutCount(null);
          showToast('Failed to load attendance report. HR/Manager access is required.', 'error');
        }
      } finally {
        if (!cancelled) setLoadingAttendance(false);
      }
    }
    loadAttendance();
    return () => { cancelled = true; };
  }, []);

  // ---- Derived, real data only — nothing here is fabricated ----

  const departmentOptions = useMemo(() => {
    const names = new Set(employees.map((x) => x.departmentName).filter(Boolean));
    return Array.from(names).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((x) => {
      if (department && x.departmentName !== department) return false;
      if (!term) return true;
      const haystack = [
        x.firstName, x.lastName, x.employeeCode, x.email, x.phoneNumber,
        x.departmentName, x.designationName, x.jobTitle, formatEnum(x.employmentType),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [employees, search, department]);

  const activeCount = useMemo(() => employees.filter((x) => x.active).length, [employees]);
  const activePct = employees.length ? Math.round((activeCount / employees.length) * 100) : 0;

  const departmentCounts = useMemo(() => {
    const counts = {};
    employees.forEach((x) => {
      const key = x.departmentName || 'Unassigned';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [employees]);
  const maxDeptCount = Math.max(1, ...departmentCounts.map(([, count]) => count));

  const leaveStatusCounts = useMemo(() => ({
    APPROVED: leaveSummary?.approvedLeaves || 0,
    PENDING: leaveSummary?.pendingLeaves || 0,
    REJECTED: leaveSummary?.rejectedLeaves || 0,
    CANCELLED: leaveSummary?.cancelledLeaves || 0,
  }), [leaveSummary]);
  const totalLeaves = leaveSummary?.totalLeaves || 0;
  const pendingLeaveCount = leaveSummary?.pendingLeaves || 0;
  const attendanceShare = calculateAttendanceShare(attendanceSummary, missedCheckoutCount);
  const donutGradient = useMemo(() => {
    if (!totalLeaves) return '#eef2f7';
    let acc = 0;
    const segments = Object.entries(leaveStatusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => {
        const start = (acc / totalLeaves) * 360;
        acc += count;
        const end = (acc / totalLeaves) * 360;
        return `${LEAVE_STATUS_META[status].color} ${start}deg ${end}deg`;
      });
    return `conic-gradient(${segments.join(', ')})`;
  }, [leaveStatusCounts, totalLeaves]);

  const kpis = [
    { icon: Users, tone: 'blue', label: 'Employees', value: employeesLoading ? '…' : employees.length, desc: 'Total Accounts' },
    { icon: UserCheck, tone: 'green', label: 'Active Employees', value: employeesLoading ? '…' : activeCount, desc: employeesLoading ? '' : `${activePct}% of Total` },
    {
      icon: Clock3,
      tone: 'teal',
      label: 'Present-Day Share',
      value: loadingAttendance ? '…' : attendanceShare == null ? '—' : `${attendanceShare.toFixed(1)}%`,
      desc: loadingAttendance ? '' : '((Present + Half Days / 2 + Late + Missed Checkouts) / All Rows) × 100',
    },
    { icon: CalendarDays, tone: 'pink', label: 'Leave Requests', value: loadingLeaves ? '…' : totalLeaves, desc: 'This Month' },
    { icon: Hourglass, tone: 'orange', label: 'Pending Approvals', value: loadingLeaves ? '…' : pendingLeaveCount, desc: 'Awaiting Review · This Month' },
  ];

  return (
    <div className="reports-page page-reveal">
      <PageHeader
        eyebrow="HR Analytics"
        title="Reports"
        description="Attendance And Leave Insights For The Current Month, Straight From The Backend."
      />

      <div className="rx-tabs" role="tablist" aria-label="Report sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'attendance' && <ReportExplorer kind="attendance" />}
      {tab === 'leave' && <ReportExplorer kind="leave" />}

      {tab === 'overview' && (<>
      <div className="reports-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`reports-kpi-card tone-${kpi.tone}`}>
            <div className="kpi-top">
              <div className="kpi-icon"><kpi.icon size={19} /></div>
            </div>
            <strong className="kpi-value">{kpi.value}</strong>
            <span className="kpi-label">{kpi.label}</span>
            {kpi.desc && <small className="kpi-desc">{kpi.desc}</small>}
          </div>
        ))}
      </div>

      <div className="reports-charts-grid">
        <div className="panel chart-card wide">
          <div className="chart-head"><BarChart3 size={17} /><h3>Employees by Department</h3></div>
          {departmentCounts.length ? (
            <div className="chart-placeholder bars">
              {departmentCounts.map(([name, count]) => (
                <div className="bar-col" key={name}>
                  <span className="bar-value">{count}</span>
                  <div className="bar-fill" style={{ height: `${(count / maxDeptCount) * 85}%` }} />
                  <small title={name}>{name}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <FolderOpen size={28} />
              <p>No Department Data Yet</p>
            </div>
          )}
        </div>

        <div className="panel chart-card">
          <div className="chart-head"><PieChart size={17} /><h3>Leave Status · This Month</h3></div>
          {totalLeaves ? (
            <div className="donut-wrap">
              <div className="donut" style={{ background: donutGradient }}>
                <div className="donut-hole"><strong>{totalLeaves}</strong><small>Requests</small></div>
              </div>
              <div className="donut-legend">
                {Object.entries(leaveStatusCounts)
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <span key={status}>
                      <i style={{ background: LEAVE_STATUS_META[status].color }} />
                      {LEAVE_STATUS_META[status].label} ({count})
                    </span>
                  ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <CalendarDays size={28} />
              <p>No Leave Requests Yet</p>
            </div>
          )}
        </div>
      </div>

      {attendanceSummary?.totalRecords > 0 && (
        <section className="panel">
          <div className="chart-head"><Clock3 size={17} /><h3>Attendance Mix · This Month</h3></div>
          <AttendanceMix summary={attendanceSummary} />
        </section>
      )}

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Directory (Browser Export)</span>
            <h2>Employee Directory</h2>
          </div>
          <div className="panel-title-icon"><Users size={19} /></div>
        </div>

        <div className="reports-toolbar">
          <div className="reports-search">
            <Search size={16} />
            <input maxLength={INPUT_LIMITS.SEARCH}
              type="text"
              placeholder="Search by name, code, email, mobile or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="compact-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All departments</option>
            {departmentOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="reports-export">
            <ExportMenu
              label="Export"
              disabled={!filteredEmployees.length}
              onExport={(format) => (format === 'excel' ? downloadExcel(filteredEmployees) : downloadPdf(filteredEmployees))}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="reports-table reports-table--wide">
            <thead>
              <tr>
                <th>Code</th><th>Employee</th><th>Gender</th><th>Date of Birth</th><th>Date of Joining</th>
                <th>Employment Type</th><th>Department</th><th>Designation</th><th>Email</th><th>Mobile</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employeesLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr className="skeleton-row" key={i}>
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j}><div className="skeleton-bar" /></td>
                    ))}
                  </tr>
                ))}
              {!employeesLoading &&
                filteredEmployees.map((x) => (
                  <tr key={x.id}>
                    <td className="cell-nowrap">{orDash(x.employeeCode)}</td>
                    <td>
                      <div className="emp-cell">
                        <span className="emp-avatar">{initialsOf(x.firstName, x.lastName)}</span>
                        <span className="emp-name">{capitalizeName(x.firstName)} {capitalizeName(x.lastName)}</span>
                      </div>
                    </td>
                    <td>{orDash(formatEnum(x.gender))}</td>
                    <td className="cell-nowrap">{orDash(displayDate(x.dateOfBirth))}</td>
                    <td className="cell-nowrap">{orDash(displayDate(x.dateOfJoining))}</td>
                    <td className="cell-nowrap">{orDash(formatEnum(x.employmentType))}</td>
                    <td>{x.departmentName ? <span className="dept-badge">{x.departmentName}</span> : '—'}</td>
                    <td>{orDash(x.designationName)}</td>
                    <td>{orDash(x.email)}</td>
                    <td className="cell-nowrap">{orDash(x.phoneNumber)}</td>
                    <td>
                      <span className={`status-pill ${x.active ? 'approved' : 'cancelled'}`}>
                        {x.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!employeesLoading && !filteredEmployees.length && (
            <div className="empty-state">
              <Users size={28} />
              <p>{employees.length ? 'No employees match your filters.' : 'No employee records.'}</p>
              <small>Try Clearing The Search or Department Filter.</small>
            </div>
          )}
        </div>
      </section>
      </>)}
    </div>
  );
}
