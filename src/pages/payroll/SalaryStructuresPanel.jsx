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
import { DeductionsSection, EarningsSection, EmptyState, PayrollBadge, StatusFilter } from "./payrollUi";
import { INPUT_LIMITS } from '../../utils/inputLimits';
import DatePicker from '../../components/DatePicker';
import SelectBox from '../../components/SelectBox';

// FULL_TIME -> "FULL TIME" (replace every underscore, not just the first one)
const formatTemplateLabel = (type) => String(type ?? "").replace(/_/g, " ").trim();

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
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [showForm, setShowForm] = useState(false);
  const [isRevision, setIsRevision] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStructures(await getSalaryStructures({ activeOnly: false }));
    } catch (err) {
      setError(err.message || "Failed to load salary structures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getEmployeeDropdown().catch(() => []),
      getSalaryTemplates({ activeOnly: false }).catch(() => []),
    ]).then(([employeeList, templateList]) => {
      if (cancelled) return;
      setEmployees(employeeList);
      setTemplates(templateList);
      setLookupsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // options for the dropdowns (real DOM rows, so they can be clicked by automation tools)
  const employeeOptions = useMemo(() => employees.map((item) => ({
    value: item.id,
    label: `${item.employeeCode} · ${item.employeeName}`,
  })), [employees]);

  const templateOptions = useMemo(() => templates.map((item) => ({
    value: item.id,
    label: formatTemplateLabel(item.employeeType),
  })), [templates]);

  const statusCounts = useMemo(() => ({
    ACTIVE: structures.filter((item) => item.status === "ACTIVE").length,
    INACTIVE: structures.filter((item) => item.status !== "ACTIVE").length,
    ALL: structures.length,
  }), [structures]);

  const filtered = useMemo(() => structures
    .filter((item) =>
      statusFilter === "ALL"
      || (statusFilter === "ACTIVE" ? item.status === "ACTIVE" : item.status !== "ACTIVE")
    )
    .filter((item) =>
      `${item.employeeName} ${item.employeeCode}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom)), [structures, query, statusFilter]);

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
    if (!form.employeeId) { setError("Please select an employee."); return; }
    if (!form.salaryTemplateId) { setError("Please select a salary template."); return; }
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
    <div className="payroll-stack page-reveal">
      {error && <div className="form-alert">{error}</div>}
      {message && <div className="success-alert">{message}</div>}
      <section className="panel">
        <div className="payroll-toolbar" style={{ marginBottom: 0 }}>
          <div className="payroll-search">
            <Search size={17} />
            <input maxLength={INPUT_LIMITS.SEARCH} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee or code" />
          </div>
          <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={statusCounts} />
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
            <label htmlFor="salary-employee">Employee
              <SelectBox
                id="salary-employee"
                name="employeeId"
                value={form.employeeId}
                onChange={(event) => setForm({ ...form, employeeId: event.target.value })}
                options={employeeOptions}
                placeholder="Select employee…"
                emptyText="No employees found"
                loading={lookupsLoading}
                required
              />
            </label>
            <label htmlFor="salary-template">Salary template
              <SelectBox
                id="salary-template"
                name="salaryTemplateId"
                value={form.salaryTemplateId}
                onChange={(event) => setForm({ ...form, salaryTemplateId: event.target.value })}
                options={templateOptions}
                placeholder="Select template…"
                emptyText="No salary templates found"
                loading={lookupsLoading}
                required
              />
            </label>
            <label>Effective from<DatePicker id="salary-effective-from" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} required /></label>
            <label>Effective to (optional)<DatePicker id="salary-effective-to" value={form.effectiveTo} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} /></label>
            <label>Remarks<input maxLength={INPUT_LIMITS.SHORT_TEXT} value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Enter remarks" /></label>
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
                    <EmptyState
                      icon={GitCommitHorizontal}
                      title={structures.length === 0
                        ? "No salary structures"
                        : query.trim()
                          ? "No salary structures match your search"
                          : `No ${statusFilter.toLowerCase()} salary structures`}
                      note={structures.length === 0
                        ? "Assign a salary structure to an employee to get started."
                        : "Try changing the search or selecting a different status filter."}
                    />
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