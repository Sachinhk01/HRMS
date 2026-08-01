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
  ChevronRight,
  Sparkles,
} from "lucide-react";
import SummaryCard from '../components/SummaryCard';
import PdfDropzone from '../components/PdfDropzone';
import { useAuth } from '../context/AuthContext';
import { getEmployees, getBirthdaysToday, normalizeEmployeeName } from '../services/employeeService';
import { getAttendanceDashboard, getAttendanceHistory } from '../services/attendanceService';
import { getMyLeaveBalances, getTeamLeaveRequests } from '../services/leaveService';
import { announcementStore, eventStore, postStore } from '../services/contentService';
import { getEmployeeOfMonth, getMonthlyMagazine, saveEmployeeOfMonth, saveMonthlyMagazine } from '../services/dashboardContentService';
import { getHolidays, getUpcomingHolidays } from '../services/holidayService';
import welcomePersonImg from '../assets/illustrations/welcome-person.png';
import calendarAttendanceImg from '../assets/illustrations/calendar-attendance.png';
import calendarLeaveImg from '../assets/illustrations/calendar-leave.png';
import celebrationCakeImg from '../assets/illustrations/celebration-cake.png';
import celebrationGroupImg from '../assets/illustrations/celebration-group.png';
import './Dashboard.css';
import BirthdayWidget from '../components/BirthdayWidget';
import HighlightCards from '../components/HighlightCards';

const actionImages = {
  'Attendance': calendarAttendanceImg,
  'Apply Leave': calendarLeaveImg,
  'My Leave': calendarLeaveImg,
  'Leave Approvals': calendarLeaveImg,
  'Celebration Wall': celebrationCakeImg,
  'Events': celebrationGroupImg,
};

function formatHolidayDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

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
  const [magazineFile, setMagazineFile] = useState({
    url: getMonthlyMagazine()?.documentUrl || '',
    name: getMonthlyMagazine()?.documentName || '',
    size: getMonthlyMagazine()?.documentSize || 0,
  });
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

useEffect(() => {
  let cancelled = false;

  async function loadEmployees() {
    if (!['HR_ADMIN', 'MANAGER'].includes(role)) {
      setEmployees([]);
      setEmployeesLoading(false);
      return;
    }

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

  return () => {
    cancelled = true;
  };
}, [role]);

  const [birthdayEmployees, setBirthdayEmployees] = useState([]);
  const [birthdayLoading, setBirthdayLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadBirthdays() {
      setBirthdayLoading(true);
      try {
        const list = await getBirthdaysToday({ days: 30 });
        if (!cancelled) setBirthdayEmployees(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setBirthdayEmployees([]);
      } finally {
        if (!cancelled) setBirthdayLoading(false);
      }
    }

    // loadBirthdays();
    window.addEventListener('focus', loadBirthdays);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadBirthdays);
    };
  }, []);

  const [upcomingHoliday, setUpcomingHoliday] = useState(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidaysError, setHolidaysError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadHolidays() {
      setHolidaysLoading(true);
      setHolidaysError('');
      try {
        const [upcomingResult, holidayList] = await Promise.all([
          getUpcomingHolidays(),
          getHolidays({ size: 6, active: true, sortDirection: 'asc' }),
        ]);

        if (cancelled) return;

        const upcoming = Array.isArray(upcomingResult) ? upcomingResult.filter(Boolean) : [];
        const fallback = Array.isArray(holidayList?.content)
          ? holidayList.content
              .filter((item) => item?.holidayDate)
              .sort((a, b) => new Date(a.holidayDate) - new Date(b.holidayDate))
              .slice(0, 4)
          : [];

        setUpcomingHoliday(upcoming[0] || fallback[0] || null);
        setUpcomingHolidays(upcoming.length ? upcoming.slice(0, 4) : fallback);
      } catch (error) {
        if (!cancelled) {
          setUpcomingHoliday(null);
          setUpcomingHolidays([]);
          setHolidaysError(error?.message || 'Failed to load holiday data.');
        }
      } finally {
        if (!cancelled) setHolidaysLoading(false);
      }
    }

    loadHolidays();
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
      [Clock3, 'My Attendance', attendanceLoading ? '...' : (isCheckedInToday ? 'Marked' : 'Not marked'), 'Check in / out', 'teal', '/attendance'],
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
      const next = saveMonthlyMagazine(user, {
        ...Object.fromEntries(form.entries()),
        documentName: magazineFile.name,
        documentSize: magazineFile.size,
      });
      setMagazine(next);
      setMagazineFile({ url: next.documentUrl || '', name: next.documentName || '', size: next.documentSize || 0 });
      setMessage('Monthly magazine updated.');
    } catch (error) { setMessage(error.message); }
  }

  function updateEmployeeOfMonth(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = employees.find((item) => String(item.id) === form.get('employeeId'));
    try {
      const next = saveEmployeeOfMonth(user, {
        ...Object.fromEntries(form.entries()),
        employeeName: selected ? normalizeEmployeeName(selected) : '',
        designation: selected?.designationName || selected?.jobTitle || '',
        department: selected?.departmentName || '',
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

      <BirthdayWidget employees={birthdayEmployees} onViewAll={() => nav('/celebrations')} />

      <section
        className="panel dashboard-holiday-banner"
        onClick={() => nav('/holidays')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            nav('/holidays');
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="feature-icon"><CalendarDays size={24} /></div>
        <div className="dashboard-holiday-content">
          <span className="eyebrow">Upcoming holidays</span>
          <h2>{upcomingHoliday ? upcomingHoliday.holidayName : holidaysLoading ? 'Loading upcoming holidays…' : 'No upcoming holiday'}</h2>
          <p>
            {upcomingHoliday
              ? formatHolidayDate(upcomingHoliday.holidayDate)
              : 'HR or Manager can add holidays from the Holiday List.'}
          </p>
          {!holidaysLoading && upcomingHolidays.length > 0 && (
            <div className="dashboard-holiday-list">
              {upcomingHolidays.slice(0, 3).map((holiday) => (
                <div key={holiday.id || `${holiday.holidayName}-${holiday.holidayDate}`} className="dashboard-holiday-chip">
                  <span>{new Date(`${holiday.holidayDate}T00:00:00`).toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
                  <strong>{holiday.holidayName}</strong>
                </div>
              ))}
            </div>
          )}
          {holidaysError && <p className="dashboard-holiday-error">{holidaysError}</p>}
        </div>
        <button type="button" className="btn btn-small btn-primary">View Holiday List</button>
      </section>

      {/* Redesigned Monthly Magazine + Employee of the Month cards */}
      <HighlightCards magazine={magazine} employeeOfMonth={employeeOfMonth} />

      {['MANAGER'].includes(role) && (
        <section className="panel highlights-editor">
          <div className="highlights-editor-head">
            <div>
              <span className="eyebrow">Manager tools</span>
              <h2>Dashboard highlights</h2>
              <p>Whatever you publish here replaces last month's — every employee sees it the moment you save.</p>
            </div>
            <div className="highlights-editor-badge"><Sparkles size={14} /> Live this month</div>
          </div>

          {message && (
            <div className={message.includes('updated') ? 'success-alert' : 'form-alert'}>{message}</div>
          )}

          <div className="highlights-editor-grid">
            <form className="editor-card editor-card--blue" onSubmit={updateMagazine}>
              <div className="editor-card-head">
                <div className="editor-card-icon editor-card-icon--blue"><BookOpen size={18} /></div>
                <div>
                  <h3>Monthly Magazine</h3>
                  <p>PDF opens or downloads for every employee on their dashboard</p>
                </div>
              </div>

              <div className="editor-fields">
                <label className="ef-field ef-full">
                  <span>Title</span>
                  <input name="title" defaultValue={magazine?.title || ''} placeholder="e.g. MyHourly Times — August Edition" required />
                </label>
                <label className="ef-field">
                  <span>Edition month</span>
                  <input name="month" type="month" defaultValue={magazine?.month || ''} />
                </label>
                <label className="ef-field">
                  <span>Cover image URL</span>
                  <input name="coverUrl" type="url" defaultValue={magazine?.coverUrl || ''} placeholder="https://…" />
                </label>
                <label className="ef-field ef-full">
                  <span>Description</span>
                  <textarea name="description" rows="3" defaultValue={magazine?.description || ''} placeholder="What's inside this edition?" />
                </label>
                <div className="ef-field ef-full">
                  <span>Magazine PDF</span>
                  <PdfDropzone
                    url={magazineFile.url}
                    fileName={magazineFile.name}
                    fileSize={magazineFile.size}
                    onChange={(next) => setMagazineFile(next)}
                  />
                </div>
              </div>

              <button className="btn btn-primary btn-block"><Save size={17} /> Save &amp; publish magazine</button>
            </form>

            <form className="editor-card editor-card--warm" onSubmit={updateEmployeeOfMonth}>
              <div className="editor-card-head">
                <div className="editor-card-icon editor-card-icon--warm"><Award size={18} /></div>
                <div>
                  <h3>Employee of the Month</h3>
                  <p>Featured on every dashboard alongside the magazine</p>
                </div>
              </div>

              <div className="editor-fields">
                <label className="ef-field ef-full">
                  <span>Employee</span>
                  <select name="employeeId" defaultValue={employeeOfMonth?.employeeId || ''} required>
                    <option value="">Select employee</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{normalizeEmployeeName(employee)}</option>)}
                  </select>
                </label>
                <label className="ef-field">
                  <span>Month</span>
                  <input name="month" type="month" defaultValue={employeeOfMonth?.month || ''} required />
                </label>
                <label className="ef-field">
                  <span>Photo URL</span>
                  <input name="photoUrl" type="url" defaultValue={employeeOfMonth?.photoUrl || ''} placeholder="https://… (optional)" />
                </label>
                <label className="ef-field ef-full">
                  <span>Recognition message</span>
                  <textarea name="message" rows="4" defaultValue={employeeOfMonth?.message || ''} placeholder="Why they earned it this month" />
                </label>
              </div>

              <button className="btn btn-primary btn-block"><Award size={17} /> Publish recognition</button>
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
