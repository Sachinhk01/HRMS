import { useEffect, useMemo, useState } from 'react';

export function sortRecent(items = [], dateField = 'createdAt') {
  return [...items].sort((a, b) => {
    const aValue = new Date(a?.[dateField] || a?.date || 0).getTime();
    const bValue = new Date(b?.[dateField] || b?.date || 0).getTime();
    return bValue - aValue;
  });
}

export default function usePagination(items = [], pageSize = 5) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return { page, setPage, pageItems, totalPages, pageSize };
}
