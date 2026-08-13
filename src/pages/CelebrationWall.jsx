import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, MessageCircle, PartyPopper, Share2, Bookmark,
  Gift, Cake, Award, Megaphone, CalendarDays, Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { getCelebrationWallToday, createAnnouncement } from '../services/notificationService';
import './CelebrationWall.css';

// The /celebration-wall/today endpoint only ever returns these three
// notificationType values (it already excludes ATTENDANCE and LEAVE on the
// backend), so the filter tabs only need to cover the real possibilities.
const types = ['ALL', 'BIRTHDAY', 'WORK_ANNIVERSARY', 'ANNOUNCEMENT'];

// Only HR can create/manage a celebration wall post.
// Note: the backend's POST /notifications/announcement currently also
// accepts SUPER_ADMIN and MANAGER tokens — this is a frontend-only gate.
// If HR-only is meant to be enforced for real, that role check needs to be
// tightened in NotificationController on the backend too.
const MANAGE_ROLES = ['HR_ADMIN'];

const CATEGORY_META = {
  BIRTHDAY: { icon: Cake, color: '#db2777', bg: '#fce7f3', soft: '#fdf2f8', label: 'Birthday' },
  WORK_ANNIVERSARY: { icon: Award, color: '#0891b2', bg: '#cffafe', soft: '#ecfeff', label: 'Work Anniversary' },
  ANNOUNCEMENT: { icon: Megaphone, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', label: 'Announcement' },
};

function categoryMeta(type = '') {
  return CATEGORY_META[type] || { icon: PartyPopper, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', label: type || 'Celebration' };
}

function initials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function normalizeNotificationToPost(item) {
  return {
    id: item.id,
    type: item.notificationType || 'ANNOUNCEMENT',
    title: item.title || '',
    message: item.message || '',
    createdAt: item.createdAt || new Date().toISOString(),
    images: item.attachmentUrls || [],
    isRead: Boolean(item.isRead),
    priority: item.priority || 'LOW',
  };
}

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

export default function CelebrationWall() {
  const { user } = useAuth();
  const canManage = MANAGE_ROLES.includes(user?.role);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState('ALL');

  // HR composer state
  const [composerTitle, setComposerTitle] = useState('');
  const [composerMessage, setComposerMessage] = useState('');
  const [composerUploadType, setComposerUploadType] = useState('POST');
  const [composerFiles, setComposerFiles] = useState([]);
  const [postError, setPostError] = useState('');
  const [posting, setPosting] = useState(false);

  // Likes/comments are NOT persisted on the backend yet — there's no
  // like/comment table or endpoint for notifications/announcements today.
  // These stay client-side (reset on refresh) until that's built.
  const [likedPosts, setLikedPosts] = useState({});
  const [commentsState, setCommentsState] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCelebrationWallToday();
      setNotifications(res || []);
    } catch (err) {
      setError(err.message || 'Failed to load celebrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const { celebrationFeed, announcements } = useMemo(() => {
    const rawFeed = [];
    const rawAnnouncements = [];

    (notifications || []).forEach((item) => {
      const post = normalizeNotificationToPost(item);
      rawFeed.push(post);
      if (post.type === 'ANNOUNCEMENT') rawAnnouncements.push(post);
    });

    return {
      celebrationFeed: sortRecent(rawFeed),
      announcements: sortRecent(rawAnnouncements).slice(0, 4),
    };
  }, [notifications]);

  const visibleFeed = useMemo(() => {
    if (active === 'ALL') return celebrationFeed;
    return celebrationFeed.filter((item) => item.type === active);
  }, [celebrationFeed, active]);

  const { page, setPage, pageItems, pageSize } = usePagination(visibleFeed, 5);

  const toggleLike = (postId) => {
    setLikedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleAddComment = (postId) => {
    const text = commentDrafts[postId]?.trim();
    if (!text) return;
    const newComment = {
      id: `c-${Date.now()}`,
      userName: user.name,
      message: text,
      createdAt: new Date().toISOString(),
    };
    setCommentsState((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComment],
    }));
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
  };

  const handlePublish = async () => {
    if (!composerTitle.trim() || !composerMessage.trim()) {
      setPostError('Title and message are required.');
      return;
    }

    setPosting(true);
    setPostError('');

    try {
      await createAnnouncement({
        title: composerTitle.trim(),
        message: composerMessage.trim(),
        uploadType: composerUploadType,
        attachments: composerFiles,
      });

      setComposerTitle('');
      setComposerMessage('');
      setComposerUploadType('POST');
      setComposerFiles([]);
      await loadData();
    } catch (err) {
      setPostError(err?.response?.data?.message || err.message || 'Failed to post celebration.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="page-stack celebration-page page-reveal">
      <PageHeader
        eyebrow="People & Culture"
        title="Celebration Wall"
        description={
          canManage
            ? 'Post Announcements for The Team And See Today\u2019s Birthdays And Work Anniversaries.'
            : 'View Today\u2019s Birthdays, Work Anniversaries, And Company Announcements.'
        }
      />

      {/* ---------- Hero banner ---------- */}
      <motion.section
        className="celebration-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
      >
        <div className="celebration-hero-text">
          <span className="eyebrow">Celebration Wall</span>
          <h1>Celebration Wall</h1>
          <p>Celebrate Birthdays, Work Anniversaries, And Team Milestones Together.</p>
        </div>
        <div className="celebration-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="58" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="42" fill="#bfdbfe" opacity="0.4" />
            <rect x="90" y="30" width="6" height="6" rx="2" fill="#fbbf24" transform="rotate(20 93 33)" />
            <rect x="120" y="22" width="5" height="5" rx="2" fill="#ec4899" transform="rotate(-15 122 24)" />
            <rect x="200" y="28" width="6" height="6" rx="2" fill="#22d3ee" transform="rotate(30 203 31)" />
            <rect x="240" y="40" width="5" height="5" rx="2" fill="#a78bfa" transform="rotate(-20 242 42)" />
            <rect x="130" y="100" width="80" height="55" rx="10" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <rect x="130" y="100" width="80" height="14" rx="7" fill="#fde68a" />
            <path d="M150 100 V88 M170 100 V82 M190 100 V88" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
            <circle cx="150" cy="84" r="3" fill="#fbbf24" />
            <circle cx="170" cy="78" r="3" fill="#fbbf24" />
            <circle cx="190" cy="84" r="3" fill="#fbbf24" />
            <circle cx="110" cy="140" r="12" fill="#2563eb" />
            <rect x="98" y="150" width="24" height="20" rx="8" fill="#2563eb" />
            <circle cx="230" cy="140" r="12" fill="#0891b2" />
            <rect x="218" y="150" width="24" height="20" rx="8" fill="#0891b2" />
            <path d="M260 120 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 z" fill="#fbbf24" />
          </svg>
        </div>
      </motion.section>

      <div className="celebration-layout">
        <div className="feed-column">
          {/* ---------- HR-only composer ---------- */}
          {canManage && (
            <section className="panel composer">
              <div className="composer-head">
                <span className="composer-avatar">{initials(user?.name || '')}</span>
                <div className="composer-head-text">
                  <strong>Share a Celebration</strong>
                  <span>Post an Announcement Your Team Will See</span>
                </div>
              </div>

              <input
                className="composer-input"
                value={composerTitle}
                onChange={(e) => setComposerTitle(e.target.value)}
                placeholder="Title"
                maxLength={100}
              />

              <div className="composer-row">
                <div className="composer-type-select">
                  <select value={composerUploadType} onChange={(e) => setComposerUploadType(e.target.value)}>
                    <option value="POST">Post</option>
                    <option value="MAGAZINE">Magazine</option>
                  </select>
                </div>
                <input
                  className="composer-input"
                  value={composerMessage}
                  onChange={(e) => setComposerMessage(e.target.value)}
                  placeholder="Write your message..."
                  maxLength={1000}
                />
              </div>

              <input type="file" multiple onChange={(e) => setComposerFiles(Array.from(e.target.files))} />

              {postError && <p className="form-error">{postError}</p>}

              <div className="composer-footer">
                <span />
                <button className="btn btn-gradient btn-ripple" onClick={handlePublish} disabled={posting}>
                  <Send size={17} /> {posting ? 'Posting...' : 'Publish'}
                </button>
              </div>
            </section>
          )}

          {/* ---------- Filter pills ---------- */}
          <motion.div
            className="filter-pills"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            {types.map((item) => {
              const meta = item === 'ALL' ? null : categoryMeta(item);
              const TIcon = meta?.icon || PartyPopper;
              return (
                <button
                  key={item}
                  className={`filter-pill ${active === item ? 'active' : ''}`}
                  onClick={() => { setActive(item); setPage(1); }}
                >
                  {meta && <TIcon size={14} />}
                  {item === 'ALL' ? 'All' : meta?.label || item}
                </button>
              );
            })}
          </motion.div>

          {/* ---------- Feed ---------- */}
          {loading && <p className="empty-inline">Loading Celebrations...</p>}
          {!loading && error && <p className="form-error">{error}</p>}

          {!loading && !error && (
            <motion.div className="feed-list" initial="hidden" animate="show" variants={stagger}>
              {pageItems.map((post) => {
                const meta = categoryMeta(post.type);
                const TIcon = meta.icon;
                const isLiked = Boolean(likedPosts[post.id]);
                const comments = commentsState[post.id] || [];

                return (
                  <motion.article className="panel post-card" key={post.id} variants={fadeUp} whileHover={{ y: -4 }}>
                    <div className="post-head">
                      <span className="post-avatar">{initials(post.title || meta.label)}</span>
                      <div className="post-head-info">
                        <strong>{post.title}</strong>
                        <span>{new Date(post.createdAt).toLocaleString()}</span>
                      </div>
                      <span className="post-category-badge" style={{ background: meta.bg, color: meta.color }}>
                        <TIcon size={13} /> {meta.label}
                      </span>
                    </div>

                    <div className="post-thumbnail" style={{ background: meta.soft, borderColor: meta.bg }}>
                      <TIcon size={32} style={{ color: meta.color }} />
                      <strong>{post.title}</strong>
                      {post.message && <span className="post-message">{post.message}</span>}
                    </div>

                    {!!post.images?.length && (
                      <div className="post-image-grid">
                        {post.images.map((src, index) => (
                          <img
                            src={src}
                            alt={`${post.title} ${index + 1}`}
                            key={`${src}-${index}`}
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="post-actions">
                      <motion.button
                        className={isLiked ? 'active liked' : ''}
                        onClick={() => toggleLike(post.id)}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Heart size={17} /> {isLiked ? 1 : 0} Like
                      </motion.button>
                      <button><MessageCircle size={17} /> {comments.length} Comments</button>
                      <button className="ghost"><Share2 size={16} /> Share</button>
                      <button className="ghost"><Bookmark size={16} /></button>
                    </div>

                    {comments.length > 0 && (
                      <div className="comment-list">
                        {comments.slice(-3).map((comment) => (
                          <div className="comment-item" key={comment.id}>
                            <span className="comment-avatar">{initials(comment.userName)}</span>
                            <div className="comment-body">
                              <strong>{comment.userName}</strong>
                              <span>{comment.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="comment-composer">
                      <span className="comment-avatar">{initials(user.name)}</span>
                      <input
                        value={commentDrafts[post.id] || ''}
                        onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                        placeholder="Write a comment..."
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                      />
                      <motion.button className="icon-btn primary" onClick={() => handleAddComment(post.id)} whileTap={{ scale: 0.9 }}>
                        <Send size={16} />
                      </motion.button>
                    </div>
                  </motion.article>
                );
              })}
              {!visibleFeed.length && (
                <section className="panel empty-state">
                  <PartyPopper size={36} />
                  <p>No Celebration Posts Yet.</p>
                  <small>Today's Birthdays, Anniversaries And Announcements Will Appear Here.</small>
                </section>
              )}
            </motion.div>
          )}

          <Pagination page={page} totalItems={visibleFeed.length} pageSize={pageSize} onPageChange={setPage} />
        </div>

        {/* ---------- Right sidebar ---------- */}
        <aside className="celebration-side">
          <motion.section
            className="panel side-widget"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}
            whileHover={{ y: -4 }}
          >
            <div className="side-widget-head">
              <span className="side-widget-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                <Megaphone size={18} />
              </span>
              <h2>Announcements</h2>
            </div>
            {announcements.map((item) => (
              <div className="side-content" key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.message}</span>
              </div>
            ))}
            {!announcements.length && <p className="empty-inline">No Announcements Today.</p>}
          </motion.section>

          <motion.section
            className="panel side-widget"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: easeOut, delay: 0.18 }}
            whileHover={{ y: -4 }}
          >
            <div className="side-widget-head">
              <span className="side-widget-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Gift size={18} />
              </span>
              <h2>Quick Links</h2>
            </div>
            <div className="quick-links">
              <Link to="/announcements" className="quick-link"><Megaphone size={15} /> Announcements</Link>
              <Link to="/events" className="quick-link"><CalendarDays size={15} /> Events</Link>
            </div>
          </motion.section>
        </aside>
      </div>
    </div>
  );
}