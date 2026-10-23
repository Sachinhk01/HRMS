import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CalendarRange, Check, CheckCircle2, Clock3, FileText, History, Inbox, Timer, X, XCircle } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { getEmployeeById } from '../services/employeeService';
import { getAllLeaveRequests, getTeamLeaveRequests, managerLeaveAction, exportLeaveReport } from '../services/leaveService';
import { capitalizeName } from '../utils/formatName';
import { appliedOnOf, formatDate, formatDateTime, isOwnRequest, isPending, leaveErrorMessage } from '../utils/leaveFormat';
import './LeaveApprovals.css';
import './LeaveRequests.css';

const easeOut = [0.16, 1, 0.3, 1];

// Month / year filter defaults and the selectable year range.
const now = new Date();
const currentMonth = now.getMonth() + 1;
const thisYear = now.getFullYear();
const years = Array.from({ length: 5 }, (_, index) => thisYear - 3 + index);

function initials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function EmployeeCell({ row, profile, onClick }) {
  const name = profile?.employeeName || profile?.name || row.employeeName || row.employeeCode || `Employee ${row.employeeId}`;
  const employeeId = profile?.employeeCode || profile?.code || row.employeeCode || row.employeeId || '—';
  const designation = profile?.designationName || profile?.designation?.designationName || profile?.jobTitle;

  return (
    <button type="button" className="emp-cell" onClick={onClick}>
      <span className="emp-avatar">{initials(name)}</span>
      <span className="emp-info">
        <span className="emp-name">{capitalizeName(name)}</span>
        <span className="emp-meta">
          <small>ID: {employeeId}</small>
          <small>{designation || 'Designation unavailable'}</small>
        </span>
      </span>
    </button>
  );
}

export default function LeaveApprovals() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const role = user?.role || user?.roles?.[0];
  const canAct = role === 'MANAGER';
  const [rows, setRows] = useState([]);
  const [employeeProfiles, setEmployeeProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    month: currentMonth,
    year: thisYear,
    employee: 'ALL',
    status: 'PENDING',
    type: 'ALL',
  });
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [drawerItem, setDrawerItem] = useState(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Backend GET /leave-requests is NOT scoped to the manager (it returns the whole
      // company), so a MANAGER must use /leave-requests/team (direct reports only).
      // HR_ADMIN / SUPER_ADMIN see everyone.
      const monthYear = { month: filters.month, year: filters.year };
      const requests = role === 'MANAGER'
        ? await getTeamLeaveRequests(monthYear)
        : await getAllLeaveRequests(monthYear);
      const leaveRequests = Array.isArray(requests) ? requests : [];
      setRows(leaveRequests);

      const employeeIds = Array.from(new Set(
        leaveRequests
          .map((request) => request.employeeId)
          .filter((employeeId) => employeeId != null)
          .map(String)
      ));
      const profiles = await Promise.allSettled(
        employeeIds.map((employeeId) => getEmployeeById(employeeId))
      );
      const profileMap = {};
      let failedProfiles = 0;
      profiles.forEach((result, index) => {
        if (result.status === 'fulfilled') profileMap[employeeIds[index]] = result.value;
        else failedProfiles += 1;
      });
      setEmployeeProfiles(profileMap);
      if (failedProfiles) {
        showToast(`Could not load profile details for ${failedProfiles} employee${failedProfiles === 1 ? '' : 's'}.`, 'error');
      }
    } catch (error) {
      showToast(error.message || 'Failed to load leave requests.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters.month, filters.year, role, showToast]);

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
    if (filters.employee !== 'ALL') list = list.filter((row) => String(row.employeeId) === String(filters.employee));
    if (filters.status !== 'ALL') list = list.filter((row) => String(row.status || '').toUpperCase() === filters.status);
    if (filters.type !== 'ALL') list = list.filter((row) => row.leaveType === filters.type);
    return list;
  }, [ordered, filters]);

  const { page, setPage, pageItems, pageSize } = usePagination(filtered, 6);

  useEffect(() => { setPage(1); }, [filters, setPage]);

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

  const confirmReject = () => {
    if (!rejectTarget) return;
    decide(rejectTarget, 'REJECT', rejectReason.trim() || 'Not approved');
  };

  const exportReport = async (format) => {
    try {
      const reportFilters = filters.status === 'ALL' ? {} : { leaveStatus: filters.status };
      const { blob, filename } = await exportLeaveReport(format, reportFilters);
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

  // A row can be approved/rejected only by a manager, while pending, and never on their own request.
  const canDecide = (row) => canAct && isPending(row) && !isOwnRequest(row, user);

  return (
    <div className="lr-page page-reveal">
      <header className="lr-head">
        <div><h1>Team Leave Requests</h1><p>Review and filter leave requests across your organization.</p></div>
      </header>
      {!canAct && <div className="lr-note lr-note--info"><CalendarDays size={15} /><span>This page is view-only for your role. Approvals are handled by the employee’s reporting manager.</span></div>}

      <section className="lr-stats">
        {cards.map((card) => <article className="lr-stat" key={card.label}><span className={`lr-stat-icon tone-${card.tone}`}><card.icon size={21} /></span><div><small>{card.label}</small><strong>{loading ? '…' : card.value}</strong></div></article>)}
      </section>

      <section className="lr-card">
        <div className="lr-filters">
          <div className="lr-filter">
            <label htmlFor="team-month">Month &amp; year</label>
            <input
              id="team-month"
              type="month"
              min={`${years[0]}-01`}
              max={`${years[years.length - 1]}-12`}
              value={`${filters.year}-${String(filters.month).padStart(2, '0')}`}
              onChange={(event) => {
                const [year, month] = event.target.value.split('-').map(Number);
                if (year && month) setFilters((value) => ({ ...value, month, year }));
              }}
            />
          </div>
          <div className="lr-filter">
            <label htmlFor="team-employee">Employee</label>
            <div className="lr-select"><select id="team-employee" value={filters.employee} onChange={(event) => setFilters((value) => ({ ...value, employee: event.target.value }))}><option value="ALL">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{capitalizeName(employee.name)}</option>)}</select></div>
          </div>
          <div className="lr-filter">
            <label htmlFor="team-status">Status</label>
            <div className="lr-select">
              <select id="team-status" value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}>
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
          <div className="lr-filter">
            <label htmlFor="team-type">Leave type</label>
            <div className="lr-select">
              <select id="team-type" value={filters.type} onChange={(event) => setFilters((value) => ({ ...value, type: event.target.value }))}>
                <option value="ALL">All leave types</option>
                {leaveTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>
          <div className="lr-filter lr-filter--actions">
            <ExportMenu onExport={exportReport} />
          </div>
        </div>

        <div className="table-wrap">
          <table className="la-table">
            <thead>
              <tr>
                <th>Employee</th><th>Leave Type</th><th>Date Range</th><th>Days</th><th>Reason</th><th>Status</th><th>Applied On</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={`lsk-${i}`} className="skeleton-row"><td colSpan={8}><div className="skeleton-bar" /></td></tr>
              ))}
              {!loading && pageItems.map((row, i) => (
                <motion.tr key={row.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04, ease: easeOut }}>
                  <td>
                    <EmployeeCell
                      row={row}
                      profile={employeeProfiles[String(row.employeeId)]}
                      onClick={() => setDrawerItem(row)}
                    />
                  </td>
                  <td><span className="lt-type">{row.leaveType}</span></td>
                  <td>{row.startDate} – {row.endDate}</td>
                  <td><strong>{row.totalDays}</strong></td>
                  <td className="reason-cell"><span title={row.reason}>{row.reason}</span></td>
                  <td><span className={`status-pill ${String(row.status || '').toLowerCase()}`}><StatusBadge>{row.status}</StatusBadge></span></td>
                  <td title={formatDateTime(appliedOnOf(row))}>{appliedOnOf(row) ? formatDate(appliedOnOf(row)) : '—'}</td>
                  <td>
                    {canAct ? (
                      <div className="la-actions">
                        <motion.button
                          type="button"
                          className="btn btn-small btn-gradient-green"
                          whileHover={canDecide(row) ? { scale: 1.05 } : undefined}
                          whileTap={canDecide(row) ? { scale: 0.95 } : undefined}
                          disabled={acting || !canDecide(row)}
                          onClick={() => setApproveTarget(row)}
                        >
                          <Check size={15} /> Approve
                        </motion.button>
                        <motion.button
                          type="button"
                          className="btn btn-small btn-gradient-red"
                          whileHover={canDecide(row) ? { scale: 1.05 } : undefined}
                          whileTap={canDecide(row) ? { scale: 0.95 } : undefined}
                          disabled={acting || !canDecide(row)}
                          onClick={() => { setRejectTarget(row); setRejectReason(''); }}
                        >
                          <X size={15} /> Reject
                        </motion.button>
                      </div>
                    ) : '—'}
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
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { if (!acting) setRejectTarget(null); }}>
            <motion.div className="modal-card" initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }} transition={{ duration: 0.25, ease: easeOut }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-icon-wrap danger"><XCircle size={26} /></div>
              <h3>Reject This Request?</h3>
              <p>Provide a Reason For Rejecting <strong>{capitalizeName(rejectTarget.employeeName)}</strong>'s <strong>{rejectTarget.leaveType}</strong> Leave Request.</p>
              <label className="reject-reason-field">
                <textarea rows="4" maxLength={500} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
                <span className="lf-counter">{rejectReason.length}/500</span>
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-soft" onClick={() => setRejectTarget(null)} disabled={acting}>Cancel</button>
                <button type="button" className="btn btn-gradient-red" disabled={acting} onClick={confirmReject}><X size={16} /> {acting ? 'Rejecting...' : 'Confirm rejection'}</button>
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
                <button type="button" className="drawer-close" onClick={() => setDrawerItem(null)} aria-label="Close"><X size={20} /></button>
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
                    <div className="tl-item"><span className="tl-dot" /><div><strong>Request Submitted</strong><small>{appliedOnOf(drawerItem) ? formatDateTime(appliedOnOf(drawerItem)) : drawerItem.startDate}</small></div></div>
                    <div className="tl-item"><span className="tl-dot pending" /><div><strong>Awaiting Manager Decision</strong><small>{drawerItem.status}</small></div></div>
                  </div>
                </div>
              </div>

              {canDecide(drawerItem) && (
                <div className="drawer-footer">
                  <motion.button type="button" className="btn btn-gradient-green" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={acting} onClick={() => { setApproveTarget(drawerItem); setDrawerItem(null); }}>
                    <Check size={16} /> Approve
                  </motion.button>
                  <motion.button type="button" className="btn btn-gradient-red" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={acting} onClick={() => { setRejectTarget(drawerItem); setRejectReason(''); setDrawerItem(null); }}>
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