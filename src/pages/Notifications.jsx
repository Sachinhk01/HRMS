import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  Bell, BellRing, BookOpen, CalendarCheck2, CalendarDays, CalendarX2, Check, CheckCheck, Inbox, Megaphone,
  PartyPopper, RotateCw, TimerReset, UserX,
} from 'lucide-react';
import { getNotifications, markAllNotificationsRead, markNotificationRead, isMagazineNotification } from '../services/notificationService';
import { useNotifications } from '../context/NotificationContext';
import { EASE_OUT } from '../components/Motion';
import PageHero from '../components/PageHero';
import StatCards from '../components/StatCards';
import './Notifications.css';
import './NotificationsRedesign.css';

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
  GENERAL: { icon: Bell, tone: 'tone-slate' },
};

const FILTERS = [{ id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' }];
const PAGE_SIZE = 20;

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function groupLabel(value) {
  if (!value) return 'Earlier';
  const date = new Date(value);
  const diff = Math.round((dayStart(new Date()) - dayStart(date)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24 && dayStart(date) === dayStart(new Date())) return `${Math.floor(mins / 60)}h ago`;
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

const META_RE = /(?:\s*Celebration date:\s*(\d{4}-\d{2}-\d{2}))?(?:\s*Celebration type:\s*([A-Za-z_]+))?\s*$/i;
function parseMessage(message = '') {
  const m = message.match(META_RE);
  if (!m || (!m[1] && !m[2])) return { text: message };
  const date = m[1] && new Date(`${m[1]}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const type = m[2] && m[2].toUpperCase() !== 'GENERAL' ? m[2].replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '';
  return { text: message.slice(0, m.index).trim(), date, type };
}

function Count({ value }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.b key={value} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.2 }}>
        {value}
      </motion.b>
    </AnimatePresence>
  );
}

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageNo, setPageNo] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [settled, setSettled] = useState(false);
  const { refreshUnreadCount, decrementUnreadCount, setUnreadCount } = useNotifications();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getNotifications({ page: 0, size: PAGE_SIZE })
      .then((res) => {
        setItems(res?.content || []);
        setPageNo(0);
        setHasMore(!(res?.last ?? true));
      })
      .catch((err) => setError(err.message || 'Failed to load notifications.'))
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await getNotifications({ page: pageNo + 1, size: PAGE_SIZE });
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...(res?.content || []).filter((item) => !seen.has(item.id))];
      });
      setPageNo((page) => page + 1);
      setHasMore(!(res?.last ?? true));
    } catch (err) {
      setError(err.message || 'Failed to load more notifications.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(); refreshUnreadCount(); }, [load, refreshUnreadCount]);

  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(() => setSettled(true), 1000);
    return () => clearTimeout(timer);
  }, [loading]);

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

  const unreadCount = items.filter((n) => !n.isRead).length;
  const todayCount = items.filter((n) => groupLabel(n.createdAt) === 'Today').length;
  const announcementCount = items.filter((n) => n.notificationType === 'ANNOUNCEMENT').length;

  const groups = useMemo(() => {
    const visible = items
      .filter((n) => filter === 'all' || !n.isRead)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const map = new Map();
    visible.forEach((n) => {
      const label = groupLabel(n.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(n);
    });
    return [...map.entries()];
  }, [items, filter]);

  let rowIndex = 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="nt-page">
        <PageHero
          eyebrow="Inbox"
          title="Notifications"
          description="Updates across HR, attendance and your team."
          icon={unreadCount > 0 ? BellRing : Bell}
          action={(
            <div className="nt-head-actions">
              <AnimatePresence mode="wait" initial={false}>
                {unreadCount > 0 ? (
                  <motion.span key="unread" className="nt-pill" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.18 }}>
                    <i className="nt-pill-dot" /><Count value={unreadCount} /> unread
                  </motion.span>
                ) : (
                  <motion.span key="clear" className="nt-pill is-clear" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.18 }}>
                    <Check size={14} /> All caught up
                  </motion.span>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.button
                    type="button" className="nt-markall" onClick={handleReadAll}
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }}
                  >
                    <CheckCheck size={16} /> Mark all as read
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        />

        {!loading && !error && (
          <StatCards items={[
            { label: 'Total', value: items.length, icon: Inbox, tone: 'blue', note: 'Loaded notifications' },
            { label: 'Unread', value: unreadCount, icon: BellRing, tone: 'amber', note: unreadCount ? 'Waiting for you' : 'Nothing pending' },
            { label: 'Today', value: todayCount, icon: CalendarCheck2, tone: 'green', note: 'Received today' },
            { label: 'Announcements', value: announcementCount, icon: Megaphone, tone: 'violet', note: 'From HR' },
          ]} />
        )}

        <div className="nt-filters" role="tablist" aria-label="Filter notifications">
          {FILTERS.map(({ id, label }) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>
              {filter === id && <motion.span layoutId="nt-filter-pill" className="nt-filter-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span>{label}</span>
              {id === 'unread' && unreadCount > 0 && <em><Count value={unreadCount} /></em>}
            </button>
          ))}
        </div>

        <section className="nt-panel" aria-live="polite">
          {loading && (
            <div className="nt-skeletons" aria-label="Loading notifications">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="nt-skel" key={i}><span className="nt-skel-icon" /><div><i style={{ width: `${40 + (i % 3) * 12}%` }} /><i style={{ width: `${62 + (i % 2) * 14}%` }} /></div></div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="nt-state">
              <p className="nt-error">{error}</p>
              <button type="button" className="nt-retry" onClick={load}><RotateCw size={15} /> Try again</button>
            </div>
          )}

          {!loading && !error && groups.length === 0 && (
            <motion.div className="nt-state" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE_OUT }}>
              <span className="nt-empty-icon">
                <Bell size={30} />
                <motion.i initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.25 }}><Check size={13} strokeWidth={3} /></motion.i>
              </span>
              <strong>{filter === 'unread' ? "You're all caught up" : 'Nothing here yet'}</strong>
              <p>{filter === 'unread' ? 'New notifications will show up here.' : 'Updates from HR and your team will appear here.'}</p>
            </motion.div>
          )}

          {!loading && !error && (
            <AnimatePresence initial>
              {groups.map(([label, list]) => (
                <motion.div key={label} className="nt-group" layout="position" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <h2>{label}<span>{list.length}</span></h2>
                  <ul>
                    <AnimatePresence initial>
                      {list.map((item) => {
                        const idx = rowIndex++;
                        const meta = isMagazineNotification(item) ? { icon: BookOpen, tone: 'tone-purple' } : (TYPE_META[item.notificationType] || TYPE_META.GENERAL);
                        const Icon = meta.icon;
                        const { text, date, type } = parseMessage(item.message);
                        const unread = !item.isRead;
                        const markRead = () => unread && handleRead(item.id);
                        return (
                          <motion.li
                            key={item.id} layout="position" className="nt-li"
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.35, ease: EASE_OUT, delay: settled ? 0 : Math.min(idx, 10) * 0.045 }}
                          >
                            <div
                              className={`nt-row${unread ? ' is-unread' : ''}`}
                              role={unread ? 'button' : undefined} tabIndex={unread ? 0 : undefined}
                              aria-label={unread ? `${item.title}, unread. Press to mark as read` : undefined}
                              onClick={markRead}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markRead(); } }}
                            >
                              <span className={`nt-icon ${meta.tone}`}><Icon size={19} /></span>
                              <div className="nt-body">
                                <strong>
                                  {item.title}
                                  <AnimatePresence>{unread && <motion.i key="dot" className="nt-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 24 }} />}</AnimatePresence>
                                </strong>
                                {text && <span className="nt-text">{text}</span>}
                                {(date || type) && (
                                  <span className="nt-chips">
                                    {date && <em><CalendarDays size={12} />{date}</em>}
                                    {type && <em>{type}</em>}
                                  </span>
                                )}
                              </div>
                              <time className="nt-time" dateTime={item.createdAt} title={item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}>{timeLabel(item.createdAt)}</time>
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!loading && !error && hasMore && (
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
              <button type="button" className="btn btn-soft" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </section>
      </div>
    </MotionConfig>
  );
}
