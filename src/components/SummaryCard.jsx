import { ArrowUpRight } from 'lucide-react';

export default function SummaryCard({ icon: Icon, label, value, meta, tone, onClick }) {
  return (
    <button type="button" className={`summary-card tone-${tone || 'blue'}`} onClick={onClick}>
      <div className="summary-icon"><Icon size={22} /></div>
      <div className="summary-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>
      <ArrowUpRight size={18} className="summary-arrow" />
    </button>
  );
}
