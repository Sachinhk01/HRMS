import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalItems, pageSize = 5, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="pagination" aria-label="Pagination">
      <span>{start}–{end} of {totalItems}</span>
      <div className="pagination-actions">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={17} />
        </button>
        <strong>Page {page} of {totalPages}</strong>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
