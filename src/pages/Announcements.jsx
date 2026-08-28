import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Megaphone,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { getNotifications, parseNotificationContent, isMagazineNotification } from '../services/notificationService';
import './Announcements.css';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };


export default function Announcements() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getNotifications({ page: 0, size: 100 });
      setNotifications(res?.content || []);
    } catch (err) {
      setError(err.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const announcements = useMemo(() => {
    const items = (notifications || [])
      .filter((n) => n.notificationType === 'ANNOUNCEMENT' && !isMagazineNotification(n))
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

  return (
    <div className="page-stack announcements-page page-reveal">
      <PageHeader
        eyebrow="Company Updates"
        title="Announcements"
        description="Official Company Announcements, Policy Updates, And Broadcast Messages From HR."
      />

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
        </div>
        <div className="ann-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="56" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="40" fill="#bfdbfe" opacity="0.4" />
            <rect x="120" y="70" width="90" height="70" rx="16" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <path d="M140 100 h40 l25 -18 v56 l-25 -18 h-40 z" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
            <rect x="130" y="108" width="14" height="22" rx="4" fill="#2563eb" />
            <path d="M210 90 q14 10 0 20" stroke="#2563eb" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M220 82 q24 18 0 36" stroke="#60a5fa" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M180 60 l4 8 l8 1 l-6 6 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -6 l8 -1 z" fill="#fbbf24" />
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