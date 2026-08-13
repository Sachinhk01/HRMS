import api from './api';

/**
 * Fetch the logged-in employee's notifications (paginated).
 * Returns the unwrapped PageResponse<NotificationResponse>: { content, page, size, totalElements, totalPages, first, last }
 */
export async function getNotifications({ page = 0, size = 100 } = {}) {
  const { data } = await api.get('/notifications', { params: { page, size } });
  return data.data;
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

/**
 * GET /notifications/celebration-wall/today
 * Backend-side this already excludes ATTENDANCE and LEAVE reference types, so
 * whatever comes back is safe to render as-is (birthdays, work anniversaries,
 * announcements). Open to EMPLOYEE, MANAGER, HR_ADMIN, SUPER_ADMIN.
 */
export async function getCelebrationWallToday() {
  const { data } = await api.get('/notifications/celebration-wall/today');
  return data.data;
}

/**
 * POST /notifications/announcement (multipart).
 * uploadType is REQUIRED by the backend (AnnouncementRequest.uploadType is @NotNull) —
 * the previous version of this function omitted it, which would 400 on every call.
 * Allowed roles server-side: SUPER_ADMIN, HR_ADMIN, MANAGER.
 */
export async function createAnnouncement({ title, message, uploadType = 'POST', attachments = [] }) {
  const formData = new FormData();
  const requestBlob = new Blob([JSON.stringify({ title, message, uploadType })], { type: 'application/json' });
  formData.append('request', requestBlob);

  if (Array.isArray(attachments) && attachments.length > 0) {
    attachments.forEach((file) => {
      formData.append('attachments', file);
    });
  }

  const { data } = await api.post('/notifications/announcement', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

/**
 * Read title, message, and date directly from the backend NotificationResponse JSON.
 * Backend stores plain strings in title and message — no JSON-within-JSON needed.
 * Fields: id, title, message, notificationType, priority, referenceType, referenceId,
 *         attachmentUrls, isRead, createdAt
 */
export function parseNotificationContent(item = {}) {
  return {
    title: item.title || '',
    message: item.message || '',
    date: item.createdAt || null,
    attachmentUrls: item.attachmentUrls || [],
  };
}

/**
 * Utility: Separate celebration notifications into Today/Past feed vs Upcoming events.
 * Compares item.eventDate or item.createdAt against current date.
 */
export function splitCelebrationFeedAndEvents(notifications = []) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const celebrationFeed = [];
  const upcomingEvents = [];

  notifications.forEach((item) => {
    const parsed = parseNotificationContent(item);
    const itemDate = parsed.date ? new Date(parsed.date) : now;

    if (itemDate > endOfToday) {
      upcomingEvents.push(item);
    } else {
      celebrationFeed.push(item);
    }
  });

  return { celebrationFeed, upcomingEvents };
}