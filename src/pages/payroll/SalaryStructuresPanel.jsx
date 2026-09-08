import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, GitCommitHorizontal, Plus, Search, X } from "lucide-react";
import {
  createSalaryStructure,
  createSalaryStructureRevision,
  formatINR,
  getEmployeeDropdown,
  getSalaryStructures,
  getSalaryTemplates,
  payrollMonthLabel,
} from "../../services/payrollService";
import { DeductionsSection, EarningsSection, EmptyState, PayrollBadge } from "./payrollUi";

const EMPTY_FORM = {
  employeeId: "",
  salaryTemplateId: "",
  effectiveFrom: "",
  effectiveTo: "",
  remarks: "",
};

export default function SalaryStructuresPanel() {
  const [structures, setStructures] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isRevision, setIsRevision] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStructures(await getSalaryStructures({ activeOnly }));
    } catch (err) {
      setError(err.message || "Failed to load salary structures.");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    getEmployeeDropdown().then(setEmployees).catch(() => setEmployees([]));
    getSalaryTemplates({ activeOnly: false }).then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const filtered = useMemo(() => structures
    .filter((item) =>
      `${item.employeeName} ${item.employeeCode} ${item.status}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom)), [structures, query]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setIsRevision(false);
    setShowForm(false);
  }

  function beginCreate() {
    setIsRevision(false);
    setShowForm(true);
  }

  function beginRevision(item) {
    setIsRevision(true);
    setForm({
      employeeId: item.employeeId,
      salaryTemplateId: item.salaryTemplateId || "",
      effectiveFrom: "",
      effectiveTo: "",
      remarks: `Revision of ${item.employeeName}'s structure`,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const payload = {
        employeeId: Number(form.employeeId),
        salaryTemplateId: Number(form.salaryTemplateId),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        remarks: form.remarks || undefined,
      };
      if (isRevision) {
        const created = await createSalaryStructureRevision(payload);
        setMessage(`Revision created for ${created.employeeName} (effective ${payrollMonthLabel(created.effectiveFrom)}).`);
      } else {
        const created = await createSalaryStructure(payload);
        setMessage(`Salary structure created for ${created.employeeName}.`);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to save salary structure.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="payroll-stack">
      {error && <div className="form-alert">{error}</div>}
      {message && <div className="success-alert">{message}</div>}

      <section className="panel">
        <div className="payroll-toolbar" style={{ marginBottom: 0 }}>
          <div className="payroll-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee or code" />
          </div>
          <label className="checkbox-line">
           
          </label>
          <button type="button" className="btn btn-primary" onClick={beginCreate}>
            <Plus size={18} /> New Structure
          </button>
        </div>
      </section>

      {showForm && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">{isRevision ? "Revision" : "New structure"}</span>
              <h2>{isRevision ? "Create salary revision" : "Assign salary structure"}</h2>
            </div>
            <button type="button" className="payroll-modal-close" onClick={resetForm} aria-label="Close"><X size={18} /></button>
          </div>
          <form className="payroll-form-grid" onSubmit={submit}>
            <label>Employee
              <select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} required>
                <option value="">Select employee…</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>{item.employeeCode} · {item.employeeName}</option>
                ))}
              </select>
            </label>
            <label>Salary template
              <select value={form.salaryTemplateId} onChange={(event) => setForm({ ...form, salaryTemplateId: event.target.value })} required>
                <option value="">Select template…</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.employeeType.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>Effective from<input type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} required /></label>
            <label>Effective to (optional)<input type="date" value={form.effectiveTo} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} /></label>
            <label>Remarks<input value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="e.g. Annual revision" /></label>
            <div className="full-span payroll-form-actions">
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : isRevision ? "Create Revision" : "Assign Structure"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Effective</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6" style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Loading structures…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <EmptyState icon={GitCommitHorizontal} title="No salary structures" note="Assign a salary structure to an employee to get started." />
                  </td>
                </tr>
              )}
              {!loading && filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.employeeName}</strong>
                    <small className="table-subtext">{item.employeeCode}</small>
                  </td>
                  <td>
                    <strong>{payrollMonthLabel(item.effectiveFrom)}</strong>
                  </td>
                  <td><strong>{formatINR(item.grossSalary)}</strong></td>
                  <td><strong>{formatINR(item.netSalary)}</strong></td>
                  <td><PayrollBadge status={item.status} /></td>
                  <td>
                    <div className="payroll-actions">
                      <button type="button" title="View breakdown" onClick={() => setDetail(item)}><Eye size={16} /></button>
                      {item.status === "ACTIVE" && (
                        <button type="button" title="Create revision" onClick={() => beginRevision(item)}><GitCommitHorizontal size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <div className="payroll-overlay" onClick={() => setDetail(null)}>
          <div className="payroll-modal" onClick={(event) => event.stopPropagation()}>
            <div className="payroll-modal-head">
              <div>
                <h2>{detail.employeeName} · salary structure</h2>
                <p>{detail.employeeCode} · effective {payrollMonthLabel(detail.effectiveFrom)}
                  {detail.effectiveTo ? ` — ${payrollMonthLabel(detail.effectiveTo)}` : ""}</p>
              </div>
              <button type="button" className="payroll-modal-close" onClick={() => setDetail(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="payroll-modal-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <PayrollBadge status={detail.status} />
                {detail.remarks && <span style={{ fontSize: 12, color: "var(--muted)" }}>{detail.remarks}</span>}
              </div>
              <div className="payroll-detail-grid">
                <EarningsSection data={detail} />
                <DeductionsSection data={detail} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
