import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CalendarCheck2, CalendarClock, CalendarPlus, ChevronDown, ChevronLeft,
  ChevronRight, Eye, Info, Leaf, Plus, X,
} from 'lucide-react';
import DatePicker from '../components/DatePicker';
import Pagination from '../components/Pagination';
import { KebabMenu, PaidLop, StatusChip } from '../components/LeaveBits';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import usePagination, { sortRecent } from '../hooks/usePagination';
import useLeavePolicy from '../hooks/useLeavePolicy';
import {
  applyLeave, cancelLeave, getActiveLeaveTypes, getMyLeaveBalances, getMyLeaveRequests,
} from '../services/leaveService';
import {
  MONTH_NAMES, appliedOnOf, approxWeekdays, formatDate, formatDateTime, formatRange,
  isPending, leaveErrorMessage,
} from '../utils/leaveFormat';
import './Leave.css';
import './LeaveRequests.css';

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();
const YEARS = Array.from({ length: 7 }, (_, index) => CURRENT_YEAR - 3 + index);

function ApplyLeaveDrawer({ open, onClose, leaveTypes, balances, policy, onApplied }) {
  const { showToast } = useToast();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  const selectedType = leaveTypes.find((type) => String(type.id) === leaveTypeId);
  const balance = balances.find((item) => (
    String(item.leaveTypeId) === leaveTypeId ||
    (selectedType?.name && String(item.leaveType || '').toLowerCase() === selectedType.name.toLowerCase())
  ));
  const estimatedDays = approxWeekdays(startDate, endDate);
  const remaining = Number(balance?.remainingLeaves ?? balance?.remaining ?? 0);
  const mayIncludeLop = Boolean(
    startDate && endDate && estimatedDays > 0 &&
    ((balance && estimatedDays > remaining) || estimatedDays > policy.guideline)
  );

  useEffect(() => {
    if (!open) {
      setLeaveTypeId('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setShowExamples(false);
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    if (!leaveTypeId || !startDate || !endDate || !reason.trim()) {
      showToast('Please complete all leave fields.', 'error');
      return;
    }
    if (endDate < startDate) {
      showToast('To date cannot be before from date.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await applyLeave({
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate,
        reason: reason.trim(),
      });
      onApplied(result);
      const totalDays = result?.totalDays;
      showToast(
        totalDays == null
          ? 'Leave request submitted successfully.'
          : `Leave request submitted for ${totalDays} day${Number(totalDays) === 1 ? '' : 's'}.`,
        'success',
      );
      onClose();
    } catch (error) {
      showToast(leaveErrorMessage(error, 'Failed to submit leave request.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="lr-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) onClose();
        }}>
          <motion.aside
            className="lr-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lr-apply-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
          >
            <header className="lr-drawer-head">
              <div><span>New request</span><h2 id="lr-apply-title">Apply for Leave</h2></div>
              <button type="button" className="lr-icon-btn" aria-label="Close" onClick={onClose} disabled={submitting}><X size={18} /></button>
            </header>
            <form className="lr-drawer-form" onSubmit={submit}>
              <div className="lr-drawer-body">
                <section className="lr-balance">
                  <div><small>Selected leave balance</small><strong>{balance ? `${balance.remainingLeaves ?? balance.remaining ?? 0} days` : 'Choose a leave type'}</strong></div>
                  <span>{selectedType?.name || 'Available balance'}</span>
                </section>

                <label className="lr-field">
                  <span>Leave Type</span>
                  <div className="lr-select">
                    <select value={leaveTypeId} required onChange={(event) => setLeaveTypeId(event.target.value)}>
                      <option value="">Select leave type</option>
                      {leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                    <ChevronDown size={15} />
                  </div>
                </label>

                <div className="lr-form-grid">
                  <label className="lr-field">
                    <span>From Date</span>
                    <DatePicker id="leave-from" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </label>
                  <label className="lr-field">
                    <span>To Date</span>
                    <DatePicker id="leave-to" required min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </label>
                </div>

                {startDate && endDate && endDate >= startDate && (
                  <div className="lr-date-estimate">Approx. {estimatedDays} working day{estimatedDays === 1 ? '' : 's'}; the final total is calculated by the server.</div>
                )}

                {mayIncludeLop && (
                  <div className="lr-note lr-note--warning"><AlertTriangle size={16} /><span>This request may include LOP based on your available balance or monthly paid leave guideline. You may still submit it.</span></div>
                )}

                <label className="lr-field">
                  <span>Reason</span>
                  <textarea value={reason} maxLength={500} required rows={4} onChange={(event) => setReason(event.target.value)} placeholder="Briefly describe the reason for your leave." />
                  <small className="lr-char-count">{reason.length}/500</small>
                </label>

                <section className="lr-policy-box">
                  <div><strong>Monthly Paid Leave Rule</strong><span>{policy.guideline} paid day{policy.guideline === 1 ? '' : 's'} per month. Extra eligible days may be recorded as LOP.</span></div>
                  <Info size={17} />
                </section>
                <section className="lr-policy-box lr-policy-box--sandwich">
                  <div>
                    <strong>Sandwich Leave Policy</strong>
                    <span>{policy.sandwichKnown
                      ? [
                        policy.sandwich.monday && 'Monday',
                        policy.sandwich.friday && 'Friday',
                        policy.sandwich.fridayMonday && 'Friday–Monday',
                      ].filter(Boolean).join(', ') || 'No sandwich rules are currently enabled.'
                      : 'Weekend sandwich rules may apply; your organization’s exact rules are shown by HR.'}</span>
                  </div>
                  <button type="button" className="lr-link-btn" onClick={() => setShowExamples(true)}>View Examples</button>
                </section>
              </div>
              <footer className="lr-drawer-foot">
                <button type="button" className="lr-btn lr-btn--ghost" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="lr-btn lr-btn--primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </footer>
            </form>
          </motion.aside>
          <AnimatePresence>
            {showExamples && (
              <motion.div className="lr-overlay lr-overlay--center lr-overlay--nested" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => {
                if (event.target === event.currentTarget) setShowExamples(false);
              }}>
                <section className="lr-modal" role="dialog" aria-modal="true" aria-labelledby="lr-examples-title">
                  <h3 id="lr-examples-title">Sandwich leave examples</h3>
                  <p>A leave day next to a weekend may cause the weekend days to be included in the leave calculation when the corresponding sandwich rule is enabled.</p>
                  <p>For example, Friday leave may include Saturday and Sunday; Monday leave may include the preceding weekend. The backend applies the configured rule when it calculates your request.</p>
                  <button type="button" className="lr-btn lr-btn--primary" onClick={() => setShowExamples(false)}>Close</button>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Leave() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const policy = useLeavePolicy();
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [rows, setRows] = useState([]);
  const [monthRows, setMonthRows] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadStatic = useCallback(async () => {
    const results = await Promise.allSettled([
      getMyLeaveBalances(),
      getActiveLeaveTypes(),
      getMyLeaveRequests({ month: CURRENT_MONTH, year: CURRENT_YEAR }),
    ]);
    const [balanceResult, typeResult, monthResult] = results;
    setBalances(balanceResult.status === 'fulfilled' && Array.isArray(balanceResult.value) ? balanceResult.value : []);
    setLeaveTypes(typeResult.status === 'fulfilled' && Array.isArray(typeResult.value) ? typeResult.value : []);
    setMonthRows(monthResult.status === 'fulfilled' && Array.isArray(monthResult.value) ? monthResult.value : []);
    for (const result of results) {
      if (result.status === 'rejected') showToast(result.reason?.message || 'Some leave summary data could not be loaded.', 'error');
    }
  }, [showToast]);

  const loadRows = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMyLeaveRequests({ month, year });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error.message || 'Failed to load leave requests.', 'error');
    } finally {
      setLoading(false);
    }
  }, [month, year, showToast]);

  useEffect(() => { loadStatic(); }, [loadStatic, user?.id]);
  useEffect(() => { loadRows(); }, [loadRows, user?.id]);

  const refresh = async () => {
    await Promise.all([loadStatic(), loadRows({ silent: true })]);
  };

  const stats = useMemo(() => {
    const currentYearBalances = balances.filter((balance) => Number(balance.year) === CURRENT_YEAR);
    const source = currentYearBalances.length ? currentYearBalances : balances;
    const allocated = source.reduce((sum, balance) => sum + (Number(balance.allocatedLeaves) || 0), 0);
    const remaining = source.reduce((sum, balance) => sum + (Number(balance.remainingLeaves) || 0), 0);
    const approved = monthRows.filter((row) => (
      String(row.status || '').toUpperCase() === 'APPROVED' &&
      String(row.startDate || '').slice(0, 7) === `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}`
    ));
    return {
      allocated,
      remaining,
      paidUsed: approved.reduce((sum, row) => sum + (Number(row.paidDays) || 0), 0),
      lop: approved.reduce((sum, row) => sum + (Number(row.lopDays) || 0), 0),
    };
  }, [balances, monthRows]);

  const filtered = useMemo(() => {
    let list = sortRecent(rows, 'startDate');
    if (statusFilter !== 'ALL') list = list.filter((row) => String(row.status || '').toUpperCase() === statusFilter);
    if (typeFilter !== 'ALL') list = list.filter((row) => row.leaveType === typeFilter);
    return list;
  }, [rows, statusFilter, typeFilter]);
  const { page, setPage, pageItems, pageSize } = usePagination(filtered, 10);
  useEffect(() => { setPage(1); }, [month, year, statusFilter, typeFilter, setPage]);

  const changeMonth = (offset) => {
    const date = new Date(year, month - 1 + offset, 1);
    const nextYear = date.getFullYear();
    if (nextYear < YEARS[0] || nextYear > YEARS[YEARS.length - 1]) return;
    setMonth(date.getMonth() + 1);
    setYear(nextYear);
  };

  const clearFilters = () => {
    setMonth(CURRENT_MONTH);
    setYear(CURRENT_YEAR);
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  };

  const cancelRequest = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      await cancelLeave(cancelTarget.id);
      showToast('Leave request cancelled.', 'success');
      setCancelTarget(null);
      await refresh();
    } catch (error) {
      showToast(leaveErrorMessage(error, 'Failed to cancel leave request.'), 'error');
      setCancelTarget(null);
      await loadRows({ silent: true });
    } finally {
      setCancelling(false);
    }
  };

  const cards = [
    { icon: Leaf, tone: 'green', label: 'Annual Leave Balance', value: `${stats.remaining} / ${stats.allocated}`, sub: 'Leaves available' },
    { icon: CalendarCheck2, tone: 'blue', label: 'This Month Usage', value: `${stats.paidUsed} / ${policy.guideline}`, sub: 'Paid leaves used' },
    { icon: CalendarClock, tone: 'red', label: 'LOP This Month', value: stats.lop, sub: 'Approved leave days' },
    { icon: CalendarPlus, tone: 'purple', label: 'Monthly Guideline', value: policy.guideline, sub: 'Paid leaves allowed' },
  ];

  return (
    <div className="lr-page page-reveal">
      <header className="lr-head">
        <div><h1>My Leave Requests</h1><p>View and manage your leave requests and check your leave balance.</p></div>
        <button type="button" className="lr-btn lr-btn--primary lr-btn--lg" onClick={() => setApplyOpen(true)}><Plus size={17} /> Apply for Leave</button>
      </header>

      {policy.error && <div className="lr-note lr-note--warning"><Info size={15} /><span>{policy.error}</span></div>}

      <section className="lr-stats">
        {cards.map((card) => (
          <article className="lr-stat" key={card.label}>
            <span className={`lr-stat-icon tone-${card.tone}`}><card.icon size={22} /></span>
            <div><small>{card.label}</small><strong>{loading || policy.loading ? '…' : card.value}</strong><small>{card.sub}</small></div>
          </article>
        ))}
      </section>

      <section className="lr-card">
        <div className="lr-filters">
          <div className="lr-filter">
            <label>Select Month</label>
            <div className="lr-stepper">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
              <span>{MONTH_NAMES[month - 1]} {year}</span>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="lr-filter">
            <label htmlFor="lr-year">Select Year</label>
            <div className="lr-select"><select id="lr-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{YEARS.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={15} /></div>
          </div>
          <div className="lr-filter">
            <label htmlFor="lr-status">Status</label>
            <div className="lr-select"><select id="lr-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option>
            </select><ChevronDown size={15} /></div>
          </div>
          <div className="lr-filter">
            <label htmlFor="lr-type">Leave Type</label>
            <div className="lr-select"><select id="lr-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="ALL">All leave types</option>{leaveTypes.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}
            </select><ChevronDown size={15} /></div>
          </div>
          <button type="button" className="lr-btn lr-btn--ghost" onClick={clearFilters}>Clear</button>
        </div>

        <div className="lr-table-wrap">
          <table className="lr-table">
            <thead><tr><th>#</th><th>Leave Dates</th><th>Days</th><th>Reason</th><th>Leave Type</th><th>Status</th><th>Paid / LOP</th><th>Applied On</th><th>Actions</th></tr></thead>
            <tbody>
              {loading && Array.from({ length: 5 }, (_, index) => <tr key={index} className="lr-skel"><td colSpan={9}><div /></td></tr>)}
              {!loading && pageItems.map((row, index) => {
                const range = formatRange(row.startDate, row.endDate);
                const appliedOn = appliedOnOf(row);
                return (
                  <tr key={row.id}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td><span className="lr-dates">{range.main}<small>{range.sub}</small></span></td>
                    <td>{row.totalDays ?? '—'}</td>
                    <td className="lr-reason" title={row.reason}>{row.reason || '—'}</td>
                    <td>{row.leaveType || '—'}</td>
                    <td><StatusChip status={row.status} /></td>
                    <td><PaidLop row={row} /></td>
                    <td>{appliedOn ? formatDateTime(appliedOn) : '—'}</td>
                    <td>
                      <KebabMenu label={`Actions for leave request ${row.id}`} items={[
                        { label: 'View details', icon: <Eye size={15} />, onClick: () => navigate(`/leave/${row.id}`) },
                        isPending(row) ? { label: 'Cancel request', danger: true, onClick: () => setCancelTarget(row) } : null,
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !filtered.length && <div className="lr-empty"><CalendarPlus size={28} /><p>No leave requests found.</p><small>Try another month or filter.</small></div>}
        </div>
        <footer className="lr-table-foot"><span>Total Records: {filtered.length}</span><Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} /><span>Showing latest first</span></footer>
      </section>

      <AnimatePresence>
        {cancelTarget && (
          <motion.div className="lr-overlay lr-overlay--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cancelling) setCancelTarget(null);
          }}>
            <section className="lr-modal" role="dialog" aria-modal="true" aria-labelledby="lr-cancel-title">
              <h3 id="lr-cancel-title">Cancel this leave request?</h3>
              <p>{formatDate(cancelTarget.startDate)} – {formatDate(cancelTarget.endDate)} · {cancelTarget.leaveType}</p>
              <div className="lr-modal-actions">
                <button type="button" className="lr-btn lr-btn--ghost" onClick={() => setCancelTarget(null)} disabled={cancelling}>Keep request</button>
                <button type="button" className="lr-btn lr-btn--danger" onClick={cancelRequest} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel request'}</button>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <ApplyLeaveDrawer open={applyOpen} onClose={() => setApplyOpen(false)} leaveTypes={leaveTypes} balances={balances} policy={policy} onApplied={refresh} />
    </div>
  );
}
