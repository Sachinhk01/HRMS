import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  createHoliday,
  deleteHoliday,
  getHolidays,
  getUpcomingHolidays,
  updateHoliday,
} from '../services/holidayService';
import './Holidays.css';
import { CalendarHeart, Flag, Gift, Sparkles } from 'lucide-react';

const HOLIDAY_TYPE_META = {
  HOLIDAY: { label: 'Company Holiday', icon: CalendarHeart, cls: 'type-company' },
  PUBLIC_HOLIDAY: { label: 'National Holiday', icon: Flag, cls: 'type-national' },
  OPTIONAL_HOLIDAY: { label: 'Optional Holiday', icon: Sparkles, cls: 'type-restricted' },
  WEEKEND: { label: 'Weekend', icon: Gift, cls: 'type-festival' },
};

function HolidayTypeBadge({ type }) {
  const meta = HOLIDAY_TYPE_META[type] || HOLIDAY_TYPE_META.HOLIDAY;
  const Icon = meta.icon;
  return (
    <span className={`holiday-type-badge ${meta.cls}`}>
      <Icon size={14} className="holiday-type-icon" />
      {meta.label}
    </span>
  );
}

const PAGE_SIZE = 8;
const EMPTY_FORM = { holidayName: '', holidayDate: '', holidayType: '', description: '' };

function formatDate(value, options = {}) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString([], options);
}

export default function Holidays() {
  const { user } = useAuth();
  const canManage = ['HR_ADMIN', 'MANAGER'].includes(user.role);

  const [holidays, setHolidays] = useState([]);
  const [upcoming, setUpcoming] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  async function refresh() {
    setLoading(true);
    try {
        const [holidaysResult, upcomingResult] = await Promise.all([
          getHolidays({ size: 200, active: true }),
          getUpcomingHolidays(),
        ]);
      setHolidays(holidaysResult?.content || []);
      setUpcoming((upcomingResult || [])[0] || null);
    } catch (err) {
      showToast(err?.response?.data?.message || err.message || 'Failed to load holidays.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const values = new Set([current - 1, current, current + 1]);
    holidays.forEach((item) => values.add(new Date(`${item.holidayDate}T00:00:00`).getFullYear()));
    return Array.from(values).sort((a, b) => b - a);
  }, [holidays]);

  const filtered = useMemo(() => holidays
    .filter((item) => String(new Date(`${item.holidayDate}T00:00:00`).getFullYear()) === year)
    .filter((item) => `${item.holidayName} ${item.holidayType} ${item.description || ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => new Date(a.holidayDate) - new Date(b.holidayDate)), [holidays, query, year]);

  const { page, setPage, pageItems, pageSize } = usePagination(filtered, PAGE_SIZE);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormErrors({});
  }

  function validateForm() {
    const errors = {};
    if (!form.holidayName.trim()) errors.holidayName = 'Holiday Name is required';
    if (!form.holidayDate) errors.holidayDate = 'Holiday Date is required';
    if (!form.holidayType) errors.holidayType = 'Holiday Type is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingId) {
        await updateHoliday(editingId, { ...form, attendanceAllowed: false, recurring: false, active: true });
        showToast('Holiday updated successfully.', 'success');
      } else {
        await createHoliday(form);
        showToast('Holiday added successfully.', 'success');
      }
      resetForm();
      await refresh();
    } catch (actionError) {
      showToast(actionError?.response?.data?.message || actionError.message || 'Action failed.', 'error');
    }
  }

  function beginEdit(item) {
    setEditingId(item.id);
    setForm({
      holidayName: item.holidayName,
      holidayDate: item.holidayDate,
      holidayType: item.holidayType,
      description: item.description || '',
    });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(item) {
    const ok = await confirm({
      title: 'Delete holiday',
      message: `Delete "${item.holidayName}"? This can't be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteHoliday(item.id);
      await refresh();
      showToast('Holiday deleted successfully.', 'success');
    } catch (actionError) {
      showToast(actionError?.response?.data?.message || actionError.message || 'Failed to delete holiday.', 'error');
    }
  }

  return (
    <div className="page-stack holidays-page page-reveal">
      <PageHeader eyebrow="Organisation calendar" title="Holiday List" description="View Company Holidays And Plan Attendance And Leave In Advance." />

      <div className="holiday-overview-grid">
        <section className="panel holiday-upcoming-card">
          <CalendarDays size={28} />
          <div>
            <span className="eyebrow">Next Upcoming Holiday</span>
            {upcoming
              ? <><h2>{upcoming.holidayName}</h2><p>{formatDate(upcoming.holidayDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></>
              : <><h2>{loading ? 'Loading…' : 'No Upcoming Holiday'}</h2><p>HR or Manager Can Add The Holiday Calendar.</p></>}
          </div>
        </section>
        <section className="panel holiday-count-card"><strong>{filtered.length}</strong><span>Holidays in {year}</span></section>
      </div>

      {canManage && (
        <section className="panel holiday-form-panel">
          <div className="panel-title">
            <div><span className="eyebrow">{editingId ? 'Update entry' : 'New entry'}</span><h2>{editingId ? 'Edit Holiday' : 'Add Holiday'}</h2></div>
            <div className="holiday-form-header-actions">
              {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel Edit</button>}
              <button className="btn btn-primary" type="submit" form="holiday-form"><Plus size={18} /> {editingId ? 'Save Changes' : 'Add Holiday'}</button>
            </div>
          </div>
          <form id="holiday-form" className="form-grid" onSubmit={submit} noValidate>
            <label>
              Holiday Name
              <input
                value={form.holidayName}
                onChange={(event) => {
                  setForm({ ...form, holidayName: event.target.value });
                  if (formErrors.holidayName) setFormErrors({ ...formErrors, holidayName: undefined });
                }}
                placeholder="e.g. Republic Day"
              />
              {formErrors.holidayName && <p className="field-error">{formErrors.holidayName}</p>}
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.holidayDate}
                onChange={(event) => {
                  setForm({ ...form, holidayDate: event.target.value });
                  if (formErrors.holidayDate) setFormErrors({ ...formErrors, holidayDate: undefined });
                }}
              />
              {formErrors.holidayDate && <p className="field-error">{formErrors.holidayDate}</p>}
            </label>
            <label>
              Type
              <select
                value={form.holidayType}
                onChange={(event) => {
                  setForm({ ...form, holidayType: event.target.value });
                  if (formErrors.holidayType) setFormErrors({ ...formErrors, holidayType: undefined });
                }}
              >
                <option value="" disabled hidden>Select Holiday Type</option>
                <option value="HOLIDAY">Company Holiday</option>
                <option value="PUBLIC_HOLIDAY">National Holiday</option>
                <option value="OPTIONAL_HOLIDAY">Optional Holiday</option>
                <option value="WEEKEND">Weekend</option>
              </select>
              {formErrors.holidayType && <p className="field-error">{formErrors.holidayType}</p>}
            </label>
            <label>
              Description
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional Note" />
            </label>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="holiday-list-toolbar">
          <div className="searchbox holiday-search"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search Holidays" /></div>
          <select className="compact-select" value={year} onChange={(event) => { setYear(event.target.value); setPage(1); }}>{years.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Holiday</th><th>Date</th><th>Day</th><th>Type</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>
              {pageItems.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.holidayName}</strong>{item.description && <small className="table-subtext">{item.description}</small>}</td>
                  <td>{formatDate(item.holidayDate, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td>{formatDate(item.holidayDate, { weekday: 'long' })}</td>
                  <td><HolidayTypeBadge type={item.holidayType} /></td>
                  {canManage && (
                    <td>
                      <div className="holiday-actions">
                        <button type="button" title="Edit Holiday" onClick={() => beginEdit(item)}><Edit3 size={16} /></button>
                        <button type="button" className="danger" title="Delete Holiday" onClick={() => remove(item)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !filtered.length && <p className="empty-inline">No Holidays Added for {year}.</p>}
        </div>
        <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />
      </section>
    </div>
  );
}