export default function StatusBadge({ children, tone }) {
  const normalized = (tone || children || '').toString().toLowerCase().replace(/\s+/g, '-');
  return <span className={`status-badge status-${normalized}`}>{children}</span>;
}
