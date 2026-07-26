import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, UserPlus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import {
  getEmployees,
  createEmployee,
  changeEmployeeStatus,
  getDepartments,
  getDesignations,
  getJobTitles,
} from '../services/employeeService';

export default function Employees() {
  const { user } = useAuth();
  const isHr = user.role === 'HR_ADMIN';

  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedDesigId, setSelectedDesigId] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const ordered = useMemo(() => sortRecent(rows, 'employeeCode'), [rows]);
  const { page, setPage, pageItems, pageSize } = usePagination(ordered, 6);

  const loadEmployees = async () => {
    setLoading(true);
    setErr('');
    try {
      const result = await getEmployees({ size: 100 });
      setRows(result.content || []);
    } catch (error) {
      setErr(error.message || 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  };

  const loadLookups = async () => {
    try {
      const [deptData, desigData, jobData] = await Promise.all([
        getDepartments(),
        getDesignations(),
        getJobTitles(),
      ]);
      setDepartments(deptData || []);
      setDesignations(desigData || []);
      setJobTitles(jobData || []);
    } catch (error) {
      setErr(error.message || 'Failed to load department/designation data.');
    }
  };

  useEffect(() => {
    loadEmployees();
    if (isHr) loadLookups();
  }, []);

  // Cascading filters: designations belonging to selected department, job titles belonging to selected designation
  const filteredDesignations = useMemo(
    () => (selectedDeptId ? designations.filter((d) => String(d.departmentId) === String(selectedDeptId)) : designations),
    [designations, selectedDeptId]
  );
  const filteredJobTitles = useMemo(
    () => (selectedDesigId ? jobTitles.filter((j) => String(j.designationId) === String(selectedDesigId)) : jobTitles),
    [jobTitles, selectedDesigId]
  );

const submit = async (event) => {
  event.preventDefault();
  setErr('');
  setMsg('');
  setSubmitting(true);
  const formEl = event.currentTarget;        // capture reference BEFORE any await
  const form = new FormData(formEl);

  try {
    await createEmployee({
      username: form.get('username'),
      email: form.get('email'),
      password: form.get('password'),
      role: form.get('role'),
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      phoneNumber: form.get('phoneNumber'),
      gender: form.get('gender'),
      dateOfBirth: form.get('dateOfBirth'),
      dateOfJoining: form.get('dateOfJoining'),
      employmentType: form.get('employmentType'),
      departmentId: Number(form.get('departmentId')),
      designationId: Number(form.get('designationId')),
      jobTitleId: Number(form.get('jobTitleId')),
    });
    formEl.reset();                          // use the captured reference, not event.currentTarget
    setSelectedDeptId('');
    setSelectedDesigId('');
    setMsg('Employee created successfully.');
    await loadEmployees();
    setPage(1);
  } catch (error) {
    setErr(error?.response?.data?.message || error.message || 'Failed to create employee.');
  } finally {
    setSubmitting(false);
  }
};

  const toggleStatus = async (id, currentActive) => {
    setErr('');
    try {
      await changeEmployeeStatus(id, !currentActive);
      await loadEmployees();
    } catch (error) {
      setErr(error?.response?.data?.message || error.message || 'Failed to update status.');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={isHr ? 'HR Workspace' : 'Manager Workspace'}
        title="Employees"
        description={isHr ? 'Create and manage Employee, HR and Manager accounts.' : 'View employees and team information.'}
      />

      {err && <div className="form-alert">{err}</div>}
      {msg && <div className="success-alert">{msg}</div>}

      {isHr && (
        <section className="panel">
          <div className="panel-title"><h2>Add employee</h2><UserPlus size={20} /></div>
          <form className="form-grid compact-form" onSubmit={submit}>
            <label>Username<input name="username" required /></label>
            <label>Email<input name="email" type="email" required /></label>
            <label>Temporary password<input name="password" type="password" minLength="6" required /></label>
            <label>Role
              <select name="role" required defaultValue="EMPLOYEE">
                <option value="EMPLOYEE">Employee</option>
                <option value="HR_ADMIN">HR</option>
                <option value="MANAGER">Manager</option>
              </select>
            </label>
            <label>First name<input name="firstName" required /></label>
            <label>Last name<input name="lastName" /></label>
            <label>Phone number<input name="phoneNumber" pattern="[6-9][0-9]{9}" title="10-digit mobile number" required /></label>
            <label>Gender
              <select name="gender" required defaultValue="">
                <option value="" disabled>Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </label>
            <label>Date of birth<input name="dateOfBirth" type="date" required /></label>
            <label>Date of joining<input name="dateOfJoining" type="date" required /></label>
            <label>Employment type
              <select name="employmentType" required defaultValue="FULL_TIME">
                <option value="FULL_TIME">Full time</option>
                <option value="PART_TIME">Part time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </select>
            </label>
            <label>Department
              <select
                name="departmentId"
                required
                value={selectedDeptId}
                onChange={(e) => { setSelectedDeptId(e.target.value); setSelectedDesigId(''); }}
              >
                <option value="" disabled>Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.departmentName}</option>)}
              </select>
            </label>
            <label>Designation
              <select
                name="designationId"
                required
                value={selectedDesigId}
                onChange={(e) => setSelectedDesigId(e.target.value)}
                disabled={!selectedDeptId}
              >
                <option value="" disabled>Select designation</option>
                {filteredDesignations.map((d) => <option key={d.id} value={d.id}>{d.designationName}</option>)}
              </select>
            </label>
            <label>Job title
              <select name="jobTitleId" required defaultValue="" disabled={!selectedDesigId}>
                <option value="" disabled>Select job title</option>
                {filteredJobTitles.map((j) => <option key={j.id} value={j.id}>{j.jobTitle}</option>)}
              </select>
            </label>
            <button className="btn btn-primary full-span" disabled={submitting}>
              {submitting ? 'Creating…' : 'Add employee'}
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Email</th><th>Department</th><th>Designation</th><th>Job Title</th><th>Status</th>
                {isHr && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.employeeCode}</td>
                  <td>{row.firstName} {row.lastName}</td>
                  <td>{row.email}</td>
                  <td>{row.departmentName || '—'}</td>
                  <td>{row.designationName || '—'}</td>
                  <td>{row.jobTitle || '—'}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                  {isHr && (
                    <td>
                      <button
                        className={`icon-btn ${row.active ? 'danger' : ''}`}
                        onClick={() => toggleStatus(row.id, row.active)}
                        title={row.active ? 'Deactivate' : 'Activate'}
                      >
                        {row.active ? <Ban size={17} /> : <CheckCircle2 size={17} />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !ordered.length && <p className="empty-inline">No employees found.</p>}
        </div>
        <Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} />
      </section>
    </div>
  );
}