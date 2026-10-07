import DatePicker from '../components/DatePicker';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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
import './ReportsRedesign.css';
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

// There's no backend report endpoint for the employee directory (only
// /reports/attendance and /reports/leave exist), so PDF/Excel are built
// client-side from the employee rows already loaded for the table — no new
// or changed API calls involved.
//
// One column list drives BOTH the Excel and PDF export, so they never drift.
//   header : column title
//   wch    : Excel column width
//   value  : (employee, rowIndex) => cell value
//   date   : true -> written to Excel as a real date cell (sortable/filterable)
const REPORT_COLUMNS = [
  { header: 'S.No', wch: 6, value: (x, i) => i + 1 },
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

const EXPORT_STAMP = () => new Date().toISOString().slice(0, 10);

function downloadExcel(rows) {
  const aoa = [
    REPORT_COLUMNS.map((c) => c.header),
    ...rows.map((row, i) =>
      REPORT_COLUMNS.map((c) => {
        const v = c.value(row, i);
        if (c.date) {
          const serial = toExcelSerial(v);
          // Real Excel date (shown as 15-Aug-2024); blank when the employee has no date.
          return serial === null ? '' : { t: 'n', v: serial, z: 'dd-mmm-yyyy' };
        }
        return v;
      }),
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = REPORT_COLUMNS.map((c) => ({ wch: c.wch }));
  // Filter arrows on the header row so HR can sort/filter inside Excel.
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: REPORT_COLUMNS.length - 1 } }),
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Directory');
  XLSX.writeFile(workbook, `employee-directory-${EXPORT_STAMP()}.xlsx`);
}

function downloadPdf(rows) {
  // 15 columns need real width: A3 landscape + small type keeps it readable.
  const doc = new jsPDF({ orientation: 'landscape', format: 'a3' });
  doc.setFontSize(14);
  doc.text('Employee Directory', 14, 16);
  doc.setFontSize(9);
  doc.text(`${rows.length} employees · generated ${displayDate(EXPORT_STAMP())}`, 14, 22);
  autoTable(doc, {
    head: [REPORT_COLUMNS.map((c) => c.header)],
    body: rows.map((row, i) =>
      REPORT_COLUMNS.map((c) => (c.date ? displayDate(c.value(row, i)) : c.value(row, i))),
    ),
    startY: 27,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`employee-directory-${EXPORT_STAMP()}.pdf`);
}

// The directory endpoint is paged, so walk every page. The old code read only
// the first 100 employees, which silently truncated both the table and the export.
async function fetchAllEmployees(pageSize = 100, maxPages = 50) {
  const all = [];
  for (let page = 0; page < maxPages; page += 1) {
    const res = await getEmployees({ page, size: pageSize });
    const content = res?.content || [];
    all.push(...content);
    if (res?.last !== false || content.length === 0) break;
  }
  return all;
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
        const list = await fetchAllEmployees();
        if (!cancelled) setEmployees(list);
      } catch {
        if (!cancelled) setEmployees([]);
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

  const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
  const shareValue = attendanceShare == null ? null : Math.max(0, Math.min(100, attendanceShare));

  const kpis = [
    { icon: Users, tone: 'blue', label: 'Employees', loading: employeesLoading, value: employees.length, desc: 'Total accounts' },
    {
      icon: UserCheck, tone: 'green', label: 'Active employees', loading: employeesLoading,
      value: activeCount, desc: `${activePct}% of total`, progress: activePct,
    },
    {
      icon: Clock3, tone: 'teal', label: 'Present-day share', loading: loadingAttendance,
      value: shareValue == null ? '—' : `${shareValue.toFixed(1)}%`, desc: 'This month',
      progress: shareValue, hint: '((Present + Half Days / 2 + Late + Missed Checkouts) / All Rows) × 100',
    },
    { icon: CalendarDays, tone: 'pink', label: 'Leave requests', loading: loadingLeaves, value: totalLeaves, desc: 'This month' },
    { icon: Hourglass, tone: 'orange', label: 'Pending approvals', loading: loadingLeaves, value: pendingLeaveCount, desc: 'Awaiting review' },
  ];

  // Quick numbers shown in the hero banner (same real data as the cards below).
  const heroStats = [
    { icon: Users, label: 'Employees', loading: employeesLoading, value: employees.length },
    { icon: UserCheck, label: 'Active', loading: employeesLoading, value: activeCount },
    { icon: Hourglass, label: 'Pending leave', loading: loadingLeaves, value: pendingLeaveCount },
  ];

  return (
    <div className="reports-page page-reveal">
      <motion.section
        className="reports-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="reports-hero-text">
          <span className="eyebrow">HR analytics</span>
          <h1>Workforce reports</h1>
          <p>Attendance and leave for the current month, plus your full employee directory.</p>
          <div className="reports-hero-stats">
            {heroStats.map((stat) => (
              <div className="reports-hero-stat" key={stat.label}>
                <span className="reports-hero-stat-icon"><stat.icon size={16} /></span>
                <div>
                  {stat.loading ? <span className="rd-skel rd-skel--hero" /> : <strong>{stat.value}</strong>}
                  <small>{stat.label}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="reports-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="rhCard" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#eef4ff" />
              </linearGradient>
              <linearGradient id="rhBar" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#93c5fd" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
            </defs>

            <circle cx="262" cy="46" r="52" fill="#dbeafe" opacity="0.55" />
            <circle cx="56" cy="160" r="38" fill="#c7d7fe" opacity="0.45" />
            <circle cx="40" cy="64" r="4" fill="#60a5fa" />
            <circle cx="292" cy="132" r="4" fill="#a5b4fc" />

            <rect x="84" y="30" width="172" height="130" rx="16" fill="url(#rhCard)" stroke="#dbe7fb" strokeWidth="2" />
            <rect x="100" y="46" width="56" height="7" rx="3.5" fill="#bfdbfe" />
            <rect x="100" y="59" width="36" height="5" rx="2.5" fill="#e2e8f0" />

            <path d="M100 138 H178" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
            <g>
              <rect className="rh-bar" style={{ '--i': 0 }} x="102" y="112" width="13" height="26" rx="4" fill="url(#rhBar)" />
              <rect className="rh-bar" style={{ '--i': 1 }} x="122" y="96" width="13" height="42" rx="4" fill="url(#rhBar)" />
              <rect className="rh-bar" style={{ '--i': 2 }} x="142" y="106" width="13" height="32" rx="4" fill="url(#rhBar)" />
              <rect className="rh-bar" style={{ '--i': 3 }} x="162" y="82" width="13" height="56" rx="4" fill="#2563eb" />
            </g>

            <circle cx="216" cy="98" r="24" stroke="#e2e8f0" strokeWidth="9" />
            <circle
              className="rh-ring"
              cx="216" cy="98" r="24"
              stroke="#2563eb" strokeWidth="9" strokeLinecap="round"
              strokeDasharray="105 151" transform="rotate(-90 216 98)"
            />
            <rect x="198" y="132" width="36" height="5" rx="2.5" fill="#e2e8f0" />

            <g className="rh-badge">
              <circle cx="250" cy="152" r="16" fill="#22c55e" stroke="#fff" strokeWidth="3" />
              <path d="M243 152 l5 5 l9 -10" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
        </div>
      </motion.section>

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
      <div className="rd-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`rd-kpi tone-${kpi.tone}`} title={kpi.hint}>
            <div className="rd-kpi-icon"><kpi.icon size={19} /></div>
            <div className="rd-kpi-body">
              <span className="rd-kpi-label">{kpi.label}</span>
              {kpi.loading ? <span className="rd-skel rd-skel--value" /> : <strong className="rd-kpi-value">{kpi.value}</strong>}
              {!kpi.loading && kpi.desc && <small className="rd-kpi-desc">{kpi.desc}</small>}
            </div>
            {!kpi.loading && kpi.progress != null && (
              <div className="rd-kpi-meter" role="img" aria-label={`${Math.round(kpi.progress)} percent`}>
                <span style={{ width: `${kpi.progress}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rd-charts-grid">
        <section className="rd-card rd-card--wide">
          <div className="rd-card-head">
            <span className="rd-card-icon"><BarChart3 size={17} /></span>
            <div>
              <h3>Employees by department</h3>
              <small>{employeesLoading ? 'Loading…' : `${employees.length} employees across ${departmentCounts.length} ${departmentCounts.length === 1 ? 'department' : 'departments'}`}</small>
            </div>
          </div>
          {employeesLoading ? (
            <div className="rd-dept-list">
              {[0, 1, 2].map((i) => <div key={i} className="rd-skel rd-skel--row" />)}
            </div>
          ) : departmentCounts.length ? (
            <div className="rd-dept-list">
              {departmentCounts.map(([name, count], i) => (
                <div className="rd-dept-row" key={name}>
                  <div className="rd-dept-meta">
                    <span className="rd-dept-name" title={name}>{name}</span>
                    <span className="rd-dept-num"><strong>{count}</strong><em>{pct(count, employees.length)}%</em></span>
                  </div>
                  <div className="rd-dept-track">
                    <span className="rd-dept-fill" style={{ width: `${(count / maxDeptCount) * 100}%`, '--i': i }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <FolderOpen size={28} />
              <p>No department data yet</p>
            </div>
          )}
        </section>

        <section className="rd-card">
          <div className="rd-card-head">
            <span className="rd-card-icon"><PieChart size={17} /></span>
            <div>
              <h3>Leave status</h3>
              <small>This month</small>
            </div>
          </div>
          {loadingLeaves ? (
            <div className="rd-skel rd-skel--donut" />
          ) : totalLeaves ? (
            <div className="rd-donut-wrap">
              <div className="rd-donut" style={{ background: donutGradient }}>
                <div className="rd-donut-hole"><strong>{totalLeaves}</strong><small>Requests</small></div>
              </div>
              <ul className="rd-legend">
                {Object.entries(leaveStatusCounts)
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <li key={status}>
                      <i style={{ background: LEAVE_STATUS_META[status].color }} />
                      <span>{LEAVE_STATUS_META[status].label}</span>
                      <strong>{count}</strong>
                      <em>{pct(count, totalLeaves)}%</em>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <div className="empty-state">
              <CalendarDays size={28} />
              <p>No leave requests this month</p>
            </div>
          )}
        </section>
      </div>

      {attendanceSummary?.totalRecords > 0 && (
        <section className="rd-card">
          <div className="rd-card-head">
            <span className="rd-card-icon"><Clock3 size={17} /></span>
            <div>
              <h3>Attendance mix</h3>
              <small>{attendanceSummary.totalRecords} person-days this month</small>
            </div>
          </div>
          <AttendanceMix summary={attendanceSummary} />
        </section>
      )}

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">
              {employeesLoading ? 'Loading…' : `${filteredEmployees.length} of ${employees.length} employees`}
            </span>
            <h2>Employee directory</h2>
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
                    <td className="cell-nowrap">{orDash(x.designationName)}</td>
                    <td className="cell-nowrap">{orDash(x.email)}</td>
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
              <p>{employees.length ? 'No employees match your filters.' : 'No employee records yet.'}</p>
              <small>Try clearing the search or the department filter.</small>
            </div>
          )}
        </div>
      </section>
      </>)}
    </div>
  );
}