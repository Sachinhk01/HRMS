import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, CalendarCheck2, Check, ChevronDown, Info, Leaf, RefreshCw, Send, X, Zap,
} from 'lucide-react';
import DatePicker from './DatePicker';
import api from '../services/api';
import { applyLeave } from '../services/leaveService';
import { useToast } from '../context/ToastContext';
import { approxWeekdays, leaveErrorMessage, todayIso } from '../utils/leaveFormat';
import './ApplyLeaveModal.css';

const SANDWICH_EXAMPLES = [
  { key: 'monday', title: 'Monday Leave', parts: 'Mon + Sat + Sun', days: 3 },
  { key: 'friday', title: 'Friday Leave', parts: 'Fri + Sat + Sun', days: 3 },
  { key: 'fridayMonday', title: 'Friday & Monday Leave', parts: 'Fri + Sat + Sun + Mon', days: 4 },
];

const CURRENT_YEAR = new Date().getFullYear();
const num = (value) => Number(value) || 0;

// The modal loads its own balance (longer timeout) so it never depends on the
// page-level request, which may have timed out and left the balance empty.
async function fetchMyBalances() {
  const { data } = await api.get('/leave-balances/my', { timeout: 60000 });
  return Array.isArray(data?.data) ? data.data : [];
}

// NOTE: the red "*" on required fields is added automatically (formValidation.js +
// required-fields.css), so labels below must NOT contain their own "*".
export default function ApplyLeaveModal({ open, onClose, leaveTypes = [], balances = [], policy, onApplied }) {
  const { showToast } = useToast();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [liveBalances, setLiveBalances] = useState(null);
  const [balanceState, setBalanceState] = useState('idle');
  const closeTimer = useRef(null);
  const requestId = useRef(0);
  const today = useMemo(() => todayIso(), []);

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    onClose();
  }, [onClose]);

  const loadBalances = useCallback(async () => {
    const id = requestId.current + 1;
    requestId.current = id;
    setBalanceState('loading');
    try {
      const rows = await fetchMyBalances();
      if (requestId.current !== id) return;
      setLiveBalances(rows);
      setBalanceState('ready');
    } catch {
      if (requestId.current !== id) return;
      setBalanceState('error');
    }
  }, []);

  useEffect(() => {
    if (open) loadBalances();
  }, [open, loadBalances]);

  useEffect(() => {
    if (!open) {
      setLeaveTypeId('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setShowExamples(true);
      setDone(false);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !submitting && !document.querySelector('.dp-popup')) close();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, submitting, close]);

  // ---- balance maths -------------------------------------------------------
  const rows = useMemo(() => {
    const source = liveBalances ?? (Array.isArray(balances) ? balances : []);
    const thisYear = source.filter((row) => Number(row.year) === CURRENT_YEAR);
    return thisYear.length ? thisYear : source;
  }, [liveBalances, balances]);

  const selectedType = leaveTypes.find((type) => String(type.id) === leaveTypeId);
  const selectedRow = selectedType
    ? rows.find((row) => (
      String(row.leaveTypeId) === leaveTypeId ||
      String(row.leaveType || '').toLowerCase() === String(selectedType.name || '').toLowerCase()
    ))
    : null;

  const totals = useMemo(() => rows.reduce((sum, row) => ({
    allocatedLeaves: sum.allocatedLeaves + num(row.allocatedLeaves),
    remainingLeaves: sum.remainingLeaves + num(row.remainingLeaves),
  }), { allocatedLeaves: 0, remainingLeaves: 0 }), [rows]);

  const shown = selectedType ? selectedRow : totals;
  const hasRows = rows.length > 0;
  const loadingFirst = balanceState === 'loading' && !hasRows;
  const failedFirst = balanceState === 'error' && !hasRows;
  const noRecordForType = Boolean(selectedType && !selectedRow && hasRows);
  const allocated = num(shown?.allocatedLeaves);
  const remaining = num(shown?.remainingLeaves);
  const valueEmpty = failedFirst || noRecordForType || (!hasRows && !loadingFirst);

  // ---- request maths -------------------------------------------------------
  const estimatedDays = approxWeekdays(startDate, endDate);
  const validRange = Boolean(startDate && endDate && endDate >= startDate);
  const guideline = num(policy?.guideline) || 2;
  const mayIncludeLop = Boolean(
    validRange && estimatedDays > 0 &&
    ((selectedRow && estimatedDays > remaining) || estimatedDays > guideline),
  );

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
      const totalDays = result?.totalDays;
      showToast(
        totalDays == null
          ? 'Leave request submitted successfully.'
          : `Leave request submitted for ${totalDays} day${Number(totalDays) === 1 ? '' : 's'}.`,
        'success',
      );
      setDone(true);
      onApplied?.(result);
      closeTimer.current = setTimeout(close, 1500);
    } catch (error) {
      showToast(leaveErrorMessage(error, 'Failed to submit leave request.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="alm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) close();
          }}
        >
          <motion.div
            className="alm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alm-title"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <header className="alm-head">
              <h2 id="alm-title">Apply for Leave</h2>
              <button type="button" className="alm-close" aria-label="Close" onClick={close} disabled={submitting}>
                <X size={20} />
              </button>
            </header>

            {done ? (
              <div className="alm-success">
                <motion.span
                  className="alm-success-check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                >
                  <Check size={34} strokeWidth={3} />
                </motion.span>
                <h3>Request submitted</h3>
                <p>Your manager has been notified. You can track the status under My Requests.</p>
              </div>
            ) : (
              <form className="alm-form" onSubmit={submit}>
                <div className="alm-body">
                  {/* ---- balance + monthly rule ---- */}
                  <div className="alm-top">
                    <section className="alm-balance" aria-live="polite">
                      <span className="alm-balance-icon"><Leaf size={30} /></span>
                      <div className="alm-balance-text">
                        <small>{selectedType ? `${selectedType.name} Balance` : 'Annual Leave Balance'}</small>
                        {loadingFirst ? (
                          <div className="alm-skeleton" aria-label="Loading balance" />
                        ) : (
                          <strong className={valueEmpty ? 'is-empty' : ''}>
                            {valueEmpty ? '—/—' : `${remaining}/${allocated}`}
                          </strong>
                        )}

                        {failedFirst ? (
                          <p className="alm-balance-msg is-error">
                            Could not load balance.
                            <button type="button" onClick={loadBalances}><RefreshCw size={12} /> Retry</button>
                          </p>
                        ) : loadingFirst ? (
                          <p className="alm-balance-msg">Fetching balance…</p>
                        ) : noRecordForType ? (
                          <p className="alm-balance-msg">Nothing allocated for this type.</p>
                        ) : !hasRows ? (
                          <p className="alm-balance-msg">No leave allocated yet. Contact HR.</p>
                        ) : (
                          <p className="alm-balance-msg">Leaves available</p>
                        )}
                      </div>
                    </section>

                    <section className="alm-rule">
                      <h3><Info size={17} /> Monthly Paid Leave Rule</h3>
                      <ul>
                        <li>Only {guideline} paid leave{guideline === 1 ? ' is' : 's are'} allowed per month.</li>
                        <li>If you take more than {guideline} leaves, additional leaves will be marked as LOP (Loss of Pay).</li>
                        <li>Approved leaves will be deducted from your annual leave balance (only paid leaves).</li>
                        <li>If you do not take leave in a month, it will not be carried forward and will expire.</li>
                      </ul>
                    </section>
                  </div>

                  {/* ---- sandwich policy ---- */}
                  <section className="alm-sandwich">
                    <div className="alm-sandwich-head">
                      <span className="alm-sandwich-icon"><Zap size={17} /></span>
                      <h3>Sandwich Leave Policy</h3>
                      <button
                        type="button"
                        className="alm-link"
                        aria-expanded={showExamples}
                        onClick={() => setShowExamples((value) => !value)}
                      >
                        {showExamples ? 'Hide Examples' : 'View Examples'}
                        <ChevronDown size={15} className={showExamples ? 'is-open' : ''} />
                      </button>
                    </div>
                    <p>
                      If you apply for leave on a Monday, Friday, or both Friday and Monday,
                      the weekend (Saturday and Sunday) will also be considered as leave days.
                    </p>

                    <AnimatePresence initial={false}>
                      {showExamples && (
                        <motion.div
                          className="alm-examples"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          {SANDWICH_EXAMPLES.map((example) => (
                            <div key={example.key} className="alm-example">
                              <small>{example.title}</small>
                              <span>{example.parts}</span>
                              <strong>= {example.days} chargeable days</strong>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>

                  {/* ---- form ---- */}
                  <label className="alm-field">
                    <span className="alm-label">Leave Type</span>
                    <div className={`alm-select${leaveTypeId ? ' has-icon' : ''}`}>
                      {leaveTypeId && <Leaf size={18} className="alm-select-icon" />}
                      <select value={leaveTypeId} required onChange={(event) => setLeaveTypeId(event.target.value)}>
                        <option value="">Select leave type</option>
                        {leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                      </select>
                      <ChevronDown size={16} className="alm-select-caret" />
                    </div>
                  </label>

                  <div className="alm-grid-2">
                    <label className="alm-field">
                      <span className="alm-label">From Date</span>
                      <DatePicker
                        id="leave-from"
                        required
                        min={today}
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </label>
                    <label className="alm-field">
                      <span className="alm-label">To Date</span>
                      <DatePicker
                        id="leave-to"
                        required
                        min={startDate || today}
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </label>
                  </div>

                  <AnimatePresence initial={false}>
                    {validRange && (
                      <motion.div
                        key="estimate"
                        className="alm-note alm-note--info"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <CalendarCheck2 size={16} />
                        <span>
                          About <b>{estimatedDays}</b> working day{estimatedDays === 1 ? '' : 's'}. The server calculates the final total.
                        </span>
                      </motion.div>
                    )}
                    {mayIncludeLop && (
                      <motion.div
                        key="lop"
                        className="alm-note alm-note--warn"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <AlertTriangle size={16} />
                        <span>This request may include LOP, based on your balance or the monthly paid leave limit. You can still submit it.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <label className="alm-field">
                    <span className="alm-label">Reason</span>
                    <textarea
                      value={reason}
                      maxLength={500}
                      required
                      rows={4}
                      placeholder="Enter reason for leave (e.g. personal work, medical, family function, etc.)"
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <small className="alm-count">{reason.length}/500</small>
                  </label>
                </div>

                <footer className="alm-foot">
                  <button type="button" className="alm-btn alm-btn--ghost" onClick={close} disabled={submitting}>Cancel</button>
                  <button type="submit" className="alm-btn alm-btn--primary" disabled={submitting}>
                    {submitting ? 'Submitting…' : <>Submit Request <Send size={15} /></>}
                  </button>
                </footer>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}