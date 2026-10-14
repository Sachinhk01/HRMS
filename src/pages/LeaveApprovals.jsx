import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Check, CheckCircle2, Clock3, Inbox, Search, Timer, X, XCircle } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import Pagination from '../components/Pagination';
import { Avatar, PaidLop, StatusChip } from '../components/LeaveBits';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { getAllLeaveRequests, getTeamLeaveRequests, managerLeaveAction, exportLeaveReport } from '../services/leaveService';
import { capitalizeName } from '../utils/formatName';
import { formatDate, formatRange, isOwnRequest, isPending, leaveErrorMessage } from '../utils/leaveFormat';
import './LeaveApprovals.css';
import './LeaveRequests.css';
import { INPUT_LIMITS } from '../utils/inputLimits';

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
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const role = user?.role || user?.roles?.[0];
  const canAct = role === 'MANAGER';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({
    month: currentMonth,
    year: thisYear,
    employee: 'ALL',
    status: 'PENDING',
    type: 'ALL',
    search: '',
  });
  const [applied, setApplied] = useState(draft);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let requests;
      try {
        requests = await getAllLeaveRequests({ month: applied.month, year: applied.year });
      } catch (error) {
        if (error?.status !== 403) throw error;
        requests = await getTeamLeaveRequests();
      }
      setRows(Array.isArray(requests) ? requests : []);
    } catch (error) {
      showToast(error.message || 'Failed to load leave requests.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [applied.month, applied.year, showToast]);

  useEffect(() => { load(); }, [load]);

  const ordered = useMemo(() => sortRecent(rows, 'startDate'), [rows]);
  const employees = useMemo(() => {
    const byId = new Map();
    ordered.forEach((row) => {
      if (row.employeeId != null) byId.set(String(row.employeeId), {
        id: row.employeeId,
        name: row.employeeName || row.employeeCode || `Employee ${row.employeeId}`,
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [ordered]);
  const leaveTypes = useMemo(() => Array.from(new Set(ordered.map((row) => row.leaveType).filter(Boolean))), [ordered]);

  const filtered = useMemo(() => {
    let list = ordered;
    if (applied.employee !== 'ALL') list = list.filter((row) => String(row.employeeId) === String(applied.employee));
    if (applied.status !== 'ALL') list = list.filter((row) => String(row.status || '').toUpperCase() === applied.status);
    if (applied.type !== 'ALL') list = list.filter((row) => row.leaveType === applied.type);
    if (applied.search.trim()) {
      const query = applied.search.trim().toLowerCase();
      list = list.filter((row) => (
        String(row.employeeName || '').toLowerCase().includes(query) ||
        String(row.employeeCode || '').toLowerCase().includes(query) ||
        String(row.leaveType || '').toLowerCase().includes(query)
      ));
    }
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

  const decide = async (row, action, reason = '') => {
    if (!canAct || !isPending(row) || isOwnRequest(row, user) || acting) return;
    setActing(true);
    try {
      await managerLeaveAction(row.id, action, reason);
      showToast(action === 'APPROVE' ? 'Leave request approved.' : 'Leave request rejected.', 'success');
      setApproveTarget(null);
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (error) {
      showToast(leaveErrorMessage(error, 'Failed to record the decision.'), 'error');
      await load();
    } finally {
      setActing(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setApplied({ ...draft });
  };

  const stepMonth = (offset) => {
    const date = new Date(draft.year, draft.month - 1 + offset, 1);
    if (date.getFullYear() < years[0] || date.getFullYear() > years[years.length - 1]) return;
    setDraft((current) => ({ ...current, month: date.getMonth() + 1, year: date.getFullYear() }));
  };

  const exportReport = async (format) => {
    try {
      const filters = applied.status === 'ALL' ? {} : { leaveStatus: applied.status };
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
  };

  const cards = [
    { icon: Clock3, label: 'Pending Requests', value: summary.pending, tone: 'orange' },
    { icon: CheckCircle2, label: 'Approved Requests', value: summary.approved, tone: 'green' },
    { icon: XCircle, label: 'Rejected Requests', value: summary.rejected, tone: 'red' },
    { icon: Timer, label: 'Total Requests', value: summary.total, tone: 'blue' },
  ];

  return (
    <div className="lr-page page-reveal">
      <header className="lr-head">
        <div><h1>Team Leave Requests</h1><p>Search and review leave requests across your organization.</p></div>
      </header>
      {!canAct && <div className="lr-note lr-note--info"><CalendarDays size={15} /><span>This page is view-only for your role. Approvals are handled by the employee’s reporting manager.</span></div>}

      <section className="lr-stats">
        {cards.map((card) => <article className="lr-stat" key={card.label}><span className={`lr-stat-icon tone-${card.tone}`}><card.icon size={21} /></span><div><small>{card.label}</small><strong>{loading ? '…' : card.value}</strong></div></article>)}
      </section>

      <section className="lr-card">
        <form className="lr-filters" onSubmit={handleSearch}>
          <div className="lr-filter">
            <label>Month</label>
            <div className="lr-stepper">
              <button type="button" aria-label="Previous month" onClick={() => stepMonth(-1)}>‹</button>
              <span>{new Date(draft.year, draft.month - 1).toLocaleString(undefined, { month: 'long' })} {draft.year}</span>
              <button type="button" aria-label="Next month" onClick={() => stepMonth(1)}>›</button>
            </div>
          </div>
          <div className="lr-filter">
            <label htmlFor="team-year">Year</label>
            <div className="lr-select"><select id="team-year" value={draft.year} onChange={(event) => setDraft((value) => ({ ...value, year: Number(event.target.value) }))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
          </div>
          <div className="lr-filter">
            <label htmlFor="team-employee">Employee</label>
            <div className="lr-select"><select id="team-employee" value={draft.employee} onChange={(event) => setDraft((value) => ({ ...value, employee: event.target.value }))}><option value="ALL">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{capitalizeName(employee.name)}</option>)}</select></div>
          </div>
        </div>

        <div className="la-toolbar">
          <label className="la-search">
            <Search size={15} />
            <input maxLength={INPUT_LIMITS.SEARCH} type="text" placeholder="Search employee or leave type..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
          {!loading && !filtered.length && <div className="lr-empty"><Inbox size={30} /><p>No leave requests found.</p><small>Try a different month or filter.</small></div>}
        </div>
        <footer className="lr-table-foot"><span>Total Records: {filtered.length}</span><Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} /><span>Showing latest first</span></footer>
      </section>

      <AnimatePresence>
        {approveTarget && (
          <motion.div className="lr-overlay lr-overlay--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => {
            if (event.target === event.currentTarget && !acting) setApproveTarget(null);
          }}>
            <section className="lr-modal" role="dialog" aria-modal="true" aria-labelledby="team-approve-title">
              <h3 id="team-approve-title">Approve this request?</h3>
              <p><strong>{capitalizeName(approveTarget.employeeName)}</strong> · {approveTarget.leaveType} · {formatDate(approveTarget.startDate)} – {formatDate(approveTarget.endDate)} ({approveTarget.totalDays} day{Number(approveTarget.totalDays) === 1 ? '' : 's'}).</p>
              <div className="lr-modal-actions"><button type="button" className="lr-btn lr-btn--ghost" onClick={() => setApproveTarget(null)} disabled={acting}>Cancel</button><button type="button" className="lr-btn lr-btn--approve" disabled={acting} onClick={() => decide(approveTarget, 'APPROVE')}><Check size={15} />{acting ? 'Approving…' : 'Approve'}</button></div>
            </section>
          </motion.div>
        )}
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
          <motion.div
            className="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerItem(null)}
          >
            <motion.aside
              className="detail-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Leave request details"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
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
                    {drawerItem.department ? <small>{drawerItem.department}</small> : null}
                  </div>
                  <span className="drawer-emp-status"><StatusBadge>{drawerItem.status}</StatusBadge></span>
                </div>

                <div className="drawer-grid">
                  <div className="dg-item"><FileText size={15} /><span>Leave Type</span><strong>{drawerItem.leaveType}</strong></div>
                  <div className="dg-item"><CalendarDays size={15} /><span>Total Days</span><strong>{drawerItem.totalDays}</strong></div>
                  <div className="dg-item dg-wide"><CalendarRange size={15} /><span>Date Range</span><strong>{drawerItem.startDate} – {drawerItem.endDate}</strong></div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
