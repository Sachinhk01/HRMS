import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, Trash2, Pin, MapPin, Clock3, Users, Link2, Bell,
  Video, Heart, Share2, CalendarPlus, Save,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { eventStore } from '../services/contentService';
import './Events.css';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

function initials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function Events() {
  const { user } = useAuth();
  const [rows, setRows] = useState(eventStore.all());
  const ordered = useMemo(() => sortRecent(rows), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 6);

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    eventStore.create(user, {
      title: form.get('title'),
      message: form.get('message'),
      date: form.get('date'),
      location: form.get('location'),
      meetingLink: form.get('meetingLink'),
    });
    event.currentTarget.reset();
    setRows(eventStore.all());
    setPage(1);
  };

  return (
    <div className="page-stack events-page page-reveal">
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
          <p>Stay connected with company activities.</p>
        </div>
        <div className="ev-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="56" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="40" fill="#bfdbfe" opacity="0.4" />
            {/* Calendar */}
            <rect x="110" y="50" width="130" height="120" rx="18" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <rect x="110" y="50" width="130" height="30" rx="18" fill="#2563eb" />
            <rect x="110" y="68" width="130" height="12" fill="#2563eb" />
            <circle cx="135" cy="46" r="6" fill="#64748b" />
            <circle cx="215" cy="46" r="6" fill="#64748b" />
            {/* Date grid */}
            <rect x="125" y="92" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="148" y="92" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="171" y="92" width="14" height="14" rx="4" fill="#2563eb" />
            <rect x="194" y="92" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="125" y="114" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="148" y="114" width="14" height="14" rx="4" fill="#fde68a" />
            <rect x="171" y="114" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="194" y="114" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="125" y="136" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="148" y="136" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="171" y="136" width="14" height="14" rx="4" fill="#e0edff" />
            <rect x="194" y="136" width="14" height="14" rx="4" fill="#e0edff" />
            {/* Star */}
            <path d="M230 60 l3 6 l6 1 l-4 5 l1 6 l-6 -3 l-6 3 l1 -6 l-4 -5 l6 -1 z" fill="#fbbf24" />
          </svg>
        </div>
      </motion.section>

      {/* ---------- Event creation form ---------- */}
      <motion.section
        className="panel ev-form-panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="panel-title">
          <div>
            <span className="eyebrow">New activity</span>
            <h2>Create Event</h2>
          </div>
          <div className="panel-title-icon"><CalendarPlus size={20} /></div>
        </div>
        <p className="panel-desc">Organize an event and invite your team to join.</p>

        <form className="ev-form-grid" onSubmit={submit}>
          <label className="ev-field full-span">
            <span className="ev-label"><CalendarDays size={14} /> Event name</span>
            <input name="title" required placeholder="Event name..." />
          </label>

          <label className="ev-field full-span">
            <span className="ev-label"><CalendarDays size={14} /> Description</span>
            <textarea name="message" rows="3" placeholder="Describe the event..." />
          </label>

          <label className="ev-field">
            <span className="ev-label"><CalendarDays size={14} /> Date</span>
            <input name="date" type="date" />
          </label>
          <label className="ev-field">
            <span className="ev-label"><Clock3 size={14} /> Time</span>
            <input name="time" type="time" />
          </label>

          <label className="ev-field">
            <span className="ev-label"><MapPin size={14} /> Location</span>
            <input name="location" placeholder="Location or venue..." />
          </label>
          <label className="ev-field">
            <span className="ev-label"><Link2 size={14} /> Meeting link</span>
            <input name="meetingLink" placeholder="https://meet..." />
          </label>

          <label className="ev-field">
            <span className="ev-label"><Users size={14} /> Category</span>
            <select name="category" defaultValue="TEAM">
              <option value="TEAM">Team Building</option>
              <option value="TRAINING">Training</option>
              <option value="CELEBRATION">Celebration</option>
              <option value="MEETING">Meeting</option>
            </select>
          </label>
          <label className="ev-field">
            <span className="ev-label"><Bell size={14} /> Reminders</span>
            <div className="ev-toggles">
              <label className="ev-toggle"><input type="checkbox" name="rsvp" defaultChecked /><span>RSVP</span></label>
              <label className="ev-toggle"><input type="checkbox" name="reminder" defaultChecked /><span>Reminder</span></label>
            </div>
          </label>

          <div className="ev-form-actions full-span">
            <button type="button" className="btn btn-soft"><Save size={16} /> Save Draft</button>
            <motion.button type="submit" className="btn btn-gradient btn-ripple" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <CalendarPlus size={17} /> Publish event
            </motion.button>
          </div>
        </form>
      </motion.section>

      {/* ---------- Event cards ---------- */}
      <motion.div className="ev-grid" initial="hidden" animate="show" variants={stagger}>
        {pageItems.map((item) => (
          <motion.article className="panel ev-card" key={item.id} variants={fadeUp} whileHover={{ y: -6 }}>
            <div className="ev-card-banner">
              <div className="ev-date-badge">
                <strong>{item.date ? new Date(item.date).getDate() : '—'}</strong>
                <small>{item.date ? new Date(item.date).toLocaleString([], { month: 'short' }) : ''}</small>
              </div>
              {item.pinned && <span className="ev-pinned"><Pin size={12} /> Pinned</span>}
              <button className="icon-btn danger ev-del" onClick={() => { eventStore.remove(user, item.id); setRows(eventStore.all()); }}>
                <Trash2 size={16} />
              </button>
            </div>
            <div className="ev-card-body">
              <h3>{item.title}</h3>
              <p>{item.message}</p>
              <div className="ev-meta">
                {item.location && <span><MapPin size={13} /> {item.location}</span>}
                {item.meetingLink && <span><Video size={13} /> Online</span>}
              </div>
              <div className="ev-card-actions">
                <button className="btn btn-small btn-gradient"><Heart size={14} /> Interested</button>
                <button className="icon-btn" title="Share"><Share2 size={15} /></button>
                <button className="icon-btn" title="Add to calendar"><CalendarDays size={15} /></button>
              </div>
            </div>
          </motion.article>
        ))}
        {!ordered.length && (
          <section className="panel empty-state">
            <CalendarDays size={36} />
            <p>No events scheduled.</p>
            <small>Company events will appear here once created.</small>
          </section>
        )}
      </motion.div>

      <Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}
