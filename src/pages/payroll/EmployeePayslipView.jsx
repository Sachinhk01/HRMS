import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  Banknote, Building2, CalendarCheck, CalendarDays, CalendarX, Clock, Download, FileText,
  Hash, Landmark, Loader2, ShieldCheck, TrendingUp, UserCheck, WalletCards,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyProfile } from "../../services/employeeService";
import {
  downloadPayslip, formatINR, getPaymentDetails, getPayrollByEmployee,
  payrollMonthLabel, triggerBlobDownload,
} from "../../services/payrollService";
import { EASE_OUT } from "../../components/Motion";
import { AnimatedNumber, EmptyState, PayrollBadge, getHalfDayDeduction } from "./payrollUi";
import "./SalaryRedesign.css";

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
  const [selectedId, setSelectedId] = useState(null);

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

        <motion.section className="sal-panel" variants={rise}>
          <h2>Attendance summary <small>{payrollMonthLabel(selected?.payrollMonth)}</small></h2>
          <div className="sal-attendance">
            {attendance.map(([Icon, label, value]) => (
              <div key={label} className="sal-att"><Icon size={16} /><strong>{value == null ? "—" : <AnimatedNumber value={value} />}</strong><span>{label}</span></div>
            ))}
          </div>
        </motion.section>

        <motion.section className="sal-panel" variants={rise}>
          <h2>Payment details {payment?.paymentMode && <PayrollBadge status={payment.paymentMode} />}</h2>
          {details ? (
            <div className="sal-details">
              {details.map(([Icon, label, value]) => (
                <div key={label} className="sal-detail"><span className="sal-detail-icon"><Icon size={15} /></span><div><small>{label}</small><strong>{value}</strong></div></div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Landmark} title="No payment details on file" note="Contact HR to update your bank and tax details." />
          )}
        </motion.section>

        <motion.section className="sal-panel" variants={rise}>
          <h2>Payslip history <small>Select a row to view that month</small></h2>
          <div className="sal-table-wrap">
            <table className="sal-table">
              <thead><tr><th>Month</th><th>Payroll number</th><th>Status</th><th>Gross</th><th>Deductions</th><th>Net pay</th><th /></tr></thead>
              <tbody>
                {sorted.map((item, i) => (
                  <motion.tr
                    key={item.id} className={selected?.id === item.id ? "is-active" : ""}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.5 + i * 0.04, ease: EASE_OUT }}
                    onClick={() => setSelectedId(item.id)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(item.id); }}
                  >
                    <td><strong>{payrollMonthLabel(item.payrollMonth)}</strong></td>
                    <td>{item.payrollNumber}</td>
                    <td><PayrollBadge status={item.status} /></td>
                    <td>{money(item.grossSalary)}</td>
                    <td>{money(item.totalDeduction)}</td>
                    <td><strong>{money(item.netPayable)}</strong></td>
                    <td className="sal-right">
                      <button type="button" className="sal-pdf" onClick={(e) => { e.stopPropagation(); handleDownload(item); }} disabled={downloading}>
                        <Download size={14} /> PDF
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      </motion.div>
    </MotionConfig>
  );
}
