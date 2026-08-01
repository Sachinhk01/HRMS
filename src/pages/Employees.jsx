import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutGrid, List, Phone, Mail, MessageSquare, Eye, X,
  Briefcase, Building2, CalendarDays, IdCard, Users,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { getEmployees } from '../services/employeeService';
import './Employees.css';

const DEPT_COLORS = {
  Engineering: '#2563eb', Sales: '#16a34a', HR: '#d97706', Marketing: '#db2777',
  Finance: '#0891b2', Operations: '#6b7280', IT: '#7c3aed', Design: '#dc2626',
};
function deptColor(dept) { return DEPT_COLORS[dept] || '#2563eb'; }
function initials(name = '') { return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(); }

const easeOut = [0.16, 1, 0.3, 1];
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };

export default function Employees() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [desigFilter, setDesigFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [view, setView] = useState('grid');
  const [drawerEmp, setDrawerEmp] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getEmployees({ size: 100 });
        if (!cancelled) setRows(result?.content || []);
      } catch { if (!cancelled) setRows([]); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const departments = useMemo(() => Array.from(new Set(rows.map((e) => e.departmentName).filter(Boolean))), [rows]);
  const designations = useMemo(() => Array.from(new Set(rows.map((e) => e.designationName).filter(Boolean))), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || String(e.email || '').toLowerCase().includes(q) || String(e.employeeCode || '').toLowerCase().includes(q));
    }
    if (deptFilter !== 'ALL') list = list.filter((e) => e.departmentName === deptFilter);
    if (desigFilter !== 'ALL') list = list.filter((e) => e.designationName === desigFilter);
    if (statusFilter !== 'ALL') list = list.filter((e) => (statusFilter === 'ACTIVE' ? e.active : !e.active));
    return list;
  }, [rows, searchQuery, deptFilter, desigFilter, statusFilter]);

  const { page, setPage, pageItems, pageSize } = usePagination(filtered, view === 'grid' ? 9 : 8);

  return (
    <div className="page-stack employees-page page-reveal">
      {/* ---------- Hero banner ---------- */}
      <motion.section className="emp-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }}>
        <div className="emp-hero-text">
          <span className="eyebrow">Organization</span>
          <h1>Employees</h1>
          <p>Browse your organization and view employee information.</p>
        </div>
        <div className="emp-hero-illustration" aria-hidden="true">
          <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="250" cy="55" r="56" fill="#dbeafe" opacity="0.5" />
            <circle cx="60" cy="155" r="40" fill="#bfdbfe" opacity="0.4" />
            <rect x="100" y="50" width="140" height="120" rx="18" fill="#fff" stroke="#bfdbfe" strokeWidth="2" />
            {/* Team avatars */}
            <circle cx="140" cy="90" r="14" fill="#2563eb" />
            <rect x="126" y="102" width="28" height="18" rx="9" fill="#2563eb" />
            <circle cx="200" cy="90" r="14" fill="#0891b2" />
            <rect x="186" y="102" width="28" height="18" rx="9" fill="#0891b2" />
            <circle cx="170" cy="130" r="14" fill="#16a34a" />
            <rect x="156" y="142" width="28" height="18" rx="9" fill="#16a34a" />
            {/* Building */}
            <rect x="120" y="150" width="100" height="14" rx="4" fill="#e0edff" />
          </svg>
        </div>
      </motion.section>

      {/* ---------- Toolbar ---------- */}
      <motion.div className="emp-toolbar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}>
        <label className="emp-search">
          <Search size={15} />
          <input type="text" placeholder="Search name, email or employee code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </label>
        <select className="compact-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="ALL">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="compact-select" value={desigFilter} onChange={(e) => setDesigFilter(e.target.value)}>
          <option value="ALL">All designations</option>
          {designations.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <div className="view-toggle">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid view"><LayoutGrid size={16} /></button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List view"><List size={16} /></button>
        </div>
      </motion.div>

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
            {!loading && pageItems.map((emp) => (
              <motion.article className="panel emp-card" key={emp.id} variants={fadeUp} whileHover={{ y: -6 }}>
                <div className="emp-card-top">
                  <span className="emp-avatar lg" style={{ background: `linear-gradient(135deg, ${deptColor(emp.departmentName)}, ${deptColor(emp.departmentName)}cc)` }}>{initials(`${emp.firstName} ${emp.lastName}`)}</span>
                  <span className="dept-badge" style={{ background: `${deptColor(emp.departmentName)}1a`, color: deptColor(emp.departmentName) }}>{emp.departmentName || '—'}</span>
                </div>
                <strong className="emp-card-name">{emp.firstName} {emp.lastName}</strong>
                <span className="emp-card-role">{emp.designationName || '—'}</span>
                <div className="emp-card-meta">
                  <span><Mail size={13} /> {emp.email || '—'}</span>
                  <span><Phone size={13} /> {emp.phone || '—'}</span>
                </div>
                <div className="emp-card-actions">
                  <button className="btn btn-small btn-soft" onClick={() => setDrawerEmp(emp)}><Eye size={14} /> View</button>
                  <button className="icon-btn" title="Message (UI)"><MessageSquare size={15} /></button>
                  <button className="icon-btn" title="Call (UI)"><Phone size={15} /></button>
                  <button className="icon-btn" title="Email (UI)"><Mail size={15} /></button>
                </div>
              </motion.article>
            ))}
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
                  {!loading && pageItems.map((emp) => (
                    <motion.tr key={emp.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: easeOut }}>
                      <td><span className="emp-cell"><span className="emp-avatar" style={{ background: `linear-gradient(135deg, ${deptColor(emp.departmentName)}, ${deptColor(emp.departmentName)}cc)` }}>{initials(`${emp.firstName} ${emp.lastName}`)}</span><span className="emp-name">{emp.firstName} {emp.lastName}</span></span></td>
                      <td>{emp.employeeCode || '—'}</td>
                      <td>{emp.departmentName ? <span className="dept-badge" style={{ background: `${deptColor(emp.departmentName)}1a`, color: deptColor(emp.departmentName) }}>{emp.departmentName}</span> : '—'}</td>
                      <td>{emp.designationName || '—'}</td>
                      <td>{emp.email || '—'}</td>
                      <td>{emp.phone || '—'}</td>
                      <td><span className={`status-pill ${emp.active ? 'approved' : 'cancelled'}`}>{emp.active ? 'Active' : 'Inactive'}</span></td>
                      <td><button className="icon-btn" title="View profile" onClick={() => setDrawerEmp(emp)}><Eye size={15} /></button></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {!loading && !filtered.length && <div className="empty-state"><Users size={32} /><p>No employees found.</p><small>Try adjusting your filters.</small></div>}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />

      {/* ---------- Profile preview drawer ---------- */}
      <AnimatePresence>
        {drawerEmp && (
          <>
            <motion.div className="drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerEmp(null)} />
            <motion.aside className="detail-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 360, damping: 38 }}>
              <div className="drawer-head">
                <span className="eyebrow">Employee preview</span>
                <h2>{drawerEmp.firstName} {drawerEmp.lastName}</h2>
                <button className="drawer-close" onClick={() => setDrawerEmp(null)}><X size={20} /></button>
              </div>
              <div className="drawer-body">
                <div className="drawer-emp">
                  <span className="emp-avatar lg" style={{ background: `linear-gradient(135deg, ${deptColor(drawerEmp.departmentName)}, ${deptColor(drawerEmp.departmentName)}cc)` }}>{initials(`${drawerEmp.firstName} ${drawerEmp.lastName}`)}</span>
                  <div>
                    <strong>{drawerEmp.firstName} {drawerEmp.lastName}</strong>
                    <small>{drawerEmp.designationName || '—'}</small>
                  </div>
                </div>
                <div className="drawer-grid">
                  <div className="dg-item"><IdCard size={15} /><span>Employee code</span><strong>{drawerEmp.employeeCode || '—'}</strong></div>
                  <div className="dg-item"><Building2 size={15} /><span>Department</span><strong>{drawerEmp.departmentName || '—'}</strong></div>
                  <div className="dg-item"><Briefcase size={15} /><span>Designation</span><strong>{drawerEmp.designationName || '—'}</strong></div>
                  <div className="dg-item"><Mail size={15} /><span>Email</span><strong>{drawerEmp.email || '—'}</strong></div>
                  <div className="dg-item"><Phone size={15} /><span>Phone</span><strong>{drawerEmp.phone || '—'}</strong></div>
                  <div className="dg-item"><CalendarDays size={15} /><span>Status</span><strong>{drawerEmp.active ? 'Active' : 'Inactive'}</strong></div>
                </div>
              </div>
              <div className="drawer-footer">
                <button className="btn btn-soft" onClick={() => setDrawerEmp(null)}>Close</button>
                <button className="btn btn-gradient"><Eye size={16} /> Full profile</button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
