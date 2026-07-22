import { useMemo, useState } from 'react';
import { Megaphone, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { announcementStore } from '../services/contentService';

export default function Announcements() {
  const { user } = useAuth(); const [rows, setRows] = useState(announcementStore.all());
  const ordered = useMemo(() => sortRecent(rows), [rows]); const { page, setPage, pageItems, pageSize } = usePagination(ordered, 5);
  const submit = (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); announcementStore.create(user, { title: form.get('title'), message: form.get('message') }); event.currentTarget.reset(); setRows(announcementStore.all()); setPage(1); };
  return <div className="page-stack"><PageHeader eyebrow="HR Content" title="Announcements" description="Publish important company updates for employees." /><section className="panel"><form className="form-grid" onSubmit={submit}><label>Title<input name="title" required /></label><label className="full-span">Message<textarea name="message" rows="4" required /></label><button className="btn btn-primary full-span"><Megaphone size={17} />Publish announcement</button></form></section><section className="cards-list">{pageItems.map((item) => <article className="panel content-card" key={item.id}><div><h3>{item.title}</h3><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div><button className="icon-btn danger" onClick={() => { announcementStore.remove(user, item.id); setRows(announcementStore.all()); }}><Trash2 size={17} /></button></article>)}{!ordered.length && <section className="panel"><p className="empty-inline">No announcements yet.</p></section>}</section><Pagination page={page} totalItems={ordered.length} pageSize={pageSize} onPageChange={setPage} /></div>;
}
