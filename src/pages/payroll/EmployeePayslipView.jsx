import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Building2, CreditCard, Download, FileText, Hash, Landmark, ShieldCheck, WalletCards } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { getMyProfile } from "../../services/employeeService";
import {
  downloadPayslip,
  formatINR,
  getPaymentDetails,
  getPayrollByEmployee,
  payrollMonthLabel,
  triggerBlobDownload,
} from "../../services/payrollService";
import { AttendanceSection, DeductionsSection, EarningsSection, EmptyState, PayrollBadge } from "./payrollUi";

const MODE_LABELS = {
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  CASH: "Cash",
};

export default function EmployeePayslipView() {
  const { user } = useAuth();
  const [employeeId, setEmployeeId] = useState(user?.employeeId || user?.employee?.id || null);

  const [payslips, setPayslips] = useState([]);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let profile = null;
      try { profile = await getMyProfile(); } catch { profile = null; }

      const candidateIds = [
        user?.employeeId,
        user?.employee?.id,
        profile?.employeeId,
        profile?.employee?.id,
        profile?.id,
        user?.id,
      ].filter((value, index, values) => value != null && value !== "" && values.indexOf(value) === index);

      if (!candidateIds.length) {
        setEmployeeId(null);
        setPayslips([]);
        setPayment(null);
        setError("Employee Profile Could Not Be Resolved.");
        return;
      }

      let resolvedId = candidateIds[0];
      let records = [];
      let details = null;
      let lastError = null;

      for (const candidateId of candidateIds) {
        try {
          const history = await getPayrollByEmployee(candidateId);
          resolvedId = candidateId;
          records = Array.isArray(history) ? history : [];
          try { details = await getPaymentDetails(candidateId); } catch { details = null; }
          if (records.length || details) break;
        } catch (err) {
          lastError = err;
        }
      }

      setEmployeeId(resolvedId);
      setPayslips(records);
      setPayment(details);
      if (!records.length && lastError) {
        setError(lastError.message || "Unable To Load Payslips.");
      }
    } catch (err) {
      setPayslips([]);
      setPayment(null);
      setError(err.message || "Failed To Load Your Payslips.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => [...payslips].sort((a, b) => new Date(b.payrollMonth) - new Date(a.payrollMonth)),
    [payslips],
  );

  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(
    () => sorted.find((item) => item.id === selectedId) || sorted[0] || null,
    [sorted, selectedId],
  );
  useEffect(() => { setSelectedId(null); }, [sorted.length]);

  const latest = sorted[0] || null;
  const paidCount = sorted.filter((item) => item.status === "PAID").length;
  const totalPaid = sorted
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + Number(item.netPayable || 0), 0);

  async function handleDownload(item) {
    if (!item || downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadPayslip(item.id);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err.message || "Failed to download payslip.");
    } finally {
      setDownloading(false);
    }
  }

  if (!employeeId) {
    return (
      <div className="payroll-page">
        <PageHeader title="Payroll" description="Your payslips and payment details." />
        <EmptyState icon={FileText} title="Sign in to view your payslips" note="Your payslips appear here once you log in." />
      </div>
    );
  }

  return (
    <div className="payroll-page">
      <PageHeader
        eyebrow="Payroll"
        title="My Payslips"
        description="Your salary slips, earnings breakdown and payment details."
      />

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <div className="panel"><div className="skeleton-line" style={{ height: 120 }} /></div>
      ) : sorted.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={FileText}
            title="No payslips yet"
            note="Once payroll is processed, your payslips will appear here."
          />
        </div>
      ) : (
        <>
          <div className="payroll-summary-grid">
            <div className="panel payroll-summary-card tone-blue">
              <span className="summary-icon"><Banknote size={20} /></span>
              <span>Latest Net Pay</span>
              <strong>{formatINR(latest?.netPayable)}</strong>
              <small>{latest ? payrollMonthLabel(latest.payrollMonth) : "—"}</small>
            </div>
            <div className="panel payroll-summary-card tone-green">
              <span className="summary-icon"><WalletCards size={20} /></span>
              <span>Payslips Issued</span>
              <strong>{sorted.length}</strong>
              <small>All payroll records</small>
            </div>
            <div className="panel payroll-summary-card tone-orange">
              <span className="summary-icon"><CreditCard size={20} /></span>
              <span>Paid Months</span>
              <strong>{paidCount}</strong>
              <small>Marked as paid</small>
            </div>
            <div className="panel payroll-summary-card tone-pink">
              <span className="summary-icon"><Banknote size={20} /></span>
              <span>Total Paid</span>
              <strong>{formatINR(totalPaid)}</strong>
              <small>Across paid months</small>
            </div>
          </div>

          <div className="payroll-layout">
            <section className="panel pay-hero">
              <Banknote size={56} strokeWidth={1.4} />
              <div className="pay-hero-copy">
                <span>{selected ? payrollMonthLabel(selected.payrollMonth) : ""}</span>
                <strong>{formatINR(selected?.netPayable)}</strong>
                <p>
                  {selected?.payrollNumber} · Net payable after {formatINR(selected?.totalDeduction)} in deductions.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="compact-select payslip-selector"
                  value={selected?.id || ""}
                  onChange={(event) => setSelectedId(Number(event.target.value))}
                >
                  {sorted.map((item) => (
                    <option key={item.id} value={item.id}>
                      {payrollMonthLabel(item.payrollMonth)} · {item.status}
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={() => handleDownload(selected)} disabled={downloading}>
                  <Download size={15} /> {downloading ? "Downloading…" : "Payslip"}
                </button>
              </div>
            </section>

            <EarningsSection data={selected} />
            <DeductionsSection data={selected} />
          </div>

          {selected && (
            <section className="panel">
              <div className="panel-title"><h2>Attendance Summary</h2></div>
              <AttendanceSection data={selected} />
            </section>
          )}

          <section className="panel">
            <div className="panel-title">
              <h2>Payment Details</h2>
              <PayrollBadge status={payment?.paymentMode} />
            </div>
            {payment ? (
              <div className="pay-details-grid">
                <div className="pay-detail-item">
                  <span><Landmark size={12} /> Bank</span>
                  <strong>{payment.bankName || "—"}</strong>
                </div>
                <div className="pay-detail-item">
                  <span><Hash size={12} /> Account Number</span>
                  <strong>{payment.accountNumber ? `•••• ${payment.accountNumber.slice(-4)}` : "—"}</strong>
                </div>
                <div className="pay-detail-item">
                  <span><Building2 size={12} /> IFSC</span>
                  <strong>{payment.ifscCode || "—"}</strong>
                </div>
                <div className="pay-detail-item">
                  <span><WalletCards size={12} /> Payment Mode</span>
                  <strong>{MODE_LABELS[payment.paymentMode] || payment.paymentMode || "—"}</strong>
                </div>
                <div className="pay-detail-item">
                  <span><ShieldCheck size={12} /> PAN</span>
                  <strong>{payment.panNumber || "—"}</strong>
                </div>
                <div className="pay-detail-item">
                  <span><Hash size={12} /> UAN / PF / ESI</span>
                  <strong>{[payment.uanNumber, payment.pfNumber, payment.esiNumber].filter(Boolean).join(" · ") || "—"}</strong>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Landmark}
                title="No payment details on file"
                note="Please contact HR to update your bank and tax details."
              />
            )}
          </section>

          <section className="panel">
            <div className="panel-title"><h2>Payslip History</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Payroll Number</th>
                    <th>Status</th>
                    <th>Gross</th>
                    <th>Deductions</th>
                    <th>Net Pay</th>
                    <th style={{ textAlign: "right" }}>Payslip</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr key={item.id} className={selected?.id === item.id ? "row-active" : ""}>
                      <td><strong>{payrollMonthLabel(item.payrollMonth)}</strong></td>
                      <td>{item.payrollNumber}</td>
                      <td><PayrollBadge status={item.status} /></td>
                      <td>{formatINR(item.grossSalary)}</td>
                      <td>{formatINR(item.totalDeduction)}</td>
                      <td><strong>{formatINR(item.netPayable)}</strong></td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(item)} disabled={downloading}>
                          <Download size={14} /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
