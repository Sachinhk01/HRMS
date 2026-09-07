import { formatINR } from "../../services/payrollService";

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

export function DeductionsSection({ data }) {
  const rows = [
    ["LOP Amount", data?.lopAmount],
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

export function AttendanceSection({ data }) {
  const cells = [
    ["Total Working Days", data?.totalWorkingDays],
    ["Worked Days", data?.workedDays],
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
