import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Trash2, Pin, Paperclip, ImagePlus, Save, Send,
  AlertTriangle, AlertCircle, Info, CheckCircle2, CalendarClock,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { announcementStore } from '../services/contentService';
import './Announcements.css';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

const PRIORITY_META = {
  NORMAL: { icon: Info, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', label: 'Normal' },
  IMPORTANT: { icon: AlertTriangle, color: '#d97706', bg: '#fef3c7', soft: '#fffbeb', label: 'Important' },
  CRITICAL: { icon: AlertCircle, color: '#dc2626', bg: '#fee2e2', soft: '#fef2f2', label: 'Critical' },
};

export default function Announcements() {
  const { user } = useAuth();
  const [rows, setRows] = useState(announcementStore.all());
  const ordered = useMemo(() => sortRecent(rows), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 5);

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    announcementStore.create(user, { title: form.get('title'), message: form.get('message') });
    event.currentTarget.reset();
    setRows(announcementStore.all());
    setPage(1);
  };

  return (
    <div className="page-stack announcements-page page-reveal">
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
          <p>Stay informed with the latest company updates.</p>
        </div>
        <div className="ann-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="56" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="40" fill="#bfdbfe" opacity="0.4" />
            {/* Megaphone */}
            <rect x="120" y="70" width="90" height="70" rx="16" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <path d="M140 100 h40 l25 -18 v56 l-25 -18 h-40 z" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
            <rect x="130" y="108" width="14" height="22" rx="4" fill="#2563eb" />
            {/* Sound waves */}
            <path d="M210 90 q14 10 0 20" stroke="#2563eb" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M220 82 q24 18 0 36" stroke="#60a5fa" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Pin */}
            <path d="M180 60 l4 8 l8 1 l-6 6 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -6 l8 -1 z" fill="#fbbf24" />
          </svg>
        </div>
      </motion.section>

      {/* ---------- Create announcement form ---------- */}
      <motion.section
        className="panel ann-form-panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="panel-title">
          <div>
            <span className="eyebrow">New update</span>
            <h2>Create Announcement</h2>
          </div>
          <div className="panel-title-icon"><Megaphone size={20} /></div>
        </div>
        <p className="panel-desc">Share important news with your team. Choose a priority and audience.</p>

        <form className="ann-form-grid" onSubmit={submit}>
          <label className="ann-field full-span">
            <span className="ann-label"><Info size={14} /> Title</span>
            <input name="title" required placeholder="Announcement title..." />
          </label>

          <label className="ann-field full-span">
            <span className="ann-label"><Megaphone size={14} /> Message</span>
            <textarea name="message" rows="4" required placeholder="Write your announcement..." />
          </label>

          <div className="ann-field-group">
            <label className="ann-field">
              <span className="ann-label"><AlertTriangle size={14} /> Priority</span>
              <div className="ann-seg-sm">
                {Object.keys(PRIORITY_META).map((key) => {
                  const meta = PRIORITY_META[key];
                  return (
                    <label key={key} className="ann-priority-opt">
                      <input type="radio" name="priority" value={key} defaultChecked={key === 'NORMAL'} />
                      <span><meta.icon size={13} /> {meta.label}</span>
                    </label>
                  );
                })}
              </div>
            </label>

            <label className="ann-field">
              <span className="ann-label"><CalendarClock size={14} /> Audience</span>
              <select defaultValue="EVERYONE">
                <option value="EVERYONE">Everyone</option>
                <option value="DEPARTMENT">Department</option>
                <option value="MANAGERS">Managers</option>
              </select>
            </label>
          </div>

          <div className="ann-upload-row full-span">
            <button type="button" className="ann-attach"><Paperclip size={15} /> Attachment</button>
            <button type="button" className="ann-attach"><ImagePlus size={15} /> Banner image</button>
            <button type="button" className="ann-attach"><CalendarClock size={15} /> Schedule</button>
          </div>

          <div className="ann-form-actions full-span">
            <button type="button" className="btn btn-soft"><Save size={16} /> Save Draft</button>
            <motion.button type="submit" className="btn btn-gradient btn-ripple" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Send size={17} /> Publish announcement
            </motion.button>
          </div>
        </form>
      </motion.section>

      {/* ---------- Announcement feed ---------- */}
      <motion.div className="ann-feed" initial="hidden" animate="show" variants={stagger}>
        {pageItems.map((item) => {
          const meta = PRIORITY_META[item.priority] || PRIORITY_META.NORMAL;
          const PIcon = meta.icon;
          return (
            <motion.article className="panel ann-card" key={item.id} variants={fadeUp} whileHover={{ y: -4 }}>
              <div className="ann-card-head">
                <span className="ann-priority-badge" style={{ background: meta.bg, color: meta.color }}>
                  <PIcon size={13} /> {meta.label}
                </span>
                {item.pinned && <span className="ann-pinned"><Pin size={12} /> Pinned</span>}
                <button className="icon-btn danger" onClick={() => { announcementStore.remove(user, item.id); setRows(announcementStore.all()); }}>
                  <Trash2 size={16} />
                </button>
              </div>
              <h3>{item.title}</h3>
              <p>{item.message}</p>
              <div className="ann-card-foot">
                <span className="ann-author">
                  <span className="ann-author-avatar">{item.createdByName?.slice(0, 2).toUpperCase()}</span>
                  {item.createdByName}
                </span>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>
            </motion.article>
          );
        })}
        {!ordered.length && (
          <section className="panel empty-state">
            <Megaphone size={36} />
            <p>No announcements yet.</p>
            <small>Company updates will appear here once published.</small>
          </section>
        )}
      </motion.div>

      <Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}
