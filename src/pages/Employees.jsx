import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutGrid, List, Phone, Mail, Eye, X,
  Briefcase, Building2, CalendarDays, IdCard, Users, AlertTriangle, RotateCw,
  UserPlus, CheckCircle2, Loader2, ChevronRight, ChevronLeft,
  User, Lock, ShieldCheck, Check, EyeOff,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import EmployeeAttendancePanel from '../components/EmployeeAttendancePanel';
import usePagination from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getEmployees, createEmployee, getDepartments, getDesignations, getJobTitles, getEmployeeDropdown,
  getProfilePhotoUrl,
} from '../services/employeeService';
import './Employees.css';
import './EmployeesPolish.css';
import './AddEmployeeModal.css';
import { AnimatedCount, ActiveFilters } from './EmployeesExtras';
import { capitalizeName } from '../utils/formatName';
import { listJobTitles } from '../services/masterDataService';
import { INPUT_LIMITS } from '../utils/inputLimits';
import DatePicker from '../components/DatePicker';
import EmployeesHeroArt from '../components/EmployeesHeroArt';

const DEPT_COLORS = {
  Engineering: '#2563eb', Sales: '#16a34a', HR: '#d97706', Marketing: '#db2777',
  Finance: '#0891b2', Operations: '#6b7280', IT: '#7c3aed', Design: '#dc2626',
};
function deptColor(dept) { return DEPT_COLORS[dept] || '#2563eb'; }
function initials(name = '') { return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(); }

// Shows the employee's real profile photo when one has been uploaded
// (photoUrl is looked up by the parent from a fetched object-URL map),
// falling back to the colored initials avatar otherwise.
function EmpAvatar({ emp, size, photoUrl }) {
  const cls = size === 'lg' ? 'emp-avatar lg' : 'emp-avatar';
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${emp.firstName || ''} ${emp.lastName || ''}`.trim()}
        className={cls}
        style={{ objectFit: 'cover', display: 'block' }}
      />
    );
  }
  const color = deptColor(emp.departmentName);
  return (
    <span className={cls} style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
      {initials(`${emp.firstName} ${emp.lastName}`)}
    </span>
  );
}

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };

// Roles allowed to see the "Add Employee" action. Mirrors the backend's
// @PreAuthorize on POST /admin/users/register and /admin/employee-profile/{userId}.
const CAN_CREATE_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

// Job Title filter is shown in the HR and Manager portals only.
const CAN_FILTER_JOB_TITLE_ROLES = ['HR_ADMIN', 'MANAGER'];

const ROLE_OPTIONS = ['EMPLOYEE', 'HR_ADMIN', 'MANAGER', 'PAYROLL_ADMIN'];
const GENDER_OPTIONS = ['MALE', 'FEMALE'];
const EMPLOYMENT_TYPE_OPTIONS = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];

const EMPTY_FORM = {
  // Step 1 — account
  username: '', email: '', password: '', role: '',
  // Step 2 — profile
  firstName: '', lastName: '', phoneNumber: '', gender: '', dateOfBirth: '',
  dateOfJoining: '', employmentType: '', departmentId: '', designationId: '',
  jobTitleId: '', reportingManagerId: '',
};

export default function Employees() {
  const { user } = useAuth();
  const userRole = user?.roles?.[0] || user?.role;
  const canCreate = CAN_CREATE_ROLES.includes(userRole);
  const canFilterByJobTitle = CAN_FILTER_JOB_TITLE_ROLES.includes(userRole);

  // Picks up ?search= from the global TopBar search so landing here from
  // "Search anything..." arrives with the query already applied.
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');

  useEffect(() => {
    const fromUrl = searchParams.get('search') || '';
    setSearchQuery((current) => (fromUrl !== current ? fromUrl : current));
    // Only react to the URL changing (e.g. a fresh TopBar search while this
    // page is already open) — typing in the box shouldn't fight this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [desigFilter, setDesigFilter] = useState('ALL');
  const [jobTitleFilter, setJobTitleFilter] = useState('ALL');
  const [masterJobTitles, setMasterJobTitles] = useState([]); // every active job title, so newly added ones are filterable
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState('grid');
  const [drawerEmp, setDrawerEmp] = useState(null);
  const [drawerTab, setDrawerTab] = useState('profile');
  const { showToast } = useToast();

  // ---------- Add Employee modal state ----------
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState(1); // 1 = account, 2 = profile
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  useEffect(() => { if (!showAdd) setShowPw(false); }, [showAdd]);

  // Each lookup list is fetched and tracked independently, so one failing
  // request (e.g. a 403 on a role-gated endpoint) doesn't blank out the others.
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [managers, setManagers] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [desigLoading, setDesigLoading] = useState(false);
  const [titleLoading, setTitleLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const result = await getEmployees({ size: 100 });
      setRows(result?.content || []);
    } catch (error) {
      setRows([]);
      setErr(error?.response?.data?.message || error.message || 'Failed to load employees from the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const departmentNames = useMemo(() => Array.from(new Set(rows.map((e) => e.departmentName).filter(Boolean))), [rows]);
  const designationNames = useMemo(() => Array.from(new Set(rows.map((e) => e.designationName).filter(Boolean))), [rows]);

  // Load the full job-title list (HR / Manager only) so titles like MERN Stack Developer or
  // DevOps Engineer appear in the filter even before an employee has been assigned to them.
  useEffect(() => {
    if (!canFilterByJobTitle) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const page = await listJobTitles({ page: 0, size: 200, sortBy: 'jobTitle', sortDirection: 'asc' });
        const names = (page?.content || []).filter((t) => t.active).map((t) => t.jobTitle);
        if (!cancelled) setMasterJobTitles(names);
      } catch {
        if (!cancelled) setMasterJobTitles([]); // fall back to the titles found on the employee list
      }
    })();
    return () => { cancelled = true; };
  }, [canFilterByJobTitle]);

  const jobTitleNames = useMemo(
    () => Array.from(new Set([...masterJobTitles, ...rows.map((e) => e.jobTitle).filter(Boolean)])).sort((a, b) => a.localeCompare(b)),
    [masterJobTitles, rows]
  );

  // Reporting manager dropdown: restricted to show only Anagha (EMP0001) as
  // requested — the underlying employee list from the API is untouched,
  // this just filters what's rendered in this one select.
  const managerOptions = useMemo(
    () => managers.filter((m) =>
      (m.employeeCode || '').toUpperCase() === 'EMP0001' ||
      (m.employeeName || '').toLowerCase().includes('anagha')
    ),
    [managers]
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || String(e.email || '').toLowerCase().includes(q) || String(e.employeeCode || '').toLowerCase().includes(q));
    }
    if (deptFilter !== 'ALL') list = list.filter((e) => e.departmentName === deptFilter);
    if (desigFilter !== 'ALL') list = list.filter((e) => e.designationName === desigFilter);
    if (canFilterByJobTitle && jobTitleFilter !== 'ALL') list = list.filter((e) => e.jobTitle === jobTitleFilter);
    if (statusFilter !== 'ALL') list = list.filter((e) => (statusFilter === 'ACTIVE' ? e.active : !e.active));
    return list;
  }, [rows, searchQuery, deptFilter, desigFilter, jobTitleFilter, canFilterByJobTitle, statusFilter]);

  const { page, setPage, pageItems, pageSize } = usePagination(filtered, view === 'grid' ? 9 : 8);

  // ---------- Real profile photos ----------
  // Employee cards only ever showed initials because no photo was ever
  // fetched. Only the employees currently on screen (this page, plus the
  // one open in the preview modal) are fetched, and each object-URL is
  // cached by employee id so paging back and forth doesn't re-fetch.
  const [photoUrls, setPhotoUrls] = useState({});

  useEffect(() => {
    const toFetch = [...pageItems, ...(drawerEmp ? [drawerEmp] : [])]
      .filter((emp) => emp?.hasProfilePhoto && emp?.id != null && !(emp.id in photoUrls));

    if (!toFetch.length) return;
    let cancelled = false;

    toFetch.forEach((emp) => {
      getProfilePhotoUrl(emp.id)
        .then((url) => {
          if (cancelled) return;
          setPhotoUrls((prev) => (emp.id in prev ? prev : { ...prev, [emp.id]: url }));
        })
        .catch(() => {
          if (cancelled) return;
          setPhotoUrls((prev) => (emp.id in prev ? prev : { ...prev, [emp.id]: '' }));
        });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItems, drawerEmp]);

  // Revoke every cached object URL when the page unmounts.
  useEffect(() => () => {
    Object.values(photoUrls).forEach((url) => { if (url) URL.revokeObjectURL(url); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Add Employee: load departments + managers when the modal opens ----------
  useEffect(() => {
    if (!showAdd) return;
    let cancelled = false;

    (async () => {
      setDeptLoading(true);
      try {
        const list = await getDepartments();
        if (!cancelled) setDepartments(list || []);
      } catch (error) {
        if (!cancelled) {
          setDepartments([]);
          showToast(error?.response?.data?.message || error.message || 'Failed to load departments. Check that you have permission and the server is reachable.', 'error');
        }
      } finally {
        if (!cancelled) setDeptLoading(false);
      }

      try {
        const list = await getEmployeeDropdown();
        if (!cancelled) setManagers(list || []);
      } catch {
        if (!cancelled) setManagers([]); // reporting manager is optional — fail silently
      }
    })();

    return () => { cancelled = true; };
  }, [showAdd]);

  // ---------- Add Employee: fetch designations whenever the chosen department changes ----------
  useEffect(() => {
    if (!form.departmentId) { setDesignations([]); return; }
    let cancelled = false;

    (async () => {
      setDesigLoading(true);
      try {
        const list = await getDesignations(form.departmentId);
        if (!cancelled) setDesignations(list || []);
      } catch (error) {
        if (!cancelled) {
          setDesignations([]);
          showToast(error?.response?.data?.message || error.message || 'Failed to load designations for that department.', 'error');
        }
      } finally {
        if (!cancelled) setDesigLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [form.departmentId]);

  // ---------- Add Employee: fetch job titles whenever the chosen designation changes ----------
  useEffect(() => {
    if (!form.designationId) { setJobTitles([]); return; }
    let cancelled = false;

    (async () => {
      setTitleLoading(true);
      try {
        const list = await getJobTitles(form.designationId);
        if (!cancelled) setJobTitles(list || []);
      } catch (error) {
        if (!cancelled) {
          setJobTitles([]);
          showToast(error?.response?.data?.message || error.message || 'Failed to load job titles for that designation.', 'error');
        }
      } finally {
        if (!cancelled) setTitleLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [form.designationId]);

  const openAddModal = useCallback(() => {
    setForm(EMPTY_FORM);
    setAddStep(1);
    setDepartments([]);
    setDesignations([]);
    setJobTitles([]);
    setManagers([]);
    setShowAdd(true);
  }, []);

  const closeAddModal = useCallback(() => {
    if (submitting) return;
    setShowAdd(false);
    setForm(EMPTY_FORM);
    setAddStep(1);
  }, [submitting]);

  const updateField = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
  };

  function validateStep1() {
    if (!form.username.trim() || form.username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return 'Enter a valid email address.';
    if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters.';
    if (!form.role) return 'Select a role.';
    return '';
  }

  function validateStep2() {
    if (!form.firstName.trim()) return 'First name is required.';
    if (!/^[6-9]\d{9}$/.test(form.phoneNumber)) return 'Enter a valid 10-digit Indian mobile number.';
    if (!form.gender) return 'Select a gender.';
    if (!form.dateOfBirth) return 'Date of birth is required.';
    if (!form.dateOfJoining) return 'Date of joining is required.';
    if (!form.employmentType) return 'Select an employment type.';
    if (!form.departmentId) return 'Select a department.';
    if (!form.designationId) return 'Select a designation.';
    if (!form.jobTitleId) return 'Select a job title.';
    return '';
  }

  function goNext() {
    const error = validateStep1();
    if (error) { showToast(error, 'error'); return; }
    setAddStep(2);
  }

  function goBack() {
    setAddStep(1);
  }

  // Back must never behave like a submit: stop the click here, skip validation, and go to step 1.
  function handleBackClick(e) {
    e.preventDefault();
    e.stopPropagation();
    goBack();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const error = validateStep2();
    if (error) { showToast(error, 'error'); return; }
    setSubmitting(true);
    try {
      await createEmployee({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        dateOfJoining: form.dateOfJoining,
        employmentType: form.employmentType,
        departmentId: Number(form.departmentId),
        designationId: Number(form.designationId),
        jobTitleId: Number(form.jobTitleId),
        reportingManagerId: form.reportingManagerId ? Number(form.reportingManagerId) : undefined,
      });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      setAddStep(1);
      showToast(`${form.firstName} ${form.lastName} was added successfully.`, 'success');
      load();
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Failed to create employee. Please check the details and try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack employees-page page-reveal">
      {/* ---------- Hero banner ---------- */}
      <motion.section className="emp-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }}>
        <div className="emp-hero-text">
          <span className="eyebrow">Organization</span>
          <h1>Employees</h1>
          <p>Browse Your Organization And View Employee Information.</p>
          <div className="emp-stats">
            <div className="emp-stat"><strong><AnimatedCount value={rows.length} /></strong><span>Total</span></div>
            <div className="emp-stat tone-green"><strong><AnimatedCount value={rows.filter((e) => e.active).length} /></strong><span>Active</span></div>
            <div className="emp-stat tone-violet"><strong><AnimatedCount value={departmentNames.length} /></strong><span>Departments</span></div>
          </div>
          {canCreate && (
            <button className="btn btn-primary emp-add-btn" onClick={openAddModal}>
              <UserPlus size={16} /> Add Employee
            </button>
          )}
        </div>
        <div className="emp-hero-illustration" aria-hidden="true">
          <EmployeesHeroArt />
        </div>
      </motion.section>

      {/* ---------- Error banner (real API failure, not mock fallback) ---------- */}
      <AnimatePresence>
        {err && (
          <motion.div
            className="toast toast-error"
            style={{ position: 'static', transform: 'none', width: '100%', justifyContent: 'space-between' }}
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} /> {err}</span>
            <button className="btn btn-small btn-soft" onClick={load}><RotateCw size={14} /> Retry</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Toolbar ---------- */}
      <motion.div className="emp-toolbar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}>
        <label className="emp-search">
          <Search size={15} />
          <input maxLength={INPUT_LIMITS.SEARCH} type="text" placeholder="Search name, email or employee code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </label>
        <select className="compact-select" data-active={deptFilter !== 'ALL'} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="ALL">All Departments</option>
          {departmentNames.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="compact-select" data-active={desigFilter !== 'ALL'} value={desigFilter} onChange={(e) => setDesigFilter(e.target.value)}>
          <option value="ALL">All Designations</option>
          {designationNames.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {canFilterByJobTitle && (
          <select className="compact-select" data-active={jobTitleFilter !== 'ALL'} value={jobTitleFilter} onChange={(e) => setJobTitleFilter(e.target.value)}>
            <option value="ALL">All Job Titles</option>
            {jobTitleNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <select className="compact-select" data-active={statusFilter !== 'ALL'} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <div className="view-toggle">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid view"><LayoutGrid size={16} /></button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List view"><List size={16} /></button>
        </div>
      </motion.div>

      <ActiveFilters
        loading={loading}
        shown={filtered.length}
        total={rows.length}
        chips={[
          searchQuery.trim() && { key: 'q', label: `Search: “${searchQuery.trim()}”`, onRemove: () => setSearchQuery('') },
          deptFilter !== 'ALL' && { key: 'dept', label: deptFilter, onRemove: () => setDeptFilter('ALL') },
          desigFilter !== 'ALL' && { key: 'desig', label: desigFilter, onRemove: () => setDesigFilter('ALL') },
          canFilterByJobTitle && jobTitleFilter !== 'ALL' && { key: 'title', label: jobTitleFilter, onRemove: () => setJobTitleFilter('ALL') },
          statusFilter !== 'ALL' && { key: 'status', label: statusFilter === 'ACTIVE' ? 'Active' : 'Inactive', onRemove: () => setStatusFilter('ALL') },
        ].filter(Boolean)}
        onClearAll={() => { setSearchQuery(''); setDeptFilter('ALL'); setDesigFilter('ALL'); setJobTitleFilter('ALL'); setStatusFilter('ALL'); }}
      />

      {/* ---------- Grid view ---------- */}
      <AnimatePresence mode="wait">
        {view === 'grid' ? (
          <motion.div className="emp-grid" key="grid" initial="hidden" animate="show" exit={{ opacity: 0 }} variants={stagger}>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <div className="emp-card skeleton" key={`esk-${i}`}>
                <div className="skeleton-bar" style={{ width: '40%' }} />
                <div className="skeleton-bar" style={{ width: '70%' }} />
                <div className="skeleton-bar" style={{ width: '50%' }} />
              </div>
            ))}
            <AnimatePresence mode="popLayout">
            {!loading && pageItems.map((emp) => (
              <motion.article
                className="panel emp-card"
                key={emp.id}
                layout
                variants={fadeUp}
                exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                whileHover={{ y: -6 }}
              >
                <div className="emp-card-top">
                  <span className="emp-avatar-wrap">
                    <EmpAvatar emp={emp} size="lg" photoUrl={photoUrls[emp.id]} />
                    <i className={`emp-dot ${emp.active ? 'on' : 'off'}`} title={emp.active ? 'Active' : 'Inactive'} />
                  </span>
                  <span className="dept-badge" style={{ background: `${deptColor(emp.departmentName)}1a`, color: deptColor(emp.departmentName) }}>{emp.departmentName || '—'}</span>
                </div>
                <strong className="emp-card-name">{capitalizeName(emp.firstName)} {capitalizeName(emp.lastName)}</strong>
                <span className="emp-card-role">{emp.designationName || '—'}</span>
                <div className="emp-card-meta">
                  <span><Mail size={13} /> {emp.email || '—'}</span>
                  <span><Phone size={13} /> {emp.phoneNumber || '—'}</span>
                </div>
                <div className="emp-card-actions">
                  <button className="btn btn-small btn-soft" onClick={() => { setDrawerEmp(emp); setDrawerTab('profile'); }}><Eye size={14} /> View</button>
                </div>
              </motion.article>
            ))}
            </AnimatePresence>
            {!loading && !err && !filtered.length && (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <Users size={32} />
                <p>No employees found.</p>
                <small>Try adjusting your filters.</small>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.section className="panel" key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="table-wrap">
              <table className="emp-table">
                <thead><tr><th>Employee</th><th>Code</th><th>Department</th><th>Designation</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`lsk-${i}`} className="skeleton-row"><td colSpan={8}><div className="skeleton-bar" /></td></tr>
                  ))}
                  {!loading && pageItems.map((emp, index) => (
                    <motion.tr key={emp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.035, ease: easeOut }}>
                      <td><span className="emp-cell"><EmpAvatar emp={emp} photoUrl={photoUrls[emp.id]} /><span className="emp-name">{capitalizeName(emp.firstName)} {capitalizeName(emp.lastName)}</span></span></td>
                      <td>{emp.employeeCode || '—'}</td>
                      <td>{emp.departmentName ? <span className="dept-badge" style={{ background: `${deptColor(emp.departmentName)}1a`, color: deptColor(emp.departmentName) }}>{emp.departmentName}</span> : '—'}</td>
                      <td>{emp.designationName || '—'}</td>
                      <td>{emp.email || '—'}</td>
                      <td>{emp.phoneNumber || '—'}</td>
                      <td><span className={`status-pill ${emp.active ? 'approved' : 'cancelled'}`}>{emp.active ? 'Active' : 'Inactive'}</span></td>
                      <td><button className="icon-btn" title="View profile" onClick={() => { setDrawerEmp(emp); setDrawerTab('profile'); }}><Eye size={15} /></button></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {!loading && !err && !filtered.length && <div className="empty-state"><Users size={32} /><p>No employees found.</p><small>Try adjusting your filters.</small></div>}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />

      {/* ---------- Profile preview modal (centered card) ---------- */}
      {createPortal(
      <AnimatePresence>
        {drawerEmp && (
          <motion.div className="emp-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerEmp(null)}>
            <motion.div
              className="emp-modal-card"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.25, ease: easeOut }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="emp-modal-head">
                <div>
                  <span className="eyebrow">Employee Preview</span>
                  <h2>{capitalizeName(drawerEmp.firstName)} {capitalizeName(drawerEmp.lastName)}</h2>
                </div>
                <button className="emp-modal-close" onClick={() => setDrawerEmp(null)}><X size={18} /></button>
              </div>

              <div className="emp-modal-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={drawerTab === 'profile'}
                  className={drawerTab === 'profile' ? 'active' : ''}
                  onClick={() => setDrawerTab('profile')}
                >
                  Profile
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={drawerTab === 'attendance'}
                  className={drawerTab === 'attendance' ? 'active' : ''}
                  onClick={() => setDrawerTab('attendance')}
                >
                  Attendance
                </button>
              </div>

              <div className="emp-modal-body">
                {drawerTab === 'profile' && (
                  <>
                    <div className="emp-modal-person">
                      <EmpAvatar emp={drawerEmp} size="lg" photoUrl={photoUrls[drawerEmp.id]} />
                      <div>
                        <strong>{capitalizeName(drawerEmp.firstName)} {capitalizeName(drawerEmp.lastName)}</strong>
                        <small>{drawerEmp.designationName || '—'}</small>
                      </div>
                    </div>

                    <div className="emp-info-grid emp-info-grid-3">
                      <div className="emp-info-item"><IdCard size={14} /><span>Employee Code</span><strong>{drawerEmp.employeeCode || '—'}</strong></div>
                      <div className="emp-info-item"><Building2 size={14} /><span>Department</span><strong>{drawerEmp.departmentName || '—'}</strong></div>
                      <div className="emp-info-item"><Briefcase size={14} /><span>Designation</span><strong>{drawerEmp.designationName || '—'}</strong></div>
                      <div className="emp-info-item"><Mail size={14} /><span>Email</span><strong className="truncate">{drawerEmp.email || '—'}</strong></div>
                      <div className="emp-info-item"><Phone size={14} /><span>Phone</span><strong>{drawerEmp.phoneNumber || '—'}</strong></div>
                      <div className="emp-info-item"><CalendarDays size={14} /><span>Status</span><strong>{drawerEmp.active ? 'Active' : 'Inactive'}</strong></div>
                    </div>
                  </>
                )}

                {drawerTab === 'attendance' && (
                  <EmployeeAttendancePanel
                    employeeId={drawerEmp.id}
                    employeeName={`${drawerEmp.firstName || ''} ${drawerEmp.lastName || ''}`.trim()}
                    employeeCode={drawerEmp.employeeCode}
                    jobTitle={drawerEmp.jobTitle || drawerEmp.designationName}
                  />
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      , document.body)}

      {/* ---------- Add Employee modal ---------- */}
      {createPortal(
      <AnimatePresence>
        {showAdd && (
          <motion.div className="emp-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="emp-modal-card emp-add-card"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25, ease: easeOut }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ef-head">
                <div>
                  <h2>Add Employee</h2>
                  <p>{addStep === 1 ? 'Set up the login this person will use to sign in.' : 'Add their personal and employment details.'}</p>
                </div>
                <button type="button" className="emp-modal-close" onClick={closeAddModal} aria-label="Close"><X size={18} /></button>
              </div>

              <ol className="ef-steps" aria-label="Progress">
                <li className={`ef-step ${addStep === 1 ? 'is-current' : 'is-done'}`}>
                  <span className="ef-step-dot">{addStep > 1 ? <Check size={13} strokeWidth={3} /> : 1}</span>
                  <span className="ef-step-label">Account</span>
                </li>
                <li className="ef-step-line" aria-hidden="true">
                  <motion.span initial={false} animate={{ scaleX: addStep === 2 ? 1 : 0 }} transition={{ duration: 0.45, ease: easeOut }} />
                </li>
                <li className={`ef-step ${addStep === 2 ? 'is-current' : ''}`}>
                  <span className="ef-step-dot">2</span>
                  <span className="ef-step-label">Profile</span>
                </li>
              </ol>

              <form onSubmit={addStep === 1 ? (e) => { e.preventDefault(); goNext(); } : handleSubmit}>
                <div className="ef-body">
                  <motion.div
                    key={addStep}
                    initial={{ opacity: 0, x: addStep === 2 ? 22 : -22 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, ease: easeOut }}
                  >
                    {addStep === 1 && (
                      <div className="ef-grid ef-grid--2">
                        <label className="form-field">
                          <span>Username</span>
                          <div className="ef-control">
                            <User size={16} className="ef-icon" />
                            <input maxLength={INPUT_LIMITS.USERNAME} type="text" value={form.username} onChange={updateField('username')} placeholder="e.g. anagha.k" required />
                          </div>
                        </label>
                        <label className="form-field">
                          <span>Email</span>
                          <div className="ef-control">
                            <Mail size={16} className="ef-icon" />
                            <input maxLength={INPUT_LIMITS.EMAIL} type="email" value={form.email} onChange={updateField('email')} placeholder="name@company.com" required />
                          </div>
                        </label>
                        <label className="form-field">
                          <span>Temporary Password</span>
                          <div className="ef-control">
                            <Lock size={16} className="ef-icon" />
                            <input maxLength={INPUT_LIMITS.PASSWORD} className="ef-has-eye" type={showPw ? 'text' : 'password'} value={form.password} onChange={updateField('password')} placeholder="Min. 6 characters" required />
                            <button type="button" className="ef-eye" tabIndex={-1} onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </label>
                        <label className="form-field">
                          <span>Role</span>
                          <div className="ef-control">
                            <ShieldCheck size={16} className="ef-icon" />
                            <select value={form.role} onChange={updateField('role')} required>
                              <option value="">Select role</option>
                              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                            </select>
                          </div>
                        </label>
                      </div>
                    )}

                    {addStep === 2 && (
                      <>
                        <section className="ef-section">
                          <h3 className="ef-section-title">Personal details</h3>
                          <div className="ef-grid ef-grid--3">
                            <label className="form-field">
                              <span>First Name</span>
                              <input maxLength={INPUT_LIMITS.NAME} type="text" value={form.firstName} onChange={updateField('firstName')} required />
                            </label>
                            <label className="form-field">
                              <span>Last Name</span>
                              <input maxLength={INPUT_LIMITS.NAME} type="text" value={form.lastName} onChange={updateField('lastName')} />
                            </label>
                            <label className="form-field">
                              <span>Gender</span>
                              <select value={form.gender} onChange={updateField('gender')} required>
                                <option value="">Select</option>
                                {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g[0] + g.slice(1).toLowerCase()}</option>)}
                              </select>
                            </label>
                            <label className="form-field ef-span-2">
                              <span>Phone Number</span>
                              <input maxLength={INPUT_LIMITS.PHONE} type="tel" value={form.phoneNumber} onChange={updateField('phoneNumber')} placeholder="10-digit mobile" required />
                            </label>
                            <label className="form-field">
                              <span>Date of Birth</span>
                              <DatePicker id="employee-dob" value={form.dateOfBirth} onChange={updateField('dateOfBirth')} required />
                            </label>
                          </div>
                        </section>

                        <section className="ef-section">
                          <h3 className="ef-section-title">Employment</h3>
                          <div className="ef-grid ef-grid--3">
                            <label className="form-field">
                              <span>Date of Joining</span>
                              <DatePicker id="employee-doj" value={form.dateOfJoining} onChange={updateField('dateOfJoining')} required />
                            </label>
                            <label className="form-field">
                              <span>Employment Type</span>
                              <select value={form.employmentType} onChange={updateField('employmentType')} required>
                                <option value="">Select</option>
                                {EMPLOYMENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Reporting Manager</span>
                              <select value={form.reportingManagerId} onChange={updateField('reportingManagerId')}>
                                <option value="">None</option>
                                {managerOptions.map((m) => (
                                  <option key={m.id} value={m.id}>Anagha Pothi ({m.employeeCode})</option>
                                ))}
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Department {deptLoading && <small>(loading…)</small>}</span>
                              <select
                                value={form.departmentId}
                                onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, designationId: '', jobTitleId: '' }))}
                                disabled={deptLoading}
                                required
                              >
                                <option value="">{deptLoading ? 'Loading…' : departments.length ? 'Select' : 'No departments found'}</option>
                                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Designation {desigLoading && <small>(loading…)</small>}</span>
                              <select
                                value={form.designationId}
                                onChange={(e) => setForm((f) => ({ ...f, designationId: e.target.value, jobTitleId: '' }))}
                                disabled={!form.departmentId || desigLoading}
                                required
                              >
                                <option value="">
                                  {!form.departmentId ? 'Select department first' : desigLoading ? 'Loading…' : designations.length ? 'Select' : 'No designations found'}
                                </option>
                                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            </label>
                            <label className="form-field">
                              <span>Job Title {titleLoading && <small>(loading…)</small>}</span>
                              <select
                                value={form.jobTitleId}
                                onChange={updateField('jobTitleId')}
                                disabled={!form.designationId || titleLoading}
                                required
                              >
                                <option value="">
                                  {!form.designationId ? 'Select designation first' : titleLoading ? 'Loading…' : jobTitles.length ? 'Select' : 'No job titles found'}
                                </option>
                                {jobTitles.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
                              </select>
                            </label>
                          </div>
                        </section>
                      </>
                    )}
                  </motion.div>
                </div>

                <div className="ef-footer">
                  {addStep === 2 ? (
                    <>
                      <button key="back" type="button" formNoValidate className="ef-btn ef-btn--ghost" onClick={handleBackClick} disabled={submitting}><ChevronLeft size={16} /> Back</button>
                      <button key="create" type="submit" className="ef-btn ef-btn--primary" disabled={submitting}>
                        {submitting ? <><Loader2 className="spin" size={16} /> Creating…</> : <>Create Employee</>}
                      </button>
                    </>
                  ) : (
                    <>
                      <button key="cancel" type="button" formNoValidate className="ef-btn ef-btn--ghost" onClick={closeAddModal}>Cancel</button>
                      <button key="continue" type="submit" className="ef-btn ef-btn--primary">
                        Continue <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      , document.body)}
    </div>
  );
}
