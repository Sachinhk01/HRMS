import { useMemo, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { addEmployee, deleteEmployee, getEmployees } from '../services/employeeService';

export default function Employees() {
  const { user } = useAuth();
  const [rows, setRows] = useState(getEmployees());
  const [err, setErr] = useState('');
  const isHr = user.role === 'HR_ADMIN';
  const ordered = useMemo(() => sortRecent(rows), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 6);

  const submit = (event) => {
    event.preventDefault(); setErr('');
    const form = new FormData(event.currentTarget);
    try {
      addEmployee(user, { name: form.get('name'), email: form.get('email'), password: form.get('password'), role: form.get('role'), department: form.get('department'), title: form.get('title') });
      event.currentTarget.reset(); setRows(getEmployees()); setPage(1);
    } catch (error) { setErr(error.message); }
  };

  const remove = (id) => {
    if (confirm('Delete this user?')) { deleteEmployee(user, id); setRows(getEmployees()); }
  };

  return <div className="page-stack"><PageHeader eyebrow={isHr ? 'HR Workspace' : 'Manager Workspace'} title="Employees" description={isHr ? 'Create and manage Employee, HR and Manager accounts.' : 'View employees and team information.'} />
    {isHr && <section className="panel"><div className="panel-title"><h2>Add employee</h2><UserPlus size={20} /></div><form className="form-grid compact-form" onSubmit={submit}><label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Temporary password<input name="password" type="password" minLength="6" required /></label><label>Role<select name="role"><option value="EMPLOYEE">Employee</option><option value="HR_ADMIN">HR</option><option value="MANAGER">Manager</option></select></label><label>Department<input name="department" /></label><label>Designation<input name="title" /></label>{err && <div className="form-alert full-span">{err}</div>}<button className="btn btn-primary full-span">Add user</button></form></section>}
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Designation</th>{isHr && <th>Action</th>}</tr></thead><tbody>{pageItems.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{row.role === 'HR_ADMIN' ? 'HR' : row.role}</td><td>{row.department || '—'}</td><td>{row.title || '—'}</td>{isHr && <td><button className="icon-btn danger" onClick={() => remove(row.id)}><Trash2 size={17} /></button></td>}</tr>)}</tbody></table>{!ordered.length && <p className="empty-inline">No users created yet.</p>}</div><Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} /></section>
  </div>;
}
