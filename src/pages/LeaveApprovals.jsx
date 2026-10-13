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
import {
  exportLeaveReport, getAllLeaveRequests, getTeamLeaveRequests, managerLeaveAction,
} from '../services/leaveService';
import { capitalizeName } from '../utils/formatName';
import { formatDate, formatRange, isOwnRequest, isPending, leaveErrorMessage } from '../utils/leaveFormat';
import './LeaveApprovals.css';
import './LeaveRequests.css';
import { INPUT_LIMITS } from '../utils/inputLimits';

const thisYear = new Date().getFullYear();
const years = Array.from({ length: 7 }, (_, index) => thisYear - 3 + index);
const currentMonth = new Date().getMonth() + 1;

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
  }, [ordered, applied]);
  const { page, setPage, pageItems, pageSize } = usePagination(filtered, 10);
  useEffect(() => { setPage(1); }, [applied, setPage]);

  const summary = useMemo(() => ({
    pending: ordered.filter((row) => isPending(row)).length,
    approved: ordered.filter((row) => String(row.status).toUpperCase() === 'APPROVED').length,
    rejected: ordered.filter((row) => String(row.status).toUpperCase() === 'REJECTED').length,
    total: ordered.length,
  }), [ordered]);

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
          <div className="lr-filter">
            <label htmlFor="team-status">Status</label>
            <div className="lr-select"><select id="team-status" value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value }))}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option></select></div>
          </div>
          <div className="lr-filter">
            <label htmlFor="team-type">Leave Type</label>
            <div className="lr-select"><select id="team-type" value={draft.type} onChange={(event) => setDraft((value) => ({ ...value, type: event.target.value }))}><option value="ALL">All types</option>{leaveTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
          </div>
          <label className="lr-team-search" htmlFor="team-search"><Search size={15} /><input id="team-search" maxLength={INPUT_LIMITS.SEARCH} value={draft.search} onChange={(event) => setDraft((value) => ({ ...value, search: event.target.value }))} placeholder="Search name, code, or leave type" /></label>
          <button type="submit" className="lr-btn lr-btn--primary"><Search size={15} /> Search</button>
          <ExportMenu onExport={exportReport} />
        </form>

        <div className="lr-table-wrap">
          <table className="lr-table lr-team-table">
            <thead><tr><th>#</th><th>Employee</th><th>Leave Dates</th><th>Days</th><th>Reason</th><th>Leave Type</th><th>Status</th><th>Paid / LOP</th><th>Actions</th></tr></thead>
            <tbody>
              {loading && Array.from({ length: 5 }, (_, index) => <tr key={index} className="lr-skel"><td colSpan={9}><div /></td></tr>)}
              {!loading && pageItems.map((row, index) => {
                const canDecide = canAct && isPending(row) && !isOwnRequest(row, user);
                const range = formatRange(row.startDate, row.endDate);
                return (
                  <tr key={row.id}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td><span className="lr-emp"><Avatar name={row.employeeName} /><span><b>{capitalizeName(row.employeeName || 'Employee')}</b><small>{row.employeeCode || ''}</small></span></span></td>
                    <td><span className="lr-dates">{range.main}<small>{range.sub}</small></span></td>
                    <td>{row.totalDays ?? '—'}</td>
                    <td className="lr-reason" title={row.reason}>{row.reason || '—'}</td>
                    <td>{row.leaveType || '—'}</td>
                    <td><StatusChip status={row.status} /></td>
                    <td><PaidLop row={row} /></td>
                    <td><div className="lr-actions">
                      {canDecide ? (
                        <>
                          <button type="button" className="lr-btn lr-btn--approve" disabled={acting} onClick={() => setApproveTarget(row)}>Approve</button>
                          <button type="button" className="lr-btn lr-btn--reject" disabled={acting} onClick={() => { setRejectTarget(row); setRejectReason(''); }}>Reject</button>
                        </>
                      ) : <button type="button" className="lr-btn lr-btn--view" onClick={() => navigate(`/leave/${row.id}`)}>View</button>}
                    </div></td>
                  </tr>
                );
              })}
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
          <motion.div className="lr-overlay lr-overlay--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => {
            if (event.target === event.currentTarget && !acting) setRejectTarget(null);
          }}>
            <section className="lr-modal" role="dialog" aria-modal="true" aria-labelledby="team-reject-title">
              <h3 id="team-reject-title">Reject this request?</h3>
              <p>Provide a reason for rejecting {capitalizeName(rejectTarget.employeeName)}’s request.</p>
              <label className="lr-field"><span>Rejection reason</span><textarea rows={4} maxLength={500} required value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} /></label>
              <div className="lr-modal-actions"><button type="button" className="lr-btn lr-btn--ghost" onClick={() => setRejectTarget(null)} disabled={acting}>Cancel</button><button type="button" className="lr-btn lr-btn--reject" disabled={acting || !rejectReason.trim()} onClick={() => decide(rejectTarget, 'REJECT', rejectReason.trim())}><X size={15} />{acting ? 'Rejecting…' : 'Reject'}</button></div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
