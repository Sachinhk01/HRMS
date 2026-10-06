import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import {
  downloadPayslip,
  formatINR,
  generatePayroll,
  getEmployeeDropdown,
  getPayrollsByMonth,
  getPayrollsByStatus,
  payrollMonthLabel,
  regeneratePayroll,
  triggerBlobDownload,
  updateDraftPayroll,
  updatePayrollStatus,
} from "../../services/payrollService";
import { AttendanceSection, DeductionsSection, EarningsSection, EmptyState, PayrollBadge } from "./payrollUi";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { INPUT_LIMITS } from '../../utils/inputLimits';
import { MonthPicker } from '../../components/DatePicker';

const EMPTY_EDIT_FORM = {
  totalWorkingDays: "",
  workedDays: "",
  lopDays: "",
  basicSalary: "",
  hra: "",
  specialAllowance: "",
  medicalAllowance: "",
  travelAllowance: "",
  bonus: "",
  otherAllowance: "",
  pf: "",
  esi: "",
  professionalTax: "",
  incomeTax: "",
  otherDeduction: "",
  remarks: "",
};

const EDIT_SECTIONS = [
  ["Attendance", [
    ["totalWorkingDays", "Total working days", "1", "1"],
    ["workedDays", "Worked days", "1", "0"],
    ["lopDays", "LOP days", "1", "0"],
  ]],
  ["Earnings", [
    ["basicSalary", "Basic salary"],
    ["hra", "HRA"],
    ["specialAllowance", "Special allowance"],
    ["medicalAllowance", "Medical allowance"],
    ["travelAllowance", "Travel allowance"],
    ["bonus", "Bonus"],
    ["otherAllowance", "Other allowance"],
  ]],
  ["Deductions", [
    ["pf", "PF"],
    ["esi", "ESI"],
    ["professionalTax", "Professional tax"],
    ["incomeTax", "Income tax"],
    ["otherDeduction", "Other deduction"],
  ]],
];

const NUMERIC_KEYS = [
  "totalWorkingDays", "workedDays", "lopDays",
  "basicSalary", "hra", "specialAllowance", "medicalAllowance", "travelAllowance", "bonus", "otherAllowance",
  "pf", "esi", "professionalTax", "incomeTax", "otherDeduction",
];

const num = (value) => (value === "" || value === null || value === undefined ? undefined : Number(value));

export default function PayrollRunsPanel() {
  const { confirm, promptDialog } = useConfirm();
  const { showToast } = useToast();
  const [payrolls, setPayrolls] = useState([]);
  const [monthlyPayrolls, setMonthlyPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showGenerate, setShowGenerate] = useState(false);
  const [genMonth, setGenMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [genSaveAsDraft, setGenSaveAsDraft] = useState(false);
  const [genRemarks, setGenRemarks] = useState("");
  const [genEmployeeQuery, setGenEmployeeQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [generatedEmployeeIds, setGeneratedEmployeeIds] = useState(() => new Set());
  const [loadingEligibleEmployees, setLoadingEligibleEmployees] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genSummary, setGenSummary] = useState(null);

  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editMode, setEditMode] = useState("draft"); // "draft" | "regenerate"
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (targetMonth = month) => {
    setLoading(true);
    try {
      const payrollMonth = `${targetMonth}-01`;
      const [monthly, byStatus] = await Promise.all([
        getPayrollsByMonth(payrollMonth),
        statusFilter === "ALL" ? Promise.resolve(null) : getPayrollsByStatus(statusFilter),
      ]);
      setMonthlyPayrolls(monthly);
      setPayrolls(monthly);
      if (statusFilter !== "ALL") {
        const inMonth = new Set(monthly.map((item) => item.id));
        setPayrolls(byStatus.filter((item) => inMonth.has(item.id)));
      }
    } catch (err) {
      setError(err.message || "Failed to load payroll records.");
    } finally {
      setLoading(false);
    }
  }, [month, statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    getEmployeeDropdown()
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  // The generation picker must offer only employees without an active payroll
  // in its selected month. Superseded and cancelled records can be generated again.
  useEffect(() => {
    let current = true;
    setLoadingEligibleEmployees(true);
    getPayrollsByMonth(`${genMonth}-01`)
      .then((records) => {
        if (!current) return;
        setGeneratedEmployeeIds(new Set(
          records
            .filter((record) => !["SUPERSEDED", "CANCELLED"].includes(record.status))
            .map((record) => record.employeeId ?? record.employee?.id)
            .filter((id) => id !== null && id !== undefined)
            .map(String)
        ));
        setLoadingEligibleEmployees(false);
      })
      .catch(() => {
        if (current) {
          setGeneratedEmployeeIds(new Set());
          setLoadingEligibleEmployees(false);
        }
      });
    return () => { current = false; };
  }, [genMonth]);

  const filtered = useMemo(() => payrolls
    .filter((item) =>
      `${item.payrollNumber} ${item.employeeName} ${item.employeeCode}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [payrolls, query]);

  const summary = useMemo(() => {
    const net = monthlyPayrolls
      .filter((item) => item.status === "PAID")
      .reduce((sum, item) => sum + Number(item.netPayable || 0), 0);
    const count = (status) => payrolls.filter((item) => item.status === status).length;
    return {
      total: payrolls.length,
      net,
      drafts: count("DRAFT"),
      approved: count("APPROVED"),
      paid: count("PAID"),
    };
  }, [payrolls, monthlyPayrolls]);

  // Live preview of the payslip totals while editing (mirrors backend maths).
  const editPreview = useMemo(() => {
    const n = (value) => Number(value || 0);
    const round2 = (value) => Math.round(value * 100) / 100;
    const gross = n(editForm.basicSalary) + n(editForm.hra) + n(editForm.specialAllowance)
      + n(editForm.medicalAllowance) + n(editForm.travelAllowance) + n(editForm.bonus) + n(editForm.otherAllowance);
    const totalDays = n(editForm.totalWorkingDays);
    const lopDays = n(editForm.lopDays);
    const lopAmount = lopDays > 0 && totalDays > 0 ? round2(round2(gross / totalDays) * lopDays) : 0;
    const deductions = n(editForm.pf) + n(editForm.esi) + n(editForm.professionalTax)
      + n(editForm.incomeTax) + n(editForm.otherDeduction) + lopAmount;
    return { gross, lopAmount, deductions, net: gross - deductions };
  }, [editForm]);

  const availableEmployees = useMemo(() => loadingEligibleEmployees
    ? []
    : employees.filter((item) => !generatedEmployeeIds.has(String(item.id))),
  [employees, generatedEmployeeIds, loadingEligibleEmployees]);

  const matchedEmployees = useMemo(() => availableEmployees
    .filter((item) =>
      `${item.employeeCode} ${item.employeeName}`
        .toLowerCase()
        .includes(genEmployeeQuery.toLowerCase())
    )
    .slice(0, 40), [availableEmployees, genEmployeeQuery]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => !generatedEmployeeIds.has(String(id))));
  }, [generatedEmployeeIds]);

  function toggleEmployee(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function selectAllEmployees(event) {
    if (event.target.value === "ALL") {
      setSelectedIds(availableEmployees.map((item) => item.id));
    }
  }

  async function submitGenerate(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setGenerating(true);
    setGenSummary(null);
    try {
      const result = await generatePayroll({
        payrollMonth: `${genMonth}-01`,
        employeeIds: selectedIds,
        remarks: genRemarks || undefined,
        saveAsDraft: genSaveAsDraft,
      });
      setGenSummary(result);
      setMessage(`Payroll generated: ${result.generated} created, ${result.failed} failed.`);
      setSelectedIds([]);
      setGenRemarks("");
      setMonth(genMonth);
      await refresh(genMonth);
    } catch (err) {
      setError(err.message || "Failed to generate payroll.");
    } finally {
      setGenerating(false);
    }
  }

  function openDetail(item) {
    setDetail(item);
  }

  function beginEdit(item) {
    setEditMode(item.status === "DRAFT" ? "draft" : "regenerate");
    setEditError("");
    setEditing(item);
    setEditForm({
      totalWorkingDays: item.totalWorkingDays ?? "",
      workedDays: item.workedDays ?? "",
      lopDays: item.lopDays ?? "",
      basicSalary: item.basicSalary ?? "",
      hra: item.hra ?? "",
      specialAllowance: item.specialAllowance ?? "",
      medicalAllowance: item.medicalAllowance ?? "",
      travelAllowance: item.travelAllowance ?? "",
      bonus: item.bonus ?? "",
      otherAllowance: item.otherAllowance ?? "",
      pf: item.pf ?? "",
      esi: item.esi ?? "",
      professionalTax: item.professionalTax ?? "",
      incomeTax: item.incomeTax ?? "",
      otherDeduction: item.otherDeduction ?? "",
      remarks: item.remarks ?? "",
    });
  }

  function closeEdit() {
    setEditing(null);
    setEditError("");
  }

  // True when the record returned by the server already reflects the edited values.
  function matchesPayload(record, payload) {
    return NUMERIC_KEYS.every((key) => {
      if (payload[key] === undefined) return true;
      return Number(record?.[key] ?? 0) === Number(payload[key]);
    });
  }

  async function submitEdit(event) {
    event.preventDefault();
    setEditError("");
    setError("");
    setMessage("");

    const n = (value) => Number(value || 0);
    if (n(editForm.workedDays) + n(editForm.lopDays) > n(editForm.totalWorkingDays)) {
      setEditError("Worked days + LOP days cannot exceed total working days.");
      return;
    }
    if (editPreview.gross <= 0) {
      setEditError("Gross salary must be greater than 0.");
      return;
    }
    if (editPreview.net < 0) {
      setEditError("Total deductions cannot exceed gross salary.");
      return;
    }

    const payload = {
      totalWorkingDays: num(editForm.totalWorkingDays),
      workedDays: num(editForm.workedDays),
      lopDays: num(editForm.lopDays),
      basicSalary: num(editForm.basicSalary),
      hra: num(editForm.hra),
      specialAllowance: num(editForm.specialAllowance),
      medicalAllowance: num(editForm.medicalAllowance),
      travelAllowance: num(editForm.travelAllowance),
      bonus: num(editForm.bonus),
      otherAllowance: num(editForm.otherAllowance),
      pf: num(editForm.pf),
      esi: num(editForm.esi),
      professionalTax: num(editForm.professionalTax),
      incomeTax: num(editForm.incomeTax),
      otherDeduction: num(editForm.otherDeduction),
      remarks: editForm.remarks || undefined,
    };

    if (editMode === "regenerate") {
      const ok = await confirm({
        title: "Save as new version",
        message: `${editing.payrollNumber} will be superseded and a new version will be created with your changes.`,
        confirmText: "Save & Regenerate",
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      if (editMode === "draft") {
        const updated = await updateDraftPayroll(editing.id, payload);
        showToast(`Draft ${updated.payrollNumber} updated successfully.`, "success");
      } else {
        let updated = await regeneratePayroll(editing.id, payload);
        let applied = matchesPayload(updated, payload);

        // Some backends ignore the regenerate body. If the new version does not
        // carry the edited values, try to apply them to the new version directly.
        if (!applied && updated?.id) {
          try {
            updated = await updateDraftPayroll(updated.id, payload);
            applied = matchesPayload(updated, payload);
          } catch {
            applied = false;
          }
        }

        if (applied) {
          showToast(`New version ${updated.payrollNumber} created with your changes.`, "success");
        } else {
          showToast(
            `New version ${updated.payrollNumber} was created, but the server did not apply your edits. Please contact the backend team.`,
            "error"
          );
        }
      }
      closeEdit();
      setDetail(null);
      await refresh();
    } catch (err) {
      setEditError(err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function runStatusAction(item, status) {
    setError("");
    setMessage("");
    let paymentReference;
    if (status === "PAID") {
      const result = await promptDialog({
        title: "Payment reference",
        fields: [
          {
            name: "paymentReference",
            label: `Payment reference for ${item.payrollNumber} (optional)`,
            defaultValue: item.paymentReference || "",
          },
        ],
        confirmText: "Continue",
      });
      if (result === null) return;
      paymentReference = result.paymentReference;
    }
    const ok = await confirm({
      title: "Update payroll status",
      message: `${item.payrollNumber} → ${status}?`,
      confirmText: "Confirm",
    });
    if (!ok) return false;
    try {
      const updated = await updatePayrollStatus(item.id, { status, paymentReference });
      showToast(`${updated.payrollNumber} marked as ${status}.`, "success");
      if (detail?.id === item.id) setDetail(updated);
      await refresh();
      return true;
    } catch (err) {
      setError(err.message || `Failed to ${status.toLowerCase()} payroll.`);
    }
  }

  async function handleRegenerate(item) {
    const ok = await confirm({
      title: "Regenerate payroll",
      message: `Create a new version superseding ${item.payrollNumber}?`,
      confirmText: "Regenerate",
    });
    if (!ok) return;
    setError("");
    setMessage("");
    try {
      const updated = await regeneratePayroll(item.id);
      setMessage(`New version ${updated.payrollNumber} created.`);
      setDetail(updated);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to regenerate payroll.");
    }
  }

  async function handleDownload(item) {
    try {
      const { blob, filename } = await downloadPayslip(item.id);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err.message || "Failed to download payslip.");
    }
  }

  const canDownload = (item) => ["APPROVED", "PAID"].includes(item.status);
  // PAID/SUPERSEDED/CANCELLED payrolls must not be regenerated.
  const canRegenerate = (item) => ["DRAFT", "GENERATED", "APPROVED"].includes(item.status);
  // Drafts are edited in place; generated/approved payslips are edited as a new version.
  const canEdit = (item) => ["DRAFT", "GENERATED", "APPROVED"].includes(item.status);

  return (
    <div className="payroll-stack">
      {error && <div className="form-alert">{error}</div>}
      {message && <div className="success-alert">{message}</div>}

      {/* Summary */}
      <div className="payroll-summary-grid">
        <section className="panel payroll-summary-card tone-blue">
          <div className="summary-icon"><FileText size={20} /></div>
          <span>Records · {payrollMonthLabel(`${month}-01`)}</span>
          <strong>{summary.total}</strong>
        </section>
        <section className="panel payroll-summary-card tone-green">
          <div className="summary-icon"><IndianRupee size={20} /></div>
          <span>Total Net Payable</span>
          <strong>{formatINR(summary.net)}</strong>
          <small>Paid records only, for this month</small>
        </section>
        <section className="panel payroll-summary-card tone-orange">
          <div className="summary-icon"><WalletCards size={20} /></div>
          <span>Approved</span>
          <strong>{summary.approved}</strong>
          <small>Ready to be paid</small>
        </section>
        <section className="panel payroll-summary-card tone-pink">
          <div className="summary-icon"><Banknote size={20} /></div>
          <span>Paid</span>
          <strong>{summary.paid}</strong>
          <small>Marked as disbursed</small>
        </section>
      </div>

      {/* Generate */}
      <section className="panel">
        <button
          type="button"
          className="payroll-generate-toggle"
          onClick={() => setShowGenerate((value) => !value)}
        >
          <div>
            <h2>Generate Payroll</h2>
            <p>Create payroll for one or more employees, or the whole active workforce.</p>
          </div>
          {showGenerate ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showGenerate && (
          <form className="payroll-form-grid" style={{ marginTop: 16 }} onSubmit={submitGenerate}>
            <label>Payroll month
              <MonthPicker id="payroll-generate-month" value={genMonth} onChange={(event) => setGenMonth(event.target.value)} required />
            </label>
            <label>Remarks
              <input maxLength={INPUT_LIMITS.SHORT_TEXT} value={genRemarks} onChange={(event) => setGenRemarks(event.target.value)} placeholder="Enter remarks" />
            </label>
            <label className="checkbox-line" style={{ alignSelf: "end", height: 34, paddingTop: 0 }}>
              <input
                type="checkbox"
                checked={genSaveAsDraft}
                onChange={(event) => setGenSaveAsDraft(event.target.checked)}
              />
              Save as draft
            </label>
            <div className="full-span">
              <label>Employees</label>
              <select defaultValue="" onChange={selectAllEmployees}>
                <option value="">Quick select…</option>
                <option value="ALL">Select all active employees</option>
              </select>
              <input maxLength={INPUT_LIMITS.SEARCH}
                value={genEmployeeQuery}
                onChange={(event) => setGenEmployeeQuery(event.target.value)}
                placeholder="Search employees to include…"
              />
              <div
                style={{
                  maxHeight: 160, overflowY: "auto", border: "1px solid var(--line)",
                  borderRadius: 10, marginTop: 8, padding: "6px 10px",
                  display: "flex", flexDirection: "column", gap: 2,
                }}
              >
                {matchedEmployees.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--muted)", padding: "6px 2px" }}>
                    {loadingEligibleEmployees
                      ? "Loading employees eligible for payroll…"
                      : availableEmployees.length === 0
                      ? "All employees already have a payroll for this month."
                      : "No employees match."}
                  </span>
                )}
                {matchedEmployees.map((item) => (
                  <label className="checkbox-line" key={item.id} style={{ fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleEmployee(item.id)}
                    />
                    <span>{item.employeeCode}</span> · {item.employeeName}
                  </label>
                ))}
              </div>
              {selectedIds.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                  {selectedIds.length} employee(s) selected
                </div>
              )}
            </div>
            <div className="full-span payroll-form-actions">
              <button className="btn btn-primary" type="submit" disabled={generating}>
                <Plus size={18} /> {generating ? "Generating…" : genSaveAsDraft ? "Generate Drafts" : "Generate Payroll"}
              </button>
            </div>
          </form>
        )}

        {genSummary && (
          <div className="full-span" style={{ marginTop: 14 }}>
            <div className="payroll-result-summary" style={{ marginBottom: 8 }}>
              <CheckCircle2 size={16} />
              {genSummary.generated} payroll(s) generated for {payrollMonthLabel(genSummary.payrollMonth)}.
            </div>
            {genSummary.generatedPayrolls?.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                <strong style={{ color: "var(--navy)" }}>Numbers:</strong> {genSummary.generatedPayrolls.join(", ")}
              </div>
            )}
            {genSummary.failedEmployees?.map((item) => (
              <div key={item.employeeId} className="payroll-result-item" style={{ marginBottom: 6 }}>
                <XCircle size={15} /> {item.employeeName} ({item.employeeCode}) — {item.reason}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* List */}
      <section className="panel">
        <div className="payroll-toolbar">
          <div className="payroll-search">
            <Search size={17} />
            <input maxLength={INPUT_LIMITS.SEARCH} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search number, name, code" />
          </div>
          <MonthPicker id="payroll-filter-month"
            className="compact-select"
            value={month}
            onChange={(event) => { setMonth(event.target.value); setStatusFilter("ALL"); }}
            style={{ width: "auto" }}
          />
          <select
            className="compact-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="GENERATED">Generated</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="SUPERSEDED">Superseded</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Payroll No.</th>
                <th>Employee</th>
                <th>Month</th>
                <th>Status</th>
                <th>Net Payable</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6" style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Loading payroll records…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      icon={FileText}
                      title="No payroll records"
                      note="Pick a month above or generate a new payroll run."
                    />
                  </td>
                </tr>
              )}
              {!loading && filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.payrollNumber}</strong>
                  </td>
                  <td>
                    <strong>{item.employeeName}</strong>
                  </td>
                  <td>{payrollMonthLabel(item.payrollMonth)}</td>
                  <td><PayrollBadge status={item.status} /></td>
                  <td><strong>{formatINR(item.netPayable)}</strong></td>
                  <td>
                    <div className="payroll-actions">
                      <button type="button" title="View details" onClick={() => openDetail(item)}><Eye size={16} /></button>
                      {canEdit(item) && (
                        <button
                          type="button"
                          title={item.status === "DRAFT" ? "Edit draft" : "Edit payslip (saves as new version)"}
                          onClick={() => beginEdit(item)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {item.status === "DRAFT" && (
                        <button type="button" className="danger" title="Cancel" onClick={() => runStatusAction(item, "CANCELLED")}><XCircle size={16} /></button>
                      )}
                      {item.status === "GENERATED" && (
                        <div className="payroll-approve-reject">
                          <button
                            type="button"
                            className="btn-approve"
                            onClick={() => runStatusAction(item, "APPROVED")}
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button
                            type="button"
                            className="btn-reject"
                            onClick={() => runStatusAction(item, "CANCELLED")}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )}
                      {item.status === "APPROVED" && (
                        <button type="button" title="Mark as paid" onClick={() => runStatusAction(item, "PAID")}><Banknote size={16} /></button>
                      )}
                      {canRegenerate(item) && (
                        <button type="button" title="Regenerate (new version)" onClick={() => handleRegenerate(item)}><RotateCcw size={16} /></button>
                      )}
                      {canDownload(item) && (
                        <button type="button" title="Download payslip" onClick={() => handleDownload(item)}><Download size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detail modal */}
      {detail && createPortal(
        <div className="payroll-overlay" onClick={() => setDetail(null)}>
          <div className="payroll-modal" onClick={(event) => event.stopPropagation()}>
            <div className="payroll-modal-head">
              <div>
                <h2>{detail.payrollNumber}</h2>
                <p>
                  {detail.employeeName} ({detail.employeeCode}) · {payrollMonthLabel(detail.payrollMonth)}
                </p>
              </div>
              <button type="button" className="payroll-modal-close" onClick={() => setDetail(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="payroll-modal-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <PayrollBadge status={detail.status} />
                {detail.remarks && <span style={{ fontSize: 12, color: "var(--muted)" }}>{detail.remarks}</span>}
              </div>

              <AttendanceSection data={detail} />

              <div className="payroll-detail-grid">
                <EarningsSection data={detail} />
                <DeductionsSection data={detail} />
              </div>

              <div className="payroll-detail-grid">
                <div className="pay-detail-item"><span>Bank</span><strong>{detail.bankName || "—"}</strong></div>
                <div className="pay-detail-item"><span>Account No.</span><strong>{detail.accountNumber || "—"}</strong></div>
                <div className="pay-detail-item"><span>IFSC</span><strong>{detail.ifscCode || "—"}</strong></div>
                <div className="pay-detail-item"><span>PAN</span><strong>{detail.panNumber || "—"}</strong></div>
                <div className="pay-detail-item"><span>Approved by</span><strong>{detail.approvedBy || "—"}</strong></div>
                <div className="pay-detail-item"><span>Approved on</span><strong>{detail.approvedDate ? new Date(detail.approvedDate).toLocaleDateString() : "—"}</strong></div>
                <div className="pay-detail-item"><span>Payment reference</span><strong>{detail.paymentReference || "—"}</strong></div>
                <div className="pay-detail-item"><span>Payment date</span><strong>{detail.paymentDate ? new Date(detail.paymentDate).toLocaleDateString() : "—"}</strong></div>
              </div>

              {canDownload(detail) && (
                <button className="btn btn-primary btn-block" type="button" onClick={() => handleDownload(detail)}>
                  <Download size={18} /> Download Payslip PDF
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit modal (draft = edit in place, generated/approved = save as new version) */}
      {editing && createPortal(
        <div className="payroll-overlay" onClick={closeEdit}>
          <form className="payroll-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitEdit}>
            <div className="payroll-modal-head">
              <div>
                <h2>{editMode === "draft" ? "Edit draft" : "Edit payslip"} · {editing.payrollNumber}</h2>
                <p>
                  {editing.employeeName} ({editing.employeeCode}) —{" "}
                  {editMode === "draft"
                    ? "adjust attendance or amounts before approval."
                    : "changes are saved as a new version and the current one is superseded."}
                </p>
              </div>
              <button type="button" className="payroll-modal-close" onClick={closeEdit} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="payroll-modal-body">
              {editError && <div className="form-alert">{editError}</div>}

              {EDIT_SECTIONS.map(([heading, fields]) => (
                <div key={heading}>
                  <h3 style={{ fontSize: 13, margin: "4px 0 8px" }}>{heading}</h3>
                  <div className="payroll-detail-grid">
                    {fields.map(([key, label, step, min]) => (
                      <label key={key}>{label}
                        <input
                          type="number"
                          min={min || "0"}
                          max="999999"
                          step={step || "0.01"}
                          value={editForm[key]}
                          onChange={(event) => setEditForm((form) => ({ ...form, [key]: event.target.value }))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <label>Remarks
                <input
                  maxLength={INPUT_LIMITS.SHORT_TEXT}
                  value={editForm.remarks}
                  onChange={(event) => setEditForm((form) => ({ ...form, remarks: event.target.value }))}
                />
              </label>

              <div className="payroll-detail-grid">
                <div className="pay-detail-item"><span>Gross</span><strong>{formatINR(editPreview.gross)}</strong></div>
                <div className="pay-detail-item"><span>LOP amount</span><strong>{formatINR(editPreview.lopAmount)}</strong></div>
                <div className="pay-detail-item"><span>Total deductions</span><strong>{formatINR(editPreview.deductions)}</strong></div>
                <div className="pay-detail-item"><span>Net payable</span><strong>{formatINR(editPreview.net)}</strong></div>
              </div>

              <div className="payroll-form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editMode === "draft" ? "Save Draft" : "Save & Regenerate"}
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}