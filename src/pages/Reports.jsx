import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import SummaryCard from '../components/SummaryCard';
import { Users, Clock3, CalendarDays } from 'lucide-react';
import { getEmployees } from '../services/employeeService';
import { getAttendanceHistory } from '../services/attendanceService';
import { getSection } from '../services/localStorageService';

export default function Reports() {
  const employees = getEmployees();
  const leaves = getSection('leaveRequests') || [];

  const [attendanceCount, setAttendanceCount] = useState(0);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadAttendance() {
      setLoadingAttendance(true);
      setAttendanceError('');
      try {
        const historyData = await getAttendanceHistory();
        if (cancelled) return;

        // NOTE: adjust if backend wraps records differently
        const records = Array.isArray(historyData)
          ? historyData
          : historyData?.records || historyData?.content || [];
        setAttendanceCount(records.length);
      } catch (error) {
        if (!cancelled) {
          setAttendanceError('Failed to load attendance.');
        }
      } finally {
        if (!cancelled) setLoadingAttendance(false);
      }
    }

    loadAttendance();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="HR Analytics"
        title="Reports"
        description="LocalStorage summaries ready to be replaced by backend reports."
      />
      {attendanceError && <div className="form-alert">{attendanceError}</div>}
      <div className="summary-grid three">
        <SummaryCard icon={Users} label="Employees" value={employees.length} meta="Total accounts" tone="green" />
        <SummaryCard
          icon={Clock3}
          label="Attendance"
          value={loadingAttendance ? '...' : attendanceCount}
          meta="Total records"
          tone="teal"
        />
        <SummaryCard icon={CalendarDays} label="Leave" value={leaves.length} meta="Total requests" tone="pink" />
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Employee</th><th>Role</th><th>Department</th><th>Email</th></tr>
            </thead>
            <tbody>
              {employees.map(x => (
                <tr key={x.id}>
                  <td>{x.name}</td>
                  <td>{x.role === 'HR_ADMIN' ? 'HR' : x.role}</td>
                  <td>{x.department || '—'}</td>
                  <td>{x.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!employees.length && <p className="empty-inline">No employee records.</p>}
        </div>
      </section>
    </div>
  );
}