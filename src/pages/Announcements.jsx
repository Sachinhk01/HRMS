import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Megaphone, Plus, X, Send,
} from 'lucide-react';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getNotifications, parseNotificationContent, isMagazineNotification, isCelebrationOrEventNotification, createAnnouncement } from '../services/notificationService';
import { getFriendlyError, validatePostText, POST_TITLE_MAX, POST_MESSAGE_MAX } from '../utils/postValidation';
import './Announcements.css';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };


export default function Announcements() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Backend restricts POST /notifications/announcement to
  // SUPER_ADMIN / HR_ADMIN / MANAGER, but on this page the composer is
  // surfaced for HR only (mirrors the canCreateCelebration check on the
  // Celebration Wall).
  const canCreateAnnouncement = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user?.role || user?.roles?.[0]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '' });
  const [announcementFiles, setAnnouncementFiles] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getNotifications({ page: 0, size: 100 });
      setNotifications(res?.content || []);
    } catch (err) {
      setError(getFriendlyError(err, 'Unable to load announcements right now. Please try again in a moment.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const announcements = useMemo(() => {
    const items = (notifications || [])
      .filter((n) => n.notificationType === 'ANNOUNCEMENT' && !isMagazineNotification(n) && !isCelebrationOrEventNotification(n))
      .map((n) => {
        const parsed = parseNotificationContent(n);
        return {
          id: n.id,
          // title and message come directly from backend NotificationResponse
          title: parsed.title || n.title || '',
          message: parsed.message || n.message || '',
          createdAt: n.createdAt,
          attachmentUrls: n.attachmentUrls || [],
          isRead: Boolean(n.isRead),
        };
      });
    return sortRecent(items);
  }, [notifications]);

  const { page, setPage, pageItems, pageSize } = usePagination(announcements, 6);

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();
    const validationError = validatePostText({ title: announcementForm.title, message: announcementForm.message });
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    setCreating(true);
    try {
      await createAnnouncement({
        title: announcementForm.title.trim(),
        message: announcementForm.message.trim(),
        uploadType: 'POST',
        attachments: announcementFiles,
      });
      setAnnouncementForm({ title: '', message: '' });
      setAnnouncementFiles([]);
      setComposerOpen(false);
      showToast('Announcement Published Successfully.', 'success');
      await loadData();
    } catch (err) {
      showToast(getFriendlyError(err, 'Could not publish the announcement. Please try again in a moment.'), 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-stack announcements-page page-reveal">
      {/* ---------- HR-only composer ---------- */}
      {canCreateAnnouncement && composerOpen && (
        <section className="panel ann-composer">
          <div className="panel-title">
            <div>
              <span className="eyebrow">HR Broadcast</span>
              <h2>Add Announcement</h2>
            </div>
            <button type="button" className="icon-btn" onClick={() => setComposerOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <p className="panel-desc">This Will Be Published To All Employees Instantly.</p>

          <form className="ann-form-grid" onSubmit={handleCreateAnnouncement}>
            <div className="ann-field full-span">
              <span className="ann-label">Title</span>
              <input
                value={announcementForm.title}
                maxLength={POST_TITLE_MAX}
                onChange={(e) => setAnnouncementForm((v) => ({ ...v, title: e.target.value }))}
                placeholder="Announcement Title"
                required
              />
            </div>

            <div className="ann-field full-span">
              <span className="ann-label">Message</span>
              <textarea
                rows={4}
                value={announcementForm.message}
                maxLength={POST_MESSAGE_MAX}
                onChange={(e) => setAnnouncementForm((v) => ({ ...v, message: e.target.value }))}
                placeholder="Write The Announcement Details..."
                required
              />
              <small className={`char-hint ${announcementForm.message.length >= POST_MESSAGE_MAX ? 'over' : ''}`}>
                {announcementForm.message.length}/{POST_MESSAGE_MAX}
              </small>
            </div>

            <div className="ann-form-actions full-span">
              <button type="button" className="btn btn-soft" onClick={() => setComposerOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-gradient" disabled={creating}>
                <Send size={16} /> {creating ? 'Publishing…' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ---------- Hero banner ---------- */}
      <motion.section
        className="ann-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
      >
        <div className="ann-hero-text">
          <span className="eyebrow">Company Updates</span>
          <h1>Company Announcements</h1>
          <p>Stay Informed With The Latest Company Updates.</p>
          {canCreateAnnouncement && !composerOpen && (
            <button type="button" className="ann-hero-btn" onClick={() => setComposerOpen(true)}>
              <Plus size={18} /> Add Announcement
            </button>
          )}
        </div>
        <div className="ann-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="anCone" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#ffe4f2" />
              </linearGradient>
            </defs>

            <circle cx="262" cy="52" r="46" fill="#fff" opacity="0.14" />
            <circle cx="56" cy="156" r="36" fill="#fff" opacity="0.12" />

            <rect className="an-conf" style={{ '--i': 0 }} x="86" y="26" width="9" height="4" rx="2" fill="#fde047" />
            <circle className="an-conf" style={{ '--i': 1 }} cx="150" cy="22" r="3.5" fill="#fff" />
            <rect className="an-conf" style={{ '--i': 2 }} x="214" y="30" width="8" height="4" rx="2" fill="#67e8f9" />
            <circle className="an-conf" style={{ '--i': 3 }} cx="258" cy="70" r="3" fill="#fde047" />
            <rect className="an-conf" style={{ '--i': 4 }} x="60" y="82" width="8" height="4" rx="2" fill="#86efac" />
            <circle className="an-conf" style={{ '--i': 5 }} cx="236" cy="22" r="3" fill="#f9a8d4" />
            <rect className="an-conf" style={{ '--i': 6 }} x="118" y="16" width="7" height="4" rx="2" fill="#67e8f9" />
            <circle className="an-conf" style={{ '--i': 7 }} cx="282" cy="104" r="3.5" fill="#fff" />

            <g transform="translate(78,52)"><path className="an-star" d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#fde047" /></g>
            <g transform="translate(268,148)"><path className="an-star an-star--b" d="M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8 Z" fill="#fff" /></g>

            <path className="an-wave" style={{ '--i': 0 }} d="M206 70 Q222 92 206 114" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path className="an-wave" style={{ '--i': 1 }} d="M218 58 Q242 92 218 126" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path className="an-wave" style={{ '--i': 2 }} d="M230 46 Q262 92 230 138" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />

            <g className="an-mega">
              <path d="M120 108 L132 138 Q134 144 128 146 L118 148 Q112 148 112 142 L108 110 Z" fill="#fde047" />
              <rect x="84" y="76" width="22" height="34" rx="8" fill="#fff" />
              <path d="M104 78 L182 42 Q192 40 192 52 L192 132 Q192 144 182 142 L104 108 Z" fill="url(#anCone)" />
              <path d="M150 62 L150 123" stroke="#f472b6" strokeWidth="8" strokeLinecap="round" />
              <path d="M168 54 L168 130" stroke="#a78bfa" strokeWidth="8" strokeLinecap="round" />
              <ellipse cx="192" cy="92" rx="8" ry="40" fill="#fde047" />
            </g>
          </svg>
        </div>
      </motion.section>

      {/* ---------- Announcement feed ---------- */}
      {loading && <p className="empty-inline">Loading Announcements...</p>}
      {!loading && error && <p className="form-error">{error}</p>}

      {!loading && !error && (
        <motion.div className="ann-feed" initial="hidden" animate="show" variants={stagger}>
          {pageItems.map((item) => (
              <motion.article className="panel ann-card" key={item.id} variants={fadeUp} whileHover={{ y: -4 }}>
                <div className="ann-card-icon"><Megaphone size={20} /></div>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                {item.attachmentUrls?.length > 0 && (
                  <div className="ann-attachments">
                    {item.attachmentUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="ann-attachment-link">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                <div className="ann-card-foot">
                  <small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</small>
                </div>
              </motion.article>
          ))}
          {!announcements.length && (
            <section className="panel empty-state">
              <Megaphone size={36} />
              <p>No Announcements Yet.</p>
              <small>Company Updates Will Appear Here Once Published.</small>
            </section>
          )}
        </motion.div>
      )}

      <Pagination page={page} totalItems={announcements.length} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}