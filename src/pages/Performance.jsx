import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { getEmployees } from '../services/employeeService';
import { getSection, setSection } from '../services/localStorageService';

export default function Performance() {
  const [rows, setRows] = useState(getSection('performanceRecords') || []);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadEmployees() {
      try {
        const result = await getEmployees({ size: 100 });
        if (!cancelled) setEmployees(result?.content || []);
      } catch {
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadEmployees();
    return () => { cancelled = true; };
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emp = employees.find((x) => String(x.id) === form.get('employeeId'));
    const item = {
      id: `perf-${Date.now()}`,
      employeeId: emp?.id,
      employeeName: emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : '',
      period: form.get('period'),
      rating: Number(form.get('rating')),
      feedback: form.get('feedback'),
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...rows];
    setSection('performanceRecords', next);
    setRows(next);
    event.currentTarget.reset();
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Manager Workspace" title="Performance" description="Record employee feedback and ratings." />
      <section className="panel">
        <form className="form-grid" onSubmit={submit}>
          <label>Employee
            <select name="employeeId" required defaultValue="">
              <option value="" disabled>{loading ? 'Loading…' : 'Select'}</option>
              {employees.map((x) => (
                <option key={x.id} value={x.id}>{x.firstName} {x.lastName}</option>
              ))}
            </select>
          </label>
          <label>Review period<input name="period" required placeholder="Q3 2026" /></label>
          <label>Rating<input name="rating" type="number" min="1" max="5" required /></label>
          <label className="full-span">Feedback<textarea name="feedback" rows="4" required /></label>
          <button className="btn btn-primary full-span">Save review</button>
        </form>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Period</th><th>Rating</th><th>Feedback</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}><td>{x.employeeName}</td><td>{x.period}</td><td>{x.rating}/5</td><td>{x.feedback}</td></tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="empty-inline">No performance reviews yet.</p>}
        </div>
      </section>
    </div>
  );
}