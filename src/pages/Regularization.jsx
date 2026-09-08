import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardEdit,
  CalendarRange,
  Clock3,
  CheckCircle2,
  ListChecks,
  Search,
  X,
  Inbox,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { getAttendanceHistory } from '../services/attendanceService';
import {
  createRegularization,
  getMyRegularizations,
  getRegularizationById,
  REGULARIZABLE_STATUSES,
} from '../services/regularizationService';
import './Regularization.css';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const STATUS_META = {
  PENDING: { tone: 'pending', label: 'Pending' },
  PARTIALLY_APPROVED: { tone: 'partial', label: 'Partially Approved' },
  APPROVED: { tone: 'approved', label: 'Approved' },
  REJECTED: { tone: 'rejected', label: 'Rejected' },
  CANCELLED: { tone: 'cancelled', label: 'Cancelled' },
  REVERTED: { tone: 'reverted', label: 'Reverted' },
};

function detailTally(details = []) {
  return details.reduce(
    (acc, d) => {
      const key = (d.status || 'PENDING').toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0, reverted: 0 }
  );
}

export default function Regularization() {
  const { showToast } = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // ---- Create form state ----
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [attendanceOptions, setAttendanceOptions] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [selected, setSelected] = useState({}); // attendanceId -> true
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ---- Detail drawer ----
  const [viewItem, setViewItem] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getMyRegularizations();
      setRequests(Array.isArray(data) ? sortRecent(data, 'createdAt') : []);
    } catch (error) {
      showToast(error.message || 'Failed to load regularization requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const acc = { total: requests.length, pending: 0, partial: 0, approved: 0, rejected: 0 };
    requests.forEach((r) => {
      if (r.status === 'PENDING') acc.pending += 1;
      else if (r.status === 'PARTIALLY_APPROVED') acc.partial += 1;
      else if (r.status === 'APPROVED') acc.approved += 1;
      else if (r.status === 'REJECTED') acc.rejected += 1;
    });
    return acc;
  }, [requests]);

  const SUMMARY_CARDS = [
    { icon: ListChecks, label: 'Total Requests', value: summary.total, tone: 'blue', desc: 'All Time' },
    { icon: Clock3, label: 'Pending', value: summary.pending, tone: 'amber', desc: 'Awaiting Manager' },
    { icon: RefreshCw, label: 'Partially Approved', value: summary.partial, tone: 'blue', desc: 'Some Lines Approved' },
    { icon: CheckCircle2, label: 'Approved', value: summary.approved, tone: 'green', desc: 'Fully Approved' },
  ];

  // ---- Filtered history ----
  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${r.reason || ''} ${r.fromDate || ''} ${r.toDate || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  const { page, setPage, pageItems } = usePagination(filtered, 5);

  // ---- Load attendance for the chosen range ----
  const loadAttendance = async () => {
    if (!rangeFrom || !rangeTo) {
      showToast('Please select both a from and to date.', 'error');
      return;
    }
    if (new Date(rangeFrom) > new Date(rangeTo)) {
      showToast('From date must be before or equal to to date.', 'error');
      return;
    }
    setLoadingAttendance(true);
    setAttendanceLoaded(false);
    try {
      const result = await getAttendanceHistory({
        fromDate: rangeFrom,
        toDate: rangeTo,
        page: 0,
        size: 100,
        sortBy: 'attendanceDate',
        sortDirection: 'asc',
      });
      const content = Array.isArray(result?.content) ? result.content : Array.isArray(result) ? result : [];
      const normalized = content.map((rec) => ({
        ...rec,
        attendanceId: rec.attendanceId ?? rec.AttendanceId ?? rec.id ?? rec.Id ?? null,
      }));
      const regularizable = normalized.filter((rec) => REGULARIZABLE_STATUSES.includes(rec.attendanceStatus));
      const eligible = regularizable.filter((rec) => rec.attendanceId != null);
      setAttendanceOptions(eligible);
      setSelected({});
      setAttendanceLoaded(true);
      if (regularizable.length > eligible.length) {
        showToast(`${regularizable.length - eligible.length} attendance record(s) skipped because no attendance ID was provided.`, 'info');
      }
      if (eligible.length === 0) {
        showToast('No regularizable attendance records found in that range.', 'info');
      }
    } catch (error) {
      showToast(error.message || 'Failed to load attendance records.', 'error');
    } finally {
      setLoadingAttendance(false);
    }
  };

  const toggleRow = (attendanceId) => {
    setSelected((prev) => ({ ...prev, [attendanceId]: !prev[attendanceId] }));
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const resetForm = () => {
    setRangeFrom('');
    setRangeTo('');
    setAttendanceOptions([]);
    setAttendanceLoaded(false);
    setSelected({});
    setReason('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!rangeFrom || !rangeTo) {
      showToast('Please select a date range.', 'error');
      return;
    }
    if (selectedCount === 0) {
      showToast('Please select at least one attendance record.', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Please provide a reason.', 'error');
      return;
    }

    const details = attendanceOptions
      .filter((rec) => selected[rec.attendanceId] && rec.attendanceId != null)
      .map((rec) => ({ attendanceId: rec.attendanceId, requestedStatus: 'PRESENT' }));

    if (details.length === 0) {
      showToast('Selected attendance records are missing a valid attendance ID.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await createRegularization({
        fromDate: rangeFrom,
        toDate: rangeTo,
        reason: reason.trim(),
        details,
      });
      resetForm();
      await load();
      setPage(1);
      showToast('Regularization request submitted successfully.', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to submit regularization request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (id) => {
    setViewLoading(true);
    setViewItem({ id });
    try {
      const data = await getRegularizationById(id);
      setViewItem(data);
    } catch (error) {
      showToast(error.message || 'Failed to load request details.', 'error');
      setViewItem(null);
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="page-stack regularization-page page-reveal">
      {/* ---------- Hero ---------- */}
      <motion.section
        className="reg-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="reg-hero-text">
          <span className="eyebrow">Attendance Regularization</span>
          <h1>Fix Your Attendance Records</h1>
          <p>Request corrections for missed check-ins, late marks, or absences — your manager will review each line.</p>
        </div>
        <div className="reg-hero-icon" aria-hidden="true">
          <ClipboardEdit size={64} strokeWidth={1.4} />
        </div>
      </motion.section>

      {/* ---------- Summary cards ---------- */}
      <motion.div className="reg-overview-grid" initial="hidden" animate="show" variants={stagger}>
        {SUMMARY_CARDS.map((card) => (
          <motion.div key={card.label} className={`reg-overview-card tone-${card.tone}`} variants={fadeUp} whileHover={{ y: -6 }}>
            <div className="reg-icon"><card.icon size={20} /></div>
            <span>{card.label}</span>
            <strong>{loading ? '...' : card.value}</strong>
            <small>{card.desc}</small>
          </motion.div>
        ))}
      </motion.div>

      {/* ---------- Create request panel ---------- */}
      <div className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">New Request</span>
            <h2>Create Regularization Request</h2>
          </div>
        </div>
        <p className="panel-desc">Pick a date range, choose the attendance records you'd like corrected, and tell us why.</p>

        <div className="reg-range-row">
          <div className="reg-field">
            <label htmlFor="reg-from">From Date</label>
            <input id="reg-from" type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
          </div>
          <div className="reg-field">
            <label htmlFor="reg-to">To Date</label>
            <input id="reg-to" type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary" onClick={loadAttendance} disabled={loadingAttendance}>
            <CalendarRange size={16} />
            {loadingAttendance ? 'Loading…' : 'Load Attendance'}
          </button>
        </div>

        {attendanceLoaded && (
          <form onSubmit={submit} className="reg-create-form">
            {attendanceOptions.length === 0 ? (
              <div className="empty-state">
                <Inbox size={30} />
                <p>No eligible records</p>
                <small>Only ABSENT, LATE, HALF_DAY, or MISSED_CHECKOUT days can be regularized.</small>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th />
                      <th>Date</th>
                      <th>Original Status</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Requesting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceOptions.map((rec) => (
                      <tr key={rec.attendanceId}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selected[rec.attendanceId]}
                            onChange={() => toggleRow(rec.attendanceId)}
                          />
                        </td>
                        <td>{fmtDate(rec.attendanceDate)}</td>
                        <td><StatusBadge tone={rec.attendanceStatus}>{rec.attendanceStatus}</StatusBadge></td>
                        <td>{rec.checkInTime || '—'}</td>
                        <td>{rec.checkOutTime || '—'}</td>
                        <td><span className="reg-target-pill">PRESENT</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="reg-field">
              <label htmlFor="reg-reason">Reason</label>
              <textarea
                id="reg-reason"
                rows={3}
                placeholder="e.g. Biometric device was not working on these days"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="reg-form-actions">
              <span className="reg-selected-count">{selectedCount} record{selectedCount === 1 ? '' : 's'} selected</span>
              <button type="submit" className="btn btn-primary" disabled={submitting || selectedCount === 0}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ---------- History ---------- */}
      <div className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">History</span>
            <h2>My Regularization Requests</h2>
          </div>
        </div>

        <div className="reg-filters-row">
          <div className="reg-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by reason or date…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            {Object.keys(STATUS_META).filter((k) => k !== 'CANCELLED' && k !== 'REVERTED').map((key) => (
              <option key={key} value={key}>{STATUS_META[key].label}</option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date Range</th>
                <th>Reason</th>
                <th>Status</th>
                <th># Details</th>
                <th>Created At</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <tr className="skeleton-row" key={`sk-${i}`}>
                  <td colSpan={6}><div className="skeleton-bar" /></td>
                </tr>
              ))}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <Inbox size={30} />
                      <p>No regularization requests yet</p>
                      <small>Create one above to get started.</small>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && pageItems.map((r) => {
                const meta = STATUS_META[r.status] || { tone: 'pending', label: r.status };
                const tally = detailTally(r.details);
                return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.fromDate)} – {fmtDate(r.toDate)}</td>
                    <td className="reg-reason-cell">{r.reason}</td>
                    <td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td>
                    <td>
                      <span className="reg-tally">
                        <span title="Approved">✅ {tally.approved}</span>
                        <span title="Pending">⏳ {tally.pending}</span>
                        <span title="Rejected">❌ {tally.rejected}</span>
                      </span>
                    </td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                    <td>
                      <button type="button" className="btn btn-icon btn-light" onClick={() => openDetails(r.id)} aria-label="View details">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={filtered.length} pageSize={5} onPageChange={setPage} />
      </div>

      {/* ---------- Detail drawer/modal ---------- */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="modal-card reg-detail-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="reg-modal-close" onClick={() => setViewItem(null)} aria-label="Close">
              <X size={18} />
            </button>
            {viewLoading || !viewItem.details ? (
              <div className="reg-detail-loading">Loading…</div>
            ) : (
              <>
                <h3>Request #{viewItem.id}</h3>
                <p className="reg-detail-sub">
                  {fmtDate(viewItem.fromDate)} – {fmtDate(viewItem.toDate)} · <StatusBadge tone={(STATUS_META[viewItem.status] || {}).tone}>{(STATUS_META[viewItem.status] || {}).label || viewItem.status}</StatusBadge>
                </p>
                <p className="reg-detail-reason"><strong>Reason:</strong> {viewItem.reason}</p>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Original</th>
                        <th>Requested</th>
                        <th>Final</th>
                        <th>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewItem.details || []).map((d) => (
                        <tr key={d.id}>
                          <td>{fmtDate(d.attendanceDate)}</td>
                          <td>{d.originalStatus}</td>
                          <td>{d.requestedStatus}</td>
                          <td>{d.approvedStatus || '—'}</td>
                          <td><StatusBadge tone={(d.status || '').toLowerCase()}>{d.status}</StatusBadge></td>
                          <td>{d.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}