import { useMemo, useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { eventStore } from '../services/contentService';

export default function Events() {
  const { user } = useAuth(); const [rows, setRows] = useState(eventStore.all());
  const ordered = useMemo(() => sortRecent(rows), [rows]); const { page, setPage, pageItems, pageSize } = usePagination(ordered, 5);
  const submit = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); eventStore.create(user, { title: form.get('title'), date: form.get('date'), location: form.get('location'), description: form.get('description') }); event.currentTarget.reset(); setRows(eventStore.all()); setPage(1); };
  return <div className="page-stack"><PageHeader eyebrow="HR Content" title="Events" description="Create and manage company events." /><section className="panel"><form className="form-grid" onSubmit={submit}><label>Event title<input name="title" required /></label><label>Date<input name="date" type="date" required /></label><label>Location<input name="location" /></label><label className="full-span">Description<textarea name="description" rows="4" required /></label><button className="btn btn-primary full-span"><CalendarPlus size={17} />Create event</button></form></section><section className="cards-list">{pageItems.map((item) => <article className="panel content-card" key={item.id}><div><h3>{item.title}</h3><p>{item.description}</p><small>{item.date} {item.location && `• ${item.location}`}</small></div><button className="icon-btn danger" onClick={() => { eventStore.remove(user, item.id); setRows(eventStore.all()); }}><Trash2 size={17} /></button></article>)}{!ordered.length && <section className="panel"><p className="empty-inline">No events yet.</p></section>}</section><Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} /></div>;
}
