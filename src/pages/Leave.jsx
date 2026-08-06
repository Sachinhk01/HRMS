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
import {
  applyLeave,
  cancelLeave,
  getActiveLeaveTypes,
  getMyLeaveBalances,
  getMyLeaveRequests,
} from '../services/leaveService';
import './Leave.css';

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

export default function Leave() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

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
    setErr('');
    try {
      const [requestsData, balancesData, typesData] = await Promise.all([
        getMyLeaveRequests(),
        getMyLeaveBalances(),
        getActiveLeaveTypes(),
      ]);
      setRows(requestsData || []);
      setBalances(balancesData || []);
      setLeaveTypes(typesData || []);
    } catch (error) {
      setErr(error.message || 'Failed to load leave data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user.id]);

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
    const allowance = balances.reduce((sum, b) => sum + (b.allocatedLeaves || 0), 0);
    const taken = balances.reduce((sum, b) => sum + (b.usedLeaves || 0), 0);
    const left = balances.reduce((sum, b) => sum + (b.remainingLeaves || 0), 0);
    const pending = rows
      .filter((r) => r.status === 'PENDING')
      .reduce((sum, r) => sum + (r.totalDays || 0), 0);
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

  const selectedBalance = useMemo(
    () => balances.find((b) => String(b.leaveType).toUpperCase().includes(String(leaveTypes.find((t) => Number(t.id) === Number(formLeaveTypeId))?.name || '').toUpperCase())),
    [balances, leaveTypes, formLeaveTypeId]
  );

  const hasPreviewData = Boolean(formLeaveTypeId || formFrom || formTo);

  const submit = async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    setMsg('');
    setErr('');
    const form = new FormData(formEl);
    const leaveTypeId = Number(form.get('leaveTypeId'));
    const startDate = form.get('from');
    const endDate = form.get('to');
    const reason = form.get('reason');

    if (!leaveTypeId || !startDate || !endDate || !reason?.trim()) {
      setErr('Please complete all leave fields.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setErr('To date cannot be before from date.');
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
      setMsg('Leave request submitted successfully.');
    } catch (error) {
      setErr(error.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    setErr('');
    setCancelTarget(null);
    try {
      await cancelLeave(id);
      await load();
      setMsg('Leave request cancelled.');
    } catch (error) {
      setErr(error.message || 'Failed to cancel leave request.');
    }
  };

  const SUMMARY_CARDS = [
    { icon: WalletCards, label: 'Total Allowance', value: summary.allowance, suffix: ' days', tone: 'blue', desc: 'Annual entitlement' },
    { icon: CheckCircle2, label: 'Leaves Taken', value: summary.taken, suffix: ' days', tone: 'blue', desc: 'Used this year' },
    { icon: CalendarDays, label: 'Leaves Left', value: summary.left, suffix: ' days', tone: 'blue', desc: 'Available to use' },
    { icon: Clock3, label: 'Pending Requests', value: summary.pending, suffix: ' days', tone: 'amber', desc: 'Awaiting decision' },
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
          <h1>Plan your time away</h1>
          <p>Apply for leave, monitor balances and track approval progress.</p>
        </div>
        <div className="leave-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f4f8ff" />
              </linearGradient>
              <linearGradient id="planeGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="46" r="46" fill="#dbeafe" opacity="0.55" />
            <circle cx="46" cy="176" r="34" fill="#bfdbfe" opacity="0.4" />

            {/* Calendar card */}
            <rect x="86" y="52" width="150" height="122" rx="20" fill="url(#cardGrad)" stroke="#bfdbfe" strokeWidth="1.5" />
            <rect x="86" y="52" width="150" height="30" rx="20" fill="#2563eb" />
            <rect x="86" y="70" width="150" height="12" fill="#2563eb" />
            <circle cx="108" cy="67" r="4" fill="#fff" />
            <circle cx="126" cy="67" r="4" fill="#fff" opacity="0.7" />
            <rect x="104" y="96" width="16" height="16" rx="4" fill="#eef4ff" />
            <rect x="128" y="96" width="16" height="16" rx="4" fill="#eef4ff" />
            <rect x="152" y="96" width="16" height="16" rx="4" fill="#dbeafe" />
            <rect x="176" y="96" width="16" height="16" rx="4" fill="#eef4ff" />
            <rect x="200" y="96" width="16" height="16" rx="4" fill="#eef4ff" />
            <rect x="104" y="120" width="16" height="16" rx="4" fill="#eef4ff" />
            <rect x="128" y="120" width="16" height="16" rx="4" fill="#2563eb" />
            <rect x="152" y="120" width="16" height="16" rx="4" fill="#2563eb" />
            <rect x="176" y="120" width="16" height="16" rx="4" fill="#eef4ff" />
            <rect x="200" y="120" width="16" height="16" rx="4" fill="#eef4ff" />
            <rect x="104" y="144" width="112" height="14" rx="7" fill="#eef4ff" />

            {/* Palm tree accent */}
            <path d="M56 178 Q56 150 70 140" stroke="#16a34a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M70 140 Q56 130 46 138 M70 140 Q84 130 94 138 M70 140 Q70 126 80 122 M70 140 Q60 126 55 122" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" />

            {/* Sun */}
            <circle cx="252" cy="148" r="13" fill="#fbbf24" />

            {/* Plane */}
            <path d="M226 42 L266 34 L274 40 L266 46 L226 54 Z" fill="url(#planeGrad)" />
            <path d="M238 42 L244 28 L250 28 L246 42" fill="#60a5fa" />
          </svg>
        </div>
      </motion.section>

      {/* ---------- Toasts ---------- */}
      <AnimatePresence>
        {err && (
          <motion.div className="toast toast-error" initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -24, scale: 0.96 }} transition={{ duration: 0.3, ease: easeOut }}>
            <AlertTriangle size={18} /> {err}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {msg && (
          <motion.div className="toast toast-success" initial={{ opacity: 0, y: -24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -24, scale: 0.96 }} transition={{ duration: 0.3, ease: easeOut }} onAnimationComplete={() => { if (msg) window.setTimeout(() => setMsg(''), 3500); }}>
            <CheckCircle2 size={18} /> {msg}
          </motion.div>
        )}
      </AnimatePresence>

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
        <span className="eyebrow">Your entitlements</span>
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
          const pct = balance.allocatedLeaves ? Math.min(100, (balance.usedLeaves / balance.allocatedLeaves) * 100) : 0;
          return (
            <motion.div
              key={balance.id}
              className="leave-balance-card"
              style={{ '--lb-color': theme.color, '--lb-bg': theme.soft, '--lb-border': theme.border }}
              variants={fadeUp}
              whileHover={{ y: -5 }}
            >
              <div className="lb-top">
                <div className="lb-icon" style={{ background: theme.bg, color: theme.color }}><TIcon size={20} /></div>
                <div className="lb-name">
                  <strong>{balance.leaveType}</strong>
                  <span>{balance.remainingLeaves} days remaining</span>
                </div>
              </div>
              <div className="lb-progress">
                <motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: easeOut }} style={{ background: `linear-gradient(90deg, ${theme.color}, ${theme.color}cc)` }} />
              </div>
              <div className="lb-stats">
                <span><b>{balance.usedLeaves}</b> used</span>
                <span><b>{balance.allocatedLeaves}</b> allocated</span>
              </div>
            </motion.div>
          );
        })}
        {!loading && !balances.length && (
          <div className="empty-state">
            <CalendarDays size={32} />
            <p>No leave balances found.</p>
            <small>Your allocated leave types will appear here.</small>
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
          <p className="panel-desc">Fill in the details below. Your manager will be notified for approval.</p>

          <form className="leave-form-grid" onSubmit={submit}>
            <label className="lf-field full-span">
              <span className="lf-label"><FileText size={14} /> Leave type</span>
              <div className="lf-select-wrap">
                <select name="leaveTypeId" required defaultValue="" value={formLeaveTypeId} onChange={(e) => setFormLeaveTypeId(e.target.value)}>
                  <option value="" disabled>Select leave type</option>
                  {leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
                <ChevronDown size={16} className="lf-chevron" />
              </div>
            </label>

            <label className="lf-field">
              <span className="lf-label"><CalendarDays size={14} /> From date</span>
              <input name="from" type="date" required value={formFrom} onChange={(e) => setFormFrom(e.target.value)} />
            </label>
            <label className="lf-field">
              <span className="lf-label"><CalendarDays size={14} /> To date</span>
              <input name="to" type="date" required value={formTo} onChange={(e) => setFormTo(e.target.value)} />
            </label>

            <label className="lf-field full-span">
              <span className="lf-label"><FileText size={14} /> Reason</span>
              <textarea name="reason" rows="4" required maxLength={500} value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Briefly describe the reason for your leave..." />
              <span className="lf-counter">{reasonText.length}/500</span>
            </label>

            {/* Preview summary */}
            <div className="lf-preview full-span">
              <div className="lf-preview-head"><CalendarRange size={15} /> Request preview</div>
              {hasPreviewData ? (
                <div className="lf-preview-grid">
                  <div><span>Type</span><strong>{leaveTypes.find((t) => Number(t.id) === Number(formLeaveTypeId))?.name || '—'}</strong></div>
                  <div><span>From</span><strong>{formFrom || '—'}</strong></div>
                  <div><span>To</span><strong>{formTo || '—'}</strong></div>
                  <div><span>Estimated days</span><strong className="lf-est">{estimatedDays || '—'}</strong></div>
                  <div><span>Remaining balance</span><strong>{selectedBalance ? `${selectedBalance.remainingLeaves} days` : '—'}</strong></div>
                </div>
              ) : (
                <p className="lf-preview-empty">Fill in the form to see your request preview here.</p>
              )}
            </div>

            <motion.button
              type="submit"
              className="btn btn-gradient btn-ripple leave-submit-btn"
              disabled={submitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {submitting ? <><span className="btn-spinner" /> Submitting...</> : <><CalendarPlus size={18} /> Submit request</>}
            </motion.button>
          </form>
        </motion.section>

        {/* History table */}
        <motion.section className="panel leave-history-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut, delay: 0.1 }}>
          <div className="panel-title">
            <div>
              <span className="eyebrow">My requests</span>
              <h2>Leave History</h2>
            </div>
          </div>

          <div className="leave-toolbar">
            <label className="leave-search">
              <Search size={15} />
              <input type="text" placeholder="Search type or date..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </label>
            <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
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
                <p>No leave requests found.</p>
                <small>Submit your first request using the form.</small>
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
              <h3>Cancel this leave request?</h3>
              <p>You're about to cancel your <strong>{cancelTarget.leaveType}</strong> request from <strong>{cancelTarget.startDate}</strong> to <strong>{cancelTarget.endDate}</strong>. This action cannot be undone.</p>
              <div className="modal-actions">
                <button className="btn btn-soft" onClick={() => setCancelTarget(null)}>Keep request</button>
                <button className="btn btn-danger-soft" onClick={() => handleCancel(cancelTarget.id)}><X size={16} /> Yes, cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}