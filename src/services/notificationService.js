import { getSection, setSection } from './localStorageService';

const NOTIFICATIONS_KEY = 'notifications';
const all = () => getSection(NOTIFICATIONS_KEY) || [];
const save = (items) => setSection(NOTIFICATIONS_KEY, items);
const generateId = () => `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function getNotifications() { return all(); }

export function createNotification(notificationData) {
  const item = {
    id: generateId(),
    userId: notificationData.userId,
    title: notificationData.title,
    message: notificationData.message,
    type: notificationData.type || 'INFO',
    relatedId: notificationData.relatedId || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
  save([item, ...all()]);
  return item;
}

export const getUserNotifications = (userId) => all().filter((item) => item.userId === userId);

export function markNotificationRead(notificationId) {
  const next = all().map((item) => item.id === notificationId ? { ...item, read: true } : item);
  save(next); return next.find((item) => item.id === notificationId);
}

export function markAllNotificationsRead(userId) {
  const next = all().map((item) => item.userId === userId ? { ...item, read: true } : item);
  save(next); return next.filter((item) => item.userId === userId);
}
