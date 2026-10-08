import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { formatINR } from "../../services/payrollService";

// Counts up to `value` (respects reduced-motion). `format` renders each frame.
export function AnimatedNumber({ value, format = (n) => String(n) }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setShown(target);
      return undefined;
    }
    const controls = animate(from.current, target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { from.current = v; setShown(v); },
    });
    return () => controls.stop();
  }, [target]);

  return <>{format(Math.round(shown))}</>;
}

export function PayrollBadge({ status }) {
  const label = status || "—";
  return <span className={`payroll-badge st-${label}`}>{label}</span>;
}

export function LineItem({ label, value, total = false }) {
  return (
    <div className={`payroll-line-item${total ? " total" : ""}`}>
      <span>{label}</span>
      <strong>{formatINR(value)}</strong>
    </div>
  );
}

export function EarningsSection({ data }) {
  const rows = [
    ["Basic Salary", data?.basicSalary],
    ["HRA", data?.hra],
    ["Special Allowance", data?.specialAllowance],
    ["Medical Allowance", data?.medicalAllowance],
    ["Travel Allowance", data?.travelAllowance],
    ["Bonus", data?.bonus],
    ["Other Allowance", data?.otherAllowance],
  ];
  return (
    <section className="panel line-items">
      <div className="panel-title"><h2>Earnings</h2></div>
      {rows.map(([label, value]) => (
        <LineItem key={label} label={label} value={value} />
      ))}
      <LineItem label="Gross Salary" value={data?.grossSalary} total />
    </section>
  );
}

// The payroll response carries the stored Total Deductions (which already
// include the half-day deduction) but not the half-day line itself, so derive
// it as: total - (all the other listed deductions). This matches the backend
// total and keeps the UI consistent with the server response.
export function getHalfDayDeduction(data) {
  if (data?.halfDaysAmount != null) return Number(data.halfDaysAmount) || 0;
  if (data?.totalDeduction == null) return 0;
  const others = [data.lopAmount, data.pf, data.esi, data.professionalTax, data.incomeTax, data.otherDeduction]
    .reduce((sum, value) => sum + (Number(value) || 0), 0);
  return Math.max(0, Math.round((Number(data.totalDeduction) - others) * 100) / 100);
}

export function DeductionsSection({ data }) {
  const rows = [
    ["LOP Amount", data?.lopAmount],
    ["Half Day Deduction", getHalfDayDeduction(data)],
    ["Provident Fund (PF)", data?.pf],
    ["ESI", data?.esi],
    ["Professional Tax", data?.professionalTax],
    ["Income Tax", data?.incomeTax],
    ["Other Deduction", data?.otherDeduction],
  ];
  return (
    <section className="panel line-items">
      <div className="panel-title"><h2>Deductions</h2></div>
      {rows.map(([label, value]) => (
        <LineItem key={label} label={label} value={value} />
      ))}
      <LineItem label="Total Deductions" value={data?.totalDeduction} total />
      <div className="payroll-net-row" style={{ marginTop: 12 }}>
        <span>Net Payable</span>
        <strong>{formatINR(data?.netPayable)}</strong>
      </div>
    </section>
  );
}

export function AttendanceSection({ data, halfDays }) {
  const cells = [
    ["Total Working Days", data?.totalWorkingDays],
    ["Worked Days", data?.workedDays],
    ["Half Days", halfDays ?? data?.halfDays],
    ["LOP Days", data?.lopDays],
    ["Payable Days", data?.payableDays],
  ];
  return (
    <div className="payroll-detail-grid">
      {cells.map(([label, value]) => (
        <div className="pay-detail-item" key={label}>
          <span>{label}</span>
          <strong>{value ?? "—"}</strong>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, note }) {
  return (
    <div className="payroll-empty">
      {Icon && <Icon size={40} />}
      <strong>{title}</strong>
      {note && <p>{note}</p>}
    </div>
  );
}

export function StatusFilter({ value, onChange, counts = {} }) {
  const options = [
    ["ACTIVE", "Active"],
    ["INACTIVE", "Inactive"],
    ["ALL", "All"],
  ];
  return (
    <div className="payroll-status-filter" role="group" aria-label="Filter by status">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={value === key ? "is-active" : ""}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label}
          {counts[key] != null && <span>{counts[key]}</span>}
        </button>
      ))}
    </div>
  );
}