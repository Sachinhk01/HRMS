import { useEffect, useState } from 'react';
import {
  Bell, BookOpen, CalendarCheck2, CalendarX2, CheckCheck, Megaphone,
  PartyPopper, TimerReset, UserX,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { getNotifications, markAllNotificationsRead, markNotificationRead, isMagazineNotification } from '../services/notificationService';
import { useNotifications } from '../context/NotificationContext';
import './Notifications.css';

// Matches backend NotificationType enum exactly. Each entry pairs an icon with a color tone.
const TYPE_META = {
  LEAVE_APPLIED: { icon: CalendarCheck2, tone: 'tone-blue' },
  LEAVE_MANAGER_APPROVED: { icon: CheckCheck, tone: 'tone-green' },
  LEAVE_HR_APPROVED: { icon: CheckCheck, tone: 'tone-green' },
  LEAVE_REJECTED: { icon: CalendarX2, tone: 'tone-red' },
  LEAVE_CANCELLED: { icon: CalendarX2, tone: 'tone-orange' },
  LATE_CHECK_IN: { icon: TimerReset, tone: 'tone-orange' },
  ABSENT: { icon: UserX, tone: 'tone-red' },
  MISSED_CHECKOUT: { icon: TimerReset, tone: 'tone-orange' },
  HOLIDAY: { icon: CalendarCheck2, tone: 'tone-teal' },
  BIRTHDAY: { icon: PartyPopper, tone: 'tone-pink' },
  WORK_ANNIVERSARY: { icon: PartyPopper, tone: 'tone-pink' },
  ANNOUNCEMENT: { icon: Megaphone, tone: 'tone-blue' },
  APPROVED: { icon: CheckCheck, tone: 'tone-green' },
  GENERAL: { icon: Bell, tone: '' },
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { refreshUnreadCount, decrementUnreadCount, setUnreadCount } = useNotifications();

  const load = () => {
    setLoading(true);
    getNotifications({ page: 0, size: 20 })
      .then((res) => setItems(res?.content || []))
      .catch((err) => setError(err.message || 'Failed to load notifications.'))
      .finally(() => setLoading(false));
  };

  // Loading this page doesn't mark anything read by itself — only clicking a
  // row or "Mark all as read" does, matching the explicit actions below.
  // If you'd rather everything auto-clear just by opening the inbox, call
  // markAllNotificationsRead() + setUnreadCount(0) inside this effect instead.
  useEffect(() => { load(); refreshUnreadCount(); }, []);

  const handleRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    decrementUnreadCount(1);
    try {
      await markNotificationRead(id);
    } catch {
      load();
      refreshUnreadCount();
    }
  };

  const handleReadAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      load();
      refreshUnreadCount();
    }
  };

  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Important Updates Across HR, Attendance And Team Activity."
        action={hasUnread ? (
          <button className="btn btn-light" onClick={handleReadAll}>
            <CheckCheck size={16} /> Mark All As Read
          </button>
        ) : null}
      />
      <section className="panel notifications-panel">
        {loading && <p className="empty-inline">Loading Notifications…</p>}
        {!loading && error && <p className="form-error">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <EmptyState title="You're All Caught Up" text="No New Notifications." />
        )}
        {!loading && !error && items.map((item) => {
          const meta = isMagazineNotification(item)
            ? { icon: BookOpen, tone: 'tone-purple' }
            : (TYPE_META[item.notificationType] || TYPE_META.GENERAL);
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
              className={`notification-row${!item.isRead ? ' is-unread' : ''}`}
              onClick={() => !item.isRead && handleRead(item.id)}
            >
              <div className={`notification-icon ${meta.tone}`}><Icon size={19} /></div>
              <div className="notification-body">
                <strong>{item.title}</strong>
                {item.message && <span>{item.message}</span>}
              </div>
              <small className="notification-time">
                {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
              </small>
            </div>
          );
        })}
      </section>
    </div>
  );
}