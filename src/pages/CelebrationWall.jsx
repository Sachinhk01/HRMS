import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, PartyPopper, Pin, Send, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import usePagination, { sortRecent } from '../hooks/usePagination';
import { useAuth } from '../context/AuthContext';
import { announcementStore, ensureAutomaticCelebrations, eventStore, postStore } from '../services/contentService';
import { getEmployees } from '../services/employeeService';
import './CelebrationWall.css';

const types = ['ALL', 'BIRTHDAY', 'WORK ANNIVERSARY', 'FESTIVAL', 'NEW JOINER', 'KUDOS'];

function TaggedMessage({ post }) {
  return <span>{post.message}{post.tagAll ? <span className="member-tag all-members-tag"><Users size={13}/>All Employees</span> : (post.taggedMembers || []).map((member) => <Link className="member-tag" key={member.id} to={`/profile?user=${member.id}`}>@{member.name}</Link>)}</span>;
}

export default function CelebrationWall() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(postStore.all());
  const [active, setActive] = useState('ALL');
  const [text, setText] = useState('');
  const [type, setType] = useState('BIRTHDAY');
  const [tagIds, setTagIds] = useState([]);
  const [tagAll, setTagAll] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [imageText, setImageText] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const isHr = user.role === 'HR_ADMIN';
  const members = getEmployees().filter((member) => member.id !== user.id && member.active !== false);
  const filteredMembers = members.filter((member) => {
    const term = memberSearch.trim().toLowerCase();
    return !term || member.name?.toLowerCase().includes(term) || member.email?.toLowerCase().includes(term);
  });
  useEffect(() => { if (isHr && ensureAutomaticCelebrations(user, getEmployees()).length) setPosts(postStore.all()); }, []);
  const visible = useMemo(() => {
    const filtered = active === 'ALL' ? posts : posts.filter((item) => item.type === active);
    return sortRecent(filtered).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [posts, active]);
  const { page, setPage, pageItems, pageSize } = usePagination(visible, 5);

  const refresh = () => setPosts(postStore.all());
  const publish = () => {
    if (!text.trim()) return;
    const taggedMembers = (tagAll ? members : members.filter((member) => tagIds.includes(member.id))).map(({ id, name, email }) => ({ id, name, email }));
    const images = imageText.split(/[,\n]/).map((value) => value.trim()).filter(Boolean).slice(0, 6);
    postStore.create(user, { type, title: type, message: text.trim(), taggedMembers, tagAll, images });
    refresh(); setText(''); setTagIds([]); setTagAll(false); setMemberSearch(''); setImageText(''); setPage(1);
  };
  const announcements = sortRecent(announcementStore.all()).slice(0, 4);
  const events = sortRecent(eventStore.all()).slice(0, 4);

  return <div className="page-stack celebration-page page-reveal"><PageHeader eyebrow="People & Culture" title="Celebration Wall" description={isHr ? 'Create posts, tag members, add images, pin highlights and celebrate together.' : 'View, like and comment on company celebrations.'} />
    <div className="celebration-layout"><div className="feed-column">
      {isHr && <section className="panel composer"><div className="composer-row"><select value={type} onChange={(event) => setType(event.target.value)}>{types.slice(1).map((item) => <option key={item}>{item}</option>)}</select><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a birthday wish or celebration post..." /><button className="btn btn-primary btn-icon" onClick={publish}><Send size={17} /></button></div>
        <div className="tagging-panel"><div className="tagging-title"><Users size={16}/><strong>Tag members</strong><span>{tagAll ? `All ${members.length} selected` : `${tagIds.length} selected`}</span></div>
          <div className="tagging-controls"><label className={tagAll ? 'tag-chip tag-all-chip selected' : 'tag-chip tag-all-chip'}><input type="checkbox" checked={tagAll} onChange={(event) => { const checked = event.target.checked; setTagAll(checked); if (checked) setTagIds([]); }}/><Users size={14}/><span>All Employees</span></label><input className="member-search" type="search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members..." disabled={tagAll}/></div>
          <div className="tag-chip-list">{filteredMembers.map((member) => <label className={tagIds.includes(member.id) ? 'tag-chip selected' : 'tag-chip'} key={member.id}><input type="checkbox" disabled={tagAll} checked={tagIds.includes(member.id)} onChange={() => { setTagAll(false); setTagIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id]); }}/><span>@{member.name}</span></label>)}{!filteredMembers.length && <span className="tag-empty">No members found.</span>}</div></div>
        <label className="image-url-field">Image URLs <small>(comma or new-line separated, up to 6)</small><textarea value={imageText} onChange={(event) => setImageText(event.target.value)} placeholder="https://.../photo-1.jpg, https://.../photo-2.jpg" /></label>
      </section>}
      <div className="tabs">{types.map((item) => <button key={item} className={active === item ? 'active' : ''} onClick={() => { setActive(item); setPage(1); }}>{item}</button>)}</div>
      <div className="feed-list">{pageItems.map((post) => <article className={post.pinned ? 'panel post-card pinned-post' : 'panel post-card'} key={post.id}><div className="post-head"><div className="mini-avatar blue">{post.createdByName?.slice(0,2).toUpperCase()}</div><div><strong>{post.createdByName}</strong><span>{new Date(post.createdAt).toLocaleString()}</span></div>{post.pinned && <span className="pinned-label"><Pin size={13}/>Pinned</span>}{isHr && <div className="post-admin-actions"><button className="icon-btn" title="Pin post" onClick={() => { postStore.togglePin(user, post.id); refresh(); }}><Pin size={16}/></button><button className="icon-btn danger" onClick={() => { postStore.remove(user, post.id); refresh(); }}><Trash2 size={16}/></button></div>}</div>
        <div className="thumbnail birthday-thumb"><PartyPopper size={34}/><strong>{post.title}</strong><TaggedMessage post={post}/></div>
        {!!post.images?.length && <div className="post-image-grid">{post.images.map((src, index) => <img src={src} alt={`${post.title} ${index + 1}`} key={`${src}-${index}`} onError={(event) => { event.currentTarget.style.display='none'; }}/>)}</div>}
        <div className="post-actions"><button className={(post.likes || []).some((like) => like.userId === user.id) ? 'active' : ''} onClick={() => { postStore.toggleLike(user, post.id); refresh(); }}><Heart size={17}/>{post.likes?.length || 0} Like</button><button><MessageCircle size={17}/>{post.comments?.length || 0} Comments</button></div>
        <div className="comment-list">{(post.comments || []).slice(-3).map((comment) => <div key={comment.id}><strong>{comment.userName}</strong><span>{comment.message}</span></div>)}</div>
        <div className="comment-composer"><input value={commentDrafts[post.id] || ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Write a comment..."/><button className="icon-btn" onClick={() => { const value = commentDrafts[post.id]; if (!value?.trim()) return; postStore.addComment(user, post.id, value); setCommentDrafts((current) => ({ ...current, [post.id]: '' })); refresh(); }}><Send size={16}/></button></div>
      </article>)}{!visible.length && <section className="panel"><p className="empty-inline">No celebration posts yet.</p></section>}</div>
      <Pagination page={page} totalItems={visible.length} pageSize={pageSize} onPageChange={setPage}/></div>
      <aside className="celebration-side"><section className="panel"><div className="panel-title"><h2>Announcements</h2></div>{announcements.map((item) => <div className="side-content" key={item.id}><strong>{item.title}</strong><span>{item.message}</span></div>)}{!announcements.length && <p className="empty-inline">No announcements.</p>}</section><section className="panel"><div className="panel-title"><h2>Upcoming events</h2></div>{events.map((item) => <div className="side-content" key={item.id}><strong>{item.title}</strong><span>{item.date}{item.location ? ` • ${item.location}` : ''}</span></div>)}{!events.length && <p className="empty-inline">No events.</p>}</section></aside>
    </div></div>;
}
