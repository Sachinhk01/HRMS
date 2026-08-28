import api from './api';

export async function getNotifications({ page = 0, size = 100 } = {}) {
  const { data } = await api.get('/notifications', { params: { page, size } });
  return data.data;
}

export async function getCelebrationWallToday() {
  const { data } = await api.get('/notifications/celebration-wall/today');
  return data.data;
}

export async function getUpcomingBirthdays(days = 0) {
  const { data } = await api.get('/notifications/upcoming-birthdays', { params: { days } });
  return data.data;
}

// The general notification response has no uploadType field. Magazine
// publishes always include the PDF as the first attachment, while plain
// announcements do not attach PDFs.
function isPdfUrl(url = '') {
  return /\.pdf(\?|#|$)/i.test((url || '').split('/').pop() || '');
}

export function hasPdfAttachment(item = {}) {
  return (item.attachmentUrls || []).some(isPdfUrl);
}

export function isMagazineNotification(item = {}) {
  return item.notificationType === 'ANNOUNCEMENT' && hasPdfAttachment(item);
}

// Maps a backend Announcement (uploadType=MAGAZINE) to the shape
// HighlightCards/Dashboard expect. `month` is derived from the real
// createdAt timestamp rather than being a manually-typed field, since the
// backend doesn't store one.
export function mapAnnouncementToMagazine(announcement) {
  if (!announcement) return null;
  const documentUrl = announcement.attachmentUrls?.[0] || '';
  const month = announcement.createdAt
    ? new Date(announcement.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })
    : '';

  return {
    title: announcement.title || '',
    description: (announcement.message || '').trim(),
    documentUrl,
    documentName: documentUrl ? documentUrl.split('/').pop() : '',
    month,
    updatedAt: announcement.createdAt || '',
  };
}

// NOTE ON THIS FUNCTION: there is no dedicated "latest magazine" endpoint on
// the backend (that's what was causing the magazine to vanish — it was
// calling a URL that 404s, so the catch-block cleared it back to null on
// every load, for every role). Since we can't add a backend endpoint right
// now, this instead reuses the existing, already-working
// GET /notifications/announcement/today endpoint, which really does query
// the shared database and is already open to EMPLOYEE/MANAGER/HR_ADMIN/
// SUPER_ADMIN — so a published magazine now genuinely shows up for everyone,
// not just the browser that published it.
//
// The trade-off: that endpoint only returns announcements created *today*.
// So the magazine will correctly show for every role on the day it's
// published, but will stop appearing once the calendar day rolls over,
// until a new one is published. Removing that limitation needs a real
// backend "latest magazine" endpoint — this is the best fix possible
// without touching backend code.
export async function getLatestMagazine() {
  const { data } = await api.get('/notifications/announcement/today');
  const todaysAnnouncements = data.data || [];
  // Already ordered by createdAt desc from the backend, so the first
  // MAGAZINE-type entry is the most recently published one.
  const latestMagazine = todaysAnnouncements.find(
    (announcement) => announcement.uploadType === 'MAGAZINE'
  );
  return mapAnnouncementToMagazine(latestMagazine);
}

export async function getUnreadCount() {
  const { data } = await api.get('/notifications/unread-count');
  return data.data;
}

export async function markNotificationRead(notificationId) {
  const { data } = await api.patch(`/notifications/${notificationId}/read`);
  return data.data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all');
  return data.data;
}

async function postAnnouncement({ title, message, uploadType = 'POST', attachments = [] }) {
  const formData = new FormData();
  formData.append('request', new Blob([JSON.stringify({ title, message, uploadType })], { type: 'application/json' }));
  attachments.forEach((file) => formData.append('attachments', file));

  // Attachments (e.g. a 20MB+ magazine PDF) take a lot longer to upload
  // than a normal API call — the app-wide 15–60s timeout was built for
  // small JSON requests and cuts a large upload off mid-transfer. Scale
  // the timeout to the payload size instead of using the global default.
  const totalBytes = attachments.reduce((sum, file) => sum + (file?.size || 0), 0);
  const uploadTimeout = Math.max(60000, Math.ceil(totalBytes / (256 * 1024)) * 1000); // ~256KB/s floor

  const { data } = await api.post('/notifications/announcement', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: uploadTimeout,
  });
  return data.data;
}

export function createAnnouncement({ title, message, uploadType = 'POST', attachments = [] }) {
  return postAnnouncement({ title, message, uploadType, attachments });
}

export async function updateAnnouncement(announcementId, { title, message, uploadType = 'POST' }) {
  const { data } = await api.put(`/notifications/announcement/${announcementId}`, { title, message, uploadType });
  return data.data;
}

export async function deleteAnnouncement(announcementId) {
  const { data } = await api.delete(`/notifications/announcement/${announcementId}`);
  return data.data;
}

export function createCelebration({ type = 'GENERAL', title, message, eventDate = '', taggedPeople = [], attachments = [] }) {
  const taggedNames = taggedPeople.map((person) => person.name).filter(Boolean);
  const details = [
    message,
    eventDate ? `Celebration date: ${eventDate}` : '',
    taggedNames.length ? `Tagged people: ${taggedNames.join(', ')}` : '',
    `Celebration type: ${type}`,
  ].filter(Boolean).join('\n\n');
  return postAnnouncement({ title, message: details, uploadType: 'POST', attachments });
}

export function parseNotificationContent(item = {}) {
  return {
    title: item.title || '',
    message: item.message || '',
    date: item.createdAt || null,
    attachmentUrls: item.attachmentUrls || [],
    isMagazine: isMagazineNotification(item),
  };
}

// Only genuine celebration/event content belongs on the "Upcoming Events"
// page — mirrors the same allowlist used on the Celebration Wall so
// operational alerts (late check-in, leave lifecycle, etc.) never leak in.
const EVENT_TYPES = ['BIRTHDAY', 'WORK_ANNIVERSARY', 'HOLIDAY', 'GENERAL'];
export { EVENT_TYPES };

// The "Add Celebration" composer on the Celebration Wall posts through the
// existing /notifications/announcement endpoint (there's no dedicated
// celebration endpoint) and encodes the celebration type/date/tagged people
// as trailing "\n\nLabel: value" lines inside the message body. Parse them
// back out so these posts can be recognised as real events wherever
// notifications are turned into events (Celebration Wall, Events page).
const CELEBRATION_TYPE_RE = /\n\nCelebration type:\s*([A-Z_]+)\s*$/;
const CELEBRATION_DATE_RE = /\n\nCelebration date:\s*([^\n]+)/;
const TAGGED_PEOPLE_RE = /\n\nTagged people:\s*([^\n]+)/;

export function parseCelebrationMeta(rawMessage = '') {
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

// Same "what counts as upcoming" logic as the Celebration Wall's sidebar
// widget: celebration-type notifications (birthdays, work anniversaries,
// general celebration posts, celebration-meta-tagged announcements) plus
// company holidays, whose date falls after today — so the Events page
// shows exactly what the Celebration Wall considers "Upcoming events".
export function buildUpcomingEvents(notifications = [], holidays = []) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const upcoming = [];

  const blockedTypes = [
    'LATE_CHECK_IN', 'MISSED_CHECKOUT', 'ABSENT',
    'LEAVE_APPLIED', 'LEAVE_REJECTED', 'LEAVE_MANAGER_APPROVED', 'LEAVE_HR_APPROVED',
  ];

  (notifications || []).forEach((item) => {
    if (blockedTypes.includes(item.notificationType)) return;

    if (item.notificationType === 'ANNOUNCEMENT') {
      const meta = parseCelebrationMeta(item.message || '');
      if (!meta) return; // plain announcement, not a celebration/event
      const dateVal = new Date(meta.eventDate || item.createdAt);
      if (dateVal > endOfToday) {
        upcoming.push({
          id: item.id,
          type: meta.type,
          title: item.title || '',
          message: meta.message,
          eventDate: meta.eventDate,
          createdAt: item.createdAt,
        });
      }
      return;
    }

    if (!EVENT_TYPES.includes(item.notificationType)) return;
    const dateVal = new Date(item.eventDate || item.createdAt);
    if (dateVal > endOfToday) {
      upcoming.push({
        id: item.id,
        type: item.notificationType,
        title: item.title || '',
        message: item.message || '',
        eventDate: item.eventDate || null,
        createdAt: item.createdAt,
      });
    }
  });

  (holidays || []).forEach((holiday) => {
    const dateVal = new Date(holiday.holidayDate);
    if (dateVal > endOfToday) {
      upcoming.push({
        id: `holiday-${holiday.id}`,
        type: 'HOLIDAY',
        title: holiday.holidayName || 'Holiday',
        message: holiday.description || '',
        eventDate: holiday.holidayDate,
        createdAt: holiday.holidayDate,
      });
    }
  });

  return upcoming;
}

export function splitCelebrationFeedAndEvents(notifications = []) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const celebrationFeed = [];
  const upcomingEvents = [];
  notifications.forEach((item) => {
    if (item.notificationType === 'ANNOUNCEMENT') return;
    if (!EVENT_TYPES.includes(item.notificationType)) return;
    const parsed = parseNotificationContent(item);
    const itemDate = parsed.date ? new Date(parsed.date) : now;
    if (itemDate > endOfToday) upcomingEvents.push(item);
    else celebrationFeed.push(item);
  });
  return { celebrationFeed, upcomingEvents };
}