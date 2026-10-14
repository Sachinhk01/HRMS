import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Building2, CreditCard, Download, FileText, Hash, Landmark, ShieldCheck, WalletCards } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { getMyProfile } from "../../services/employeeService";
import {
  downloadPayslip, formatINR, getPaymentDetails, getPayrollByEmployee,
  payrollMonthLabel, triggerBlobDownload,
} from "../../services/payrollService";
import { AttendanceSection, DeductionsSection, EarningsSection, EmptyState, PayrollBadge } from "./payrollUi";

const MODE_LABELS = { BANK_TRANSFER: "Bank transfer", UPI: "UPI", CHEQUE: "Cheque", CASH: "Cash" };

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } } };
const rowStagger = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } };
const rowIn = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE_OUT } } };

const share = (value, total) => (total > 0 ? Math.max(0, Math.min(100, (Number(value || 0) / total) * 100)) : 0);
const money = (n) => formatINR(n);

function Line({ label, value, total }) {
  return (
    <motion.li className={`sal-line${Number(value) ? "" : " is-zero"}`} variants={rowIn}>
      <span>{label}</span>
      <strong><AnimatedNumber value={value} format={money} /></strong>
      <i className="sal-line-bar">
        <motion.b initial={{ width: 0 }} animate={{ width: `${share(value, total)}%` }} transition={{ duration: 0.9, delay: 0.2, ease: EASE_OUT }} />
      </i>
    </motion.li>
  );
}

function Breakdown({ title, rows, totalLabel, totalValue, barTotal, tone, children }) {
  return (
    <motion.section className={`sal-panel sal-breakdown sal-${tone}`} variants={rise}>
      <h2>{title}</h2>
      <motion.ul variants={rowStagger} initial="hidden" animate="show">
        {rows.map(([label, value]) => <Line key={label} label={label} value={value} total={barTotal} />)}
      </motion.ul>
      <div className="sal-total"><span>{totalLabel}</span><strong><AnimatedNumber value={totalValue} format={money} /></strong></div>
      {children}
    </motion.section>
  );
}

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
        user?.employeeId, user?.employee?.id, profile?.employeeId, profile?.employee?.id, profile?.id, user?.id,
      ].filter((value, index, values) => value != null && value !== "" && values.indexOf(value) === index);

      if (!candidateIds.length) {
        setEmployeeId(null); setPayslips([]); setPayment(null);
        setError("Employee profile could not be resolved.");
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
        } catch (err) { lastError = err; }
      }
      setEmployeeId(resolvedId);
      setPayslips(records);
      setPayment(details);
      if (!records.length && lastError) setError(lastError.message || "Unable to load payslips.");
    } catch (err) {
      setPayslips([]); setPayment(null);
      setError(err.message || "Failed to load your payslips.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => payslips.filter((i) => i.status === "PAID").sort((a, b) => new Date(b.payrollMonth) - new Date(a.payrollMonth)),
    [payslips],
  );
  const selected = useMemo(() => sorted.find((i) => i.id === selectedId) || sorted[0] || null, [sorted, selectedId]);
  useEffect(() => { setSelectedId(null); }, [sorted.length]);

  const latest = sorted[0] || null;
  const totalPaid = sorted.reduce((sum, i) => sum + Number(i.netPayable || 0), 0);

  async function handleDownload(item, source) {
    if (!item || downloading) return;
    setDownloadError(null);

    if (!DOWNLOADABLE_STATUSES.includes(String(item.status || "").toUpperCase())) {
      setDownloadError({ id: item.id, source, message: payslipBlockedMessage(item) });
      return;
    }

    setDownloading(true);
    try {
      const { blob, filename } = await downloadPayslip(item.id);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setDownloadError({ id: item.id, source, message: await readDownloadError(err) });
    } finally {
      setDownloading(false);
    }
  }

  const hero = (
    <header className="sal-title">
      <h1>My salary</h1>
      <p>Your payslips, earnings breakdown and payment details.</p>
    </header>
  );

  if (!employeeId) {
    return (
      <div className="sal-page">{hero}
        <EmptyState icon={FileText} title="Sign in to view your payslips" note="Your payslips appear here once you log in." />
      </div>
    );
  }
  if (loading) {
    return (
      <div className="sal-page">{hero}
        <div className="sal-top"><div className="sal-skeleton" style={{ height: 250 }} /><div className="sal-skeleton" style={{ height: 250 }} /></div>
        <div className="sal-split"><div className="sal-skeleton" style={{ height: 340 }} /><div className="sal-skeleton" style={{ height: 340 }} /></div>
      </div>
    );
  }
  if (!sorted.length) {
    return (
      <div className="sal-page">{hero}
        {error && <div className="sal-error">{error}</div>}
        <div className="sal-panel">
          <EmptyState icon={FileText} title="No paid payslips yet" note="Your payslip appears here once your salary has been paid." />
        </div>
      </div>
    );
  }

  const gross = Number(selected?.grossSalary || 0);
  const deductions = Number(selected?.totalDeduction || 0);
  const netPct = share(selected?.netPayable, gross);

  const earningRows = [
    ["Basic salary", selected?.basicSalary], ["HRA", selected?.hra], ["Special allowance", selected?.specialAllowance],
    ["Medical allowance", selected?.medicalAllowance], ["Travel allowance", selected?.travelAllowance],
    ["Bonus", selected?.bonus], ["Other allowance", selected?.otherAllowance],
  ];
  const deductionRows = [
    ["LOP amount", selected?.lopAmount], ["Half day deduction", getHalfDayDeduction(selected)],
    ["Provident fund (PF)", selected?.pf], ["ESI", selected?.esi], ["Professional tax", selected?.professionalTax],
    ["Income tax", selected?.incomeTax], ["Other deduction", selected?.otherDeduction],
  ];
  const attendance = [
    [CalendarDays, "Working days", selected?.totalWorkingDays], [UserCheck, "Worked days", selected?.workedDays],
    [Clock, "Half days", selected?.halfDays], [CalendarX, "LOP days", selected?.lopDays],
    [WalletCards, "Payable days", selected?.payableDays],
  ];
  const stats = [
    { tone: "blue", icon: Banknote, label: "Latest paid salary", node: <AnimatedNumber value={latest?.netPayable} format={money} />, note: payrollMonthLabel(latest?.payrollMonth) },
    { tone: "amber", icon: CalendarCheck, label: "Paid months", node: <AnimatedNumber value={sorted.length} />, note: "Marked as paid" },
    { tone: "violet", icon: TrendingUp, label: "Total paid", node: <AnimatedNumber value={totalPaid} format={money} />, note: "Across paid months" },
  ];
  const details = payment && [
    [Landmark, "Bank", payment.bankName || "—"],
    [Hash, "Account number", payment.accountNumber ? `•••• ${payment.accountNumber.slice(-4)}` : "—"],
    [Building2, "IFSC", payment.ifscCode || "—"],
    [WalletCards, "Payment mode", MODE_LABELS[payment.paymentMode] || payment.paymentMode || "—"],
    [ShieldCheck, "PAN", payment.panNumber || "—"],
    [Hash, "UAN / PF / ESI", [payment.uanNumber, payment.pfNumber, payment.esiNumber].filter(Boolean).join(" · ") || "—"],
  ];

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="sal-page" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={rise}>{hero}</motion.div>
        {error && <div className="sal-error">{error}</div>}

        <div className="sal-top">
          <motion.section className="sal-net" variants={rise}>
            <div className="sal-net-head">
              <span>Net pay</span>
              <select value={selected?.id || ""} onChange={(e) => setSelectedId(Number(e.target.value))} aria-label="Choose payslip month">
                {sorted.map((i) => <option key={i.id} value={i.id}>{payrollMonthLabel(i.payrollMonth)}</option>)}
              </select>
            </div>
            <strong className="sal-net-amount"><AnimatedNumber value={selected?.netPayable} format={money} /></strong>
            <p>{selected?.payrollNumber} · Gross {money(gross)} less {money(deductions)} in deductions</p>

            <div className="sal-split-bar" role="img" aria-label={`Take-home ${Math.round(netPct)} percent, deductions ${Math.round(100 - netPct)} percent`}>
              <motion.i className="is-net" initial={{ width: 0 }} animate={{ width: `${netPct}%` }} transition={{ duration: 1.1, delay: 0.3, ease: EASE_OUT }} />
              <motion.i className="is-ded" initial={{ width: 0 }} animate={{ width: `${gross ? 100 - netPct : 0}%` }} transition={{ duration: 1.1, delay: 0.3, ease: EASE_OUT }} />
            </div>
            <div className="sal-split-legend"><span><b className="is-net" />Take-home {Math.round(netPct)}%</span><span><b className="is-ded" />Deductions {Math.round(gross ? 100 - netPct : 0)}%</span></div>

            <motion.button type="button" className="sal-download" onClick={() => handleDownload(selected)} disabled={downloading} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              {downloading ? <Loader2 size={16} className="sal-spin" /> : <Download size={16} />}
              {downloading ? "Downloading…" : "Download payslip"}
            </motion.button>
          </motion.section>

          <motion.div className="sal-stats" variants={stagger}>
            {stats.map(({ tone, icon: Icon, label, node, note }) => (
              <motion.div key={label} className="sal-stat" data-tone={tone} variants={rise} whileHover={{ x: 4 }}>
                <span className="sal-stat-icon"><Icon size={18} /></span>
                <div><small>{label}</small><strong>{node}</strong><em>{note}</em></div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="sal-split">
          <Breakdown title="Earnings" rows={earningRows} totalLabel="Gross salary" totalValue={selected?.grossSalary} barTotal={gross} tone="earn" />
          <Breakdown title="Deductions" rows={deductionRows} totalLabel="Total deductions" totalValue={selected?.totalDeduction} barTotal={deductions} tone="ded">
            <div className="sal-netrow"><span>Net payable</span><strong><AnimatedNumber value={selected?.netPayable} format={money} /></strong></div>
          </Breakdown>
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