import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { getTeamLeaveRequests, managerLeaveAction } from '../services/leaveService';
import './LeaveApprovals.css';

export default function LeaveApprovals() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const teamRequests = await getTeamLeaveRequests();
      setRows((teamRequests || []).filter((r) => r.status === 'PENDING'));
    } catch (error) {
      setErr(error.message || 'Failed to load pending leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const ordered = useMemo(() => sortRecent(rows, 'startDate'), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 6);

  const decide = async (id, action) => {
    setErr('');
    try {
      const reason = action === 'REJECT' ? (prompt('Reason for rejection:') || 'Not approved') : '';
      await managerLeaveAction(id, action, reason);
      await load();
    } catch (error) {
      setErr(error.message || 'Failed to record decision.');
    }
  };

  return (
    <div className="page-stack leave-approvals-page page-reveal">
      <PageHeader eyebrow="Manager Workspace" title="Leave approvals" description="Approve or reject leave requests from your team." />
      {err && <div className="form-alert">{err}</div>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.employeeName}</td>
                  <td>{row.leaveType}</td>
                  <td>{row.startDate} – {row.endDate}</td>
                  <td>{row.reason}</td>
                  <td><StatusBadge>{row.status}</StatusBadge></td>
                  <td className="table-actions">
                    <button className="btn btn-small btn-primary" onClick={() => decide(row.id, 'APPROVE')}>Approve</button>
                    <button className="btn btn-small btn-danger-soft" onClick={() => decide(row.id, 'REJECT')}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !ordered.length && <p className="empty-inline">No pending leave requests.</p>}
        </div>
        <Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} />
      </section>
    </div>
  );
}