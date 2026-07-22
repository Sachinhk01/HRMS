import { useMemo, useState } from 'react';
import { CalendarDays, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { addHoliday, deleteHoliday, getHolidays, getUpcomingHoliday, updateHoliday } from '../services/holidayService';
import './Holidays.css';
import { CalendarHeart, Flag, Gift, Sparkles } from 'lucide-react';

const HOLIDAY_TYPE_META = {
  'Company Holiday': { icon: CalendarHeart, cls: 'type-company' },
  'National Holiday': { icon: Flag, cls: 'type-national' },
  'Festival': { icon: Gift, cls: 'type-festival' },
  'Restricted Holiday': { icon: Sparkles, cls: 'type-restricted' },
};
function HolidayTypeBadge({ type }) {
  const meta = HOLIDAY_TYPE_META[type] || HOLIDAY_TYPE_META['Company Holiday'];
  const Icon = meta.icon;
  return (
    <span className={`holiday-type-badge ${meta.cls}`}>
      <Icon size={14} className="holiday-type-icon" />
      {type}
    </span>
  );
}

const PAGE_SIZE = 8;
const EMPTY_FORM = { name: '', date: '', type: 'Company Holiday', description: '' };

function formatDate(value, options = {}) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString([], options);
}

export default function Holidays() {
  const { user } = useAuth();
  const canManage = ['HR_ADMIN', 'MANAGER'].includes(user.role);
  const [holidays, setHolidays] = useState(() => getHolidays());
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const values = new Set([current - 1, current, current + 1]);
    holidays.forEach((item) => values.add(new Date(`${item.date}T00:00:00`).getFullYear()));
    return Array.from(values).sort((a, b) => b - a);
  }, [holidays]);

  const filtered = useMemo(() => holidays
    .filter((item) => String(new Date(`${item.date}T00:00:00`).getFullYear()) === year)
    .filter((item) => `${item.name} ${item.type} ${item.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => new Date(a.date) - new Date(b.date)), [holidays, query, year]);

  const { page, setPage, pageItems, pageSize } = usePagination(filtered, PAGE_SIZE);
  const upcoming = getUpcomingHoliday();

  function refresh() {
    setHolidays(getHolidays());
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingId) updateHoliday(user, editingId, form);
      else addHoliday(user, form);
      setMessage(editingId ? 'Holiday updated successfully.' : 'Holiday added successfully.');
      resetForm();
      refresh();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  function beginEdit(item) {
    setEditingId(item.id);
    setForm({ name: item.name, date: item.date, type: item.type, description: item.description || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function remove(item) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      deleteHoliday(user, item.id);
      refresh();
      setMessage('Holiday deleted successfully.');
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  return (
    <div className="page-stack holidays-page page-reveal">
      <PageHeader eyebrow="Organisation calendar" title="Holiday List" description="View company holidays and plan attendance and leave in advance." />

      <div className="holiday-overview-grid">
        <section className="panel holiday-upcoming-card">
          <CalendarDays size={28} />
          <div>
            <span className="eyebrow">Next upcoming holiday</span>
            {upcoming ? <><h2>{upcoming.name}</h2><p>{formatDate(upcoming.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></> : <><h2>No upcoming holiday</h2><p>HR or Manager can add the holiday calendar.</p></>}
          </div>
        </section>
        <section className="panel holiday-count-card"><strong>{filtered.length}</strong><span>Holidays in {year}</span></section>
      </div>

      {canManage && (
        <section className="panel holiday-form-panel">
          <div className="panel-title"><div><span className="eyebrow">{editingId ? 'Update entry' : 'New entry'}</span><h2>{editingId ? 'Edit holiday' : 'Add holiday'}</h2></div>{editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel edit</button>}</div>
          <form className="form-grid" onSubmit={submit}>
            <label>Holiday name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Republic Day" required /></label>
            <label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
            <label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Company Holiday</option><option>National Holiday</option><option>Festival</option><option>Restricted Holiday</option></select></label>
            <label>Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional note" /></label>
            <div className="full-span holiday-form-actions"><button className="btn btn-primary" type="submit"><Plus size={18} /> {editingId ? 'Save Changes' : 'Add Holiday'}</button></div>
          </form>
          {message && <div className="success-alert">{message}</div>}{error && <div className="form-alert">{error}</div>}
        </section>
      )}

      <section className="panel">
        <div className="holiday-list-toolbar">
          <div className="searchbox holiday-search"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search holidays" /></div>
          <select className="compact-select" value={year} onChange={(event) => { setYear(event.target.value); setPage(1); }}>{years.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Holiday</th><th>Date</th><th>Day</th><th>Type</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>{pageItems.map((item) => <tr key={item.id}><td><strong>{item.name}</strong>{item.description && <small className="table-subtext">{item.description}</small>}</td><td>{formatDate(item.date, { day: '2-digit', month: 'short', year: 'numeric' })}</td><td>{formatDate(item.date, { weekday: 'long' })}</td><td><HolidayTypeBadge type={item.type} /></td>{canManage && <td><div className="holiday-actions"><button type="button" title="Edit holiday" onClick={() => beginEdit(item)}><Edit3 size={16} /></button><button type="button" className="danger" title="Delete holiday" onClick={() => remove(item)}><Trash2 size={16} /></button></div></td>}</tr>)}</tbody>
          </table>
          {!filtered.length && <p className="empty-inline">No holidays added for {year}.</p>}
        </div>
        <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />
      </section>
    </div>
  );
}
