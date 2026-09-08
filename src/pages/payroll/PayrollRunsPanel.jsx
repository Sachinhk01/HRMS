import { useCallback, useEffect, useMemo, useState } from "react";
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

const num = (value) => (value === "" || value === null || value === undefined ? undefined : Number(value));

export default function PayrollRunsPanel() {
  const [payrolls, setPayrolls] = useState([]);
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genSummary, setGenSummary] = useState(null);

  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (targetMonth = month) => {
    setLoading(true);
    setError("");
    try {
      const payrollMonth = `${targetMonth}-01`;
      const [monthly, byStatus] = await Promise.all([
        getPayrollsByMonth(payrollMonth),
        statusFilter === "ALL" ? Promise.resolve(null) : getPayrollsByStatus(statusFilter),
      ]);
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

  const filtered = useMemo(() => payrolls
    .filter((item) =>
      `${item.payrollNumber} ${item.employeeName} ${item.employeeCode}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [payrolls, query]);

  const summary = useMemo(() => {
    const net = payrolls.reduce((sum, item) => sum + Number(item.netPayable || 0), 0);
    const count = (status) => payrolls.filter((item) => item.status === status).length;
    return {
      total: payrolls.length,
      net,
      drafts: count("DRAFT"),
      approved: count("APPROVED"),
      paid: count("PAID"),
    };
  }, [payrolls]);

  function handleEmployeeSelection(event) {
    const { value } = event.target;
    if (value === "ALL") {
      setSelectedIds([]);
      return;
    }

    const employee = employees.find((item) => String(item.id) === value);
    setSelectedIds(employee ? [employee.id] : []);
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

  async function submitEdit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
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
      const updated = await updateDraftPayroll(editing.id, payload);
      setMessage(`Draft ${updated.payrollNumber} updated successfully.`);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to update draft.");
    } finally {
      setSaving(false);
    }
  }

  async function runStatusAction(item, status) {
    setError("");
    setMessage("");
    let paymentReference;
    if (status === "PAID") {
      paymentReference = window.prompt(
        `Payment reference for ${item.payrollNumber} (optional):`,
        item.paymentReference || ""
      );
      if (paymentReference === null) return;
    }
    if (!window.confirm(`${item.payrollNumber} → ${status}?`)) return;
    try {
      const updated = await updatePayrollStatus(item.id, { status, paymentReference });
      setMessage(`${updated.payrollNumber} marked as ${status}.`);
      if (detail?.id === item.id) setDetail(updated);
      await refresh();
    } catch (err) {
      setError(err.message || `Failed to ${status.toLowerCase()} payroll.`);
    }
  }

  async function handleRegenerate(item) {
    if (!window.confirm(`Create a new version superseding ${item.payrollNumber}?`)) return;
    setError("");
    setMessage("");
    try {
      const updated = await regeneratePayroll(item.id);
      setMessage(`New version ${updated.payrollNumber} (v${updated.version}) created.`);
      setDetail(updated);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to regenerate payroll.");
    }
  }

  async function handleDownload(item) {
    setError("");
    try {
      const { blob, filename } = await downloadPayslip(item.id);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err.message || "Failed to download payslip.");
    }
  }

  const canDownload = (item) => ["APPROVED", "PAID"].includes(item.status);

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
          <small>Across all records for this month</small>
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
              <input type="month" value={genMonth} onChange={(event) => setGenMonth(event.target.value)} required />
            </label>
            <label>Remarks
              <input value={genRemarks} onChange={(event) => setGenRemarks(event.target.value)} placeholder="e.g. August 2026 payroll" />
            </label>
            <label className="checkbox-line" style={{ paddingTop: 26 }}>
              <input
                type="checkbox"
                checked={genSaveAsDraft}
                onChange={(event) => setGenSaveAsDraft(event.target.checked)}
              />
              Save as draft
            </label>
            <div className="full-span">
              <label>Employees</label>
              <select value={selectedIds.length === 0 ? "ALL" : String(selectedIds[0])} onChange={handleEmployeeSelection}>
                <option value="ALL">Select all active employees</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.employeeCode} · {item.employeeName}
                  </option>
                ))}
              </select>
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
            <div className="success-alert" style={{ marginBottom: 8 }}>
              <CheckCircle2 size={16} />
              {genSummary.generated} payroll(s) generated for {payrollMonthLabel(genSummary.payrollMonth)}.
            </div>
            {genSummary.generatedPayrolls?.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                <strong style={{ color: "var(--navy)" }}>Numbers:</strong> {genSummary.generatedPayrolls.join(", ")}
              </div>
            )}
            {genSummary.failedEmployees?.map((item) => (
              <div key={item.employeeId} className="form-alert" style={{ marginBottom: 6 }}>
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search number, name, code" />
          </div>
          <input
            type="month"
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
                    {item.version > 1 && <small className="table-subtext">v{item.version}</small>}
                  </td>
                  <td>
                    <strong>{item.employeeName}</strong>
                    <small className="table-subtext">{item.employeeCode} · {item.departmentName || "—"}</small>
                  </td>
                  <td>{payrollMonthLabel(item.payrollMonth)}</td>
                  <td><PayrollBadge status={item.status} /></td>
                  <td><strong>{formatINR(item.netPayable)}</strong></td>
                  <td>
                    <div className="payroll-actions">
                      <button type="button" title="View details" onClick={() => openDetail(item)}><Eye size={16} /></button>
                      {item.status === "DRAFT" && (
                        <button type="button" title="Edit draft" onClick={() => beginEdit(item)}><Pencil size={16} /></button>
                      )}
                      {item.status === "GENERATED" && (
                        <button type="button" title="Approve" onClick={() => runStatusAction(item, "APPROVED")}><CheckCircle2 size={16} /></button>
                      )}
                      {item.status === "APPROVED" && (
                        <button type="button" title="Mark as paid" onClick={() => runStatusAction(item, "PAID")}><Banknote size={16} /></button>
                      )}
                      {["DRAFT", "GENERATED"].includes(item.status) && (
                        <button type="button" className="danger" title="Cancel" onClick={() => runStatusAction(item, "CANCELLED")}><XCircle size={16} /></button>
                      )}
                      <button type="button" title="Regenerate (new version)" onClick={() => handleRegenerate(item)}><RotateCcw size={16} /></button>
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
      {detail && (
        <div className="payroll-overlay" onClick={() => setDetail(null)}>
          <div className="payroll-modal" onClick={(event) => event.stopPropagation()}>
            <div className="payroll-modal-head">
              <div>
                <h2>{detail.payrollNumber} · v{detail.version}</h2>
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
        </div>
      )}

      {/* Edit draft modal */}
      {editing && (
        <div className="payroll-overlay" onClick={() => setEditing(null)}>
          <form className="payroll-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitEdit}>
            <div className="payroll-modal-head">
              <div>
                <h2>Edit draft · {editing.payrollNumber}</h2>
                <p>{editing.employeeName} — adjust attendance or amounts before approval.</p>
              </div>
              <button type="button" className="payroll-modal-close" onClick={() => setEditing(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="payroll-modal-body">
              <div className="payroll-detail-grid">
                <label>Total working days<input type="number" min="1" max="999999" value={editForm.totalWorkingDays} onChange={(event) => setEditForm({ ...editForm, totalWorkingDays: event.target.value })} /></label>
                <label>Worked days<input type="number" min="0" max="999999" value={editForm.workedDays} onChange={(event) => setEditForm({ ...editForm, workedDays: event.target.value })} /></label>
                <label>LOP days<input type="number" min="0" max="999999" value={editForm.lopDays} onChange={(event) => setEditForm({ ...editForm, lopDays: event.target.value })} /></label>
              </div>
              <div className="payroll-detail-grid">
                <label>Basic salary<input type="number" min="0" max="999999" step="0.01" value={editForm.basicSalary} onChange={(event) => setEditForm({ ...editForm, basicSalary: event.target.value })} /></label>
                <label>HRA<input type="number" min="0" max="999999" step="0.01" value={editForm.hra} onChange={(event) => setEditForm({ ...editForm, hra: event.target.value })} /></label>
                <label>Special allowance<input type="number" min="0" max="999999" step="0.01" value={editForm.specialAllowance} onChange={(event) => setEditForm({ ...editForm, specialAllowance: event.target.value })} /></label>
                <label>Medical allowance<input type="number" min="0" max="999999" step="0.01" value={editForm.medicalAllowance} onChange={(event) => setEditForm({ ...editForm, medicalAllowance: event.target.value })} /></label>
                <label>Travel allowance<input type="number" min="0" max="999999" step="0.01" value={editForm.travelAllowance} onChange={(event) => setEditForm({ ...editForm, travelAllowance: event.target.value })} /></label>
                <label>Bonus<input type="number" min="0" max="999999" step="0.01" value={editForm.bonus} onChange={(event) => setEditForm({ ...editForm, bonus: event.target.value })} /></label>
                <label>Other allowance<input type="number" min="0" max="999999" step="0.01" value={editForm.otherAllowance} onChange={(event) => setEditForm({ ...editForm, otherAllowance: event.target.value })} /></label>
              </div>
              <div className="payroll-detail-grid">
                <label>PF<input type="number" min="0" max="999999" step="0.01" value={editForm.pf} onChange={(event) => setEditForm({ ...editForm, pf: event.target.value })} /></label>
                <label>ESI<input type="number" min="0" max="999999" step="0.01" value={editForm.esi} onChange={(event) => setEditForm({ ...editForm, esi: event.target.value })} /></label>
                <label>Professional tax<input type="number" min="0" max="999999" step="0.01" value={editForm.professionalTax} onChange={(event) => setEditForm({ ...editForm, professionalTax: event.target.value })} /></label>
                <label>Income tax<input type="number" min="0" max="999999" step="0.01" value={editForm.incomeTax} onChange={(event) => setEditForm({ ...editForm, incomeTax: event.target.value })} /></label>
                <label>Other deduction<input type="number" min="0" max="999999" step="0.01" value={editForm.otherDeduction} onChange={(event) => setEditForm({ ...editForm, otherDeduction: event.target.value })} /></label>
              </div>
              <label>Remarks<input value={editForm.remarks} onChange={(event) => setEditForm({ ...editForm, remarks: event.target.value })} /></label>
              <div className="payroll-form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Draft"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
