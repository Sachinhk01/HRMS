import { useEffect, useState } from 'react';
import {
  Bell, CalendarCheck2, CalendarX2, CheckCheck, Megaphone,
  PartyPopper, TimerReset, UserX,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notificationService';
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

  const load = () => {
    setLoading(true);
    getNotifications({ page: 0, size: 20 })
      .then((res) => setItems(res?.content || []))
      .catch((err) => setError(err.message || 'Failed to load notifications.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      load();
    }
  };

  const handleReadAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  };

  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Important updates across HR, attendance and team activity."
        action={hasUnread ? (
          <button className="btn btn-light" onClick={handleReadAll}>
            <CheckCheck size={16} /> Mark all as read
          </button>
        ) : null}
      />
      <section className="panel notifications-panel">
        {loading && <p className="empty-inline">Loading notifications…</p>}
        {!loading && error && <p className="form-error">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <EmptyState title="You're all caught up" text="No new notifications." />
        )}
        {!loading && !error && items.map((item) => {
          const meta = TYPE_META[item.notificationType] || TYPE_META.GENERAL;
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
                <span>{item.message}</span>
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