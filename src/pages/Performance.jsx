import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, ClipboardCheck, CheckCircle2, TrendingUp, Award, Save, Send,
  Paperclip, ChevronDown, CalendarDays, User, Target, MessageSquare,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { getEmployees } from '../services/employeeService';
import { capitalizeName } from '../utils/formatName';
import { useToast } from '../context/ToastContext';
import './Performance.css';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };

function StarRating({ value, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="star-rating" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button
          type="button"
          key={n}
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(n)}
          onClick={() => !readOnly && onChange(n)}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          className={n <= display ? 'star filled' : 'star'}
        >
          <Star size={22} />
        </motion.button>
      ))}
    </div>
  );
}

export default function Performance() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [period, setPeriod] = useState('Q1 2026');
  const [feedback, setFeedback] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [goals, setGoals] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviews, setReviews] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getEmployees({ size: 100 });
        if (!cancelled) setEmployees(result?.content || []);
      } catch { if (!cancelled) setEmployees([]); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const submit = (event) => {
    event.preventDefault();
    if (!selectedEmp || !rating) return;
    setSubmitting(true);
    const emp = employees.find((e) => e.id === Number(selectedEmp));
    const newReview = {
      id: Date.now(),
      employeeName: emp ? capitalizeName(`${emp.firstName} ${emp.lastName}`) : 'Employee',
      period, rating, feedback, strengths, improvements, goals,
      managerName: 'You', status: 'COMPLETED', createdAt: new Date().toISOString(),
    };
    setReviews((prev) => [newReview, ...prev]);
    setSelectedEmp(''); setRating(0); setPeriod('Q1 2026'); setFeedback(''); setStrengths(''); setImprovements(''); setGoals('');
    setSubmitting(false);
    showToast('Review submitted successfully.', 'success');
  };

  const SUMMARY = [
    { icon: ClipboardCheck, label: 'Pending Reviews', value: 3, tone: 'orange', desc: 'Awaiting completion' },
    { icon: CheckCircle2, label: 'Completed Reviews', value: reviews.length, tone: 'green', desc: 'This cycle' },
    { icon: Star, label: 'Average Rating', value: '4.2', tone: 'blue', desc: 'Across all reviews' },
    { icon: Award, label: 'Top Performers', value: 5, tone: 'pink', desc: 'Rated 4.5+' },
  ];

  return (
    <div className="page-stack performance-page page-reveal">
      {/* ---------- Hero banner ---------- */}
      <motion.section className="perf-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }}>
        <div className="perf-hero-text">
          <span className="eyebrow">People Development</span>
          <h1>Performance Reviews</h1>
          <p>Track employee growth and performance reviews.</p>
        </div>
        <div className="perf-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="56" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="40" fill="#bfdbfe" opacity="0.4" />
            {/* Trophy */}
            <path d="M140 50 h40 v20 a20 20 0 0 1 -40 0 z" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
            <rect x="150" y="70" width="20" height="14" fill="#d97706" />
            <rect x="135" y="84" width="50" height="10" rx="3" fill="#d97706" />
            {/* Growth chart */}
            <rect x="180" y="100" width="100" height="70" rx="12" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <polyline points="190,160 210,145 225,150 245,130 265,115" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="265" cy="115" r="4" fill="#16a34a" />
            {/* Star */}
            <path d="M120 120 l4 8 l8 1 l-6 6 l1 8 l-8 -4 l-8 4 l1 -8 l-6 -6 l8 -1 z" fill="#2563eb" />
          </svg>
        </div>
      </motion.section>

      {/* ---------- Summary cards ---------- */}
      <motion.div className="perf-summary-grid" initial="hidden" animate="show" variants={stagger}>
        {SUMMARY.map((card) => (
          <motion.div key={card.label} className={`perf-summary-card tone-${card.tone}`} variants={fadeUp} whileHover={{ y: -6 }}>
            <div className="loc-icon"><card.icon size={22} /></div>
            <span>{card.label}</span>
            <strong>{loading ? '...' : card.value}</strong>
            <small>{card.desc}</small>
          </motion.div>
        ))}
      </motion.div>

      <div className="perf-two-column">
        {/* ---------- Review form ---------- */}
        <motion.section className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}>
          <div className="panel-title">
            <div><span className="eyebrow">New review</span><h2>Submit Review</h2></div>
            <div className="panel-title-icon"><ClipboardCheck size={20} /></div>
          </div>
          <p className="panel-desc">Rate and provide feedback for an employee this review cycle.</p>

          <form className="perf-form" onSubmit={submit}>
            <label className="perf-field">
              <span className="perf-label"><User size={14} /> Employee</span>
              <div className="perf-select-wrap">
                <select value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)} required>
                  <option value="" disabled>Select employee</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                </select>
                <ChevronDown size={16} className="perf-chevron" />
              </div>
            </label>

            <label className="perf-field">
              <span className="perf-label"><CalendarDays size={14} /> Review period</span>
              <div className="perf-select-wrap">
                <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option>Q1 2026</option><option>Q2 2026</option><option>Q3 2026</option><option>Q4 2026</option>
                  <option>H1 2026</option><option>Annual 2026</option>
                </select>
                <ChevronDown size={16} className="perf-chevron" />
              </div>
            </label>

            <div className="perf-field full-span">
              <span className="perf-label"><Star size={14} /> Rating</span>
              <StarRating value={rating} onChange={setRating} />
            </div>

            <label className="perf-field full-span">
              <span className="perf-label"><MessageSquare size={14} /> Feedback</span>
              <textarea rows="3" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Overall feedback..." />
            </label>
            <label className="perf-field full-span">
              <span className="perf-label"><TrendingUp size={14} /> Strengths</span>
              <textarea rows="2" value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Key strengths..." />
            </label>
            <label className="perf-field full-span">
              <span className="perf-label"><Target size={14} /> Areas for Improvement</span>
              <textarea rows="2" value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Improvement areas..." />
            </label>
            <label className="perf-field full-span">
              <span className="perf-label"><Target size={14} /> Goals</span>
              <textarea rows="2" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="Goals for next cycle..." />
            </label>

            <div className="perf-attach-row full-span">
              <button type="button" className="perf-attach"><Paperclip size={15} /> Attachments (UI)</button>
            </div>

            <div className="perf-form-actions full-span">
              <button type="button" className="btn btn-soft"><Save size={16} /> Save Draft</button>
              <motion.button type="submit" className="btn btn-gradient btn-ripple" disabled={submitting} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Send size={17} /> {submitting ? 'Submitting...' : 'Submit Review'}
              </motion.button>
            </div>
          </form>
        </motion.section>

        {/* ---------- Performance history timeline ---------- */}
        <motion.section className="panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}>
          <div className="panel-title">
            <div><span className="eyebrow">History</span><h2>Review Timeline</h2></div>
            <div className="panel-title-icon"><Award size={20} /></div>
          </div>
          <div className="perf-timeline">
            {reviews.length === 0 && (
              <div className="empty-state"><Award size={32} /><p>No reviews yet.</p><small>Submitted reviews will appear here.</small></div>
            )}
            {reviews.map((review, i) => (
              <motion.div className="tl-card" key={review.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: i * 0.06, ease: easeOut }}>
                <div className="tl-card-head">
                  <span className="tl-avatar">{review.employeeName.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                  <div className="tl-card-info">
                    <strong>{review.employeeName}</strong>
                    <span>{review.period} • {review.managerName}</span>
                  </div>
                  <StarRating value={review.rating} readOnly />
                </div>
                {review.feedback && <p className="tl-feedback">{review.feedback}</p>}
                <span className="tl-status completed">Completed</span>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}