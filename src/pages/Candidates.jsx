import { useMemo, useState } from 'react';
import { ClipboardCopy, KeyRound, Trash2, UserPlus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { addCandidate, deleteCandidate, generateTemporaryPassword, getCandidates, regenerateCandidateCredentials } from '../services/candidateService';

export default function Candidates() {
  const { user } = useAuth();
  const [rows, setRows] = useState(getCandidates());
  const [password, setPassword] = useState(generateTemporaryPassword());
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState('');
  const ordered = useMemo(() => sortRecent(rows), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 6);

  const refresh = () => setRows(getCandidates());
  const submit = (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const candidate = addCandidate(user, {
        name: form.get('name'), email: form.get('email'), dob: form.get('dob'), phone: form.get('phone'),
        position: form.get('position'), department: form.get('department'), experience: form.get('experience'),
        status: form.get('status'), password,
      });
      setCredentials({ email: candidate.email, password: candidate.temporaryPassword });
      event.currentTarget.reset();
      setPassword(generateTemporaryPassword());
      refresh(); setPage(1);
    } catch (err) { setError(err.message); }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    await navigator.clipboard?.writeText(`Email: ${credentials.email}\nTemporary password: ${credentials.password}`);
  };

  return <div className="page-stack">
    <PageHeader eyebrow="Manager Workspace" title="Candidates" description="Add Candidates, Capture Required DOB Details, And Generate Their Temporary Login Credentials." />
    <section className="panel">
      <div className="panel-title"><h2>Add Candidate</h2><UserPlus size={20} /></div>
      <form className="form-grid compact-form" onSubmit={submit}>
        <label>Full Name<input name="name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Date of Birth<input name="dob" type="date" required /></label>
        <label>Phone<input name="phone" /></label>
        <label>Applied Position<input name="position" required /></label>
        <label>Department<input name="department" /></label>
        <label>Experience<input name="experience" placeholder="e.g. 2 years" /></label>
        <label>Status<select name="status"><option value="SCREENING">Screening</option><option value="INTERVIEW">Interview</option><option value="SELECTED">Selected</option><option value="REJECTED">Rejected</option></select></label>
        <label>Temporary Login Password<div className="inline-field"><input value={password} onChange={(event) => setPassword(event.target.value)} minLength="6" required /><button type="button" className="icon-btn" title="Generate password" onClick={() => setPassword(generateTemporaryPassword())}><KeyRound size={17} /></button></div></label>
        {error && <div className="form-alert full-span">{error}</div>}
        <button className="btn btn-primary full-span">Add Candidate And Create Login</button>
      </form>
      {credentials && <div className="credentials-card"><div><strong>Login Credentials Generated</strong><span>{credentials.email}</span><code>{credentials.password}</code></div><button className="btn btn-secondary" onClick={copyCredentials}><ClipboardCopy size={16} /> Copy</button></div>}
    </section>
    <section className="panel">
      <div className="table-wrap"><table><thead><tr><th>Candidate</th><th>DOB</th><th>Position</th><th>Status</th><th>Login Email</th><th>Actions</th></tr></thead><tbody>
        {pageItems.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><br/><small>{row.phone || '—'}</small></td><td>{row.dob}</td><td>{row.position || '—'}</td><td><span className={`status-badge status-${row.status.toLowerCase()}`}>{row.status}</span></td><td>{row.email}</td><td><div className="table-actions"><button className="icon-btn" title="Regenerate credentials" onClick={() => { const next = regenerateCandidateCredentials(user, row.id); setCredentials(next); refresh(); }}><KeyRound size={17}/></button><button className="icon-btn danger" title="Delete candidate" onClick={() => { if (confirm('Delete candidate and generated login account?')) { deleteCandidate(user, row.id); refresh(); } }}><Trash2 size={17}/></button></div></td></tr>)}
      </tbody></table>{!ordered.length && <p className="empty-inline">No candidates added yet.</p>}</div>
      <Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage}/>
    </section>
  </div>;
}
