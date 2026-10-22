import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CalendarCheck2, CalendarClock, CalendarPlus, ChevronDown, ChevronLeft,
  ChevronRight, Eye, Info, Leaf,
} from 'lucide-react';
import ApplyLeaveModal from '../components/ApplyLeaveModal';
import LeaveHero from '../components/LeaveHero';
import Pagination from '../components/Pagination';
import { KebabMenu, PaidLop, StatusChip } from '../components/LeaveBits';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import usePagination, { sortRecent } from '../hooks/usePagination';
import useLeavePolicy from '../hooks/useLeavePolicy';
import {
  cancelLeave, getActiveLeaveTypes, getMyLeaveBalances, getMyLeaveRequests,
} from '../services/leaveService';
import {
  MONTH_NAMES, appliedOnOf, formatDate, formatDateTime, formatRange, isPending, leaveErrorMessage,
} from '../utils/leaveFormat';
import './Leave.css';
import './LeaveRequests.css';
import './LeaveModern.css';

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();
const YEARS = Array.from({ length: 7 }, (_, index) => CURRENT_YEAR - 3 + index);
const easeOut = [0.16, 1, 0.3, 1];

function useCountUp(target, duration = 900) {
  const end = Number(target) || 0;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(end);
      return undefined;
    }

    let frame;
    const start = performance.now();
    const tick = (time) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Number.isInteger(end) ? Math.round(end * eased) : Number((end * eased).toFixed(1)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [end, duration]);

  return value;
}

function CountUp({ value }) {
  return <>{useCountUp(value)}</>;
}

function StatCard({ icon: Icon, tone, label, value, total, sub, ratio, loading, index }) {
  const warn = ratio != null && ratio >= 1;
  return (
    <motion.article
      className={`lv2-stat lv2-stat--${tone}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08 * index, ease: easeOut }}
      whileHover={{ y: -4 }}
    >
      <span className="lv2-stat-icon"><Icon size={21} /></span>
      <div className="lv2-stat-body">
        <small>{label}</small>
        <strong>
          {loading ? '…' : <CountUp value={value} />}
          {!loading && total != null && <em> / {total}</em>}
        </strong>
        <span>{sub}</span>
        {ratio != null && !loading && (
          <div className="lv2-bar" aria-hidden="true">
            <motion.i
              className={warn ? 'is-full' : ''}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
              transition={{ duration: 0.9, delay: 0.3 + 0.08 * index, ease: easeOut }}
            />
          </div>
        )}
      </div>
    </motion.article>
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

  const closeApply = useCallback(() => setApplyOpen(false), []);
  const busy = loading || policy.loading;
  const cards = [
    {
      icon: Leaf, tone: 'green', label: 'Annual Leave Balance', value: stats.remaining, total: stats.allocated,
      sub: 'Leaves available', ratio: stats.allocated ? stats.remaining / stats.allocated : 0,
    },
    {
      icon: CalendarCheck2, tone: 'blue', label: 'This Month Usage', value: stats.paidUsed, total: policy.guideline,
      sub: 'Paid leaves used', ratio: policy.guideline ? stats.paidUsed / policy.guideline : 0,
    },
    { icon: CalendarClock, tone: 'red', label: 'LOP This Month', value: stats.lop, sub: 'Approved leave days' },
    { icon: CalendarPlus, tone: 'purple', label: 'Monthly Guideline', value: policy.guideline, sub: 'Paid leaves allowed' },
  ];

  return (
    <div className="lv2-page page-reveal">
      <LeaveHero onApply={() => setApplyOpen(true)} />

      {policy.error && <div className="lr-note lr-note--warning"><Info size={15} /><span>{policy.error}</span></div>}

      <section className="lv2-stats">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} loading={busy} />
        ))}
      </section>

      <motion.section
        className="lv2-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: easeOut }}
      >
        <div className="lv2-card-head">
          <div><h2>My Requests</h2><p>Filter by month, status or leave type.</p></div>
        </div>

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
            <div className="lr-select">
              <select id="lr-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {YEARS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
          </div>
          <div className="lr-filter">
            <label htmlFor="lr-status">Status</label>
            <div className="lr-select">
              <select id="lr-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <ChevronDown size={15} />
            </div>
          </div>
          <div className="lr-filter">
            <label htmlFor="lr-type">Leave Type</label>
            <div className="lr-select">
              <select id="lr-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="ALL">All leave types</option>
                {leaveTypes.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
          </div>
          <button type="button" className="lr-btn lr-btn--ghost" onClick={clearFilters}>Clear</button>
        </div>

        <div className="lr-table-wrap">
          <table className="lr-table lv2-table">
            <thead>
              <tr>
                <th>#</th><th>Leave Dates</th><th>Days</th><th>Reason</th><th>Leave Type</th>
                <th>Status</th><th>Paid / LOP</th><th>Applied On</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }, (_, index) => (
                <tr key={index} className="lr-skel"><td colSpan={9}><div /></td></tr>
              ))}
              {!loading && pageItems.map((row, index) => {
                const range = formatRange(row.startDate, row.endDate);
                const appliedOn = appliedOnOf(row);
                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04, ease: easeOut }}
                  >
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td><span className="lr-dates">{range.main}<small>{range.sub}</small></span></td>
                    <td><b>{row.totalDays ?? '—'}</b></td>
                    <td className="lr-reason" title={row.reason}>{row.reason || '—'}</td>
                    <td><span className="lv2-type">{row.leaveType || '—'}</span></td>
                    <td><StatusChip status={row.status} /></td>
                    <td><PaidLop row={row} /></td>
                    <td title={formatDateTime(appliedOn)}>{appliedOn ? formatDate(appliedOn) : '—'}</td>
                    <td>
                      <KebabMenu label={`Actions for leave request ${row.id}`} items={[
                        { label: 'View details', icon: <Eye size={15} />, onClick: () => navigate(`/leave/${row.id}`) },
                        isPending(row) ? { label: 'Cancel request', danger: true, onClick: () => setCancelTarget(row) } : null,
                      ]} />
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !filtered.length && (
            <div className="lv2-empty">
              <span><CalendarPlus size={30} /></span>
              <p>No leave requests found</p>
              <small>Try another month or filter, or apply for a new leave.</small>
            </div>
          )}
        </div>
        <footer className="lr-table-foot">
          <span>Total Records: {filtered.length}</span>
          <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />
          <span>Showing latest first</span>
        </footer>
      </motion.section>

      <AnimatePresence>
        {cancelTarget && (
          <motion.div
            className="lv2-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !cancelling) setCancelTarget(null);
            }}
          >
            <motion.section
              className="lv2-modal lv2-modal--sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lv2-cancel-title"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <div className="lv2-confirm">
                <span className="lv2-confirm-icon"><AlertTriangle size={24} /></span>
                <h3 id="lv2-cancel-title">Cancel this leave request?</h3>
                <p>{formatDate(cancelTarget.startDate)} – {formatDate(cancelTarget.endDate)} · {cancelTarget.leaveType}</p>
                <div className="lv2-confirm-actions">
                  <button type="button" className="lr-btn lr-btn--ghost" onClick={() => setCancelTarget(null)} disabled={cancelling}>Keep request</button>
                  <button type="button" className="lr-btn lr-btn--danger" onClick={cancelRequest} disabled={cancelling}>
                    {cancelling ? 'Cancelling…' : 'Cancel request'}
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <ApplyLeaveModal
        open={applyOpen}
        onClose={closeApply}
        leaveTypes={leaveTypes}
        balances={balances}
        policy={policy}
        onApplied={refresh}
      />
    </div>
  );
}
