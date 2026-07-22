import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { decideLeave, getPendingApprovals } from '../services/leaveService';
import './LeaveApprovals.css';

export default function LeaveApprovals() {
  const { user } = useAuth();
  const [rows, setRows] = useState(getPendingApprovals(user.id));
  const [err, setErr] = useState('');
  const ordered = useMemo(() => sortRecent(rows), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 6);
  const decide = (id, status) => {
    try {
      const reason = status === 'REJECTED' ? (prompt('Reason for rejection:') || 'Not approved') : '';
      decideLeave(id, user, status, reason); setRows(getPendingApprovals(user.id));
    } catch (error) { setErr(error.message); }
  };
  return <div className="page-stack leave-approvals-page page-reveal"><PageHeader eyebrow="Manager Workspace" title="Leave approvals" description="Only Managers can approve or reject Employee, HR and other Manager leave requests." />{err && <div className="form-alert">{err}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Applicant</th><th>Role</th><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pageItems.map((row) => <tr key={row.id}><td>{row.applicantName}</td><td>{row.applicantRole === 'HR_ADMIN' ? 'HR' : row.applicantRole}</td><td>{row.type}</td><td>{row.fromDate} – {row.toDate}</td><td>{row.reason}</td><td><StatusBadge>{row.status}</StatusBadge></td><td className="table-actions"><button className="btn btn-small btn-primary" onClick={() => decide(row.id, 'APPROVED')}>Approve</button><button className="btn btn-small btn-danger-soft" onClick={() => decide(row.id, 'REJECTED')}>Reject</button></td></tr>)}</tbody></table>{!ordered.length && <p className="empty-inline">No pending leave requests.</p>}</div><Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} /></section></div>;
}
