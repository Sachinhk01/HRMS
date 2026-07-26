import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  PartyPopper,
  Users,
  ClipboardCheck,
  Megaphone,
  CalendarRange,
  UserRound,
  Clock3,
  Award,
  Save,
  FileText,
  Wallet,
  Timer,
  Target,
} from "lucide-react";
import SummaryCard from '../components/SummaryCard';
import { useAuth } from '../context/AuthContext';
import { getEmployees } from '../services/employeeService';
import { getAttendanceDashboard, getAttendanceHistory } from '../services/attendanceService';
import { getMyLeaveBalances, getTeamLeaveRequests } from '../services/leaveService';
import { announcementStore, eventStore, postStore } from '../services/contentService';
import { getEmployeeOfMonth, getMonthlyMagazine, saveEmployeeOfMonth, saveMonthlyMagazine } from '../services/dashboardContentService';
import { getUpcomingHolidays } from '../services/holidayService';
import welcomePersonImg from '../assets/illustrations/welcome-person.png';
import calendarAttendanceImg from '../assets/illustrations/calendar-attendance.png';
import calendarLeaveImg from '../assets/illustrations/calendar-leave.png';
import celebrationCakeImg from '../assets/illustrations/celebration-cake.png';
import celebrationGroupImg from '../assets/illustrations/celebration-group.png';
import './Dashboard.css';

const actionImages = {
  'Attendance': calendarAttendanceImg,
  'Apply Leave': calendarLeaveImg,
  'My Leave': calendarLeaveImg,
  'Leave Approvals': calendarLeaveImg,
  'Celebration Wall': celebrationCakeImg,
  'Events': celebrationGroupImg,
};

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const role = user.role;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  }, []);

  const [magazine, setMagazine] = useState(getMonthlyMagazine());
  const [employeeOfMonth, setEmployeeOfMonth] = useState(getEmployeeOfMonth());
  const [message, setMessage] = useState('');
  const [employees, setEmployees] = useState([]);
const [employeesLoading, setEmployeesLoading] = useState(true);

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
  const [upcomingHoliday, setUpcomingHoliday] = useState(null);

useEffect(() => {
  let cancelled = false;
  getUpcomingHolidays()
    .then((list) => { if (!cancelled) setUpcomingHoliday((list || [])[0] || null); })
    .catch(() => { if (!cancelled) setUpcomingHoliday(null); });
  return () => { cancelled = true; };
}, []);

  // ---- Attendance state ----
  const [attendanceDashboard, setAttendanceDashboard] = useState(null);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  // ---- NEW: Leave state (replaces getLeaveSummary / getPendingApprovals) ----
  const [leaveSummary, setLeaveSummary] = useState({ left: 0, taken: 0 });
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveError, setLeaveError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadAttendance() {
      setAttendanceLoading(true);
      setAttendanceError('');
      try {
        const [dashboardData, historyData] = await Promise.all([
          getAttendanceDashboard(),
          getAttendanceHistory(),
        ]);

        if (cancelled) return;

        setAttendanceDashboard(dashboardData);

        const records = Array.isArray(historyData)
          ? historyData
          : historyData?.records || historyData?.content || [];
        setAttendanceCount(records.length);
      } catch (error) {
        if (!cancelled) {
          setAttendanceError(error?.response?.data?.message || 'Failed to load attendance data.');
        }
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    }

    loadAttendance();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLeave() {
      setLeaveLoading(true);
      setLeaveError('');
      try {
        // My own leave balance (used by EMPLOYEE and MANAGER cards)
        const balances = await getMyLeaveBalances();
        if (cancelled) return;

        const taken = (balances || []).reduce((sum, b) => sum + (b.usedLeaves || 0), 0);
        const left = (balances || []).reduce((sum, b) => sum + (b.remainingLeaves || 0), 0);
        setLeaveSummary({ left, taken });

        // Pending team approvals (only relevant for MANAGER role)
        if (role === 'MANAGER') {
          const teamRequests = await getTeamLeaveRequests();
          if (cancelled) return;
          const pending = (teamRequests || []).filter((r) => r.status === 'PENDING');
          setPendingApprovalsCount(pending.length);
        }
      } catch (error) {
        if (!cancelled) {
          setLeaveError(error?.response?.data?.message || 'Failed to load leave data.');
        }
      } finally {
        if (!cancelled) setLeaveLoading(false);
      }
    }

    loadLeave();
    return () => { cancelled = true; };
  }, [role]);

  const isCheckedInToday = Boolean(
    attendanceDashboard?.checkInAt ||
    attendanceDashboard?.checkInTime ||
    attendanceDashboard?.todayCheckInAt ||
    attendanceDashboard?.currentStatus === 'WORKING' ||
    attendanceDashboard?.currentStatus === 'ON_BREAK'
  );

  let cards = [];
  let links = [];
  if (role === 'EMPLOYEE') {
    cards = [
      [Clock3, 'Attendance', attendanceLoading ? '...' : (isCheckedInToday ? 'Marked' : 'Not marked'), 'Today', 'green', '/attendance'],
      [CalendarDays, 'Leaves left', leaveLoading ? '...' : leaveSummary.left, `${leaveLoading ? '...' : leaveSummary.taken} days taken`, 'pink', '/leave'],
      [PartyPopper, 'Celebrations', postStore.all().length, 'Published posts', 'orange', '/celebrations'],
      [UserRound, 'Profile', 'Update', 'Personal details', 'teal', '/profile'],
    ];
    links = [
      { label: "Attendance", path: "/attendance", icon: Clock3 },
      { label: "Apply Leave", path: "/leave", icon: CalendarDays },
      { label: "Celebration Wall", path: "/celebrations", icon: PartyPopper },
      { label: "Profile", path: "/profile", icon: UserRound },
    ];
  } else if (role === 'HR_ADMIN') {
    cards = [
      [Users, 'Employees', employees.length, 'Total users', 'green', '/employees'],
      [Clock3, 'Attendance', attendanceLoading ? '...' : attendanceCount, 'Records', 'teal', '/attendance'],
      [Megaphone, 'Announcements', announcementStore.all().length, 'Published', 'orange', '/announcements'],
      [CalendarRange, 'Events', eventStore.all().length, 'Created', 'pink', '/events'],
    ];
    links = [
      { label: "Employees", path: "/employees", icon: Users },
      { label: "My Leave", path: "/leave", icon: CalendarDays },
      { label: "Celebration Wall", path: "/celebrations", icon: PartyPopper },
      { label: "Announcements", path: "/announcements", icon: Megaphone },
      { label: "Events", path: "/events", icon: CalendarRange },
      { label: "Reports", path: "/reports", icon: BookOpen },
    ];
  } else {
    cards = [
      [ClipboardCheck, 'Pending leave', leaveLoading ? '...' : pendingApprovalsCount, 'Awaiting decision', 'pink', '/leave-approvals'],
      [CalendarDays, 'My leaves left', leaveLoading ? '...' : leaveSummary.left, `${leaveLoading ? '...' : leaveSummary.taken} days taken`, 'blue', '/leave'],
      [Clock3, 'Attendance', attendanceLoading ? '...' : attendanceCount, 'Team records', 'green', '/attendance'],
      [Target, 'Performance', 'Review', 'Team goals', 'orange', '/performance'],
    ];
    links = [
      { label: "My Leave", path: "/leave", icon: CalendarDays },
      { label: "Leave Approvals", path: "/leave-approvals", icon: ClipboardCheck },
      { label: "Attendance", path: "/attendance", icon: Clock3 },
      { label: "Performance", path: "/performance", icon: Award },
      { label: "Employees", path: "/employees", icon: Users },
    ];
  }

  function updateMagazine(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const next = saveMonthlyMagazine(user, Object.fromEntries(form.entries()));
      setMagazine(next);
      setMessage('Monthly magazine updated.');
    } catch (error) { setMessage(error.message); }
  }

  function updateEmployeeOfMonth(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = employees.find((item) => item.id === form.get('employeeId'));
    try {
      const next = saveEmployeeOfMonth(user, {
        ...Object.fromEntries(form.entries()),
        employeeName: selected?.name || form.get('employeeName'),
        designation: selected?.designation || '',
        department: selected?.department || '',
      });
      setEmployeeOfMonth(next);
      setMessage('Employee of the Month updated.');
    } catch (error) { setMessage(error.message); }
  }

  return (
    <div className="page-stack dashboard-page page-reveal">
      <section className="welcome-banner">
        <div className="welcome-banner-text">
          <span className="eyebrow">{greeting}</span>
          <h1>Welcome back, {user.name?.split(' ')[0]}!</h1>
          <p>{role === 'EMPLOYEE' ? "Let's make today productive." : role === 'HR_ADMIN' ? 'Manage people, engagement and HR operations.' : 'Review team attendance, leave and performance.'}</p>
        </div>
        <div className="welcome-banner-illustration">
          <img src={welcomePersonImg} alt="Person working on laptop" />
        </div>
      </section>

      {attendanceError && <div className="form-alert">{attendanceError}</div>}
      {leaveError && <div className="form-alert">{leaveError}</div>}

      <div className="summary-grid">{cards.map(([Icon, label, value, meta, tone, path]) => <SummaryCard key={label} icon={Icon} label={label} value={value} meta={meta} tone={tone} onClick={() => nav(path)} />)}</div>

      <section className="panel dashboard-holiday-banner" onClick={() => nav('/holidays')} role="button" tabIndex={0}>
        <div className="feature-icon"><CalendarDays size={24} /></div>
        <div>
          <span className="eyebrow">Upcoming Holiday</span>
          {upcomingHoliday ? <><h2>{upcomingHoliday.name}</h2><p>{new Date(`${upcomingHoliday.date}T00:00:00`).toLocaleDateString([], { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p></> : <><h2>No upcoming holiday</h2><p>HR or Manager can add holidays from the Holiday List.</p></>}
        </div>
        <button type="button" className="btn btn-small btn-primary">View Holiday List</button>
      </section>

      <div className="dashboard-feature-grid">
        <section className="panel magazine-card">
          <div className="feature-icon"><BookOpen size={25} /></div>
          <div className="feature-copy"><span className="eyebrow">Monthly Magazine</span><h2>{magazine?.title || 'No magazine published yet'}</h2><p>{magazine?.description || 'HR or Manager can publish the company magazine here for everyone.'}</p>{magazine?.month && <small>{magazine.month}</small>}{magazine?.documentUrl && <a className="btn btn-small btn-primary" href={magazine.documentUrl} target="_blank" rel="noreferrer">Open magazine</a>}</div>
          {magazine?.coverUrl && <img src={magazine.coverUrl} alt="Magazine cover" />}
        </section>
        <section className="panel employee-month-card">
          <div className="employee-month-badge"><Award size={28} /></div>
          {employeeOfMonth?.employeeName ? <><div className="employee-month-avatar">{employeeOfMonth.employeeName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><span className="eyebrow">Employee of the Month</span><h2>{employeeOfMonth.employeeName}</h2><p>{employeeOfMonth.designation || employeeOfMonth.department || employeeOfMonth.message}</p><small>{employeeOfMonth.month}</small></div></> : <div><span className="eyebrow">Employee of the Month</span><h2>Not selected yet</h2><p>HR or Manager can recognise an outstanding employee here.</p></div>}
        </section>
      </div>

      {['HR_ADMIN', 'MANAGER'].includes(role) && (
        <section className="panel dashboard-content-admin">
          <div className="panel-title"><h2>Dashboard highlights management</h2></div>
          {message && <div className={message.includes('updated') ? 'success-alert' : 'form-alert'}>{message}</div>}
          <div className="dashboard-admin-grid">
            <form className="form-grid" onSubmit={updateMagazine}>
              <h3 className="full-span">Monthly magazine</h3>
              <label>Title<input name="title" defaultValue={magazine?.title || ''} required /></label>
              <label>Month<input name="month" type="month" defaultValue={magazine?.month || ''} /></label>
              <label className="full-span">Description<textarea name="description" rows="3" defaultValue={magazine?.description || ''} /></label>
              <label>Cover image URL<input name="coverUrl" type="url" defaultValue={magazine?.coverUrl || ''} /></label>
              <label>Magazine document URL<input name="documentUrl" type="url" defaultValue={magazine?.documentUrl || ''} /></label>
              <button className="btn btn-primary full-span"><Save size={17} /> Save magazine</button>
            </form>
            <form className="form-grid" onSubmit={updateEmployeeOfMonth}>
              <h3 className="full-span">Employee of the Month</h3>
              <label className="full-span">Employee<select name="employeeId" defaultValue={employeeOfMonth?.employeeId || ''} required><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
              <label>Month<input name="month" type="month" defaultValue={employeeOfMonth?.month || ''} required /></label>
              <label>Photo URL<input name="photoUrl" type="url" defaultValue={employeeOfMonth?.photoUrl || ''} /></label>
              <label className="full-span">Recognition message<textarea name="message" rows="4" defaultValue={employeeOfMonth?.message || ''} /></label>
              <button className="btn btn-primary full-span"><Award size={17} /> Publish recognition</button>
            </form>
          </div>
        </section>
      )}

      <section className="panel quick-actions-panel">
        <div className="panel-title">
          <h2>Quick Actions</h2>
        </div>

        <div className="quick-actions-grid">
          {links.map(({ label, path, icon: Icon }) => {
            const image = actionImages[label];
            return (
              <button
                key={label}
                className="quick-action-card"
                onClick={() => nav(path)}
              >
                <div className="quick-action-icon">
                  {image ? <img src={image} alt={label} /> : <Icon size={30} />}
                </div>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}