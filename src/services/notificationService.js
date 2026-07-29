import api from './api';

/**
 * Fetch the logged-in employee's notifications (paginated).
 * Returns the unwrapped PageResponse<NotificationResponse>: { content, page, size, totalElements, totalPages, first, last }
 */
export async function getNotifications({ page = 0, size = 10 } = {}) {
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

export async function createAnnouncement({ title, message }) {
  const { data } = await api.post('/notifications/announcement', { title, message });
  return data.data;
}