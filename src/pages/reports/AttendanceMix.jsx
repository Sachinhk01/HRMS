// MISSED_CHECKOUT has no counter in the backend summary, so it lands in "Other".
export default function AttendanceMix({ summary }) {
  const total = summary.totalRecords || 0;
  if (!total) return null;
  const known = [
    ['Present', summary.presentCount, '#16a34a'],
    ['Late', summary.lateCount, '#d97706'],
    ['Half Day', summary.halfDayCount, '#f97316'],
    ['Absent', summary.absentCount, '#dc2626'],
    ['Leave', summary.leaveCount, '#2563eb'],
    ['Holiday', summary.holidayCount, '#7c3aed'],
    ['Weekend', summary.weekendCount, '#94a3b8'],
  ];
  const other = Math.max(0, total - known.reduce((sum, [, n]) => sum + (n || 0), 0));
  const parts = [...known, ['Other', other, '#cbd5e1']].filter(([, n]) => n > 0);
  return (
    <div className="rx-mix">
      <div className="rx-mix-bar" role="img" aria-label="Attendance status mix">
        {parts.map(([label, n, color]) => (
          <span key={label} style={{ width: `${(n / total) * 100}%`, background: color }} title={`${label}: ${n}`} />
        ))}
      </div>
      <div className="rx-mix-legend">
        {parts.map(([label, n, color]) => (
          <span key={label}><i style={{ background: color }} />{label} ({n})</span>
        ))}
      </div>
    </div>
  );
}