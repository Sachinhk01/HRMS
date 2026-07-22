import { getSection, setSection } from './localStorageService';
import { createNotification } from './notificationService';

function crud(section) {
  const all = () => getSection(section) || [];
  const save = (value) => setSection(section, value);
  return {
    all,
    create(actor, data) {
      if (actor?.role !== 'HR_ADMIN') throw new Error('Only HR can manage this content.');
      const item = { id: `${section}-${Date.now()}`, ...data, createdBy: actor.id, createdByName: actor.name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      save([item, ...all()]);
      return item;
    },
    remove(actor, id) {
      if (actor?.role !== 'HR_ADMIN') throw new Error('Only HR can manage this content.');
      save(all().filter((item) => item.id !== id));
    },
  };
}

export const announcementStore = crud('announcements');
export const eventStore = crud('events');

const postAll = () => getSection('posts') || [];
const postSave = (value) => setSection('posts', value);

function notifyTaggedUsers(post, actor) {
  (post.taggedMembers || []).filter((member) => member.id !== actor.id).forEach((member) => {
    createNotification({
      userId: member.id,
      title: 'You were tagged in a celebration post',
      message: `${actor.name} tagged you in “${post.title}”.`,
      type: 'MENTION',
      relatedId: post.id,
    });
  });
}

export const postStore = {
  all: postAll,
  create(actor, data) {
    if (actor?.role !== 'HR_ADMIN') throw new Error('Only HR can create celebration posts.');
    const post = {
      id: `posts-${Date.now()}`,
      type: data.type || 'KUDOS',
      title: data.title || data.type || 'Celebration',
      message: data.message || '',
      taggedMembers: data.taggedMembers || [],
      tagAll: Boolean(data.tagAll),
      images: data.images || [],
      likes: [],
      comments: [],
      pinned: Boolean(data.pinned),
      automatic: Boolean(data.automatic),
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    postSave([post, ...postAll()]);
    notifyTaggedUsers(post, actor);
    return post;
  },
  remove(actor, id) {
    if (actor?.role !== 'HR_ADMIN') throw new Error('Only HR can delete celebration posts.');
    postSave(postAll().filter((item) => item.id !== id));
  },
  toggleLike(actor, id) {
    let updated;
    postSave(postAll().map((post) => {
      if (post.id !== id) return post;
      const likes = post.likes || [];
      const exists = likes.some((like) => like.userId === actor.id);
      updated = { ...post, likes: exists ? likes.filter((like) => like.userId !== actor.id) : [...likes, { userId: actor.id, userName: actor.name, createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() };
      return updated;
    }));
    return updated;
  },
  addComment(actor, id, message) {
    if (!message?.trim()) throw new Error('Comment cannot be empty.');
    let updated;
    postSave(postAll().map((post) => {
      if (post.id !== id) return post;
      updated = { ...post, comments: [...(post.comments || []), { id: `comment-${Date.now()}`, userId: actor.id, userName: actor.name, message: message.trim(), createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() };
      return updated;
    }));
    return updated;
  },
  togglePin(actor, id) {
    if (actor?.role !== 'HR_ADMIN') throw new Error('Only HR can pin posts.');
    let updated;
    postSave(postAll().map((post) => {
      if (post.id !== id) return post;
      updated = { ...post, pinned: !post.pinned, updatedAt: new Date().toISOString() };
      return updated;
    }));
    return updated;
  },
};

export function ensureAutomaticCelebrations(actor, members = []) {
  if (actor?.role !== 'HR_ADMIN') return [];
  const today = new Date();
  const monthDay = today.toISOString().slice(5, 10);
  const dateKey = today.toISOString().slice(0, 10);
  const existing = postAll();
  const created = [];
  members.forEach((member) => {
    const birthdayMatch = member.dob && member.dob.slice(5, 10) === monthDay;
    const anniversaryMatch = member.dateOfJoining && member.dateOfJoining.slice(5, 10) === monthDay;
    const specs = [
      birthdayMatch && { type: 'BIRTHDAY', title: `Happy Birthday ${member.name}!`, message: 'Wishing you a wonderful year ahead.', key: `birthday-${member.id}-${dateKey}` },
      anniversaryMatch && { type: 'WORK ANNIVERSARY', title: `Happy Work Anniversary ${member.name}!`, message: 'Thank you for your contribution and commitment.', key: `anniversary-${member.id}-${dateKey}` },
    ].filter(Boolean);
    specs.forEach((spec) => {
      if (existing.some((post) => post.automaticKey === spec.key)) return;
      const post = {
        id: `posts-auto-${Date.now()}-${member.id}`,
        type: spec.type,
        title: spec.title,
        message: spec.message,
        taggedMembers: [{ id: member.id, name: member.name, email: member.email }],
        images: [], likes: [], comments: [], pinned: false, automatic: true, automaticKey: spec.key,
        createdBy: actor.id, createdByName: 'MyHourly HRMS', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      existing.unshift(post); created.push(post); notifyTaggedUsers(post, actor);
    });
  });
  if (created.length) postSave(existing);
  return created;
}
