import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Heart, Share2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { getNotifications, buildUpcomingEvents } from '../services/notificationService';
import { getHolidays } from '../services/holidayService';
import './Events.css';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

export default function Events() {
  const [notifications, setNotifications] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Same two sources the Celebration Wall's "Upcoming events" widget
  // pulls from: celebration-type notifications and company holidays.
  // One source failing (e.g. a role-gated holidays endpoint) doesn't
  // blank out the other.
  const loadData = async () => {
    setLoading(true);
    setError('');
    const [notifResult, holidayResult] = await Promise.allSettled([
      getNotifications({ page: 0, size: 100 }),
      getHolidays({ page: 0, size: 100, sortBy: 'holidayDate', sortDirection: 'asc' }),
    ]);

    if (notifResult.status === 'fulfilled') {
      setNotifications(notifResult.value?.content || []);
    } else {
      setNotifications([]);
      setError(notifResult.reason?.message || 'Failed to load events.');
    }
    setHolidays(holidayResult.status === 'fulfilled' ? (holidayResult.value?.content || []) : []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Exactly what the Celebration Wall's "Upcoming events" sidebar shows —
  // birthdays, work anniversaries, general celebration posts, and
  // holidays whose date is still ahead of today.
  const eventsList = useMemo(
    () => sortRecent(buildUpcomingEvents(notifications, holidays)),
    [notifications, holidays]
  );

  const { page, pageItems, pageSize, setPage } = usePagination(eventsList, 6);

  return (
    <div className="page-stack events-page page-reveal">
      <PageHeader
        eyebrow="Company Activities"
        title="Upcoming Events"
        description="Stay Connected With Upcoming Company Activities, Celebrations, And Team Milestones."
      />

      {/* ---------- Hero banner ---------- */}
      <motion.section
        className="ev-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
      >
        <div className="ev-hero-text">
          <span className="eyebrow">Company Activities</span>
          <h1>Upcoming Events</h1>
          <p>Stay Connected With Company Activities And Celebration Events.</p>
        </div>
        <div className="ev-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="56" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="40" fill="#bfdbfe" opacity="0.4" />
            <rect x="110" y="50" width="130" height="120" rx="18" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <rect x="110" y="50" width="130" height="30" rx="18" fill="#2563eb" />
            <rect x="110" y="68" width="130" height="12" fill="#2563eb" />
            <circle cx="135" cy="46" r="6" fill="#64748b" />
            <circle cx="215" cy="46" r="6" fill="#64748b" />
            <rect x="125" y="92" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="148" y="92" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="171" y="92" width="14" height="14" rx="4" fill="#2563eb" />
            <rect x="194" y="92" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="125" y="114" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="148" y="114" width="14" height="14" rx="4" fill="#fde68a" />
            <rect x="171" y="114" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="194" y="114" width="14" height="14" rx="4" fill="#e0edff" />
          </svg>
        </div>
      </motion.section>

      {/* ---------- Event cards ---------- */}
      {loading && <p className="empty-inline">Loading Events...</p>}
      {!loading && error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <motion.div className="ev-grid" initial="hidden" animate="show" variants={stagger}>
          {pageItems.map((item) => {
            const dateVal = item.eventDate || item.createdAt;
            const dateObj = dateVal ? new Date(dateVal) : null;
            return (
              <motion.article className="panel ev-card" key={item.id} variants={fadeUp} whileHover={{ y: -6 }}>
                <div className="ev-card-banner">
                  <div className="ev-date-badge">
                    <strong>{dateObj ? dateObj.getDate() : '—'}</strong>
                    <small>{dateObj ? dateObj.toLocaleString([], { month: 'short' }) : ''}</small>
                  </div>
                </div>
                <div className="ev-card-body">
                  <h3>{item.title}</h3>
                  <p>{item.message}</p>
                  <div className="ev-card-actions">
                    <button className="btn btn-small btn-gradient"><Heart size={14} /> Interested</button>
                    <button className="icon-btn" title="Share"><Share2 size={15} /></button>
                    <button className="icon-btn" title="Add to Calendar"><CalendarDays size={15} /></button>
                  </div>
                </div>
              </motion.article>
            );
          })}
          {!eventsList.length && (
            <section className="panel empty-state">
              <CalendarDays size={36} />
              <p>No Events Scheduled.</p>
              <small>Company Events And Celebration Milestones Will Appear Here.</small>
            </section>
          )}
        </motion.div>
      )}

      <Pagination page={page} totalItems={eventsList.length} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}