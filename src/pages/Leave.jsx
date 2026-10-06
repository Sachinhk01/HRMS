import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarPlus,
  CalendarDays,
  CheckCircle2,
  Clock3,
  WalletCards,
  Plane,
  HeartPulse,
  Sun,
  Baby,
  HeartHandshake,
  CircleDollarSign,
  Search,
  X,
  AlertTriangle,
  CalendarRange,
  FileText,
  ChevronDown,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  applyLeave,
  cancelLeave,
  getActiveLeaveTypes,
  getMyLeaveBalances,
  getMyLeaveRequests,
} from '../services/leaveService';
import './Leave.css';
import { INPUT_LIMITS } from '../utils/inputLimits';
import DatePicker from '../components/DatePicker';

/* ---------- Leave-type visual themes (UI only) ---------- */
const LEAVE_THEMES = {
  ANNUAL: { icon: Plane, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', border: '#bfdbfe' },
  SICK: { icon: HeartPulse, color: '#dc2626', bg: '#fee2e2', soft: '#fef2f2', border: '#fecaca' },
  CASUAL: { icon: Sun, color: '#d97706', bg: '#fef3c7', soft: '#fffbeb', border: '#fde68a' },
  MATERNITY: { icon: Baby, color: '#db2777', bg: '#fce7f3', soft: '#fdf2f8', border: '#fbcfe8' },
  PATERNITY: { icon: HeartHandshake, color: '#0891b2', bg: '#cffafe', soft: '#ecfeff', border: '#a5f3fc' },
  UNPAID: { icon: CircleDollarSign, color: '#6b7280', bg: '#f3f4f6', soft: '#f9fafb', border: '#e5e7eb' },
};
const DEFAULT_THEME = { icon: CalendarDays, color: '#2563eb', bg: '#dbeafe', soft: '#eff6ff', border: '#bfdbfe' };

function themeFor(name = '') {
  const key = String(name).toUpperCase().replace(/[\s-]+/g, '_');
  return LEAVE_THEMES[key] || DEFAULT_THEME;
}

/* ---------- Animated counter ---------- */
function Counter({ value, duration = 0.9 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display}</>;
}

/* ---------- Status badge wrapper (uses existing component) ---------- */
function StatusPill({ status }) {
  return (
    <span className={`status-pill ${String(status || '').toLowerCase()}`}>
      <StatusBadge>{status}</StatusBadge>
    </span>
  );
}

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };

// Native date inputs allow 5-6 digit years while typing; keep the year to 4 digits.
const MIN_DATE = '1900-01-01';
const MAX_DATE = '9999-12-31';
const limitYearTo4 = (value) => {
  if (!value) return '';
  const match = /^(\d+)-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[1].slice(0, 4)}-${match[2]}-${match[3]}` : value;
};

export default function Leave() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // UI-only state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [formLeaveTypeId, setFormLeaveTypeId] = useState('');
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [requestsRes, balancesRes, typesRes] = await Promise.allSettled([
        getMyLeaveRequests(),
        getMyLeaveBalances(),
        getActiveLeaveTypes(),
      ]);

      const requestsData = requestsRes.status === 'fulfilled' ? requestsRes.value : [];
      const balancesData = balancesRes.status === 'fulfilled' ? balancesRes.value : [];
      const typesData = typesRes.status === 'fulfilled' ? typesRes.value : [];

      setRows(Array.isArray(requestsData) ? requestsData : []);
      setBalances(Array.isArray(balancesData) ? balancesData : []);
      setLeaveTypes(Array.isArray(typesData) ? typesData : []);
    } catch (error) {
      showToast(error.message || 'Failed to load leave data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const ordered = useMemo(() => sortRecent(rows, 'startDate'), [rows]);

  // UI-only filtering (does not change pagination data source)
  const filteredOrdered = useMemo(() => {
    let list = ordered;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => String(r.leaveType || '').toLowerCase().includes(q) || String(r.startDate || '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((r) => String(r.status || '').toUpperCase() === statusFilter);
    }
    return list;
  }, [ordered, searchQuery, statusFilter]);

  const { page, setPage, pageItems, pageSize } = usePagination(filteredOrdered, 5);

  const summary = useMemo(() => {
    const list = Array.isArray(balances) ? balances : [];
    const allowance = list.reduce((sum, b) => sum + (Number(b.allocatedLeaves ?? b.allocated ?? 0) || 0), 0);
    const taken = list.reduce((sum, b) => sum + (Number(b.usedLeaves ?? b.used ?? 0) || 0), 0);
    const left = list.reduce((sum, b) => {
      const rem = b.remainingLeaves ?? b.remaining;
      const val = rem !== undefined && rem !== null ? Number(rem) : (Number(b.allocatedLeaves || 0) - Number(b.usedLeaves || 0));
      return sum + (val || 0);
    }, 0);
    const pendingList = Array.isArray(rows) ? rows : [];
    const pending = pendingList
      .filter((r) => String(r.status || '').toUpperCase() === 'PENDING')
      .reduce((sum, r) => sum + (Number(r.totalDays ?? r.days ?? 0) || 0), 0);
    return { allowance, taken, left, pending };
  }, [balances, rows]);

  // UI-only estimated days preview
  const estimatedDays = useMemo(() => {
    if (!formFrom || !formTo) return 0;
    const a = new Date(formFrom);
    const b = new Date(formTo);
    if (b < a) return 0;
    return Math.round((b - a) / 86400000) + 1;
  }, [formFrom, formTo]);

  const selectedBalance = useMemo(() => {
    if (!formLeaveTypeId || !Array.isArray(balances)) return null;
    const selectedType = Array.isArray(leaveTypes) ? leaveTypes.find((t) => Number(t.id) === Number(formLeaveTypeId)) : null;
    const typeName = String(selectedType?.name || '').toUpperCase();
    return balances.find(
      (b) =>
        Number(b.leaveTypeId) === Number(formLeaveTypeId) ||
        (typeName && String(b.leaveType || '').toUpperCase().includes(typeName))
    );
  }, [balances, leaveTypes, formLeaveTypeId]);

  const hasPreviewData = Boolean(formLeaveTypeId || formFrom || formTo);

  const submit = async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const leaveTypeId = Number(form.get('leaveTypeId'));
    const startDate = form.get('from');
    const endDate = form.get('to');
    const reason = form.get('reason');

    if (!leaveTypeId || !startDate || !endDate || !reason?.trim()) {
      showToast('Please complete all leave fields.', 'error');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      showToast('To date cannot be before from date.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await applyLeave({ leaveTypeId, startDate, endDate, reason: reason.trim() });
      formEl.reset();
      setReasonText('');
      setFormLeaveTypeId('');
      setFormFrom('');
      setFormTo('');
      await load();
      setPage(1);
      showToast('Leave Request Submitted Successfully.', 'success');
    } catch (error) {
      showToast(error.message || 'Failed To Submit Leave Request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    setCancelTarget(null);
    try {
      await cancelLeave(id);
      await load();
      showToast('Leave Request Cancelled.', 'success');
    } catch (error) {
      showToast(error.message || 'Failed To Cancel Leave Request.', 'error');
    }
  };

  const SUMMARY_CARDS = [
    { icon: WalletCards, label: 'Total Allowance', value: summary.allowance, suffix: ' days', tone: 'blue', desc: 'Annual Entitlement' },
    { icon: CheckCircle2, label: 'Leaves Taken', value: summary.taken, suffix: ' days', tone: 'blue', desc: 'Used This Year' },
    { icon: CalendarDays, label: 'Leaves Left', value: summary.left, suffix: ' days', tone: 'blue', desc: 'Available to Use' },
    { icon: Clock3, label: 'Pending Requests', value: summary.pending, suffix: ' days', tone: 'amber', desc: 'Awaiting Decision' },
  ];

  return (
    <div className="page-stack leave-page page-reveal">
      {/* ---------- Hero banner ---------- */}
      <motion.section
        className="leave-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
      >
        <div className="leave-hero-text">
          <span className="eyebrow">Leave Management</span>
          <h1>Plan Your Time Away</h1>
          <p>Apply For Leave, Monitor Balances And Track Approval Progress.</p>
        </div>
        <div className="leave-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lvCard" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#f1f5ff" />
              </linearGradient>
              <linearGradient id="lvHead" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#2563eb" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="lvPlane" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#60a5fa" />
                <stop offset="1" stopColor="#2563eb" />
              </linearGradient>
            </defs>

            <ellipse className="lv-cloud" cx="70" cy="40" rx="22" ry="8" fill="#dbeafe" />
            <ellipse className="lv-cloud lv-cloud--b" cx="268" cy="86" rx="18" ry="6" fill="#e0e7ff" />

            <path className="lv-trail" d="M40 78 C110 8, 210 8, 292 52" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
            <g>
              <path d="M-12 0 L10 -4 L14 0 L10 4 Z" fill="url(#lvPlane)" />
              <path d="M-2 0 L-8 -9 L-4 -9 L4 0 Z" fill="#60a5fa" />
              <path d="M-2 0 L-8 9 L-4 9 L4 0 Z" fill="#3b82f6" />
              <animateMotion dur="9s" repeatCount="indefinite" rotate="auto" path="M40 78 C110 8, 210 8, 292 52" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.9;1" dur="9s" repeatCount="indefinite" />
            </g>

            <circle cx="268" cy="138" r="11" fill="#fbbf24" />
            <circle className="lv-sun-ring" cx="268" cy="138" r="18" stroke="#fcd34d" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />

            <g className="lv-cal">
              <rect x="84" y="44" width="150" height="116" rx="18" fill="url(#lvCard)" stroke="#c7d2fe" strokeWidth="1.5" />
              <path d="M84 62 a18 18 0 0 1 18 -18 h114 a18 18 0 0 1 18 18 v10 h-150 Z" fill="url(#lvHead)" />
              <circle cx="106" cy="58" r="4" fill="#fff" />
              <circle cx="124" cy="58" r="4" fill="#fff" opacity="0.65" />

              <rect className="lv-cell" style={{ '--i': 0 }} x="104" y="80" width="16" height="14" rx="4" fill="#eef2ff" />
              <rect className="lv-cell" style={{ '--i': 1 }} x="128" y="80" width="16" height="14" rx="4" fill="#eef2ff" />
              <rect className="lv-cell" style={{ '--i': 2 }} x="152" y="80" width="16" height="14" rx="4" fill="#e0e7ff" />
              <rect className="lv-cell" style={{ '--i': 3 }} x="176" y="80" width="16" height="14" rx="4" fill="#eef2ff" />
              <rect className="lv-cell" style={{ '--i': 4 }} x="200" y="80" width="16" height="14" rx="4" fill="#eef2ff" />

              <rect className="lv-cell" style={{ '--i': 5 }} x="104" y="98" width="16" height="14" rx="4" fill="#eef2ff" />
              <rect className="lv-range" style={{ '--i': 0 }} x="128" y="98" width="16" height="14" rx="4" fill="#2563eb" />
              <rect className="lv-range" style={{ '--i': 1 }} x="152" y="98" width="16" height="14" rx="4" fill="#4f46e5" />
              <rect className="lv-range" style={{ '--i': 2 }} x="176" y="98" width="16" height="14" rx="4" fill="#6366f1" />
              <rect className="lv-cell" style={{ '--i': 6 }} x="200" y="98" width="16" height="14" rx="4" fill="#eef2ff" />

              <rect className="lv-cell" style={{ '--i': 7 }} x="104" y="116" width="16" height="14" rx="4" fill="#eef2ff" />
              <rect className="lv-cell" style={{ '--i': 8 }} x="128" y="116" width="16" height="14" rx="4" fill="#eef2ff" />
              <rect className="lv-cell" style={{ '--i': 9 }} x="152" y="116" width="16" height="14" rx="4" fill="#eef2ff" />
              <rect className="lv-cell" style={{ '--i': 10 }} x="176" y="116" width="16" height="14" rx="4" fill="#eef2ff" />
              <rect className="lv-cell" style={{ '--i': 11 }} x="200" y="116" width="16" height="14" rx="4" fill="#eef2ff" />

              <rect x="104" y="138" width="112" height="10" rx="5" fill="#eef2ff" />
            </g>

            <g className="lv-palm">
              <path d="M52 176 Q50 152 64 138" stroke="#16a34a" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M64 138 Q50 128 40 136 M64 138 Q78 128 88 136 M64 138 Q64 124 74 120 M64 138 Q54 124 49 120" stroke="#22c55e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>

            <g>
              <circle className="lv-pulse" cx="236" cy="158" r="14" fill="#10b981" />
              <g className="lv-badge">
                <circle cx="236" cy="158" r="13" fill="#10b981" stroke="#fff" strokeWidth="3" />
                <path className="lv-check" d="M230 158 l4 5 l8 -10" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>
          </svg>
        </div>
      </motion.section>

      {/* ---------- Summary cards ---------- */}
      <motion.div className="leave-overview-grid" initial="hidden" animate="show" variants={stagger}>
        {SUMMARY_CARDS.map((card) => (
          <motion.div key={card.label} className={`leave-overview-card tone-${card.tone}`} variants={fadeUp} whileHover={{ y: -6 }}>
            <div className="loc-icon"><card.icon size={22} /></div>
            <span>{card.label}</span>
            <strong>{loading ? '...' : <><Counter value={card.value} />{card.suffix}</>}</strong>
            <small>{card.desc}</small>
          </motion.div>
        ))}
      </motion.div>

      {/* ---------- Leave balance cards ---------- */}
      <section className="leave-section-head">
        <span className="eyebrow">Your Entitlements</span>
        <h2>Leave Balances</h2>
      </section>
      <motion.div className="leave-balance-grid" initial="hidden" animate="show" variants={stagger}>
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div className="leave-balance-card skeleton" key={`bsk-${i}`}>
            <div className="skeleton-bar" style={{ width: '40%' }} />
            <div className="skeleton-bar" style={{ width: '70%' }} />
            <div className="skeleton-bar" style={{ width: '50%' }} />
          </div>
        ))}
        {!loading && balances.map((balance) => {
          const theme = themeFor(balance.leaveType);
          const TIcon = theme.icon;
          const allocated = Number(balance.allocatedLeaves) || 0;
          const remaining = Number(balance.remainingLeaves) || 0;
          const pct = allocated > 0 ? Math.max(0, Math.min(100, (remaining / allocated) * 100)) : 0;
          const RING_R = 22;
          const RING_C = 2 * Math.PI * RING_R;
          return (
            <motion.div
              key={balance.id}
              className="leave-balance-card"
              style={{ '--lb-color': theme.color, '--lb-bg': theme.soft, '--lb-border': theme.border }}
              variants={fadeUp}
              whileHover={{ y: -4 }}
            >
              <div className="lb-ring">
                <svg viewBox="0 0 56 56">
                  <circle className="lb-ring-track" cx="28" cy="28" r={RING_R} />
                  <motion.circle
                    className="lb-ring-bar"
                    cx="28" cy="28" r={RING_R}
                    strokeDasharray={RING_C}
                    initial={{ strokeDashoffset: RING_C }}
                    animate={{ strokeDashoffset: RING_C * (1 - pct / 100) }}
                    transition={{ duration: 1, ease: easeOut }}
                    style={{ stroke: theme.color }}
                  />
                </svg>
                <span className="lb-ring-icon" style={{ color: theme.color }}><TIcon size={18} /></span>
              </div>
              <div className="lb-info">
                <strong>{balance.leaveType}</strong>
                <span>{balance.usedLeaves} of {balance.allocatedLeaves} used</span>
              </div>
              <div className="lb-remaining">
                <b><Counter value={balance.remainingLeaves} /></b>
                <small>days left</small>
              </div>
            </motion.div>
          );
        })}
        {!loading && !balances.length && (
          <div className="empty-state">
            <CalendarDays size={32} />
            <p>No Leave Balances Found.</p>
            <small>Your Allocated Leave Types Will Appear Here.</small>
          </div>
        )}
      </motion.div>

      {/* ---------- Two column: form + history ---------- */}
      <div className="leave-two-column">
        {/* Apply form */}
        <motion.section className="panel leave-form-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}>
          <div className="panel-title">
            <div>
              <span className="eyebrow">New request</span>
              <h2>Apply for Leave</h2>
            </div>
            <div className="panel-title-icon"><CalendarPlus size={20} /></div>
          </div>
          <p className="panel-desc">Fill In The Details Below. Your Manager Will Be Notified For Approval.</p>

          <form className="leave-form-grid" onSubmit={submit}>
            <label className="lf-field full-span">
              <span className="lf-label"><FileText size={14} /> Leave Type</span>
              <div className="lf-select-wrap">
                <select name="leaveTypeId" required value={formLeaveTypeId} onChange={(e) => setFormLeaveTypeId(e.target.value)}>
                  <option value="" disabled>Select Leave Type</option>
                  {leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
                <ChevronDown size={16} className="lf-chevron" />
              </div>
            </label>

            <label className="lf-field">
              <span className="lf-label"><CalendarDays size={14} /> From Date</span>
              <DatePicker id="leave-from" name="from" required min={MIN_DATE} max={MAX_DATE} value={formFrom} onChange={(e) => setFormFrom(limitYearTo4(e.target.value))} />
            </label>
            <label className="lf-field">
              <span className="lf-label"><CalendarDays size={14} /> To Date</span>
              <DatePicker id="leave-to" name="to" required min={formFrom || MIN_DATE} max={MAX_DATE} value={formTo} onChange={(e) => setFormTo(limitYearTo4(e.target.value))} />
            </label>

            <label className="lf-field full-span">
              <span className="lf-label"><FileText size={14} /> Reason</span>
              <textarea name="reason" rows="4" required maxLength={500} value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Briefly describe the reason for your leave..." />
              <span className="lf-counter">{reasonText.length}/500</span>
            </label>

            {/* Preview summary */}
            <div className="lf-preview full-span">
              <div className="lf-preview-head"><CalendarRange size={15} /> Request Preview</div>
              {hasPreviewData ? (
                <div className="lf-preview-grid">
                  <div><span>Type</span><strong>{leaveTypes.find((t) => Number(t.id) === Number(formLeaveTypeId))?.name || '—'}</strong></div>
                  <div><span>From</span><strong>{formFrom || '—'}</strong></div>
                  <div><span>To</span><strong>{formTo || '—'}</strong></div>
                  <div><span>Estimated days</span><strong className="lf-est">{estimatedDays || '—'}</strong></div>
                  <div><span>Remaining balance</span><strong>{selectedBalance ? `${selectedBalance.remainingLeaves} days` : '—'}</strong></div>
                </div>
              ) : (
                <p className="lf-preview-empty">Fill In The Form To See Your Request Preview Here.</p>
              )}
            </div>

            <motion.button
              type="submit"
              className="btn btn-gradient btn-ripple leave-submit-btn"
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {submitting ? <><span className="btn-spinner" /> Submitting...</> : <><CalendarPlus size={18} /> Submit Request</>}
            </motion.button>
          </form>
        </motion.section>

        {/* History table */}
        <motion.section className="panel leave-history-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}>
          <div className="panel-title">
            <div>
              <span className="eyebrow">My Requests</span>
              <h2>Leave History</h2>
            </div>
          </div>

          <div className="leave-toolbar">
            <label className="leave-search">
              <Search size={15} />
              <input maxLength={INPUT_LIMITS.SEARCH} type="text" placeholder="Search type or date..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </label>
            <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="table-wrap">
            <table className="leave-table">
              <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`lsk-${i}`} className="skeleton-row"><td colSpan={5}><div className="skeleton-bar" /></td></tr>
                ))}
                {!loading && pageItems.map((row, i) => (
                  <motion.tr key={row.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04, ease: easeOut }}>
                    <td><span className="lt-type">{row.leaveType}</span></td>
                    <td>{row.startDate} – {row.endDate}</td>
                    <td><strong>{row.totalDays}</strong></td>
                    <td><StatusPill status={row.status} /></td>
                    <td>
                      {row.status === 'PENDING' && (
                        <button className="btn btn-small btn-outline-danger" onClick={() => setCancelTarget(row)}>Cancel</button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {!loading && !filteredOrdered.length && (
              <div className="empty-state">
                <CalendarDays size={32} />
                <p>No Leave Requests Found.</p>
                <small>Submit Your First Request Using The Form.</small>
              </div>
            )}
          </div>
          <Pagination page={page} totalItems={filteredOrdered.length} pageSize={pageSize} onPageChange={setPage} />
        </motion.section>
      </div>

      {/* ---------- Cancel confirmation modal ---------- */}
      <AnimatePresence>
        {cancelTarget && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCancelTarget(null)}>
            <motion.div className="modal-card" initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }} transition={{ duration: 0.25, ease: easeOut }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon-wrap warn"><AlertTriangle size={26} /></div>
              <h3>Cancel This Leave Request?</h3>
              <p>You're About to Cancel Your <strong>{cancelTarget.leaveType}</strong> Request From <strong>{cancelTarget.startDate}</strong> to <strong>{cancelTarget.endDate}</strong>. This Action Cannot be Undone.</p>
              <div className="modal-actions">
                <button className="btn btn-soft" onClick={() => setCancelTarget(null)}>Keep request</button>
                <button className="btn btn-danger-soft" onClick={() => handleCancel(cancelTarget.id)}><X size={16} />Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}