import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Heart, Share2, Plus, X, ImagePlus, Send,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getNotifications, buildUpcomingEvents, createCelebration } from '../services/notificationService';
import './Events.css';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

export default function Events() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Events are posted through the same /notifications/announcement
  // endpoint as celebrations (createCelebration encodes type/eventDate
  // into the message), which the backend restricts to
  // SUPER_ADMIN/HR_ADMIN/MANAGER — but the "Add Event" button on this
  // page is surfaced for HR only.
  const canCreateEvent = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user?.role || user?.roles?.[0]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [eventForm, setEventForm] = useState({ type: 'GENERAL', title: '', message: '', eventDate: '' });
  const [eventFiles, setEventFiles] = useState([]);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Company holidays are shown on their own Holidays view (and in the
  // Celebration Wall's "Upcoming events" sidebar) — they're fixed calendar
  // dates, not something the company "conducts". This page is only for
  // real company-run activities and celebrations, so it loads notifications
  // alone and never fetches holidays.
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const notifResult = await getNotifications({ page: 0, size: 100 });
      setNotifications(notifResult?.content || []);
    } catch (err) {
      setNotifications([]);
      setError(err?.message || 'Failed to load events.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Same celebration-type filtering the Celebration Wall's "Upcoming
  // events" sidebar uses (birthdays, work anniversaries, general
  // celebration posts) — just without holidays mixed in, since those
  // aren't company-conducted events.
  const eventsList = useMemo(
    () => sortRecent(buildUpcomingEvents(notifications)),
    [notifications]
  );

  const { page, pageItems, pageSize, setPage } = usePagination(eventsList, 6);

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      await createCelebration({ ...eventForm, attachments: eventFiles });
      setEventForm({ type: 'GENERAL', title: '', message: '', eventDate: '' });
      setEventFiles([]);
      setComposerOpen(false);
      showToast('Event Added Successfully.', 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed To Add Event.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-stack events-page page-reveal">
      <PageHeader
        eyebrow="Company Activities"
        title="Upcoming Events"
        description="Stay Connected With Upcoming Company Activities, Celebrations, And Team Milestones."
        action={
          canCreateEvent ? (
            <button type="button" className="btn btn-gradient" onClick={() => setComposerOpen(true)}>
              <Plus size={18} /> Add Event
            </button>
          ) : null
        }
      />

      {/* ---------- HR-only composer ---------- */}
      {canCreateEvent && composerOpen && (
        <section className="panel ev-composer">
          <div className="panel-title">
            <div>
              <span className="eyebrow">HR Event</span>
              <h2>Add an Event</h2>
            </div>
            <button type="button" className="icon-btn" onClick={() => setComposerOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <p className="panel-desc">Only Events Dated In The Future Will Appear In The Upcoming List.</p>

          <form className="ev-form-grid" onSubmit={handleCreateEvent}>
            <div className="ev-field">
              <span className="ev-label">Event Type</span>
              <select
                value={eventForm.type}
                onChange={(e) => setEventForm((v) => ({ ...v, type: e.target.value }))}
              >
                <option value="GENERAL">General Event</option>
                <option value="BIRTHDAY">Birthday</option>
                <option value="WORK_ANNIVERSARY">Work Anniversary</option>
              </select>
            </div>

            <div className="ev-field">
              <span className="ev-label">Event Date</span>
              <input
                type="date"
                min={todayStr}
                value={eventForm.eventDate}
                onChange={(e) => setEventForm((v) => ({ ...v, eventDate: e.target.value }))}
                required
              />
            </div>

            <div className="ev-field full-span">
              <span className="ev-label">Title</span>
              <input
                value={eventForm.title}
                maxLength={120}
                onChange={(e) => setEventForm((v) => ({ ...v, title: e.target.value }))}
                placeholder="Event Title"
                required
              />
            </div>

            <div className="ev-field full-span">
              <span className="ev-label">Message</span>
              <textarea
                rows={4}
                value={eventForm.message}
                maxLength={1000}
                onChange={(e) => setEventForm((v) => ({ ...v, message: e.target.value }))}
                placeholder="Write The Event Details..."
                required
              />
            </div>

            <div className="ev-field full-span">
              <label className="ev-attach">
                <ImagePlus size={15} /> Add Photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => setEventFiles(Array.from(e.target.files || []))}
                />
              </label>
              {eventFiles.length > 0 && (
                <span className="empty-inline">
                  {eventFiles.length} Photo{eventFiles.length > 1 ? 's' : ''} Selected
                </span>
              )}
            </div>

            <div className="ev-form-actions full-span">
              <button type="button" className="btn btn-soft" onClick={() => setComposerOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-gradient" disabled={creating}>
                <Send size={16} /> {creating ? 'Adding…' : 'Add Event'}
              </button>
            </div>
          </form>
        </section>
      )}

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