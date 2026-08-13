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
  Download,
  FolderOpen,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { getEmployees } from '../services/employeeService';
import { getAttendanceHistory } from '../services/attendanceService';
import { getAllLeaveRequests } from '../services/leaveService';
import './Reports.css';

function initialsOf(first, last) {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';
}

const LEAVE_STATUS_META = {
  APPROVED: { label: 'Approved', color: '#16a34a' },
  PENDING: { label: 'Pending', color: '#d97706' },
  REJECTED: { label: 'Rejected', color: '#dc2626' },
  CANCELLED: { label: 'Cancelled', color: '#94a3b8' },
};

function downloadCsv(rows) {
  const header = ['Employee Code', 'Name', 'Department', 'Designation', 'Email', 'Status'];
  const lines = rows.map((x) => [
    x.employeeCode || '',
    `${x.firstName || ''} ${x.lastName || ''}`.trim(),
    x.departmentName || '',
    x.designationName || '',
    x.email || '',
    x.active ? 'Active' : 'Inactive',
  ]);
  const csv = [header, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `employee-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [leavesError, setLeavesError] = useState('');

  const [attendanceCount, setAttendanceCount] = useState(0);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadEmployees() {
      try {
        const result = await getEmployees({ size: 100 });
        if (!cancelled) setEmployees(result?.content || []);
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
      setLeavesError('');
      try {
        const result = await getAllLeaveRequests();
        if (!cancelled) setLeaves(Array.isArray(result) ? result : []);
      } catch {
        if (!cancelled) {
          setLeaves([]);
          setLeavesError('Failed to load leave requests.');
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
      setAttendanceError('');
      try {
        const historyData = await getAttendanceHistory();
        if (cancelled) return;

        const records = Array.isArray(historyData)
          ? historyData
          : historyData?.records || historyData?.content || [];
        setAttendanceCount(records.length);
      } catch {
        if (!cancelled) {
          setAttendanceError('Failed to load attendance.');
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
      const haystack = [x.firstName, x.lastName, x.email, x.departmentName, x.designationName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [employees, search, department]);

  const activeCount = useMemo(() => employees.filter((x) => x.active).length, [employees]);
  const activePct = employees.length ? Math.round((activeCount / employees.length) * 100) : 0;
  const pendingLeaveCount = useMemo(
    () => leaves.filter((l) => l.status === 'PENDING').length,
    [leaves]
  );

  const departmentCounts = useMemo(() => {
    const counts = {};
    employees.forEach((x) => {
      const key = x.departmentName || 'Unassigned';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [employees]);
  const maxDeptCount = Math.max(1, ...departmentCounts.map(([, count]) => count));

  const leaveStatusCounts = useMemo(() => {
    const counts = { APPROVED: 0, PENDING: 0, REJECTED: 0, CANCELLED: 0 };
    leaves.forEach((l) => {
      if (counts[l.status] !== undefined) counts[l.status] += 1;
    });
    return counts;
  }, [leaves]);
  const totalLeaves = leaves.length;
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
    { icon: Clock3, tone: 'teal', label: 'Attendance', value: loadingAttendance ? '…' : attendanceCount, desc: 'Total Records' },
    { icon: CalendarDays, tone: 'pink', label: 'Leave requests', value: loadingLeaves ? '…' : totalLeaves, desc: 'All Time' },
    { icon: Hourglass, tone: 'orange', label: 'Pending approvals', value: loadingLeaves ? '…' : pendingLeaveCount, desc: 'Awaiting Review' },
  ];

  return (
    <div className="reports-page page-reveal">
      <PageHeader
        eyebrow="HR Analytics"
        title="Reports"
        description="Live Summaries Pulled From The Backend."
      />

      {attendanceError && <div className="form-alert">{attendanceError}</div>}
      {leavesError && <div className="form-alert">{leavesError}</div>}

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
          <div className="chart-head"><BarChart3 size={17} /><h3>Employees By Department</h3></div>
          {departmentCounts.length ? (
            <div className="chart-placeholder bars">
              {departmentCounts.map(([name, count]) => (
                <div className="bar-col" key={name}>
                  <div className="bar-fill" style={{ height: `${(count / maxDeptCount) * 100}%` }} />
                  <small>{name}</small>
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
          <div className="chart-head"><PieChart size={17} /><h3>Leave Requests By Status</h3></div>
          {totalLeaves ? (
            <div className="donut-wrap">
              <div className="donut" style={{ borderRadius: '50%', background: donutGradient }} />
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

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Directory</span>
            <h2>Employee Directory</h2>
          </div>
          <div className="panel-title-icon"><Users size={19} /></div>
        </div>

        <div className="reports-toolbar">
          <div className="reports-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name, email or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="compact-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All Departments</option>
            {departmentOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="reports-export">
            <button
              type="button"
              className="btn btn-soft btn-export"
              onClick={() => downloadCsv(filteredEmployees)}
              disabled={!filteredEmployees.length}
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="reports-table">
            <thead>
              <tr><th>Employee</th><th>Department</th><th>Designation</th><th>Email</th><th>Status</th></tr>
            </thead>
            <tbody>
              {employeesLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr className="skeleton-row" key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j}><div className="skeleton-bar" /></td>
                    ))}
                  </tr>
                ))}
              {!employeesLoading &&
                filteredEmployees.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <div className="emp-cell">
                        <span className="emp-avatar">{initialsOf(x.firstName, x.lastName)}</span>
                        <span className="emp-name">{x.firstName} {x.lastName}</span>
                      </div>
                    </td>
                    <td>{x.departmentName ? <span className="dept-badge">{x.departmentName}</span> : '—'}</td>
                    <td>{x.designationName || '—'}</td>
                    <td>{x.email}</td>
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
              <p>{employees.length ? 'No employees match your filters.' : 'No Employee Records.'}</p>
              <small>Try Clearing The Search or Department Filter.</small>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}