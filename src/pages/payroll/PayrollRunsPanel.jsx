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
  Search,
  Settings,
  Users,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import {
  downloadPayslip,
  formatINR,
  generatePayroll,
  getEmployeeDropdown,
  getPayrollById,
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
import { getEmployeeAttendanceHistory } from "../../services/attendanceService";

const EMPTY_EDIT_FORM = {
  totalWorkingDays: "",
  workedDays: "",
  lopDays: "",
  halfDays: "",
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
    ["halfDays", "Half days", "1", "0"],
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
  "totalWorkingDays", "workedDays", "lopDays", "halfDays",
  "basicSalary", "hra", "specialAllowance", "medicalAllowance", "travelAllowance", "bonus", "otherAllowance",
  "pf", "esi", "professionalTax", "incomeTax", "otherDeduction",
];

const num = (value) => (value === "" || value === null || value === undefined ? undefined : Number(value));
const formatINRWithPaise = (value) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

async function fetchHalfDayCount(employeeId, payrollMonth) {
  const [year, month] = String(payrollMonth).slice(0, 7).split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error("Payroll month is invalid.");
  }
  const pad = (value) => String(value).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const page = await getEmployeeAttendanceHistory(employeeId, {
    fromDate: `${year}-${pad(month)}-01`,
    toDate: `${year}-${pad(month)}-${pad(lastDay)}`,
    status: "HALF_DAY",
    page: 0,
    size: 100,
  });
  const content = Array.isArray(page?.content) ? page.content : Array.isArray(page) ? page : [];
  return page?.totalElements ?? content.length;
}

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
  const [halfDays, setHalfDays] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editMode, setEditMode] = useState("draft"); // "draft" | "regenerate"
  const [editError, setEditError] = useState("");
  const [halfDaysLoadError, setHalfDaysLoadError] = useState("");
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
    const halfDayCount = n(editForm.halfDays);
    const halfDayAmount = halfDayCount > 0 && totalDays > 0
      ? round2(round2(gross / totalDays) * halfDayCount / 2)
      : 0;
    const deductions = n(editForm.pf) + n(editForm.esi) + n(editForm.professionalTax)
      + n(editForm.incomeTax) + n(editForm.otherDeduction) + lopAmount + halfDayAmount;
    return { gross, lopAmount, halfDayAmount, deductions, net: gross - deductions };
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
    ), [availableEmployees, genEmployeeQuery]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => !generatedEmployeeIds.has(String(id))));
  }, [generatedEmployeeIds]);

  function toggleEmployee(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  const allMatchedSelected = matchedEmployees.length > 0
    && matchedEmployees.every((item) => selectedIds.includes(item.id));

  function toggleAllMatched() {
    const matchedIdList = matchedEmployees.map((item) => item.id);
    setSelectedIds((current) => allMatchedSelected
      ? current.filter((id) => !matchedIdList.includes(id))
      : [...new Set([...current, ...matchedIdList])]);
  }

  function initials(name = "") {
    return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  }

  function selectAllEmployees(event) {
    const action = event.target.value;
    if (action === "ALL") {
      setSelectedIds(availableEmployees.map((item) => item.id));
    } else if (action === "NONE") {
      setSelectedIds([]);
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

  useEffect(() => {
    let isActive = true;
    setHalfDays(null);

    const employeeId = detail?.employeeId ?? detail?.employee?.id;
    if (!employeeId || !detail?.payrollMonth) return () => { isActive = false; };

    fetchHalfDayCount(employeeId, detail.payrollMonth)
      .then((count) => {
        if (isActive) setHalfDays(count);
      })
      .catch(() => {
        if (isActive) setHalfDays(null);
      });

    return () => { isActive = false; };
  }, [detail?.id, detail?.employeeId, detail?.employee?.id, detail?.payrollMonth]);

  useEffect(() => {
    if (!editing || editing.halfDays != null) return undefined;
    const employeeId = editing.employeeId ?? editing.employee?.id;
    if (!employeeId || !editing.payrollMonth) return undefined;

    let isActive = true;
    setHalfDaysLoadError("");
    fetchHalfDayCount(employeeId, editing.payrollMonth)
      .then((count) => {
        if (!isActive) return;
        setEditForm((form) => (form.halfDays === "" ? { ...form, halfDays: count } : form));
      })
      .catch(() => {
        if (isActive) setHalfDaysLoadError("Could not load half-day attendance. Enter the value manually.");
      });

    return () => { isActive = false; };
  }, [editing?.id, editing?.employeeId, editing?.employee?.id, editing?.payrollMonth, editing?.halfDays]);

  async function openDetail(item) {
    setDetail(item);
    try {
      const fresh = await getPayrollById(item.id);
      setDetail((current) => (current?.id === item.id ? { ...current, ...fresh } : current));
    } catch (err) {
      setError(err.message || "Unable to load payroll details.");
    }
  }

  function beginEdit(item) {
    setEditMode(item.status === "DRAFT" ? "draft" : "regenerate");
    setEditError("");
    setHalfDaysLoadError("");
    setEditing(item);
    setEditForm({
      totalWorkingDays: item.totalWorkingDays ?? "",
      workedDays: item.workedDays ?? "",
      lopDays: item.lopDays ?? "",
      halfDays: item.halfDays ?? "",
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
    if (n(editForm.workedDays) + n(editForm.lopDays) + n(editForm.halfDays) > n(editForm.totalWorkingDays)) {
      setEditError("Worked days + LOP days + Half days cannot exceed total working days.");
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
      halfDays: num(editForm.halfDays),
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

  async function handleDownload(item) {
    try {
      const { blob, filename } = await downloadPayslip(item.id);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err.message || "Failed to download payslip.");
    }
  }

  const canDownload = (item) => ["APPROVED", "PAID"].includes(item.status);
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
          <form className="gen-payroll" onSubmit={submitGenerate}>
            <div className="gen-payroll-grid">
              <section className="gen-card gen-settings">
                <header className="gen-card-head"><Settings size={18} /> Payroll Settings</header>
                <div className="gen-card-body">
                  <label>Payroll Month <span className="gen-req">*</span>
                    <MonthPicker id="payroll-generate-month" value={genMonth} onChange={(event) => setGenMonth(event.target.value)} required />
                  </label>
                  <label>Remarks
                    <textarea
                      rows={3}
                      maxLength={200}
                      value={genRemarks}
                      onChange={(event) => setGenRemarks(event.target.value)}
                      placeholder="e.g. August 2026 payroll"
                    />
                    <span className="gen-count">{genRemarks.length}/200</span>
                  </label>
                  <label className="gen-draft">
                    <input
                      type="checkbox"
                      checked={genSaveAsDraft}
                      onChange={(event) => setGenSaveAsDraft(event.target.checked)}
                    />
                    <span>
                      <strong>Save As Draft</strong>
                      <small>Save the payroll as draft instead of final generation.</small>
                    </span>
                  </label>
                </div>
              </section>

              <section className="gen-card gen-employees">
                <header className="gen-card-head gen-employees-head">
                  <span className="gen-title"><Users size={18} /> Employees</span>
                  <span className="gen-head-actions">
                    <span className="gen-selected-pill">{selectedIds.length} Selected</span>
                    <label className="gen-select-all">
                      <input type="checkbox" checked={allMatchedSelected} onChange={toggleAllMatched} disabled={matchedEmployees.length === 0} />
                      Select All
                    </label>
                  </span>
                </header>
                <div className="gen-card-body">
                  <div className="gen-search">
                    <Search size={16} />
                    <input
                      maxLength={INPUT_LIMITS.SEARCH}
                      value={genEmployeeQuery}
                      onChange={(event) => setGenEmployeeQuery(event.target.value)}
                      placeholder="Search employees to include…"
                    />
                  </div>
                  <div className="gen-table-wrap">
                    <table className="gen-table">
                      <thead>
                        <tr>
                          <th className="gen-col-check">
                            <input type="checkbox" aria-label="Select all employees" checked={allMatchedSelected} onChange={toggleAllMatched} disabled={matchedEmployees.length === 0} />
                          </th>
                          <th>Employee</th>
                          <th>Emp Code</th>
                          <th>Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchedEmployees.length === 0 && (
                          <tr>
                            <td colSpan={4} className="gen-empty">
                              {loadingEligibleEmployees
                                ? "Loading employees eligible for payroll…"
                                : availableEmployees.length === 0
                                ? "All employees already have a payroll for this month."
                                : "No employees match."}
                            </td>
                          </tr>
                        )}
                        {matchedEmployees.map((item, index) => (
                          <tr
                            key={item.id}
                            className={selectedIds.includes(item.id) ? "is-selected" : ""}
                            onClick={() => toggleEmployee(item.id)}
                          >
                            <td className="gen-col-check">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(item.id)}
                                onClick={(event) => event.stopPropagation()}
                                onChange={() => toggleEmployee(item.id)}
                                aria-label={`Select ${item.employeeName}`}
                              />
                            </td>
                            <td><span className={`gen-avatar gen-avatar-${index % 5}`}>{initials(item.employeeName)}</span></td>
                            <td>{item.employeeCode}</td>
                            <td>{item.employeeName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
            <div className="gen-actions">
              <button className="btn" type="button" onClick={() => setShowGenerate(false)}>Cancel</button>
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

              <AttendanceSection data={detail} halfDays={halfDays} />

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
              {halfDaysLoadError && <div className="form-alert">{halfDaysLoadError}</div>}

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
                          required={key === "halfDays"}
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
                <div className="pay-detail-item"><span>Half day</span><strong>{formatINRWithPaise(editPreview.halfDayAmount)}</strong></div>
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