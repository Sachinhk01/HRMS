import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, FileText, History, WalletCards } from 'lucide-react';
import { Avatar, PaidLop, StatusChip } from '../components/LeaveBits';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getApprovalHistory, getLeaveRequest, getLeaveRequestTransactions,
} from '../services/leaveService';
import { formatDateTime, formatRange } from '../utils/leaveFormat';
import './LeaveRequests.css';

const listOf = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

// Backend sends action as APPROVE / REJECT.
const ACTION_LABELS = {
  APPROVE: 'Approved',
  REJECT: 'Rejected',
};

// Backend LeaveTransactionType values.
const TRANSACTION_LABELS = {
  ALLOCATION: 'Allocation',
  LEAVE_APPROVED: 'Leave approved',
  LEAVE_CANCELLED: 'Leave cancelled',
  HR_ADJUSTMENT: 'HR adjustment',
  CARRY_FORWARD: 'Carry forward',
  EXPIRED: 'Expired',
  EXPIRY: 'Expiry',
  ALLOCATION_ADJUSTED: 'Allocation adjusted',
};

export default function LeaveRequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const role = user?.role || user?.roles?.[0];
  const canViewLedger = ['HR_ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(role);
  const [request, setRequest] = useState(null);
  const [history, setHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  const [historyError, setHistoryError] = useState('');
  const [ledgerError, setLedgerError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setHistoryError('');
      setLedgerError('');
      const requestResult = await getLeaveRequest(id).then((value) => ({ value }), (error) => ({ error }));
      if (cancelled) return;
      if (requestResult.error) {
        showToast(requestResult.error.message || 'Failed to load the leave request.', 'error');
        setLoading(false);
        return;
      }
      setRequest(requestResult.value);

      const historyResult = await getApprovalHistory(id).then((value) => ({ value }), (error) => ({ error }));
      if (cancelled) return;
      if (historyResult.error) {
        setHistoryError(historyResult.error.message || 'Approval history could not be loaded.');
      } else {
        setHistory(listOf(historyResult.value));
      }

      if (canViewLedger) {
        const ledgerResult = await getLeaveRequestTransactions(id).then((value) => ({ value }), (error) => ({ error }));
        if (cancelled) return;
        if (ledgerResult.error) {
          setLedgerError(ledgerResult.error.message || 'Leave ledger could not be loaded.');
        } else {
          setTransactions(listOf(ledgerResult.value));
        }
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [id, canViewLedger, showToast]);

  const range = useMemo(() => formatRange(request?.startDate, request?.endDate), [request]);

  // LeaveApprovalResponse: { id, approvedByName, approvalLevel, action, remarks, createdAt }
  const approvals = useMemo(() => history.map((item) => ({
    ...item,
    title: ACTION_LABELS[item.action] || item.action || 'Approval update',
    person: item.approvedByName || 'Approver',
    date: item.createdAt,
    note: item.remarks,
  })), [history]);

  // The request object has no rejection reason; it lives in the REJECT history row.
  const rejection = useMemo(
    () => [...history].reverse().find((item) => item.action === 'REJECT'),
    [history],
  );

  if (loading) return <div className="lr-page"><div className="lr-card">Loading leave request…</div></div>;
  if (!request) {
    return (
      <div className="lr-page">
        <div className="lr-card"><p>Leave request could not be found.</p><button type="button" className="lr-btn lr-btn--ghost" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back</button></div>
      </div>
    );
  }

  // The backend response has no "applied on" field, so only show it if one ever arrives.
  const appliedRaw = request.appliedOn || request.appliedAt || request.createdAt;

  return (
    <div className="lr-page page-reveal">
      <header className="lr-head">
        <div>
          <button type="button" className="lr-link-btn lr-back" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back to requests</button>
          <div className="lr-title-row"><h1>Leave Request Details</h1><StatusChip status={request.status} /></div>
          <p>Request #{request.id}{appliedRaw ? ` · Applied ${formatDateTime(appliedRaw)}` : ''}</p>
        </div>
      </header>

      <section className="lr-card lr-detail-card">
        <div className="lr-detail-employee">
          <Avatar name={request.employeeName} size={46} />
          <div><strong>{request.employeeName || 'My leave request'}</strong><small>{request.employeeCode || ''}</small></div>
        </div>
        <div className="lr-detail-grid">
          <div><span><FileText size={15} /> Leave Type</span><strong>{request.leaveType || '—'}</strong></div>
          <div><span><CalendarDays size={15} /> Leave Dates</span><strong>{range.main}<small>{range.sub}</small></strong></div>
          <div><span>Total Days</span><strong>{request.totalDays ?? '—'}</strong></div>
          <div><span>Paid / LOP</span><strong><PaidLop row={request} /></strong></div>
        </div>
        <div className="lr-detail-notes">
          <h2><FileText size={16} /> Reason and Notes</h2>
          <p><b>Request reason</b><span>{request.reason || 'No reason provided.'}</span></p>
          {request.approvedByName && (
            <p><b>Approved by</b><span>{request.approvedByName}{request.approvedByCode ? ` (${request.approvedByCode})` : ''}</span></p>
          )}
          {rejection && (
            <p>
              <b>Rejection reason</b>
              <span>{rejection.remarks || 'No reason provided.'}{rejection.approvedByName ? ` — ${rejection.approvedByName}` : ''}</span>
            </p>
          )}
        </div>
      </section>

      <section className="lr-card">
        <div className="lr-detail-tabs" role="tablist" aria-label="Request history">
          <button type="button" role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'is-active' : ''} onClick={() => setActiveTab('history')}><History size={15} /> Approval History</button>
          <button type="button" role="tab" aria-selected={activeTab === 'ledger'} className={activeTab === 'ledger' ? 'is-active' : ''} onClick={() => setActiveTab('ledger')}><WalletCards size={15} /> Leave Ledger</button>
        </div>
        {activeTab === 'history' && (
          <div className="lr-detail-tab-panel" role="tabpanel">
            {historyError ? <div className="lr-note lr-note--warning">{historyError}</div> : approvals.length ? (
              <ol className="lr-timeline">
                {approvals.map((item, index) => (
                  <li key={item.id ?? `${item.title}-${index}`}>
                    <span className="lr-timeline-dot" />
                    <div><strong>{item.title}</strong><span>{item.person}</span>{item.date && <small>{formatDateTime(item.date)}</small>}{item.note && <p>{item.note}</p>}</div>
                  </li>
                ))}
              </ol>
            ) : <p className="lr-dim">No approval history is available for this request yet.</p>}
          </div>
        )}
        {activeTab === 'ledger' && (
          <div className="lr-detail-tab-panel" role="tabpanel">
            {!canViewLedger ? <div className="lr-note lr-note--info">The leave ledger is available to HR and manager roles.</div>
              : ledgerError ? <div className="lr-note lr-note--warning">{ledgerError}</div>
                : transactions.length ? (
                  <div className="lr-table-wrap">
                    <table className="lr-table">
                      <thead><tr><th>Date</th><th>Transaction</th><th>Days</th><th>Balance Before</th><th>Balance After</th><th>Notes</th></tr></thead>
                      <tbody>{transactions.map((transaction, index) => (
                        <tr key={transaction.id ?? index}>
                          <td>{formatDateTime(transaction.createdAt)}</td>
                          <td>{TRANSACTION_LABELS[transaction.transactionType] || transaction.transactionType || 'Leave transaction'}</td>
                          <td>{transaction.days ?? '—'}</td>
                          <td>{transaction.balanceBefore ?? '—'}</td>
                          <td>{transaction.balanceAfter ?? '—'}</td>
                          <td>{transaction.remarks || '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p className="lr-dim">No leave ledger transactions are available for this request.</p>}
          </div>
        )}
      </section>
    </div>
  );
}