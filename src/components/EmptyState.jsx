import { Inbox } from 'lucide-react';
export default function EmptyState({ title = 'Nothing here yet', text = 'New items will appear here.' }) {
  return <div className="empty-state"><Inbox size={34} /><strong>{title}</strong><p>{text}</p></div>;
}
