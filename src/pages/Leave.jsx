import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, CalendarDays, CheckCircle2, Clock3, WalletCards } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { applyLeave, getLeaveSummary, getMyLeaves } from '../services/leaveService';
import './Leave.css';

export default function Leave() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(() => getLeaveSummary(user.id));
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    setRows(getMyLeaves(user.id));
    setSummary(getLeaveSummary(user.id));
  };
  useEffect(load, [user.id]);

  const ordered = useMemo(() => sortRecent(rows), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 5);

  const submit = (event) => {
    event.preventDefault();
    setMsg('');
    setErr('');
    const form = new FormData(event.currentTarget);
    try {
      applyLeave(user, {
        type: form.get('type'),
        fromDate: form.get('from'),
        toDate: form.get('to'),
        reason: form.get('reason'),
      });
      event.currentTarget.reset();
      load();
      setPage(1);
      setMsg(user.role === 'MANAGER' ? 'Your leave request was sent to another Manager.' : 'Leave request sent to the Manager.');
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div className="page-stack leave-page page-reveal">
      <PageHeader eyebrow="Leave Management" title="Plan time away" description="Apply for leave, see your balance and track approval status." />

      <div className="leave-overview-grid">
        <div className="leave-overview-card tone-blue"><WalletCards size={22} /><span>Total allowance</span><strong>{summary.allowance} days</strong></div>
        <div className="leave-overview-card tone-green"><CheckCircle2 size={22} /><span>Leaves taken</span><strong>{summary.taken} days</strong></div>
        <div className="leave-overview-card tone-orange"><CalendarDays size={22} /><span>Leaves left</span><strong>{summary.left} days</strong></div>
        <div className="leave-overview-card tone-pink"><Clock3 size={22} /><span>Pending</span><strong>{summary.pending} days</strong></div>
      </div>

      <div className="leave-balance-grid">
        {summary.balances.map((balance) => (
          <article className="leave-balance-card" key={balance.type}>
            <div><span>{balance.type}</span><strong>{balance.left} days left</strong></div>
            <div className="leave-progress"><i style={{ width: `${Math.min(100, (balance.taken / balance.allowance) * 100)}%` }} /></div>
            <small>{balance.taken} taken out of {balance.allowance}</small>
          </article>
        ))}
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-title"><h2>Apply for leave</h2><CalendarPlus size={20} /></div>
          <form className="form-grid" onSubmit={submit}>
            <label>Leave type<select name="type" required><option value="">Select</option><option>Casual Leave</option><option>Sick Leave</option><option>Earned Leave</option></select></label>
            <label>From date<input name="from" type="date" required /></label>
            <label>To date<input name="to" type="date" required /></label>
            <label className="full-span">Reason<textarea name="reason" rows="4" required /></label>
            {msg && <div className="success-alert full-span">{msg}</div>}
            {err && <div className="form-alert full-span">{err}</div>}
            <button className="btn btn-primary full-span">Submit request</button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-title"><h2>My leave history</h2></div>
          <div className="table-wrap">
            <table><thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th></tr></thead><tbody>{pageItems.map((row) => <tr key={row.id}><td>{row.type}</td><td>{row.fromDate} – {row.toDate}</td><td>{row.days}</td><td><StatusBadge>{row.status}</StatusBadge></td></tr>)}</tbody></table>
            {!ordered.length && <p className="empty-inline">No leave requests yet.</p>}
          </div>
          <Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} />
        </section>
      </div>
    </div>
  );
}
