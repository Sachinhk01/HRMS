import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CalendarDays, CheckCircle2, Clock3, WalletCards } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import {
  applyLeave,
  cancelLeave,
  getActiveLeaveTypes,
  getMyLeaveBalances,
  getMyLeaveRequests,
} from '../services/leaveService';
import './Leave.css';

export default function Leave() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const [requestsData, balancesData, typesData] = await Promise.all([
        getMyLeaveRequests(),
        getMyLeaveBalances(),
        getActiveLeaveTypes(),
      ]);
      setRows(requestsData || []);
      setBalances(balancesData || []);
      setLeaveTypes(typesData || []);
    } catch (error) {
      setErr(error.message || 'Failed to load leave data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user.id]);

  const ordered = useMemo(() => sortRecent(rows, 'startDate'), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 5);

  const summary = useMemo(() => {
    const allowance = balances.reduce((sum, b) => sum + (b.allocatedLeaves || 0), 0);
    const taken = balances.reduce((sum, b) => sum + (b.usedLeaves || 0), 0);
    const left = balances.reduce((sum, b) => sum + (b.remainingLeaves || 0), 0);
    const pending = rows
      .filter((r) => r.status === 'PENDING')
      .reduce((sum, r) => sum + (r.totalDays || 0), 0);
    return { allowance, taken, left, pending };
  }, [balances, rows]);

  const submit = async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    setMsg('');
    setErr('');
    const form = new FormData(formEl);
    const leaveTypeId = Number(form.get('leaveTypeId'));
    const startDate = form.get('from');
    const endDate = form.get('to');
    const reason = form.get('reason');

    if (!leaveTypeId || !startDate || !endDate || !reason?.trim()) {
      setErr('Please complete all leave fields.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setErr('To date cannot be before from date.');
      return;
    }

    try {
      await applyLeave({ leaveTypeId, startDate, endDate, reason: reason.trim() });
      formEl.reset();
      await load();
      setPage(1);
      setMsg('Leave request submitted successfully.');
    } catch (error) {
      setErr(error.message || 'Failed to submit leave request.');
    }
  };

  const handleCancel = async (id) => {
    setErr('');
    try {
      await cancelLeave(id);
      await load();
      setMsg('Leave request cancelled.');
    } catch (error) {
      setErr(error.message || 'Failed to cancel leave request.');
    }
  };

  return (
    <div className="page-stack leave-page page-reveal">
      <PageHeader eyebrow="Leave Management" title="Plan time away" description="Apply for leave, see your balance and track approval status." />

      {err && <div className="form-alert">{err}</div>}

      <div className="leave-overview-grid">
        <div className="leave-overview-card tone-blue"><WalletCards size={22} /><span>Total allowance</span><strong>{loading ? '...' : summary.allowance} days</strong></div>
        <div className="leave-overview-card tone-green"><CheckCircle2 size={22} /><span>Leaves taken</span><strong>{loading ? '...' : summary.taken} days</strong></div>
        <div className="leave-overview-card tone-orange"><CalendarDays size={22} /><span>Leaves left</span><strong>{loading ? '...' : summary.left} days</strong></div>
        <div className="leave-overview-card tone-pink"><Clock3 size={22} /><span>Pending</span><strong>{loading ? '...' : summary.pending} days</strong></div>
      </div>

      <div className="leave-balance-grid">
        {balances.map((balance) => (
          <article className="leave-balance-card" key={balance.id}>
            <div><span>{balance.leaveType}</span><strong>{balance.remainingLeaves} days left</strong></div>
            <div className="leave-progress">
              <i style={{ width: `${balance.allocatedLeaves ? Math.min(100, (balance.usedLeaves / balance.allocatedLeaves) * 100) : 0}%` }} />
            </div>
            <small>{balance.usedLeaves} taken out of {balance.allocatedLeaves}</small>
          </article>
        ))}
        {!loading && !balances.length && <p className="empty-inline">No leave balances found.</p>}
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-title"><h2>Apply for leave</h2><CalendarPlus size={20} /></div>
          <form className="form-grid" onSubmit={submit}>
            <label>Leave type
              <select name="leaveTypeId" required defaultValue="">
                <option value="" disabled>Select</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </label>
            <label>From date<input name="from" type="date" required /></label>
            <label>To date<input name="to" type="date" required /></label>
            <label className="full-span">Reason<textarea name="reason" rows="4" required /></label>
            {msg && <div className="success-alert full-span">{msg}</div>}
            <button className="btn btn-primary full-span">Submit request</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-title"><h2>My leave history</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {pageItems.map((row) => (
                  <tr key={row.id}>
                    <td>{row.leaveType}</td>
                    <td>{row.startDate} – {row.endDate}</td>
                    <td>{row.totalDays}</td>
                    <td><StatusBadge>{row.status}</StatusBadge></td>
                    <td>
                      {row.status === 'PENDING' && (
                        <button className="btn btn-small btn-danger-soft" onClick={() => handleCancel(row.id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !ordered.length && <p className="empty-inline">No leave requests yet.</p>}
          </div>
          <Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} />
        </section>
      </div>
    </div>
  );
}