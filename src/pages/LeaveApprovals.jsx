import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock3,
  CheckCircle2,
  XCircle,
  Timer,
  Search,
  X,
  AlertTriangle,
  CalendarDays,
  FileText,
  UserRound,
  Building2,
  CalendarRange,
  ClipboardList,
  History,
  Check,
  Inbox,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import ExportMenu from '../components/ExportMenu';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { getAllLeaveRequests, getTeamLeaveRequests, managerLeaveAction, exportLeaveReport } from '../services/leaveService';
import { capitalizeName } from '../utils/formatName';
import { useToast } from '../context/ToastContext';
import './LeaveApprovals.css';

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };

function initials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function LeaveApprovals() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // UI-only state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let requests = [];
      try {
        requests = await getAllLeaveRequests();
      } catch {
        requests = await getTeamLeaveRequests();
      }
      setRows(Array.isArray(requests) ? requests : []);
    } catch (error) {
      showToast(error.message || 'Failed to load leave requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const ordered = useMemo(() => sortRecent(rows, 'startDate'), [rows]);

  // UI-only filters
  const leaveTypes = useMemo(() => Array.from(new Set(ordered.map((r) => r.leaveType).filter(Boolean))), [ordered]);

  const filteredOrdered = useMemo(() => {
    let list = ordered;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => String(r.employeeName || '').toLowerCase().includes(q) || String(r.leaveType || '').toLowerCase().includes(q));
    }
    if (typeFilter !== 'ALL') list = list.filter((r) => r.leaveType === typeFilter);
    if (statusFilter !== 'ALL') list = list.filter((r) => String(r.status || '').toUpperCase() === statusFilter);
    return list;
  }, [ordered, searchQuery, typeFilter, statusFilter]);

  const { page, setPage, pageItems, pageSize } = usePagination(filteredOrdered, 6);

  // Summary cards derived from real backend data
  const summary = useMemo(() => {
    const pending = ordered.filter((r) => String(r.status || '').toUpperCase() === 'PENDING').length;
    const approved = ordered.filter((r) => String(r.status || '').toUpperCase() === 'APPROVED').length;
    const rejected = ordered.filter((r) => String(r.status || '').toUpperCase() === 'REJECTED').length;
    const total = ordered.length;
    return { pending, approved, rejected, total };
  }, [ordered]);

  const decide = async (id, action, reason) => {
    setActing(true);
    try {
      await managerLeaveAction(id, action, reason || '');
      await load();
      // Approve stays green ('success'); Reject uses the red 'error' style
      // even though the action itself succeeded, since red better signals
      // a rejection outcome than green does.
      if (action === 'APPROVE') {
        showToast('Leave Request Approved.', 'success');
      } else {
        showToast('Leave Request Rejected.', 'error');
      }
    } catch (error) {
      const rawMessage = error.message || 'Failed to record decision.';
      // The backend's attendance-conflict / start-date checks run before it
      // looks at whether this is an approve or a reject, so their error
      // text always says "...Leave cannot be approved" even when the
      // manager clicked Reject. Reword it here so it matches what was
      // actually attempted. Note: this only fixes the wording - the
      // backend still blocks the whole action in this case, so the
      // request stays Pending either way until that backend check is
      // fixed to only apply to Approve.
      const message =
        action === 'REJECT'
          ? rawMessage.replace(/\s*Leave cannot be approved(?: after its start date)?\.?/i, ' This request could not be processed.')
          : rawMessage;
      showToast(message, 'error');

      // Whatever the row currently shows locally is now out of sync with
      // the backend (e.g. it was already approved/rejected in another tab,
      // or a previous click actually went through). Re-fetch so this row
      // picks up its real status and its Approve/Reject buttons get
      // disabled - otherwise they stay clickable and every retry just
      // repeats the same "already processed" error forever.
      load();
    } finally {
      setActing(false);
    }
  };

  function confirmApprove() {
    if (!approveTarget) return;
    decide(approveTarget.id, 'APPROVE', '');
    setApproveTarget(null);
  }

  function confirmReject() {
    if (!rejectTarget) return;
    decide(rejectTarget.id, 'REJECT', rejectReason || 'Not approved');
    setRejectTarget(null);
    setRejectReason('');
  }

  async function handleExport(format) {
    try {
      const filters = {};
      if (statusFilter !== 'ALL') filters.leaveStatus = statusFilter;
      const { blob, filename } = await exportLeaveReport(format, filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Leave report downloaded as ${format === 'excel' ? 'Excel' : 'PDF'}.`, 'success');
    } catch (error) {
      showToast(error.message || 'Unable to export leave report.', 'error');
    }
  }

  const SUMMARY_CARDS = [
    { icon: Clock3, label: 'Pending Requests', value: summary.pending, tone: 'orange', desc: 'Awaiting Decision' },
    { icon: CheckCircle2, label: 'Approved Requests', value: summary.approved, tone: 'green', desc: 'Total Approved' },
    { icon: XCircle, label: 'Rejected Requests', value: summary.rejected, tone: 'red', desc: 'Total Rejected' },
    { icon: Timer, label: 'Total Requests', value: summary.total, tone: 'blue', desc: 'Across All Employees' },
  ];

  return (
    <div className="page-stack leave-approvals-page page-reveal">
      {/* ---------- Hero banner ---------- */}
      <motion.section
        className="la-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: easeOut }}
      >
        <div className="la-hero-text">
          <span className="eyebrow">Manager Workspace</span>
          <h1>Leave Approval Center</h1>
          <p>Review, Approve And Manage Employee Leave Requests.</p>
        </div>
        <div className="la-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="56" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="40" fill="#bfdbfe" opacity="0.4" />
            {/* Approval workflow: document + check */}
            <rect x="110" y="40" width="120" height="130" rx="16" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            <rect x="128" y="58" width="84" height="8" rx="4" fill="#e0edff" />
            <rect x="128" y="74" width="64" height="8" rx="4" fill="#eef4ff" />
            <rect x="128" y="90" width="74" height="8" rx="4" fill="#eef4ff" />
            <rect x="128" y="106" width="54" height="8" rx="4" fill="#eef4ff" />
            {/* Check circle */}
            <circle cx="200" cy="140" r="20" fill="#16a34a" />
            <path d="M192 140 l5 6 l10 -12" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {/* Stamp */}
            <rect x="130" y="130" width="50" height="24" rx="6" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" transform="rotate(-8 155 142)" />
          </svg>
        </div>
      </motion.section>

      {/* ---------- Summary cards ---------- */}
      <motion.div className="la-overview-grid" initial="hidden" animate="show" variants={stagger}>
        {SUMMARY_CARDS.map((card) => (
          <motion.div key={card.label} className={`la-overview-card tone-${card.tone}`} variants={fadeUp} whileHover={{ y: -6 }}>
            <div className="loc-icon"><card.icon size={22} /></div>
            <span>{card.label}</span>
            <strong>{loading ? '...' : card.value}</strong>
            <small>{card.desc}</small>
          </motion.div>
        ))}
      </motion.div>

      {/* ---------- Filter bar + table ---------- */}
      <motion.section className="panel la-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}>
        <div className="panel-title">
          <div>
            <span className="eyebrow">Pending Review</span>
            <h2>Team Leave Requests</h2>
          </div>
        </div>

        <div className="la-toolbar">
          <label className="la-search">
            <Search size={15} />
            <input type="text" placeholder="Search employee or leave type..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </label>
          <select className="compact-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All leave types</option>
            {leaveTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <ExportMenu onExport={handleExport} />
        </div>

        <div className="table-wrap">
          <table className="la-table">
            <thead>
              <tr>
                <th>Employee</th><th>Leave Type</th><th>Date Range</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={`lsk-${i}`} className="skeleton-row"><td colSpan={7}><div className="skeleton-bar" /></td></tr>
              ))}
              {!loading && pageItems.map((row, i) => (
                <motion.tr key={row.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04, ease: easeOut }}>
                  <td>
                    <button className="emp-cell" onClick={() => setDrawerItem(row)}>
                      <span className="emp-avatar">{initials(row.employeeName)}</span>
                      <span className="emp-name">{capitalizeName(row.employeeName)}</span>
                    </button>
                  </td>
                  <td><span className="lt-type">{row.leaveType}</span></td>
                  <td>{row.startDate} – {row.endDate}</td>
                  <td><strong>{row.totalDays}</strong></td>
                  <td className="reason-cell"><span title={row.reason}>{row.reason}</span></td>
                  <td><span className={`status-pill ${String(row.status || '').toLowerCase()}`}><StatusBadge>{row.status}</StatusBadge></span></td>
                  <td>
                    <div className="la-actions">
                      <motion.button
                        className="btn btn-small btn-gradient-green"
                        whileHover={String(row.status || '').toUpperCase() === 'PENDING' ? { scale: 1.05 } : undefined}
                        whileTap={String(row.status || '').toUpperCase() === 'PENDING' ? { scale: 0.95 } : undefined}
                        disabled={acting || String(row.status || '').toUpperCase() !== 'PENDING'}
                        onClick={() => setApproveTarget(row)}
                      >
                        <Check size={15} /> Approve
                      </motion.button>
                      <motion.button
                        className="btn btn-small btn-gradient-red"
                        whileHover={String(row.status || '').toUpperCase() === 'PENDING' ? { scale: 1.05 } : undefined}
                        whileTap={String(row.status || '').toUpperCase() === 'PENDING' ? { scale: 0.95 } : undefined}
                        disabled={acting || String(row.status || '').toUpperCase() !== 'PENDING'}
                        onClick={() => { setRejectTarget(row); setRejectReason(''); }}
                      >
                        <X size={15} /> Reject
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {!loading && !filteredOrdered.length && (
            <div className="empty-state">
              <Inbox size={32} />
              <p>No Pending Leave Requests.</p>
              <small>Approved And Rejected Requests Won't Appear Here.</small>
            </div>
          )}
        </div>
        <Pagination page={page} totalItems={filteredOrdered.length} pageSize={pageSize} onPageChange={setPage} />
      </motion.section>

      {/* ---------- Approve confirmation modal ---------- */}
      <AnimatePresence>
        {approveTarget && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setApproveTarget(null)}>
            <motion.div className="modal-card" initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }} transition={{ duration: 0.25, ease: easeOut }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon-wrap success"><CheckCircle2 size={26} /></div>
              <h3>Approve This Request?</h3>
              <p>Confirm Approval For <strong>{capitalizeName(approveTarget.employeeName)}</strong>'s <strong>{approveTarget.leaveType}</strong> Leave From <strong>{approveTarget.startDate}</strong> to <strong>{approveTarget.endDate}</strong>.</p>
              <div className="modal-actions">
                <button className="btn btn-soft" onClick={() => setApproveTarget(null)}>Cancel</button>
                <button className="btn btn-gradient-green" disabled={acting} onClick={confirmApprove}><Check size={16} /> {acting ? 'Approving...' : 'Yes, approve'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Reject modal with reason ---------- */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRejectTarget(null)}>
            <motion.div className="modal-card" initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }} transition={{ duration: 0.25, ease: easeOut }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon-wrap danger"><XCircle size={26} /></div>
              <h3>Reject This Request?</h3>
              <p>Provide a Reason For Rejecting <strong>{capitalizeName(rejectTarget.employeeName)}</strong>'s <strong>{rejectTarget.leaveType}</strong> Leave Request.</p>
              <label className="reject-reason-field">
                <textarea rows="4" maxLength={500} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
                <span className="lf-counter">{rejectReason.length}/500</span>
              </label>
              <div className="modal-actions">
                <button className="btn btn-soft" onClick={() => setRejectTarget(null)}>Cancel</button>
                <button className="btn btn-gradient-red" disabled={acting} onClick={confirmReject}><X size={16} /> {acting ? 'Rejecting...' : 'Confirm rejection'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Detail drawer ---------- */}
      <AnimatePresence>
        {drawerItem && (
          <>
            <motion.div className="drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerItem(null)} />
            <motion.aside
              className="detail-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 38 }}
            >
              <div className="drawer-head">
                <span className="eyebrow">Request Details</span>
                <h2>Leave Request</h2>
                <button className="drawer-close" onClick={() => setDrawerItem(null)} aria-label="Close"><X size={20} /></button>
              </div>

              <div className="drawer-body">
                <div className="drawer-emp">
                  <span className="emp-avatar lg">{initials(drawerItem.employeeName)}</span>
                  <div>
                    <strong>{capitalizeName(drawerItem.employeeName)}</strong>
                    <small>{drawerItem.department || 'Department —'}</small>
                  </div>
                </div>

                <div className="drawer-grid">
                  <div className="dg-item"><UserRound size={15} /><span>Employee</span><strong>{capitalizeName(drawerItem.employeeName)}</strong></div>
                  <div className="dg-item"><FileText size={15} /><span>Leave Type</span><strong>{drawerItem.leaveType}</strong></div>
                  <div className="dg-item"><CalendarRange size={15} /><span>Date Range</span><strong>{drawerItem.startDate} – {drawerItem.endDate}</strong></div>
                  <div className="dg-item"><CalendarDays size={15} /><span>Total Days</span><strong>{drawerItem.totalDays}</strong></div>
                  <div className="dg-item"><Building2 size={15} /><span>Department</span><strong>{drawerItem.department || '—'}</strong></div>
                  <div className="dg-item"><ClipboardList size={15} /><span>Status</span><strong><StatusBadge>{drawerItem.status}</StatusBadge></strong></div>
                </div>

                <div className="drawer-section">
                  <span className="ds-label"><FileText size={14} /> Reason</span>
                  <p>{drawerItem.reason || 'No Reason Provided.'}</p>
                </div>

                <div className="drawer-section">
                  <span className="ds-label"><History size={14} /> Timeline</span>
                  <div className="timeline">
                    <div className="tl-item"><span className="tl-dot" /><div><strong>Request Submitted</strong><small>{drawerItem.startDate}</small></div></div>
                    <div className="tl-item"><span className="tl-dot pending" /><div><strong>Awaiting Manager Decision</strong><small>{drawerItem.status}</small></div></div>
                  </div>
                </div>
              </div>

              {String(drawerItem.status || '').toUpperCase() === 'PENDING' && (
                <div className="drawer-footer">
                  <motion.button className="btn btn-gradient-green" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={acting} onClick={() => { setApproveTarget(drawerItem); setDrawerItem(null); }}>
                    <Check size={16} /> Approve
                  </motion.button>
                  <motion.button className="btn btn-gradient-red" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={acting} onClick={() => { setRejectTarget(drawerItem); setDrawerItem(null); }}>
                    <X size={16} /> Reject
                  </motion.button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}