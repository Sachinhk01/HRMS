import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Heart, Share2, Plus, X, ImagePlus, Send, Trash2,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import PostAttachments from '../components/PostAttachments';
import { getAllNotifications, selectEvents, createEvent, deleteAnnouncement, canDeleteAnnouncement, getCelebrationMessageLimit, PHOTO_ACCEPT, validatePhotos } from '../services/notificationService';
import './Events.css';
import DatePicker from '../components/DatePicker';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

export default function Events() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [deletingId, setDeletingId] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Events are posted through the same /notifications/announcement
  // endpoint as celebrations (createEvent encodes kind and event date into
  // the message), which the backend restricts to
  // SUPER_ADMIN/HR_ADMIN/MANAGER — but the "Add Event" button on this
  // page is surfaced for HR only.
  const canDelete = canDeleteAnnouncement(user?.role || user?.roles?.[0]);
  const canCreateEvent = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user?.role || user?.roles?.[0]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', message: '', eventDate: '' });
  const [tab, setTab] = useState('UPCOMING');
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
      setNotifications(await getAllNotifications());
    } catch (err) {
      setNotifications([]);
      setError(err?.message || 'Failed to load events.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const { upcoming, past } = useMemo(() => selectEvents(notifications), [notifications]);
  const eventsList = tab === 'UPCOMING' ? upcoming : past;
  const messageLimit = getCelebrationMessageLimit({ kind: 'EVENT', type: 'EVENT', eventDate: eventForm.eventDate || '0000-00-00' });

  const { page, pageItems, pageSize, setPage } = usePagination(eventsList, 6);

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    const photoError = validatePhotos(eventFiles);
    if (photoError) {
      showToast(photoError, 'error');
      return;
    }
    setCreating(true);
    try {
      await createEvent({ ...eventForm, attachments: eventFiles });
      setEventForm({ title: '', message: '', eventDate: '' });
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

  const handleDelete = async (item) => {
    if (!item.announcementId) {
      showToast('This event cannot be deleted.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Delete event',
      message: `Delete "${item.title}" for everyone? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await deleteAnnouncement(item.announcementId);
      showToast('Event deleted.', 'success');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Could not delete the event. Please try again.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="page-stack events-page page-reveal">
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
          <p className="panel-desc">Events dated today or later appear under Upcoming; earlier ones move to Past.</p>

          <form className="ev-form-grid" onSubmit={handleCreateEvent}>
            <div className="ev-field">
              <span className="ev-label">Event Date</span>
              <DatePicker id="event-date"
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
                maxLength={100}
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
                maxLength={messageLimit}
                onChange={(e) => setEventForm((v) => ({ ...v, message: e.target.value }))}
                placeholder="Write The Event Details..."
                required
              />
            </div>

            <div className="ev-field full-span">
              <label className="ev-attach">
                <ImagePlus size={15} /> Add Photos (PNG or JPG)
                <input
                  type="file"
                  accept={PHOTO_ACCEPT}
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
                <Send size={16} /> {creating ? 'Publishing…' : 'Publish Event'}
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
          {canCreateEvent && !composerOpen && (
            <button type="button" className="ev-hero-btn" onClick={() => setComposerOpen(true)}>
              <Plus size={18} /> Add Event
            </button>
          )}
        </div>
        <div className="ev-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="262" cy="50" r="46" fill="#fff" opacity="0.14" />
            <circle cx="54" cy="158" r="36" fill="#fff" opacity="0.12" />

            <rect className="ev-conf" style={{ '--i': 0 }} x="92" y="26" width="9" height="4" rx="2" fill="#fde047" />
            <circle className="ev-conf" style={{ '--i': 1 }} cx="150" cy="20" r="3.5" fill="#fff" />
            <rect className="ev-conf" style={{ '--i': 2 }} x="208" y="26" width="8" height="4" rx="2" fill="#67e8f9" />
            <circle className="ev-conf" style={{ '--i': 3 }} cx="244" cy="40" r="3" fill="#f9a8d4" />
            <rect className="ev-conf" style={{ '--i': 4 }} x="120" y="14" width="7" height="4" rx="2" fill="#86efac" />
            <circle className="ev-conf" style={{ '--i': 5 }} cx="286" cy="90" r="3" fill="#fde047" />
            <rect className="ev-conf" style={{ '--i': 6 }} x="40" y="100" width="8" height="4" rx="2" fill="#fff" />

            <g transform="translate(80,32)"><path className="ev-star" d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#fde047" /></g>
            <g transform="translate(272,150)"><path className="ev-star ev-star--b" d="M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8 Z" fill="#fff" /></g>

            <g transform="translate(62,112)">
              <g className="ev-balloon">
                <path d="M0 24 Q-6 34 0 44 T0 62" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.8" />
                <ellipse cx="0" cy="0" rx="15" ry="19" fill="#fb7185" />
                <path d="M-3 19 L3 19 L0 24 Z" fill="#e11d48" />
                <ellipse cx="-5" cy="-6" rx="3" ry="5" fill="#fff" opacity="0.5" />
              </g>
            </g>
            <g transform="translate(260,98)">
              <g className="ev-balloon ev-balloon--b">
                <path d="M0 22 Q-6 32 0 42 T0 58" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.8" />
                <ellipse cx="0" cy="0" rx="13" ry="17" fill="#fde047" />
                <path d="M-3 17 L3 17 L0 22 Z" fill="#f59e0b" />
                <ellipse cx="-4" cy="-5" rx="3" ry="4.5" fill="#fff" opacity="0.5" />
              </g>
            </g>
            <g transform="translate(36,64)">
              <g className="ev-balloon ev-balloon--c">
                <path d="M0 18 Q-5 26 0 34 T0 48" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.8" />
                <ellipse cx="0" cy="0" rx="12" ry="16" fill="#4ade80" />
                <path d="M-3 15 L3 15 L0 20 Z" fill="#16a34a" />
                <ellipse cx="-4" cy="-5" rx="2.5" ry="4" fill="#fff" opacity="0.5" />
              </g>
            </g>

            <g className="ev-cal" transform="translate(88,30)">
              <rect x="66" y="38" width="120" height="118" rx="18" fill="#fff" opacity="0.96" />
              <rect x="66" y="38" width="120" height="28" rx="18" fill="#8b5cf6" />
              <rect x="78" y="76" width="20" height="18" rx="5" fill="#e9d5ff" />
              <rect x="104" y="76" width="20" height="18" rx="5" fill="#ede9fe" />
              <rect x="130" y="76" width="20" height="18" rx="5" fill="#ddd6fe" />
              <rect x="156" y="76" width="20" height="18" rx="5" fill="#f5d0fe" />
              <rect x="78" y="104" width="20" height="18" rx="5" fill="#dbeafe" />
              <rect x="104" y="104" width="20" height="18" rx="5" fill="#fef3c7" />
              <rect x="130" y="104" width="20" height="18" rx="5" fill="#d1fae5" />
              <rect x="156" y="104" width="20" height="18" rx="5" fill="#fee2e2" />
              <rect x="96" y="130" width="66" height="12" rx="6" fill="#f3f4f6" />
            </g>
          </svg>
        </div>
      </motion.section>

      <div className="ev-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'UPCOMING'} className={tab === 'UPCOMING' ? 'active' : ''} onClick={() => { setTab('UPCOMING'); setPage(1); }}>Upcoming ({upcoming.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'PAST'} className={tab === 'PAST' ? 'active' : ''} onClick={() => { setTab('PAST'); setPage(1); }}>Past ({past.length})</button>
      </div>

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
                  <PostAttachments urls={item.attachmentUrls} title={item.title} maxImages={2} />
                  <div className="ev-card-actions">
                    <button className="btn btn-small btn-gradient"><Heart size={14} /> Interested</button>
                    <button className="icon-btn" title="Share"><Share2 size={15} /></button>
                    <button className="icon-btn" title="Add to Calendar"><CalendarDays size={15} /></button>
                    {canDelete && (
                      <button
                        type="button"
                        className="post-delete-btn"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 size={14} /> {deletingId === item.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
          {!eventsList.length && (
            <section className="panel empty-state">
              <CalendarDays size={36} />
              <p>{tab === 'UPCOMING' ? 'No Upcoming Events.' : 'No Past Events.'}</p>
              <small>Events Published By HR Will Appear Here.</small>
            </section>
          )}
        </motion.div>
      )}

      <Pagination page={page} totalItems={eventsList.length} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}