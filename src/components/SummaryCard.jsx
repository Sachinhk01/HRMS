import { ArrowUpRight } from 'lucide-react';

export default function SummaryCard({ icon: Icon, label, value, meta, tone = 'blue', onClick }) {
  return (
    <button className={`summary-card tone-${tone}`} onClick={onClick}>
      <div className="summary-icon"><Icon size={20} /></div>
      <div className="summary-copy"><span>{label}</span><strong>{value}</strong>{meta && <small>{meta}</small>}</div>
      <ArrowUpRight className="summary-arrow" size={17} />
    </button>
  );
}
