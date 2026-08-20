import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, MessageCircle, PartyPopper, Share2, Bookmark,
  Gift, Cake, Award, Sparkles, UserPlus, Megaphone, CalendarDays, Send, Plus, X, ImagePlus, Users, Pencil, Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { createCelebration, deleteAnnouncement, getNotifications, updateAnnouncement } from '../services/notificationService';
import { getEmployeeDropdown } from '../services/employeeService';
import { getHolidays } from '../services/holidayService';
import { getMyLeaveRequests, getTeamLeaveRequests, getAllLeaveRequests } from '../services/leaveService';
import './CelebrationWall.css';

// Filter tabs — must contain 'ALL' plus exact backend NotificationType values for calendar events
const types = ['ALL', 'BIRTHDAY', 'WORK_ANNIVERSARY', 'HOLIDAY', 'GENERAL', 'APPROVED'];

// Only these are genuine celebration/social content. Notifications like
// LATE_CHECK_IN, ABSENT, MISSED_CHECKOUT, LEAVE_APPLIED, LEAVE_REJECTED etc.
// are operational alerts, not celebration posts — they're excluded from the
// wall entirely (they still show up normally in the notification bell /
// Announcements page, just not here).
const CELEBRATION_TYPES = ['BIRTHDAY', 'WORK_ANNIVERSARY', 'HOLIDAY', 'GENERAL'];

// Keys match backend NotificationType enum exactly
const CATEGORY_META = {
  BIRTHDAY:         { icon: Cake,      color: '#db2777', bg: '#fce7f3', soft: '#fdf2f8', label: 'Birthday' },
  WORK_ANNIVERSARY: { icon: Award,     color: '#0891b2', bg: '#cffafe', soft: '#ecfeff', label: 'Work Anniversary' },
  HOLIDAY:          { icon: Sparkles,  color: '#059669', bg: '#d1fae5', soft: '#ecfdf5', label: 'Holiday' },
  LEAVE_APPLIED:    { icon: CalendarDays, color: '#7c3aed', bg: '#ede9fe', soft: '#f5f3ff', label: 'Leave' },
  LEAVE_MANAGER_APPROVED: { icon: Award, color: '#16a34a', bg: '#dcfce7', soft: '#f0fdf4', label: 'Leave Approved' },
  LEAVE_HR_APPROVED: { icon: Award,   color: '#16a34a', bg: '#dcfce7', soft: '#f0fdf4', label: 'Leave Approved' },
  LEAVE_REJECTED:   { icon: CalendarDays, color: '#dc2626', bg: '#fee2e2', soft: '#fef2f2', label: 'Leave Rejected' },
  LATE_CHECK_IN:    { icon: CalendarDays, color: '#d97706', bg: '#fef3c7', soft: '#fffbeb', label: 'Late Check-in' },
  ABSENT:           { icon: UserPlus,  color: '#dc2626', bg: '#fee2e2', soft: '#fef2f2', label: 'Absent' },
  MISSED_CHECKOUT:  { icon: CalendarDays, color: '#d97706', bg: '#fef3c7', soft: '#fffbeb', label: 'Missed Checkout' },
  ANNOUNCEMENT:     { icon: Megaphone, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', label: 'Announcement' },
  APPROVED:         { icon: Award,     color: '#059669', bg: '#d1fae5', soft: '#ecfdf5', label: 'Approved' },
  GENERAL:          { icon: PartyPopper, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', label: 'General' },
};

function categoryMeta(type = '') {
  const normalized = (type || '').toUpperCase().replace(/_/g, ' ');
  return CATEGORY_META[type] || CATEGORY_META[normalized] || { icon: PartyPopper, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', label: type || 'Celebration' };
}

function initials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

// createCelebration() (the "Add Celebration" composer) posts through the
// existing /notifications/announcement endpoint — there's no dedicated
// celebration endpoint — and encodes the celebration type/date/tagged
// people as trailing "\n\nLabel: value" lines inside the message body (see
// notificationService.js). Parse them back out so these posts render as
// celebration cards in the feed/filters instead of only in the sidebar
// Announcements widget. Plain announcements (no embedded "Celebration
// type:" line) fall through unchanged and stay sidebar-only.
const CELEBRATION_TYPE_RE = /\n\nCelebration type:\s*([A-Z_]+)\s*$/;
const CELEBRATION_DATE_RE = /\n\nCelebration date:\s*([^\n]+)/;
const TAGGED_PEOPLE_RE = /\n\nTagged people:\s*([^\n]+)/;

function parseCelebrationMeta(rawMessage = '') {
  const typeMatch = rawMessage.match(CELEBRATION_TYPE_RE);
  if (!typeMatch) return null;

  const dateMatch = rawMessage.match(CELEBRATION_DATE_RE);
  const taggedMatch = rawMessage.match(TAGGED_PEOPLE_RE);

  const cleanMessage = rawMessage
    .replace(CELEBRATION_TYPE_RE, '')
    .replace(CELEBRATION_DATE_RE, '')
    .replace(TAGGED_PEOPLE_RE, '')
    .trim();

  return {
    type: typeMatch[1],
    eventDate: dateMatch ? dateMatch[1].trim() : null,
    taggedPeople: taggedMatch
      ? taggedMatch[1].split(',').map((name) => ({ name: name.trim() })).filter((p) => p.name)
      : [],
    message: cleanMessage,
  };
}

function normalizeNotificationToPost(item) {
  // All fields come directly from backend NotificationResponse JSON
  return {
    id: item.id,
    type: item.notificationType || 'GENERAL',
    title: item.title || '',
    message: item.message || '',
    createdAt: item.createdAt || new Date().toISOString(),
    eventDate: item.eventDate || null,
    images: item.attachmentUrls || [],
    isRead: Boolean(item.isRead),
    priority: item.priority || 'LOW',
    taggedPeople: item.taggedPeople || [],
    announcementId: item.referenceId,
  };
}

// Some attendance/leave notifications come back from the backend without a
// notificationType set at all, so normalizeNotificationToPost()'s fallback
// tags them as GENERAL and they slip past the blockedTypes check above,
// showing up mislabeled under the "General" celebration tab. Catch these by
// title as a second line of defence — title text the backend uses for
// these operational alerts, regardless of what notificationType (or lack
// thereof) came with them.
const OPERATIONAL_TITLE_RE = /^(late check-?in|missed check-?out|absent|leave (applied|update|approved|rejected|cancelled))$/i;

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

export default function CelebrationWall() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState('ALL');
  const [likedPosts, setLikedPosts] = useState({});
  const [commentsState, setCommentsState] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState('');
  const [celebrationForm, setCelebrationForm] = useState({ type: 'GENERAL', title: '', message: '', eventDate: '', taggedPeople: [] });
  const [celebrationFiles, setCelebrationFiles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tagSearch, setTagSearch] = useState('');
  const canCreateCelebration = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user?.role || user?.roles?.[0]);
  // Edit/Delete are disabled for now: the backend has no PUT/DELETE
  // /notifications/announcement/{id} endpoints (only POST create exists),
  // so calling them throws a 404 (NoResourceFoundException). Flip this to
  // `canCreateCelebration` once those endpoints are added.
  const canEditCelebration = false;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // getHolidays() is the same existing /holidays endpoint the Holidays
      // page uses — fetched here too so the full company holiday list can
      // show under the "Holiday" filter tab, not just holiday-type
      // celebration posts someone created manually.
      //
      // For "Approved": the backend never actually creates a notification
      // when a manager/HR approves leave (LEAVE_MANAGER_APPROVED exists as
      // an enum value but nothing triggers it), so there's no notification
      // data to source this from. Instead we pull directly from the
      // existing /leave-requests endpoints and filter to status APPROVED
      // client-side — same approach as holidays. Which endpoint is used
      // depends on role, matching each endpoint's own access rules:
      // HR_ADMIN/SUPER_ADMIN -> all requests, MANAGER -> team requests,
      // everyone else -> their own requests only.
      const role = user?.role || user?.roles?.[0];
      const leaveFetch = ['HR_ADMIN', 'SUPER_ADMIN'].includes(role)
        ? getAllLeaveRequests()
        : role === 'MANAGER'
          ? getTeamLeaveRequests()
          : getMyLeaveRequests();

      const [notifResult, holidayResult, leaveResult] = await Promise.allSettled([
        getNotifications({ page: 0, size: 100 }),
        getHolidays({ page: 0, size: 100, sortBy: 'holidayDate', sortDirection: 'asc' }),
        leaveFetch,
      ]);

      if (notifResult.status === 'fulfilled') {
        setNotifications(notifResult.value?.content || []);
      } else {
        setError(notifResult.reason?.message || 'Failed to load celebrations.');
      }
      setHolidays(holidayResult.status === 'fulfilled' ? (holidayResult.value?.content || []) : []);

      const leaveData =
        leaveResult.status === 'fulfilled'
          ? (
              leaveResult.value?.content ||
              leaveResult.value?.data?.content ||
              leaveResult.value?.data ||
              leaveResult.value ||
              []
            )
          : [];

      setApprovedLeaves(
        Array.isArray(leaveData)
          ? leaveData.filter(
              (leave) =>
                String(leave.status).toUpperCase() === 'APPROVED'
            )
          : []
      );
    } catch (err) {
      setError(err.message || 'Failed to load celebrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!canCreateCelebration) return;
    getEmployeeDropdown().then((items) => setEmployees(items || [])).catch(() => setEmployees([]));
  }, [canCreateCelebration]);

  const toggleTaggedPerson = (employee) => {
    setCelebrationForm((current) => {
      const selected = current.taggedPeople.some((person) => String(person.id) === String(employee.id));
      return {
        ...current,
        taggedPeople: selected
          ? current.taggedPeople.filter((person) => String(person.id) !== String(employee.id))
          : [...current.taggedPeople, { id: employee.id, name: employee.employeeName, employeeCode: employee.employeeCode }],
      };
    });
  };

  const { celebrationFeed, upcomingEvents, announcements } = useMemo(() => {
    const rawFeed = [];
    const rawUpcoming = [];
    const rawAnnouncements = [];

    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    (notifications || []).forEach((item) => {
      const blockedTypes = [
        'LATE_CHECK_IN',
        'MISSED_CHECKOUT',
        'ABSENT',
        'LEAVE_APPLIED',
        'LEAVE_REJECTED',
        'LEAVE_MANAGER_APPROVED',
        'LEAVE_HR_APPROVED',
      ];

      if (blockedTypes.includes(item.notificationType)) {
        return;
      }
      if (OPERATIONAL_TITLE_RE.test((item.title || '').trim())) {
        return;
      }
      if (item.notificationType === 'ANNOUNCEMENT') {
        const celebrationMeta = parseCelebrationMeta(item.message || '');
        if (celebrationMeta) {
          const post = {
            id: item.id,
            type: celebrationMeta.type,
            title: item.title || '',
            message: celebrationMeta.message,
            createdAt: item.createdAt || new Date().toISOString(),
            eventDate: celebrationMeta.eventDate,
            images: item.attachmentUrls || [],
            isRead: Boolean(item.isRead),
            priority: item.priority || 'LOW',
            taggedPeople: celebrationMeta.taggedPeople,
            announcementId: item.referenceId,
          };
          const dateVal = new Date(post.eventDate || post.createdAt);
          if (dateVal > endOfToday) {
            rawUpcoming.push(post);
          } else {
            rawFeed.push(post);
          }
          return;
        }

        rawAnnouncements.push({
          id: item.id,
          title: item.title,
          message: item.message,
          createdAt: item.createdAt,
          announcementId: item.referenceId,
        });
        return;
      }

      const post = normalizeNotificationToPost(item);
      if (!CELEBRATION_TYPES.includes(post.type)) return; // skip attendance/leave-lifecycle alerts — not celebration content
      const dateVal = new Date(post.eventDate || post.createdAt);

      if (dateVal > endOfToday) {
        rawUpcoming.push(post);
      } else {
        rawFeed.push(post);
      }
    });

    // Approved leave requests from the existing /leave-requests endpoints
    // (see loadData) — synthetic posts, same pattern as holidays. No
    // announcementId, so Edit/Delete never render for these.
    (approvedLeaves || []).forEach((leave) => {
      rawFeed.push({
        id: `leave-${leave.id}`,
        type: 'APPROVED',
        title: `${leave.employeeName || 'Someone'}'s Leave Approved`,
        message: `${leave.leaveType || 'Leave'} · ${
          leave.totalDays || 0
        } day(s)${
          leave.reason ? ` — ${leave.reason}` : ''
        }`,
        createdAt:
          leave.approvedDate ||
          leave.updatedAt ||
          leave.createdAt ||
          new Date().toISOString(),
        eventDate: null,
        images: [],
        isRead: true,
        priority: 'LOW',
        taggedPeople: [],
        announcementId: null,
      });
    });

    // Company holidays from the existing /holidays endpoint — synthetic
    // posts (no announcementId, so Edit/Delete never render for these,
    // since they aren't announcements and can't be edited from here).
    // Every holiday goes into the Holiday tab regardless of date (past or
    // future); future ones are also mirrored into the "Upcoming events"
    // sidebar widget.
    (holidays || []).forEach((holiday) => {
      const post = {
        id: `holiday-${holiday.id}`,
        type: 'HOLIDAY',
        title: holiday.holidayName || 'Holiday',
        message: holiday.description || '',
        createdAt: holiday.holidayDate,
        eventDate: holiday.holidayDate,
        images: [],
        isRead: true,
        priority: 'LOW',
        taggedPeople: [],
        announcementId: null,
      };
      rawFeed.push(post);
      const dateVal = new Date(post.eventDate);
      if (dateVal > endOfToday) {
        rawUpcoming.push(post);
      }
    });

    return {
      celebrationFeed: sortRecent(rawFeed),
      upcomingEvents: sortRecent(rawUpcoming),
      announcements: sortRecent(rawAnnouncements).slice(0, 4),
    };
  }, [notifications, holidays, approvedLeaves]);

  const visibleFeed = useMemo(() => {
    if (active === 'ALL') return celebrationFeed;
    // active is the raw backend NotificationType string (e.g. WORK_ANNIVERSARY)
    return celebrationFeed.filter((item) => item.type === active);
  }, [celebrationFeed, active]);

  const { page, setPage, pageItems, pageSize } = usePagination(visibleFeed, 5);

  const toggleLike = (postId) => {
    setLikedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleAddComment = (postId) => {
    const text = commentDrafts[postId]?.trim();
    if (!text) return;
    const newComment = {
      id: `c-${Date.now()}`,
      userName: user.name,
      message: text,
      createdAt: new Date().toISOString(),
    };
    setCommentsState((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComment],
    }));
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleCreateCelebration = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      await createCelebration({ ...celebrationForm, attachments: celebrationFiles });
      setCelebrationForm({ type: 'GENERAL', title: '', message: '', eventDate: '', taggedPeople: [] });
      setCelebrationFiles([]);
      setTagSearch('');
      setComposerOpen(false);
      setSuccess('Celebration Added Successfully.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to Add Celebration.');
    } finally {
      setCreating(false);
    }
  };

  const editWallPost = async (item) => {
    const title = window.prompt('Edit title', item.title || '');
    if (title === null) return;
    const message = window.prompt('Edit message', item.message || '');
    if (message === null || !title.trim() || !message.trim()) return;
    try { await updateAnnouncement(item.announcementId, { title: title.trim(), message: message.trim() }); setSuccess('Post updated successfully.'); await loadData(); }
    catch (err) { setError(err?.response?.data?.message || err.message || 'Failed to Update Post.'); }
  };

  const deleteWallPost = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This Cannot be Undone.`)) return;
    try { await deleteAnnouncement(item.announcementId); setSuccess('Post Deleted Successfully.'); await loadData(); }
    catch (err) { setError(err?.response?.data?.message || err.message || 'Failed to Delete Post.'); }
  };

  return (
    <div className="page-stack celebration-page page-reveal">
      <PageHeader
        eyebrow="People & Culture"
        title="Celebration Wall"
        description="View Company Celebrations, Milestones, Birthdays, Anniversaries, And Achievements."
        action={canCreateCelebration ? <button type="button" className="btn celebration-add-btn" onClick={() => setComposerOpen(true)}><Plus size={18} /> Add Celebration</button> : null}
      />

      {success && <div className="success-alert">{success}</div>}

      {canCreateCelebration && composerOpen && (
        <section className="panel celebration-composer">
          <div className="celebration-composer-head"><div><span className="eyebrow">HR Celebration</span><h2>Add a Celebration</h2></div><button type="button" className="icon-btn" onClick={() => setComposerOpen(false)} aria-label="Close"><X size={18} /></button></div>
          <form className="celebration-form" onSubmit={handleCreateCelebration}>
            <label>Celebration Type<select value={celebrationForm.type} onChange={(e) => setCelebrationForm((value) => ({ ...value, type: e.target.value }))}><option value="GENERAL">General Celebration</option><option value="BIRTHDAY">Birthday</option><option value="WORK_ANNIVERSARY">Work Anniversary</option><option value="HOLIDAY">Festival / Holiday</option><option value="APPROVED">Achievement</option></select></label>
            <label>Celebration Date<input type="date" value={celebrationForm.eventDate} onChange={(e) => setCelebrationForm((value) => ({ ...value, eventDate: e.target.value }))} /></label>
            <label className="full-span">Title<input value={celebrationForm.title} maxLength={120} onChange={(e) => setCelebrationForm((value) => ({ ...value, title: e.target.value }))} required /></label>
            <label className="full-span">Message<textarea rows={4} value={celebrationForm.message} maxLength={1000} onChange={(e) => setCelebrationForm((value) => ({ ...value, message: e.target.value }))} required /></label>
            <div className="full-span celebration-tags-field">
              <div className="celebration-tags-title"><span><Users size={17} /> Tag People</span><small>{celebrationForm.taggedPeople.length} selected</small></div>
              <input className="celebration-tag-search" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Search employee name or ID" />
              <div className="celebration-tag-list">
                {employees.filter((employee) => `${employee.employeeName} ${employee.employeeCode}`.toLowerCase().includes(tagSearch.toLowerCase())).map((employee) => {
                  const selected = celebrationForm.taggedPeople.some((person) => String(person.id) === String(employee.id));
                  return <button type="button" key={employee.id} className={`celebration-tag-chip ${selected ? 'selected' : ''}`} onClick={() => toggleTaggedPerson(employee)}><span>{initials(employee.employeeName)}</span><span><strong>{employee.employeeName}</strong><small>{employee.employeeCode}</small></span>{selected && <span className="tag-check">✓</span>}</button>;
                })}
                {!employees.length && <span className="empty-inline">No Employees Available to Tag.</span>}
              </div>
            </div>
            <div className="celebration-form-actions full-span"><label className="celebration-file"><ImagePlus size={17} /> Add Photos<input type="file" accept="image/*" multiple hidden onChange={(e) => setCelebrationFiles(Array.from(e.target.files || []))} /></label>{celebrationFiles.length > 0 && <span>{celebrationFiles.length} photo{celebrationFiles.length > 1 ? 's' : ''} selected</span>}<button className="btn celebration-publish-btn" disabled={creating}><Send size={17} />{creating ? 'Adding…' : 'Add Celebration'}</button></div>
          </form>
        </section>
      )}

      {/* ---------- Hero banner ---------- */}
      <motion.section
        className="celebration-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
      >
        <div className="celebration-hero-text">
          <span className="eyebrow">Celebration Wall</span>
          <h1>Celebration Wall</h1>
          <p>Celebrate Birthdays, Work Anniversaries, Festivals, Achievements And Team Milestones Together.</p>
        </div>
        <div className="celebration-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="58" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="42" fill="#bfdbfe" opacity="0.4" />
            {/* Confetti */}
            <rect x="90" y="30" width="6" height="6" rx="2" fill="#fbbf24" transform="rotate(20 93 33)" />
            <rect x="120" y="22" width="5" height="5" rx="2" fill="#ec4899" transform="rotate(-15 122 24)" />
            <rect x="200" y="28" width="6" height="6" rx="2" fill="#22d3ee" transform="rotate(30 203 31)" />
            <rect x="240" y="40" width="5" height="5" rx="2" fill="#a78bfa" transform="rotate(-20 242 42)" />
            {/* Cake */}
            <rect x="130" y="100" width="80" height="55" rx="10" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <rect x="130" y="100" width="80" height="14" rx="7" fill="#fde68a" />
            <path d="M150 100 V88 M170 100 V82 M190 100 V88" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
            <circle cx="150" cy="84" r="3" fill="#fbbf24" />
            <circle cx="170" cy="78" r="3" fill="#fbbf24" />
            <circle cx="190" cy="84" r="3" fill="#fbbf24" />
            {/* People */}
            <circle cx="110" cy="140" r="12" fill="#2563eb" />
            <rect x="98" y="150" width="24" height="20" rx="8" fill="#2563eb" />
            <circle cx="230" cy="140" r="12" fill="#0891b2" />
            <rect x="218" y="150" width="24" height="20" rx="8" fill="#0891b2" />
            {/* Sparkles */}
            <path d="M260 120 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 z" fill="#fbbf24" />
          </svg>
        </div>
      </motion.section>

      <div className="celebration-layout">
        <div className="feed-column">
          {/* ---------- Filter pills ---------- */}
          <motion.div
            className="filter-pills"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            {types.map((item) => {
              const meta = item === 'ALL' ? null : categoryMeta(item);
              const TIcon = meta?.icon || PartyPopper;
              return (
                <button
                  key={item}
                  className={`filter-pill ${active === item ? 'active' : ''}`}
                  onClick={() => { setActive(item); setPage(1); }}
                >
                  {meta && <TIcon size={14} />}
                  {item === 'ALL' ? 'All' : meta?.label || item}
                </button>
              );
            })}
          </motion.div>

          {/* ---------- Feed ---------- */}
          {loading && <p className="empty-inline">Loading Celebrations...</p>}
          {!loading && error && <p className="form-error">{error}</p>}

          {!loading && !error && (
            <motion.div className="feed-list" initial="hidden" animate="show" variants={stagger}>
              {pageItems.map((post) => {
                const meta = categoryMeta(post.type);
                const TIcon = meta.icon;
                const isLiked = Boolean(likedPosts[post.id]);
                const comments = commentsState[post.id] || [];

                return (
                  <motion.article
                    className="panel post-card"
                    key={post.id}
                    variants={fadeUp}
                    whileHover={{ y: -4 }}
                  >
                    {/* Post head */}
                    <div className="post-head">
                      <span className="post-avatar">{initials(post.title || meta.label)}</span>
                      <div className="post-head-info">
                        <strong>{post.title}</strong>
                        <span>{new Date(post.createdAt).toLocaleString()}</span>
                      </div>
                      <span className="post-category-badge" style={{ background: meta.bg, color: meta.color }}>
                        <TIcon size={13} /> {meta.label}
                      </span>
                      {canEditCelebration && post.announcementId && <div className="celebration-card-admin"><button type="button" onClick={() => editWallPost(post)}><Pencil size={15} /> Edit</button><button type="button" className="danger" onClick={() => deleteWallPost(post)}><Trash2 size={15} /> Delete</button></div>}
                    </div>

                    {/* Thumbnail / content */}
                    <div className="post-thumbnail" style={{ background: meta.soft, borderColor: meta.bg }}>
                      <TIcon size={32} style={{ color: meta.color }} />
                      <strong>{post.title}</strong>
                      {post.message && <span className="post-message">{post.message}</span>}
                      {post.taggedPeople.length > 0 && <div className="post-tagged-people"><Users size={15} /><span>With {post.taggedPeople.map((person) => person.name).join(', ')}</span></div>}
                    </div>

                    {/* Actions */}
                    <div className="post-actions">
                      <motion.button
                        className={isLiked ? 'active liked' : ''}
                        onClick={() => toggleLike(post.id)}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Heart size={17} /> {isLiked ? 1 : 0} Like
                      </motion.button>
                      <button><MessageCircle size={17} /> {comments.length} Comments</button>
                      <button className="ghost"><Share2 size={16} /> Share</button>
                      <button className="ghost"><Bookmark size={16} /></button>
                    </div>

                    {/* Comments */}
                    {comments.length > 0 && (
                      <div className="comment-list">
                        {comments.slice(-3).map((comment) => (
                          <div className="comment-item" key={comment.id}>
                            <span className="comment-avatar">{initials(comment.userName)}</span>
                            <div className="comment-body">
                              <strong>{comment.userName}</strong>
                              <span>{comment.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment composer */}
                    <div className="comment-composer">
                      <span className="comment-avatar">{initials(user.name)}</span>
                      <input
                        value={commentDrafts[post.id] || ''}
                        onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                        placeholder="Write a comment..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                      />
                      <motion.button
                        className="icon-btn primary"
                        onClick={() => handleAddComment(post.id)}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Send size={16} />
                      </motion.button>
                    </div>
                  </motion.article>
                );
              })}
              {!visibleFeed.length && (
                <section className="panel empty-state">
                  <PartyPopper size={36} />
                  <p>No Celebration Posts Yet.</p>
                  <small>Celebrations And Company Milestones Will Appear Here.</small>
                </section>
              )}
            </motion.div>
          )}

          <Pagination page={page} totalItems={visibleFeed.length} pageSize={pageSize} onPageChange={setPage} />
        </div>

        {/* ---------- Right sidebar ---------- */}
        <aside className="celebration-side">
          {/* Announcements widget */}
          <motion.section
            className="panel side-widget"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
            whileHover={{ y: -4 }}
          >
            <div className="side-widget-head">
              <span className="side-widget-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                <Megaphone size={18} />
              </span>
              <h2>Announcements</h2>
            </div>
            {announcements.map((item) => (
              <div className="side-content" key={item.id}>
                <div className="side-content-title"><strong>{item.title}</strong>{canEditCelebration && item.announcementId && <div className="side-post-actions"><button type="button" onClick={() => editWallPost(item)} title="Edit"><Pencil size={14} /></button><button type="button" className="danger" onClick={() => deleteWallPost(item)} title="Delete"><Trash2 size={14} /></button></div>}</div>
                <span>{item.message}</span>
              </div>
            ))}
            {!announcements.length && <p className="empty-inline">No Announcements.</p>}
          </motion.section>

          {/* Events widget */}
          <motion.section
            className="panel side-widget"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.18 }}
            whileHover={{ y: -4 }}
          >
            <div className="side-widget-head">
              <span className="side-widget-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CalendarDays size={18} />
              </span>
              <h2>Upcoming Events</h2>
            </div>
            {upcomingEvents.map((item) => (
              <div className="side-content" key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.message || new Date(item.eventDate || item.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {!upcomingEvents.length && <p className="empty-inline">No upcoming events.</p>}
          </motion.section>

          {/* Quick links widget */}
          <motion.section
            className="panel side-widget"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.26 }}
            whileHover={{ y: -4 }}
          >
            <div className="side-widget-head">
              <span className="side-widget-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Gift size={18} />
              </span>
              <h2>Quick Links</h2>
            </div>
            <div className="quick-links">
              <Link to="/announcements" className="quick-link"><Megaphone size={15} /> Announcements</Link>
              <Link to="/events" className="quick-link"><CalendarDays size={15} /> Events</Link>
            </div>
          </motion.section>
        </aside>
      </div>
    </div>
  );
}