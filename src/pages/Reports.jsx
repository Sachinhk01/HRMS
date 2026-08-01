import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Clock3, CalendarDays, Building2, TrendingUp, TrendingDown,
  CheckCircle2, CalendarOff, Timer, UserCheck, AlertCircle,
  Search, Download, FileText, Printer, BarChart3, PieChart, LineChart, Activity,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { getEmployees } from '../services/employeeService';
import { getAttendanceHistory } from '../services/attendanceService';
import { getSection } from '../services/localStorageService';
import './Reports.css';

function Counter({ value, duration = 0.9 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display}</>;
}

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };

export default function Reports() {
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const leaves = getSection('leaveRequests') || [];

  const [attendanceCount, setAttendanceCount] = useState(0);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  // UI-only filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [desigFilter, setDesigFilter] = useState('ALL');

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
      } catch (error) {
        if (!cancelled) setAttendanceError('Failed to load attendance.');
      } finally {
        if (!cancelled) setLoadingAttendance(false);
      }
    }
    loadAttendance();
    return () => { cancelled = true; };
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.departmentName).filter(Boolean))),
    [employees]
  );
  const designations = useMemo(
    () => Array.from(new Set(employees.map((e) => e.designationName).filter(Boolean))),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    let list = employees;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || String(e.email || '').toLowerCase().includes(q));
    }
    if (deptFilter !== 'ALL') list = list.filter((e) => e.departmentName === deptFilter);
    if (desigFilter !== 'ALL') list = list.filter((e) => e.designationName === desigFilter);
    return list;
  }, [employees, searchQuery, deptFilter, desigFilter]);

  const KPI_CARDS = [
    { icon: Users, label: 'Employees', value: employeesLoading ? null : employees.length, tone: 'blue', trend: '+4.2%', up: true, desc: 'Total accounts' },
    { icon: Clock3, label: 'Attendance', value: loadingAttendance ? null : attendanceCount, tone: 'teal', trend: '+1.8%', up: true, desc: 'Total records' },
    { icon: CalendarDays, label: 'Leaves', value: leaves.length, tone: 'pink', trend: '-0.6%', up: false, desc: 'Total requests' },
    { icon: Building2, label: 'Departments', value: departments.length, tone: 'orange', trend: '+2.0%', up: true, desc: 'Active units' },
    { icon: UserCheck, label: "Today's Attendance", value: loadingAttendance ? null : Math.round(attendanceCount * 0.7), tone: 'green', trend: '+3.1%', up: true, desc: 'Present today' },
    { icon: CheckCircle2, label: 'Present %', value: 92, suffix: '%', tone: 'blue', trend: '+1.4%', up: true, desc: 'Attendance rate' },
    { icon: CalendarOff, label: 'Leave %', value: 8, suffix: '%', tone: 'pink', trend: '-0.3%', up: false, desc: 'On leave today' },
    { icon: Timer, label: 'Avg Working Hours', value: 8.4, tone: 'teal', trend: '+0.2', up: true, desc: 'Per day average' },
    { icon: Activity, label: 'Active Employees', value: employeesLoading ? null : employees.filter((e) => e.active).length, tone: 'green', trend: '+5.0%', up: true, desc: 'Currently active' },
    { icon: AlertCircle, label: 'Late Arrivals', value: 3, tone: 'red', trend: '-1.2%', up: false, desc: 'Today' },
  ];

  return (
    <div className="page-stack reports-page page-reveal">
      <PageHeader eyebrow="HR Analytics" title="Reports" description="Insights across attendance, leave and workforce metrics." />

      {attendanceError && <div className="form-alert">{attendanceError}</div>}

      {/* ---------- KPI cards ---------- */}
      <motion.div className="reports-kpi-grid" initial="hidden" animate="show" variants={stagger}>
        {KPI_CARDS.map((card) => (
          <motion.div key={card.label} className={`reports-kpi-card tone-${card.tone}`} variants={fadeUp} whileHover={{ y: -6 }}>
            <div className="kpi-top">
              <div className="kpi-icon"><card.icon size={20} /></div>
              <span className={`kpi-trend ${card.up ? 'up' : 'down'}`}>
                {card.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {card.trend}
              </span>
            </div>
            <strong className="kpi-value">
              {card.value === null ? '...' : <><Counter value={card.value} />{card.suffix || ''}</>}
            </strong>
            <span className="kpi-label">{card.label}</span>
            <small className="kpi-desc">{card.desc}</small>
            <div className="kpi-sparkline" aria-hidden="true">
              <svg viewBox="0 0 100 28" preserveAspectRatio="none">
                <polyline points="0,22 14,16 28,20 42,10 56,14 70,6 84,12 100,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ---------- Analytics dashboard ---------- */}
      <motion.section className="reports-charts-grid" initial="hidden" animate="show" variants={stagger}>
        <motion.div className="panel chart-card" variants={fadeUp}>
          <div className="chart-head"><BarChart3 size={18} /><h3>Attendance Distribution</h3></div>
          <div className="chart-placeholder bars">
            {[68, 82, 74, 90, 60, 78, 86].map((h, i) => (
              <div className="bar-col" key={i}><motion.div className="bar-fill" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.7, delay: i * 0.06, ease: easeOut }} /><small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</small></div>
            ))}
          </div>
        </motion.div>

        <motion.div className="panel chart-card" variants={fadeUp}>
          <div className="chart-head"><PieChart size={18} /><h3>Department Distribution</h3></div>
          <div className="donut-wrap">
            <svg viewBox="0 0 120 120" className="donut">
              <circle cx="60" cy="60" r="45" fill="none" stroke="#eef2f7" strokeWidth="14" />
              <motion.circle cx="60" cy="60" r="45" fill="none" stroke="#2563eb" strokeWidth="14" strokeLinecap="round" strokeDasharray="282.7" initial={{ strokeDashoffset: 282.7 }} animate={{ strokeDashoffset: 282.7 - 282.7 * 0.32 }} transition={{ duration: 0.9, ease: easeOut }} transform="rotate(-90 60 60)" />
              <motion.circle cx="60" cy="60" r="45" fill="none" stroke="#16a34a" strokeWidth="14" strokeLinecap="round" strokeDasharray="282.7" initial={{ strokeDashoffset: 282.7 }} animate={{ strokeDashoffset: 282.7 - 282.7 * 0.24 }} transition={{ duration: 0.9, delay: 0.1, ease: easeOut }} transform="rotate(24 60 60)" />
              <motion.circle cx="60" cy="60" r="45" fill="none" stroke="#d97706" strokeWidth="14" strokeLinecap="round" strokeDasharray="282.7" initial={{ strokeDashoffset: 282.7 }} animate={{ strokeDashoffset: 282.7 - 282.7 * 0.18 }} transition={{ duration: 0.9, delay: 0.2, ease: easeOut }} transform="rotate(110 60 60)" />
            </svg>
            <div className="donut-legend">
              <span><i style={{ background: '#2563eb' }} /> Engineering</span>
              <span><i style={{ background: '#16a34a' }} /> Sales</span>
              <span><i style={{ background: '#d97706' }} /> HR</span>
            </div>
          </div>
        </motion.div>

        <motion.div className="panel chart-card wide" variants={fadeUp}>
          <div className="chart-head"><LineChart size={18} /><h3>Employee Growth</h3></div>
          <div className="chart-placeholder area">
            <svg viewBox="0 0 300 100" preserveAspectRatio="none">
              <defs><linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
              <motion.path d="M0,80 L50,70 L100,60 L150,45 L200,38 L250,25 L300,18 L300,100 L0,100 Z" fill="url(#growthGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} />
              <motion.path d="M0,80 L50,70 L100,60 L150,45 L200,38 L250,25 L300,18" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: easeOut }} />
            </svg>
          </div>
        </motion.div>

        <motion.div className="panel chart-card" variants={fadeUp}>
          <div className="chart-head"><Activity size={18} /><h3>Leave Breakdown</h3></div>
          <div className="chart-placeholder bars small">
            {[40, 25, 15, 20].map((h, i) => (
              <div className="bar-col" key={i}><motion.div className="bar-fill alt" initial={{ height: 0 }} animate={{ height: `${h * 2}%` }} transition={{ duration: 0.7, delay: i * 0.06, ease: easeOut }} /><small>{['Annual', 'Sick', 'Casual', 'Unpaid'][i]}</small></div>
            ))}
          </div>
        </motion.div>

        <motion.div className="panel chart-card wide" variants={fadeUp}>
          <div className="chart-head"><BarChart3 size={18} /><h3>Monthly Attendance</h3></div>
          <div className="chart-placeholder bars">
            {[72, 80, 68, 88, 75, 82, 90, 78, 85, 70, 92, 86].map((h, i) => (
              <div className="bar-col" key={i}><motion.div className="bar-fill" initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.6, delay: i * 0.04, ease: easeOut }} /><small>{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</small></div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* ---------- Report table ---------- */}
      <motion.section className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}>
        <div className="panel-title">
          <div>
            <span className="eyebrow">Workforce</span>
            <h2>Employee Report</h2>
          </div>
          <div className="panel-title-icon"><Users size={20} /></div>
        </div>

        <div className="reports-toolbar">
          <label className="reports-search">
            <Search size={15} />
            <input type="text" placeholder="Search name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </label>
          <select className="compact-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="ALL">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="compact-select" value={desigFilter} onChange={(e) => setDesigFilter(e.target.value)}>
            <option value="ALL">All designations</option>
            {designations.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="reports-export">
            <button className="btn btn-soft btn-export" title="Export CSV (UI)"><Download size={15} /> CSV</button>
            <button className="btn btn-soft btn-export" title="Export PDF (UI)"><FileText size={15} /> PDF</button>
            <button className="btn btn-soft btn-export" title="Print (UI)"><Printer size={15} /> Print</button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="reports-table">
            <thead><tr><th>Employee</th><th>Department</th><th>Designation</th><th>Email</th><th>Status</th></tr></thead>
            <tbody>
              {employeesLoading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={`rsk-${i}`} className="skeleton-row"><td colSpan={5}><div className="skeleton-bar" /></td></tr>
              ))}
              {!employeesLoading && filteredEmployees.map((x) => (
                <motion.tr key={x.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: easeOut }}>
                  <td>
                    <span className="emp-cell">
                      <span className="emp-avatar">{`${x.firstName || ''} ${x.lastName || ''}`.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <span className="emp-name">{x.firstName} {x.lastName}</span>
                    </span>
                  </td>
                  <td>{x.departmentName ? <span className="dept-badge">{x.departmentName}</span> : '—'}</td>
                  <td>{x.designationName || '—'}</td>
                  <td>{x.email}</td>
                  <td><span className={`status-pill ${x.active ? 'approved' : 'cancelled'}`}>{x.active ? 'Active' : 'Inactive'}</span></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {!employeesLoading && !filteredEmployees.length && (
            <div className="empty-state"><Users size={32} /><p>No employee records.</p><small>Try adjusting your filters.</small></div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
