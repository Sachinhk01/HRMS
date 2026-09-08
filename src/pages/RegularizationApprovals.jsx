import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Search,
  X,
  Inbox,
  CheckCircle2,
  XCircle,
  Undo2,
  Clock3,
  Users,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { capitalizeName } from '../utils/formatName';
import {
  getPendingRegularizations,
  getAllRegularizations,
  getRegularizationById,
  approveRegularizationDetail,
  rejectRegularizationDetail,
  revertRegularizationDetail,
} from '../services/regularizationService';
import './Regularization.css';
import './RegularizationApprovals.css';

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
};

// Roles allowed to revert an approved detail (mirrors the backend
// @PreAuthorize on the revert endpoint: HR_ADMIN, MANAGER, SUPER_ADMIN).
const REVERT_ROLES = ['HR_ADMIN', 'MANAGER', 'SUPER_ADMIN'];

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

export default function RegularizationApprovals() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canRevert = REVERT_ROLES.includes(user?.role);

  const [tab, setTab] = useState('pending'); // 'pending' | 'all'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Detail modal
  const [selected, setSelected] = useState(null); // { id, ...full detail } or { id } while loading
  const [modalLoading, setModalLoading] = useState(false);

  // Per-line action state
  const [actionTarget, setActionTarget] = useState(null); // { detailId, type: 'approve'|'reject'|'revert' }
  const [remarks, setRemarks] = useState('');
  const [acting, setActing] = useState(false);

  const load = async (whichTab = tab) => {
    setLoading(true);
    try {
      const data = whichTab === 'pending' ? await getPendingRegularizations() : await getAllRegularizations();
      setRows(Array.isArray(data) ? sortRecent(data, 'createdAt') : []);
    } catch (error) {
      showToast(error.message || 'Failed to load regularization requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
    setEmployeeFilter('ALL');
    setStatusFilter('ALL');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const employees = useMemo(
    () => Array.from(new Set(rows.map((r) => r.employeeName).filter(Boolean))),
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (employeeFilter !== 'ALL' && r.employeeName !== employeeFilter) return false;
      if (tab === 'all' && statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${r.employeeName || ''} ${r.reason || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, employeeFilter, statusFilter, search, tab]);

  const { page, setPage, pageItems } = usePagination(filtered, 6);

  const summary = useMemo(() => {
    const acc = { total: rows.length, pending: 0, partial: 0, approved: 0 };
    rows.forEach((r) => {
      if (r.status === 'PENDING') acc.pending += 1;
      else if (r.status === 'PARTIALLY_APPROVED') acc.partial += 1;
      else if (r.status === 'APPROVED') acc.approved += 1;
    });
    return acc;
  }, [rows]);

  const SUMMARY_CARDS = [
    { icon: ClipboardList, label: tab === 'pending' ? 'Pending Requests' : 'Total Requests', value: tab === 'pending' ? summary.pending || summary.total : summary.total, tone: 'blue', desc: 'Direct Reports' },
    { icon: Clock3, label: 'Awaiting Decision', value: summary.pending, tone: 'amber', desc: 'Fully Pending' },
    { icon: RefreshCw, label: 'Partially Approved', value: summary.partial, tone: 'blue', desc: 'Some Lines Done' },
    { icon: CheckCircle2, label: 'Approved', value: summary.approved, tone: 'green', desc: 'Fully Approved' },
  ];

  const openRequest = async (id) => {
    setModalLoading(true);
    setSelected({ id });
    try {
      const data = await getRegularizationById(id);
      setSelected(data);
    } catch (error) {
      showToast(error.message || 'Failed to load request details.', 'error');
      setSelected(null);
    } finally {
      setModalLoading(false);
    }
  };

  const refreshOpenRequest = async () => {
    if (!selected?.id) return;
    try {
      const data = await getRegularizationById(selected.id);
      setSelected(data);
    } catch {
      /* keep whatever is currently shown if refresh fails */
    }
  };

  const startAction = (detail, type) => {
    setActionTarget({ detailId: detail.id, type, detail });
    setRemarks('');
  };

  const cancelAction = () => {
    setActionTarget(null);
    setRemarks('');
  };

  const confirmAction = async () => {
    if (!actionTarget || !selected?.id) return;
    if (actionTarget.type === 'reject' && !remarks.trim()) {
      showToast('Please add a reason for rejection.', 'error');
      return;
    }
    setActing(true);
    try {
      if (actionTarget.type === 'approve') {
        await approveRegularizationDetail(selected.id, actionTarget.detailId, {
          approvedStatus: actionTarget.detail.requestedStatus,
          remarks: remarks.trim(),
        });
        showToast('Detail approved.', 'success');
      } else if (actionTarget.type === 'reject') {
        await rejectRegularizationDetail(selected.id, actionTarget.detailId, {
          remarks: remarks.trim(),
        });
        showToast('Detail rejected.', 'error');
      } else if (actionTarget.type === 'revert') {
        await revertRegularizationDetail(selected.id, actionTarget.detailId);
        showToast('Detail reverted to original attendance.', 'success');
      }
      cancelAction();
      await refreshOpenRequest();
      await load(tab);
    } catch (error) {
      showToast(error.message || 'Failed to record decision.', 'error');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="page-stack regularization-page page-reveal">
      {/* ---------- Hero ---------- */}
      <motion.section className="reg-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="reg-hero-text">
          <span className="eyebrow">Regularization Approvals</span>
          <h1>Review Attendance Corrections</h1>
          <p>Approve or reject individual attendance lines from your team's regularization requests.</p>
        </div>
        <div className="reg-hero-icon" aria-hidden="true">
          <Users size={64} strokeWidth={1.4} />
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

      {/* ---------- List panel ---------- */}
      <div className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Team Requests</span>
            <h2>Regularization Requests</h2>
          </div>
          <div className="reg-tabs">
            <button type="button" className={tab === 'pending' ? 'reg-tab active' : 'reg-tab'} onClick={() => setTab('pending')}>Pending</button>
            <button type="button" className={tab === 'all' ? 'reg-tab active' : 'reg-tab'} onClick={() => setTab('all')}>All</button>
          </div>
        </div>

        <div className="reg-filters-row">
          <div className="reg-search">
            <Search size={16} />
            <input type="text" placeholder="Search by employee or reason…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="compact-select" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
            <option value="ALL">All Employees</option>
            {employees.map((name) => (
              <option key={name} value={name}>{capitalizeName(name)}</option>
            ))}
          </select>
          {tab === 'all' && (
            <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              {Object.keys(STATUS_META).map((key) => (
                <option key={key} value={key}>{STATUS_META[key].label}</option>
              ))}
            </select>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date Range</th>
                <th>Reason</th>
                <th>Status</th>
                <th># Pending</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <tr className="skeleton-row" key={`sk-${i}`}>
                  <td colSpan={7}><div className="skeleton-bar" /></td>
                </tr>
              ))}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <Inbox size={30} />
                      <p>{tab === 'pending' ? 'No pending requests' : 'No requests found'}</p>
                      <small>{tab === 'pending' ? "You're all caught up." : 'Try a different filter.'}</small>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && pageItems.map((r) => {
                const meta = STATUS_META[r.status] || { tone: 'pending', label: r.status };
                const tally = detailTally(r.details);
                return (
                  <tr key={r.id} className="reg-clickable-row" onClick={() => openRequest(r.id)}>
                    <td><strong>{capitalizeName(r.employeeName)}</strong></td>
                    <td>{fmtDate(r.fromDate)} – {fmtDate(r.toDate)}</td>
                    <td className="reg-reason-cell">{r.reason}</td>
                    <td><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td>
                    <td>{tally.pending}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                    <td>
                      <button type="button" className="btn btn-small btn-secondary" onClick={(e) => { e.stopPropagation(); openRequest(r.id); }}>
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={filtered.length} pageSize={6} onPageChange={setPage} />
      </div>

      {/* ---------- Review modal ---------- */}
      {selected && (
        <div className="modal-overlay" onClick={() => { setSelected(null); cancelAction(); }}>
          <div className="modal-card reg-detail-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="reg-modal-close" onClick={() => { setSelected(null); cancelAction(); }} aria-label="Close">
              <X size={18} />
            </button>

            {modalLoading || !selected.details ? (
              <div className="reg-detail-loading">Loading…</div>
            ) : (
              <>
                <h3>{capitalizeName(selected.employeeName)}'s Request #{selected.id}</h3>
                <p className="reg-detail-sub">
                  {fmtDate(selected.fromDate)} – {fmtDate(selected.toDate)} · <StatusBadge tone={(STATUS_META[selected.status] || {}).tone}>{(STATUS_META[selected.status] || {}).label || selected.status}</StatusBadge>
                </p>
                <p className="reg-detail-reason"><strong>Reason:</strong> {selected.reason}</p>

                <div className="reg-detail-list">
                  {(selected.details || []).map((d) => (
                    <div className="reg-detail-line" key={d.id}>
                      <div className="reg-detail-line-info">
                        <span className="reg-detail-date">{fmtDate(d.attendanceDate)}</span>
                        <span className="reg-detail-transition">
                          <span className="reg-original">{d.originalStatus}</span>
                          <span aria-hidden="true">→</span>
                          <span className="reg-requested">{d.requestedStatus}</span>
                        </span>
                        {(d.originalCheckIn || d.requestedCheckIn) && (
                          <span className="reg-detail-times">In: {d.originalCheckIn || '--'} → {d.requestedCheckIn || '--'} · Out: {d.originalCheckOut || '--'} → {d.requestedCheckOut || '--'}</span>
                        )}
                        {d.remarks && <span className="reg-detail-remarks">"{d.remarks}"</span>}
                      </div>

                      <div className="reg-detail-line-action">
                        <StatusBadge tone={(d.status || '').toLowerCase()}>{d.status}</StatusBadge>

                        {d.status === 'PENDING' && actionTarget?.detailId !== d.id && (
                          <div className="reg-line-buttons">
                            <button type="button" className="btn btn-icon btn-light reg-approve-btn" onClick={() => startAction(d, 'approve')} aria-label="Approve">
                              <CheckCircle2 size={16} />
                            </button>
                            <button type="button" className="btn btn-icon btn-light reg-reject-btn" onClick={() => startAction(d, 'reject')} aria-label="Reject">
                              <XCircle size={16} />
                            </button>
                          </div>
                        )}

                        {d.status === 'APPROVED' && canRevert && actionTarget?.detailId !== d.id && (
                          <div className="reg-line-buttons">
                            <button type="button" className="btn btn-small btn-secondary" onClick={() => startAction(d, 'revert')}>
                              <Undo2 size={14} /> Revert
                            </button>
                          </div>
                        )}
                      </div>

                      {actionTarget?.detailId === d.id && (
                        <div className="reg-inline-action">
                          {actionTarget.type !== 'revert' ? (
                            <>
                              <textarea
                                rows={2}
                                placeholder={actionTarget.type === 'approve' ? 'Remarks (optional)' : 'Reason for rejection (required)'}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                              />
                              <div className="reg-inline-action-buttons">
                                <button type="button" className="btn btn-small btn-secondary" onClick={cancelAction} disabled={acting}>Cancel</button>
                                <button
                                  type="button"
                                  className={actionTarget.type === 'approve' ? 'btn btn-small btn-primary' : 'btn btn-small btn-danger-soft'}
                                  onClick={confirmAction}
                                  disabled={acting}
                                >
                                  {acting ? 'Saving…' : actionTarget.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="reg-revert-warning">This restores the attendance record to its original state ({d.originalStatus}).</p>
                              <div className="reg-inline-action-buttons">
                                <button type="button" className="btn btn-small btn-secondary" onClick={cancelAction} disabled={acting}>Cancel</button>
                                <button type="button" className="btn btn-small btn-danger-soft" onClick={confirmAction} disabled={acting}>
                                  {acting ? 'Reverting…' : 'Confirm Revert'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}