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
import SummaryCard from "../components/SummaryCard";
import PdfDropzone from "../components/PdfDropzone";
import ImageDropzone from "../components/ImageDropzone";
import { useAuth } from "../context/AuthContext";
import { getEmployees, normalizeEmployeeName } from "../services/employeeService";
import {
  getNotifications,
  getUpcomingBirthdays,
  getLatestMagazine,
  createAnnouncement,
  encodeMagazineCover,
} from "../services/notificationService";
import { getAttendanceDashboard, getAttendanceHistory } from "../services/attendanceService";
import { getMyLeaveBalances, getTeamLeaveRequests } from "../services/leaveService";
import {
  getEmployeeOfMonth,
  saveEmployeeOfMonth,
} from "../services/dashboardContentService";
import { getHolidays, getUpcomingHolidays } from "../services/holidayService";
import calendarAttendanceImg from "../assets/illustrations/calendar-attendance.png";
import calendarLeaveImg from "../assets/illustrations/calendar-leave.png";
import celebrationCakeImg from "../assets/illustrations/celebration-cake.png";
import celebrationGroupImg from "../assets/illustrations/celebration-group.png";
import "./Dashboard.css";
import BirthdayWidget from "../components/BirthdayWidget";
import HighlightCards from "../components/HighlightCards";

// utils/formatName.js was never actually added to the repo on either
// branch, so build the name capitalization inline instead of importing it.
function capitalizeName(name) {
  if (!name) return "";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const actionImages = {
  'Attendance': calendarAttendanceImg,
  'Apply Leave': calendarLeaveImg,
  'My Leave': calendarLeaveImg,
  'Leave Approvals': calendarLeaveImg,
  'Celebration Wall': celebrationCakeImg,
  'Events': celebrationGroupImg,
};

const WELCOME_BANNER_PHOTO = "https://images.unsplash.com/photo-1758873269276-9518d0cb4a0b?fm=jpg&q=80&w=1920&auto=format&fit=crop";

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
  const role = user?.role || user?.roles?.[0] || 'EMPLOYEE';

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  }, []);

  const [magazine, setMagazine] = useState(null);
  const [magazineLoading, setMagazineLoading] = useState(true);
  const [employeeOfMonth, setEmployeeOfMonth] = useState(getEmployeeOfMonth());
  const [message, setMessage] = useState('');
  // Drives the alert color explicitly instead of guessing from the message
  // text (the old `message.includes('updated')` check was case-sensitive
  // and never matched "Updated", so the success alert always rendered red).
  const [messageType, setMessageType] = useState('success');
  const [magazineFile, setMagazineFile] = useState({ url: '', name: '', size: 0, file: null });
  const [magazineCoverFile, setMagazineCoverFile] = useState({ url: '', name: '', size: 0, file: null });
  const [magazineErrors, setMagazineErrors] = useState({});
  const MAGAZINE_DESCRIPTION_LIMIT = 500;
  const [magazineCoverUrl, setMagazineCoverUrl] = useState('');
  const [magazineDescription, setMagazineDescription] = useState('');
  // Publishing a magazine uploads a real PDF (and maybe a cover image) to
  // storage, which can take a while on a slow connection — without this the
  // button gave no feedback while that upload was in flight, so it looked
  // "stuck" and invited repeat clicks (which fired duplicate uploads).
  const [magazineSaving, setMagazineSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  // Controlled fields for Employee of the Month, so we can validate the
  // Photo URL and enforce a character limit on the Recognition Message the
  // same way the magazine's Description field already does.
  const [eomPhotoUrl, setEomPhotoUrl] = useState('');
  const [eomMessage, setEomMessage] = useState('');
  const [eomErrors, setEomErrors] = useState({});
  const EOM_MESSAGE_LIMIT = 500;
  // Only accept a real, direct https image link — this is what gets set as
  // an <img src>, so a non-image page (or a local file path pasted in by
  // mistake, e.g. "C:\Users\...") would otherwise just render as a broken
  // image with no explanation.
  const PHOTO_URL_PATTERN = /^https:\/\/[^\s]+\.(jpg|jpeg|png|webp|gif)(\?[^\s]*)?$/i;

  // Every role can read the latest magazine — it's published once and
  // seen by the whole company, same as before, but now from the backend
  // instead of the publishing manager's own browser storage.
  useEffect(() => {
    let cancelled = false;

    async function loadMagazine() {
      setMagazineLoading(true);
      try {
        const latest = await getLatestMagazine();
        if (!cancelled) setMagazine(latest);
      } catch {
        if (!cancelled) setMagazine(null);
      } finally {
        if (!cancelled) setMagazineLoading(false);
      }
    }

    loadMagazine();
    return () => { cancelled = true; };
  }, []);

  // Keep the controlled Cover URL / Description fields in sync with
  // whatever magazine record is currently loaded (initial load, and again
  // after a successful publish re-fetches the saved copy).
  useEffect(() => {
    setMagazineCoverUrl(magazine?.coverUrl || '');
    setMagazineDescription(magazine?.description || '');
    // Clear any picked-but-not-yet-saved cover file once a fresh magazine
    // record comes in (e.g. right after a successful publish) so the form
    // doesn't keep showing a stale local preview.
    setMagazineCoverFile({ url: '', name: '', size: 0, file: null });
  }, [magazine]);

  // Same idea as the magazine's sync effect above: keep the controlled
  // Photo URL / Recognition Message fields in sync with whatever Employee
  // of the Month record is currently loaded (initial load, and again after
  // a successful publish).
  useEffect(() => {
    setEomPhotoUrl(employeeOfMonth?.photoUrl || '');
    setEomMessage(employeeOfMonth?.message || '');
  }, [employeeOfMonth]);

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
        const [empResult, notifResult] = await Promise.allSettled([
          // BirthdayWidget itself splits results into "Today" vs the next
          // 30 days, so it needs a wide enough window from the API to have
          // anything to split — days:0 was asking for a zero-day lookahead
          // and always came back empty.
          getUpcomingBirthdays(30),
          getNotifications({ page: 0, size: 50 }),
        ]);

        if (cancelled) return;

        const employeeList =
          empResult.status === "fulfilled" && Array.isArray(empResult.value)
            ? empResult.value.map((b) => ({
                id: b.employeeId,
                name: b.employeeName,
                dateOfBirth: b.dateOfBirth,
                nextBirthday: b.upcomingBirthdayDate,
                daysUntil: b.daysUntil,
              }))
            : [];
        const notifContent =
          notifResult.status === "fulfilled"
            ? notifResult.value?.content || []
            : [];

        // Extract BIRTHDAY type notifications from backend GET /notifications
        const birthdayNotifs = notifContent
          .filter((n) => n.notificationType === 'BIRTHDAY')
          .map((n) => ({
            id: `notif-${n.id}`,
            name: n.title || 'Happy Birthday 🎉',
            dateOfBirth: n.createdAt,
            designation: n.message || 'Birthday Celebration',
          }));

        // Merge employee birthdays & notification birthdays without duplicates
        const combined = [...employeeList];
        birthdayNotifs.forEach((bn) => {
          if (!combined.some((item) => item.id === bn.id || item.name === bn.name)) {
            combined.push(bn);
          }
        });

        setBirthdayEmployees(combined);
      } catch {
        if (!cancelled) setBirthdayEmployees([]);
      } finally {
        if (!cancelled) setBirthdayLoading(false);
      }
    }

    loadBirthdays();
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

  // Backend already sends a pre-formatted "hh:mm a" check-in time (or "--"
  // when the employee hasn't checked in yet), same field the Attendance
  // page uses — show that instead of a generic "Marked" label.
  const loginTimeValue = attendanceLoading
    ? '...'
    : (isCheckedInToday && attendanceDashboard?.checkInTime && attendanceDashboard.checkInTime !== '--'
        ? attendanceDashboard.checkInTime
        : 'Not marked');

  let cards = [];
  let links = [];
  if (role === 'EMPLOYEE') {
    cards = [
      [Clock3, 'Attendance Login Time', loginTimeValue, 'Today', 'green', '/attendance'],
      [CalendarDays, 'Leaves Left', leaveLoading ? '...' : leaveSummary.left, `${leaveLoading ? '...' : leaveSummary.taken} Days Taken`, 'pink', '/leave'],
      [PartyPopper, 'Celebrations', 'View', 'Company Wall', 'orange', '/celebrations'],
      [UserRound, 'Profile', 'Update', 'Personal Details', 'teal', '/profile'],
    ];
    links = [
      { label: "Attendance", path: "/attendance", icon: Clock3 },
      { label: "Apply Leave", path: "/leave", icon: CalendarDays },
      { label: "Celebration Wall", path: "/celebrations", icon: PartyPopper },
      { label: "Profile", path: "/profile", icon: UserRound },
    ];
} else if (role === 'HR_ADMIN') {
    cards = [
      [Users, 'Employees', employees.length, 'Total Users', 'green', '/employees'],
      [Clock3, 'My Login Time', loginTimeValue, 'Check In / Out', 'teal', '/attendance'],
      [Megaphone, 'Announcements', 'View', 'Published', 'orange', '/announcements'],
      [CalendarRange, 'Events', 'View', 'Created', 'pink', '/events'],
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
      [ClipboardCheck, 'Pending Leave', leaveLoading ? '...' : pendingApprovalsCount, 'Awaiting Decision', 'pink', '/leave-approvals'],
      [CalendarDays, 'My Leaves Left', leaveLoading ? '...' : leaveSummary.left, `${leaveLoading ? '...' : leaveSummary.taken} Days Taken`, 'blue', '/leave'],
      [Clock3, 'Attendance', attendanceLoading ? '...' : attendanceCount, 'Team Records', 'green', '/attendance'],
      [Target, 'Performance', 'Review', 'Team Goals', 'orange', '/performance'],
    ];
    links = [
      { label: "My Leave", path: "/leave", icon: CalendarDays },
      { label: "Leave Approvals", path: "/leave-approvals", icon: ClipboardCheck },
      { label: "Attendance", path: "/attendance", icon: Clock3 },
      { label: "Performance", path: "/performance", icon: Award },
      { label: "Employees", path: "/employees", icon: Users },
    ];
  }

  async function updateMagazine(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());

    // ---- Validation: PDF, a cover image (either an uploaded file or a
    // pasted URL), and Description length are all required client-side
    // before this ever reaches the API. ----
    const errors = {};
    if (!magazineFile.file) {
      errors.pdf = 'Please upload the magazine PDF before publishing.';
    }
    const hasCoverFile = Boolean(magazineCoverFile.file);
    const trimmedCoverUrl = magazineCoverUrl.trim();
    if (!hasCoverFile && !trimmedCoverUrl) {
      errors.coverUrl = 'Upload a cover image or paste an image URL.';
    } else if (!hasCoverFile && trimmedCoverUrl.startsWith('data:')) {
      // A pasted base64 image string is what previously broke publishing:
      // it blows past the backend's 1000-character message limit and the
      // save silently fails. Catch it here with a clear fix instead.
      errors.coverUrl = 'That looks like pasted image data, not a link. Use the cover image uploader below instead.';
    }
    if (magazineDescription.length > MAGAZINE_DESCRIPTION_LIMIT) {
      errors.description = `Description cannot exceed ${MAGAZINE_DESCRIPTION_LIMIT} characters.`;
    }

    if (Object.keys(errors).length > 0) {
      setMagazineErrors(errors);
      setMessageType('error');
      setMessage('Please fix the highlighted fields before publishing.');
      return;
    }

    if (magazineSaving) return; // already publishing — ignore repeat clicks

    setMagazineErrors({});
    setMagazineSaving(true);

    try {
      // Attachment order matters: the backend stores attachmentUrls in the
      // order they're uploaded, and mapAnnouncementToMagazine reads the PDF
      // back from index 0 and an uploaded cover image from index 1. Always
      // send the PDF first, then the cover image file only if one was
      // uploaded (as opposed to a plain pasted URL).
      const attachments = [magazineFile.file];
      if (hasCoverFile) attachments.push(magazineCoverFile.file);

      // If the admin uploaded a real cover image file, don't also try to
      // encode a URL into the message — there isn't one. Only a manually
      // pasted link goes through encodeMagazineCover, and that function
      // itself now guards against anything long enough to blow the
      // backend's 1000-character message limit.
      // The backend requires a non-blank message. When the cover comes from
      // an uploaded file there's no URL to encode, so fall back to a short
      // default if the (optional) description was left empty — otherwise
      // an empty description + uploaded cover would fail "Message is
      // required." on the backend.
      const message = hasCoverFile
        ? ((magazineDescription || '').trim() || `${fields.title || 'Monthly Magazine'} — new edition published.`)
        : encodeMagazineCover(magazineDescription, trimmedCoverUrl);

      await createAnnouncement({
        title: fields.title,
        message,
        uploadType: 'MAGAZINE',
        attachments,
      });
      // The publish endpoint doesn't return the saved record, so re-fetch
      // the real thing through the same GET used on page load — this gets
      // back the actual stored attachment URL, not a local blob: preview.
      //
      // NOTE: this used to fall back to showing the manager's own local
      // file preview (magazineFile.url) if this re-fetch failed, "so they
      // see something". That was actively misleading — a blob: URL only
      // exists in the publishing manager's own browser tab, so it always
      // opened fine for them specifically while silently telling nobody
      // that the publish either failed to save or failed to be readable
      // back. If the re-fetch fails, surface that honestly instead.
      const latest = await getLatestMagazine();
      setMagazine(latest);
      setMagazineFile({ url: '', name: '', size: 0, file: null });
      setMagazineCoverFile({ url: '', name: '', size: 0, file: null });
      setMessageType('success');
      setMessage('Monthly Magazine Updated.');
    } catch (error) {
      const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '');
      setMessageType('error');
      setMessage(
        isTimeout
          ? 'The Upload Took Too Long — Try A Smaller PDF Or Check Your Connection.'
          : (error?.response?.data?.message || error.message || 'Failed to publish magazine. Please refresh and check whether it saved before trying again.')
      );
    } finally {
      setMagazineSaving(false);
    }
  }

  function updateEmployeeOfMonth(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selected = employees.find((item) => String(item.id) === form.get('employeeId'));

    // ---- Validation: Photo URL is required and must be a direct https
    // image link, and the Recognition Message can't exceed the limit. ----
    const errors = {};
    const trimmedPhotoUrl = eomPhotoUrl.trim();
    if (!trimmedPhotoUrl) {
      errors.photoUrl = 'Please add a photo URL.';
    } else if (!PHOTO_URL_PATTERN.test(trimmedPhotoUrl)) {
      errors.photoUrl = 'Enter a direct https image link, e.g. https://example.com/photo.jpg';
    }
    if (eomMessage.length > EOM_MESSAGE_LIMIT) {
      errors.message = `Recognition message cannot exceed ${EOM_MESSAGE_LIMIT} characters.`;
    }

    if (Object.keys(errors).length > 0) {
      setEomErrors(errors);
      setMessageType('error');
      setMessage('Please fix the highlighted fields before publishing.');
      return;
    }

    setEomErrors({});

    try {
      const next = saveEmployeeOfMonth(user, {
        ...Object.fromEntries(form.entries()),
        photoUrl: trimmedPhotoUrl,
        message: eomMessage.trim(),
        employeeName: selected ? normalizeEmployeeName(selected) : '',
        designation: selected?.designationName || selected?.jobTitle || '',
        department: selected?.departmentName || '',
      });
      setEmployeeOfMonth(next);
      setMessageType('success');
      setMessage('Employee of The Month Updated.');
    } catch (error) {
      setMessageType('error');
      setMessage(error.message);
    }
  }

  return (
    <div className="page-stack dashboard-page page-reveal">
      <section className="welcome-banner" style={{ '--welcome-photo': `url(${WELCOME_BANNER_PHOTO})` }}>
        <div className="welcome-banner-text">
          <span className="eyebrow">{greeting}</span>
          <h1>Welcome Back, {capitalizeName(user.name?.split(' ')[0])}!</h1>
          <p>{role === 'EMPLOYEE' ? "Let's Make Today Productive." : role === 'HR_ADMIN' ? 'Manage People, Engagement And HR Operations.' : 'Review Team Attendance, Leave And Performance.'}</p>
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
          <span className="eyebrow">Upcoming Holidays</span>
          <h2>{upcomingHoliday ? upcomingHoliday.holidayName : holidaysLoading ? 'Loading Upcoming Holidays…' : 'No Upcoming Holiday'}</h2>
          <p>
            {upcomingHoliday
              ? formatHolidayDate(upcomingHoliday.holidayDate)
              : 'HR or Manager Can Add Holidays From The Holiday List.'}
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
              <span className="eyebrow">Manager Tools</span>
              <h2>Dashboard Highlights</h2>
              <p>Whatever You Publish Here Replaces Last Month's — Every Employee Sees It The Moment You Save.</p>
            </div>
            <div className="highlights-editor-badge"><Sparkles size={14} /> Live This Month</div>
          </div>

          {message && (
            <div className={messageType === 'success' ? 'success-alert' : 'form-alert'}>{message}</div>
          )}

          <div className="highlights-editor-grid">
            <form className="editor-card editor-card--blue" onSubmit={updateMagazine}>
              <div className="editor-card-head">
                <div className="editor-card-icon editor-card-icon--blue"><BookOpen size={18} /></div>
                <div>
                  <h3>Monthly Magazine</h3>
                  <p>PDF Opens or Downloads For Every Employee on Their Dashboard</p>
                </div>
              </div>

              <div className="editor-fields">
                <label className="ef-field ef-full">
                  <span>Title</span>
                  <input name="title" defaultValue={magazine?.title || ''} placeholder="e.g. MyHourly Times — August Edition" required />
                </label>
                <div className="ef-field ef-full">
                  <span>Cover Image</span>
                  <ImageDropzone
                    url={magazineCoverFile.url}
                    fileName={magazineCoverFile.name}
                    fileSize={magazineCoverFile.size}
                    onChange={(next) => {
                      setMagazineCoverFile(next);
                      if (magazineErrors.coverUrl) setMagazineErrors((prev) => ({ ...prev, coverUrl: '' }));
                    }}
                  />
                  {!magazineCoverFile.file && (
                    <label className="ef-field" style={{ marginTop: 8 }}>
                      <span>Or Paste An Image URL</span>
                      <input
                        name="coverUrl"
                        type="url"
                        value={magazineCoverUrl}
                        onChange={(e) => {
                          setMagazineCoverUrl(e.target.value);
                          if (magazineErrors.coverUrl) setMagazineErrors((prev) => ({ ...prev, coverUrl: '' }));
                        }}
                        placeholder="https://…"
                        aria-invalid={Boolean(magazineErrors.coverUrl)}
                      />
                    </label>
                  )}
                  {magazineErrors.coverUrl && <p className="field-error">{magazineErrors.coverUrl}</p>}
                </div>
                <label className="ef-field ef-full">
                  <span>
                    Description {" "}
                    <span className="ef-char-count">{magazineDescription.length}/{MAGAZINE_DESCRIPTION_LIMIT}</span>
                  </span>
                  <textarea
                    name="description"
                    rows="3"
                    value={magazineDescription}
                    maxLength={MAGAZINE_DESCRIPTION_LIMIT}
                    onChange={(e) => {
                      setMagazineDescription(e.target.value);
                      if (magazineErrors.description) setMagazineErrors((prev) => ({ ...prev, description: '' }));
                    }}
                    placeholder="What's inside this edition?"
                    aria-invalid={Boolean(magazineErrors.description)}
                  />
                  {magazineErrors.description && <p className="field-error">{magazineErrors.description}</p>}
                </label>
                <div className="ef-field ef-full">
                  <span>Magazine PDF</span>
                  <PdfDropzone
                    url={magazineFile.url}
                    fileName={magazineFile.name}
                    fileSize={magazineFile.size}
                    onChange={(next) => {
                      setMagazineFile(next);
                      if (magazineErrors.pdf) setMagazineErrors((prev) => ({ ...prev, pdf: '' }));
                    }}
                  />
                  {magazineErrors.pdf && <p className="field-error">{magazineErrors.pdf}</p>}
                </div>
              </div>

              <button className="btn btn-primary btn-block" type="submit" disabled={magazineSaving} aria-busy={magazineSaving}>
                <Save size={17} /> {magazineSaving ? 'Publishing…' : 'Save & Publish Magazine'}
              </button>
              {magazineSaving && (
                <p className="ef-hint" role="status">
                  Uploading the PDF{magazineCoverFile.file ? ' and cover image' : ''} — this can take a little while on a larger file. Please don't close this tab.
                </p>
              )}
            </form>

            <form className="editor-card editor-card--warm" onSubmit={updateEmployeeOfMonth}>
              <div className="editor-card-head">
                <div className="editor-card-icon editor-card-icon--warm"><Award size={18} /></div>
                <div>
                  <h3>Employee of The Month</h3>
                  <p>Featured on Every Dashboard Alongside The Magazine</p>
                </div>
              </div>

              <div className="editor-fields">
                <label className="ef-field ef-full">
                  <span>Employee</span>
                  <select name="employeeId" defaultValue={employeeOfMonth?.employeeId || ''} required>
                    <option value="">Select Employee</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{normalizeEmployeeName(employee)}</option>)}
                  </select>
                </label>
                <label className="ef-field">
                  <span>Month</span>
                  <input name="month" type="month" defaultValue={employeeOfMonth?.month || ''} required />
                </label>
                <label className="ef-field">
                  <span>Photo URL</span>
                  <input
                    name="photoUrl"
                    type="url"
                    value={eomPhotoUrl}
                    onChange={(e) => {
                      setEomPhotoUrl(e.target.value);
                      if (eomErrors.photoUrl) setEomErrors((prev) => ({ ...prev, photoUrl: '' }));
                    }}
                    placeholder="https://example.com/photo.jpg"
                    aria-invalid={Boolean(eomErrors.photoUrl)}
                    required
                  />
                  {eomErrors.photoUrl && <p className="field-error">{eomErrors.photoUrl}</p>}
                </label>
                <label className="ef-field ef-full">
                  <span>
                    Recognition Message  {" "}
                    <span className="ef-char-count">{eomMessage.length}/{EOM_MESSAGE_LIMIT}</span>
                  </span>
                  <textarea
                    name="message"
                    rows="4"
                    value={eomMessage}
                    maxLength={EOM_MESSAGE_LIMIT}
                    onChange={(e) => {
                      setEomMessage(e.target.value);
                      if (eomErrors.message) setEomErrors((prev) => ({ ...prev, message: '' }));
                    }}
                    placeholder="Why they earned it this month"
                    aria-invalid={Boolean(eomErrors.message)}
                  />
                  {eomErrors.message && <p className="field-error">{eomErrors.message}</p>}
                </label>
              </div>

              <button className="btn btn-primary btn-block"><Award size={17} /> Publish Recognition</button>
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