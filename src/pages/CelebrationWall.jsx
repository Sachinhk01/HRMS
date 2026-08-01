import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, PartyPopper, Pin, Send, Trash2, Users,
  Share2, Bookmark, MoreHorizontal, ImagePlus, Smile, CalendarClock,
  Gift, Cake, Award, Sparkles, UserPlus, Megaphone, CalendarDays, Star,
  X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { announcementStore, ensureAutomaticCelebrations, eventStore, postStore } from '../services/contentService';
import { getEmployees } from '../services/employeeService';
import './CelebrationWall.css';

const types = ['ALL', 'BIRTHDAY', 'WORK ANNIVERSARY', 'FESTIVAL', 'NEW JOINER', 'KUDOS'];

const CATEGORY_META = {
  BIRTHDAY: { icon: Cake, color: '#db2777', bg: '#fce7f3', soft: '#fdf2f8', label: 'Birthday' },
  'WORK ANNIVERSARY': { icon: Award, color: '#0891b2', bg: '#cffafe', soft: '#ecfeff', label: 'Work Anniversary' },
  FESTIVAL: { icon: Sparkles, color: '#d97706', bg: '#fef3c7', soft: '#fffbeb', label: 'Festival' },
  'NEW JOINER': { icon: UserPlus, color: '#16a34a', bg: '#dcfce7', soft: '#f0fdf4', label: 'New Joiner' },
  KUDOS: { icon: Star, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', label: 'Kudos' },
};

function categoryMeta(type) {
  return CATEGORY_META[type] || { icon: PartyPopper, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', label: type || 'Celebration' };
}

function initials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function TaggedMessage({ post }) {
  return (
    <span className="post-message">
      {post.message}
      {post.tagAll ? (
        <span className="member-tag all-members-tag"><Users size={13} /> All Employees</span>
      ) : (post.taggedMembers || []).map((member) => (
        <Link className="member-tag" key={member.id} to={`/profile?user=${member.id}`}>@{member.name}</Link>
      ))}
    </span>
  );
}

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

export default function CelebrationWall() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(postStore.all());
  const [active, setActive] = useState('ALL');
  const [text, setText] = useState('');
  const [type, setType] = useState('BIRTHDAY');
  const [tagIds, setTagIds] = useState([]);
  const [tagAll, setTagAll] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [imageText, setImageText] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const isHr = user.role === 'HR_ADMIN';
  const [members, setMembers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      try {
        const result = await getEmployees({ size: 100 });
        const normalized = (result?.content || [])
          .filter((member) => member.id !== user.id && member.active !== false)
          .map((member) => ({
            ...member,
            name: `${member.firstName} ${member.lastName || ''}`.trim(),
            dob: member.dateOfBirth,
          }));
        if (!cancelled) setMembers(normalized);
        if (!cancelled && isHr && ensureAutomaticCelebrations(user, normalized).length) {
          setPosts(postStore.all());
        }
      } catch (error) {
        if (!cancelled) setMembers([]);
      }
    }
    loadMembers();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      try {
        const result = await getEmployees({ size: 100 });
        const normalized = (result?.content || [])
          .filter((member) => member.id !== user.id && member.active !== false)
          .map((member) => ({
            ...member,
            name: `${member.firstName} ${member.lastName || ''}`.trim(),
            dob: member.dateOfBirth,
          }));
        if (!cancelled) setMembers(normalized);
        if (!cancelled && isHr && ensureAutomaticCelebrations(user, normalized).length) {
          setPosts(postStore.all());
        }
      } catch (error) {
        if (!cancelled) setMembers([]);
      }
    }
    loadMembers();
    return () => { cancelled = true; };
  }, []);

  const filteredMembers = members.filter((member) => {
    const term = memberSearch.trim().toLowerCase();
    return !term || member.name?.toLowerCase().includes(term) || member.email?.toLowerCase().includes(term);
  });

  const visible = useMemo(() => {
    const filtered = active === 'ALL' ? posts : posts.filter((item) => item.type === active);
    return sortRecent(filtered).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [posts, active]);

  const { page, setPage, pageItems, pageSize } = usePagination(visible, 5);

  const refresh = () => setPosts(postStore.all());
  const publish = () => {
    if (!text.trim()) return;
    const taggedMembers = (tagAll ? members : members.filter((member) => tagIds.includes(member.id))).map(({ id, name, email }) => ({ id, name, email }));
    const images = imageText.split(/[,\n]/).map((value) => value.trim()).filter(Boolean).slice(0, 6);
    postStore.create(user, { type, title: type, message: text.trim(), taggedMembers, tagAll, images });
    refresh(); setText(''); setTagIds([]); setTagAll(false); setMemberSearch(''); setImageText(''); setPage(1);
  };
  const announcements = sortRecent(announcementStore.all()).slice(0, 4);
  const events = sortRecent(eventStore.all()).slice(0, 4);

  return (
    <div className="page-stack celebration-page page-reveal">
      <PageHeader eyebrow="People & Culture" title="Celebration Wall" description={isHr ? 'Create posts, tag members, add images, pin highlights and celebrate together.' : 'View, like and comment on company celebrations.'} />

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
          <p>Celebrate birthdays, work anniversaries, festivals, achievements and team milestones together.</p>
        </div>
        <div className="celebration-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="58" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="42" fill="#bfdbfe" opacity="0.4" />
            {/* Confetti */}
            <rect x="90" y="30" width="6" height="6" rx="2" fill="#fbbf24" transform="rotate(20 93 33)" />
            <rect x="120" y="22" width="5" height="5" rx="2" fill="#ec4899" transform="rotate(-15 122 24)" />
            <rect x="200" y="28" width="6" height="6" rx="2" fill="#22d3ee" transform="rotate(30 203 31)" />
            <rect x="240" y="40" width="5" height="5" rx="2" fill="#a78bfa" transform="rotate(-20 242 42)" />
            {/* Cake */}
            <rect x="130" y="100" width="80" height="55" rx="10" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <rect x="130" y="100" width="80" height="14" rx="7" fill="#fde68a" />
            <path d="M150 100 V88 M170 100 V82 M190 100 V88" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
            <circle cx="150" cy="84" r="3" fill="#fbbf24" />
            <circle cx="170" cy="78" r="3" fill="#fbbf24" />
            <circle cx="190" cy="84" r="3" fill="#fbbf24" />
            {/* People */}
            <circle cx="110" cy="140" r="12" fill="#2563eb" />
            <rect x="98" y="150" width="24" height="20" rx="8" fill="#2563eb" />
            <circle cx="230" cy="140" r="12" fill="#0891b2" />
            <rect x="218" y="150" width="24" height="20" rx="8" fill="#0891b2" />
            {/* Sparkles */}
            <path d="M260 120 l3 6 l6 3 l-6 3 l-3 6 l-3 -6 l-6 -3 l6 -3 z" fill="#fbbf24" />
          </svg>
        </div>
      </motion.section>

      <div className="celebration-layout">
        <div className="feed-column">
          {/* ---------- HR Composer ---------- */}
          <AnimatePresence>
            {isHr && (
              <motion.section
                className="panel composer"
                initial="hidden"
                animate="show"
                variants={stagger}
              >
                <div className="composer-head">
                  <span className="composer-avatar">{initials(user.name)}</span>
                  <div className="composer-head-text">
                    <strong>Share a celebration</strong>
                    <span>Recognize your team and spread joy</span>
                  </div>
                </div>

                <div className="composer-row">
                  <div className="composer-type-select">
                    <select value={type} onChange={(event) => setType(event.target.value)}>
                      {types.slice(1).map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <input
                    className="composer-input"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Write a birthday wish or celebration post..."
                  />
                </div>

                {/* Tagging panel */}
                <div className="tagging-panel">
                  <div className="tagging-title">
                    <Users size={16} />
                    <strong>Tag members</strong>
                    <span>{tagAll ? `All ${members.length} selected` : `${tagIds.length} selected`}</span>
                  </div>
                  <div className="tagging-controls">
                    <label className={tagAll ? 'tag-chip tag-all-chip selected' : 'tag-chip tag-all-chip'}>
                      <input type="checkbox" checked={tagAll} onChange={(event) => { const checked = event.target.checked; setTagAll(checked); if (checked) setTagIds([]); }} />
                      <Users size={14} /><span>All Employees</span>
                    </label>
                    <input
                      className="member-search"
                      type="search"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Search members..."
                      disabled={tagAll}
                    />
                  </div>
                  <div className="tag-chip-list">
                    {filteredMembers.map((member) => (
                      <label className={tagIds.includes(member.id) ? 'tag-chip selected' : 'tag-chip'} key={member.id}>
                        <input
                          type="checkbox"
                          disabled={tagAll}
                          checked={tagIds.includes(member.id)}
                          onChange={() => {
                            setTagAll(false);
                            setTagIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id]);
                          }}
                        />
                        <span className="tag-chip-avatar">{initials(member.name)}</span>
                        <span>@{member.name}</span>
                      </label>
                    ))}
                    {!filteredMembers.length && <span className="tag-empty">No members found.</span>}
                  </div>
                </div>

                {/* Image URL field */}
                <label className="image-url-field">
                  <span className="iuf-label"><ImagePlus size={14} /> Image URLs <small>(comma or new-line separated, up to 6)</small></span>
                  <textarea
                    value={imageText}
                    onChange={(event) => setImageText(event.target.value)}
                    placeholder="https://.../photo-1.jpg, https://.../photo-2.jpg"
                  />
                </label>

                {/* Composer footer */}
                <div className="composer-footer">
                  <div className="composer-tools">
                    <button type="button" className="composer-tool" title="Emoji (UI)"><Smile size={18} /></button>
                    <button type="button" className="composer-tool" title="Schedule (UI)"><CalendarClock size={18} /></button>
                    <button type="button" className="composer-tool" title="Save draft (UI)">Save Draft</button>
                  </div>
                  <motion.button
                    className="btn btn-gradient btn-ripple"
                    onClick={publish}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Send size={17} /> Publish
                  </motion.button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

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
          <motion.div className="feed-list" initial="hidden" animate="show" variants={stagger}>
            {pageItems.map((post) => {
              const meta = categoryMeta(post.type);
              const TIcon = meta.icon;
              return (
                <motion.article
                  className={post.pinned ? 'panel post-card pinned-post' : 'panel post-card'}
                  key={post.id}
                  variants={fadeUp}
                  whileHover={{ y: -4 }}
                >
                  {/* Post head */}
                  <div className="post-head">
                    <span className="post-avatar">{initials(post.createdByName)}</span>
                    <div className="post-head-info">
                      <strong>{post.createdByName}</strong>
                      <span>{new Date(post.createdAt).toLocaleString()}</span>
                    </div>
                    <span className="post-category-badge" style={{ background: meta.bg, color: meta.color }}>
                      <TIcon size={13} /> {meta.label}
                    </span>
                    {post.pinned && <span className="pinned-label"><Pin size={13} /> Pinned</span>}
                    {isHr && (
                      <div className="post-admin-actions">
                        <button className="icon-btn" title="Pin post" onClick={() => { postStore.togglePin(user, post.id); refresh(); }}><Pin size={16} /></button>
                        <button className="icon-btn danger" onClick={() => { postStore.remove(user, post.id); refresh(); }}><Trash2 size={16} /></button>
                        <button className="icon-btn" title="More"><MoreHorizontal size={16} /></button>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail / content */}
                  <div className="post-thumbnail" style={{ background: meta.soft, borderColor: meta.bg }}>
                    <TIcon size={32} style={{ color: meta.color }} />
                    <strong>{post.title}</strong>
                    <TaggedMessage post={post} />
                  </div>

                  {/* Image grid */}
                  {!!post.images?.length && (
                    <div className={`post-image-grid count-${Math.min(post.images.length, 4)}`}>
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

                  {/* Actions */}
                  <div className="post-actions">
                    <motion.button
                      className={(post.likes || []).some((like) => like.userId === user.id) ? 'active liked' : ''}
                      onClick={() => { postStore.toggleLike(user, post.id); refresh(); }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Heart size={17} size={17} /> {post.likes?.length || 0} Like
                    </motion.button>
                    <button><MessageCircle size={17} /> {post.comments?.length || 0} Comments</button>
                    <button className="ghost"><Share2 size={16} /> Share</button>
                    <button className="ghost"><Bookmark size={16} /></button>
                  </div>

                  {/* Comments */}
                  <div className="comment-list">
                    {(post.comments || []).slice(-3).map((comment) => (
                      <div className="comment-item" key={comment.id}>
                        <span className="comment-avatar">{initials(comment.userName)}</span>
                        <div className="comment-body">
                          <strong>{comment.userName}</strong>
                          <span>{comment.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Comment composer */}
                  <div className="comment-composer">
                    <span className="comment-avatar">{initials(user.name)}</span>
                    <input
                      value={commentDrafts[post.id] || ''}
                      onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                      placeholder="Write a comment..."
                    />
                    <motion.button
                      className="icon-btn primary"
                      onClick={() => {
                        const value = commentDrafts[post.id];
                        if (!value?.trim()) return;
                        postStore.addComment(user, post.id, value);
                        setCommentDrafts((current) => ({ ...current, [post.id]: '' }));
                        refresh();
                      }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Send size={16} />
                    </motion.button>
                  </div>
                </motion.article>
              );
            })}
            {!visible.length && (
              <section className="panel empty-state">
                <PartyPopper size={36} />
                <p>No celebration posts yet.</p>
                <small>Be the first to celebrate a teammate!</small>
              </section>
            )}
          </motion.div>

          <Pagination page={page} totalItems={visible.length} pageSize={pageSize} onPageChange={setPage} />
        </div>

        {/* ---------- Right sidebar ---------- */}
        <aside className="celebration-side">
          {/* Announcements widget */}
          <motion.section className="panel side-widget" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }} whileHover={{ y: -4 }}>
            <div className="side-widget-head">
              <span className="side-widget-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><Megaphone size={18} /></span>
              <h2>Announcements</h2>
            </div>
            {announcements.map((item) => (
              <div className="side-content" key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.message}</span>
              </div>
            ))}
            {!announcements.length && <p className="empty-inline">No announcements.</p>}
          </motion.section>

          {/* Events widget */}
          <motion.section className="panel side-widget" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.18 }} whileHover={{ y: -4 }}>
            <div className="side-widget-head">
              <span className="side-widget-icon" style={{ background: '#dcfce7', color: '#16a34a' }}><CalendarDays size={18} /></span>
              <h2>Upcoming events</h2>
            </div>
            {events.map((item) => (
              <div className="side-content" key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.date}{item.location ? ` • ${item.location}` : ''}</span>
              </div>
            ))}
            {!events.length && <p className="empty-inline">No events.</p>}
          </motion.section>

          {/* Quick links widget */}
          <motion.section className="panel side-widget" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.26 }} whileHover={{ y: -4 }}>
            <div className="side-widget-head">
              <span className="side-widget-icon" style={{ background: '#fef3c7', color: '#d97706' }}><Gift size={18} /></span>
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
