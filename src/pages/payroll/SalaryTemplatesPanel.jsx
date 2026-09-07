import { useEffect, useMemo, useState } from "react";
import { Layers, Pencil, Plus, Power, Search, X } from "lucide-react";
import {
  createSalaryTemplate,
  EMPLOYMENT_TYPES,
  formatINR,
  getSalaryTemplates,
  updateSalaryTemplate,
  updateSalaryTemplateStatus,
} from "../../services/payrollService";
import { EmptyState, LineItem } from "./payrollUi";

const EMPTY_FORM = {
  employeeType: "FULL_TIME",
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
};

const num = (value) => (value === "" || value === null || value === undefined ? undefined : Number(value));

export default function SalaryTemplatesPanel() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setTemplates(await getSalaryTemplates({ activeOnly: false }));
    } catch (err) {
      setError(err.message || "Failed to load salary templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => templates
    .filter((item) => item.employeeType.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.employeeType.localeCompare(b.employeeType)), [templates, query]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(false);
  }

  function beginEdit(item) {
    setEditing(item);
    setForm({
      employeeType: item.employeeType,
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
    });
    setShowForm(true);
  }

  function buildPayload() {
    const earnings = {
      basicSalary: num(form.basicSalary),
      hra: num(form.hra),
      specialAllowance: num(form.specialAllowance),
      medicalAllowance: num(form.medicalAllowance),
      travelAllowance: num(form.travelAllowance),
      bonus: num(form.bonus),
      otherAllowance: num(form.otherAllowance),
    };
    const deductions = {
      pf: num(form.pf),
      esi: num(form.esi),
      professionalTax: num(form.professionalTax),
      incomeTax: num(form.incomeTax),
      otherDeduction: num(form.otherDeduction),
    };
    return { ...earnings, ...deductions };
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      if (editing) {
        await updateSalaryTemplate(editing.id, buildPayload());
        setMessage("Salary template updated successfully.");
      } else {
        await createSalaryTemplate({ employeeType: form.employeeType, ...buildPayload() });
        setMessage("Salary template created successfully.");
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to save salary template.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    if (!window.confirm(`${item.employeeType} template → ${item.active ? "deactivate" : "activate"}?`)) return;
    setError("");
    setMessage("");
    try {
      await updateSalaryTemplateStatus(item.id, !item.active);
      setMessage(`${item.employeeType} template ${item.active ? "deactivated" : "activated"}.`);
      await refresh();
    } catch (err) {
      setError(err.message || "Failed to update template status.");
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by employee type" />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            <Plus size={18} /> New Template
          </button>
        </div>
      </section>

      {showForm && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">{editing ? "Update template" : "New template"}</span>
              <h2>{editing ? `Edit ${editing.employeeType} template` : "Create salary template"}</h2>
            </div>
            <button type="button" className="payroll-modal-close" onClick={resetForm} aria-label="Close"><X size={18} /></button>
          </div>
          <form className="payroll-form-grid" onSubmit={submit}>
            {!editing && (
              <label>Employee type
                <select value={form.employeeType} onChange={(event) => setForm({ ...form, employeeType: event.target.value })}>
                  {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type.replace("_", " ")}</option>)}
                </select>
              </label>
            )}
            <label>Basic salary<input type="number" min="0" step="0.01" value={form.basicSalary} onChange={(event) => setForm({ ...form, basicSalary: event.target.value })} required /></label>
            <label>HRA<input type="number" min="0" step="0.01" value={form.hra} onChange={(event) => setForm({ ...form, hra: event.target.value })} required /></label>
            <label>Special allowance<input type="number" min="0" step="0.01" value={form.specialAllowance} onChange={(event) => setForm({ ...form, specialAllowance: event.target.value })} required /></label>
            <label>Medical allowance<input type="number" min="0" step="0.01" value={form.medicalAllowance} onChange={(event) => setForm({ ...form, medicalAllowance: event.target.value })} required /></label>
            <label>Travel allowance<input type="number" min="0" step="0.01" value={form.travelAllowance} onChange={(event) => setForm({ ...form, travelAllowance: event.target.value })} required /></label>
            <label>Bonus<input type="number" min="0" step="0.01" value={form.bonus} onChange={(event) => setForm({ ...form, bonus: event.target.value })} required /></label>
            <label>Other allowance<input type="number" min="0" step="0.01" value={form.otherAllowance} onChange={(event) => setForm({ ...form, otherAllowance: event.target.value })} required /></label>
            <label>PF<input type="number" min="0" step="0.01" value={form.pf} onChange={(event) => setForm({ ...form, pf: event.target.value })} required /></label>
            <label>ESI<input type="number" min="0" step="0.01" value={form.esi} onChange={(event) => setForm({ ...form, esi: event.target.value })} required /></label>
            <label>Professional tax<input type="number" min="0" step="0.01" value={form.professionalTax} onChange={(event) => setForm({ ...form, professionalTax: event.target.value })} required /></label>
            <label>Income tax<input type="number" min="0" step="0.01" value={form.incomeTax} onChange={(event) => setForm({ ...form, incomeTax: event.target.value })} required /></label>
            <label>Other deduction<input type="number" min="0" step="0.01" value={form.otherDeduction} onChange={(event) => setForm({ ...form, otherDeduction: event.target.value })} required /></label>
            <div className="full-span payroll-form-actions">
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee Type</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="5" style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Loading templates…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <EmptyState icon={Layers} title="No salary templates" note="Create a template to define earnings and deductions per employment type." />
                  </td>
                </tr>
              )}
              {!loading && filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.employeeType.replace("_", " ")}</strong>
                    <small className="table-subtext">Template #{item.id}</small>
                  </td>
                  <td>
                    <div className="payroll-line-items">
                      <LineItem label="Gross" value={item.grossSalary} total />
                    </div>
                  </td>
                  <td>
                    <div className="payroll-line-items">
                      <LineItem label="Total" value={item.otherDeduction} />
                    </div>
                    <small className="table-subtext">PF {formatINR(item.pf)} · PT {formatINR(item.professionalTax)}</small>
                  </td>
                  <td>
                    <span className={`payroll-badge st-${item.active ? "ACTIVE" : "INACTIVE"}`}>
                      {item.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td>
                    <div className="payroll-actions">
                      <button type="button" title="Edit template" onClick={() => beginEdit(item)}><Pencil size={16} /></button>
                      <button type="button" title={item.active ? "Deactivate" : "Activate"} onClick={() => toggleActive(item)}>
                        <Power size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
