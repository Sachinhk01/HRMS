import api from './api';

export async function getNotifications({ page = 0, size = 100 } = {}) {
  const { data } = await api.get('/notifications', { params: { page, size } });
  return data.data;
}

export async function getCelebrationWallToday() {
  const { data } = await api.get('/notifications/celebration-wall/today');
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

async function postAnnouncement({ title, message, uploadType = 'POST', attachments = [] }) {
  const formData = new FormData();
  formData.append('request', new Blob([JSON.stringify({ title, message, uploadType })], { type: 'application/json' }));
  attachments.forEach((file) => formData.append('attachments', file));
  const { data } = await api.post('/notifications/announcement', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
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
  };
}

export function splitCelebrationFeedAndEvents(notifications = []) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const celebrationFeed = [];
  const upcomingEvents = [];
  notifications.forEach((item) => {
    if (item.notificationType === 'ANNOUNCEMENT') return;
    const parsed = parseNotificationContent(item);
    const itemDate = parsed.date ? new Date(parsed.date) : now;
    if (itemDate > endOfToday) upcomingEvents.push(item);
    else celebrationFeed.push(item);
  });
  return { celebrationFeed, upcomingEvents };
}
