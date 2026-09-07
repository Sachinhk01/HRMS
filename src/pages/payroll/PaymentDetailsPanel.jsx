import { useEffect, useMemo, useState } from "react";
import { Landmark, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  createPaymentDetails,
  deletePaymentDetails,
  getEmployeeDropdown,
  getPaymentDetails,
  PAYMENT_MODES,
  updatePaymentDetails,
} from "../../services/payrollService";
import { EmptyState } from "./payrollUi";

const EMPTY_FORM = {
  panNumber: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  paymentMode: "BANK_TRANSFER",
  uanNumber: "",
  pfNumber: "",
  esiNumber: "",
};

const MODE_LABELS = {
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  CASH: "Cash",
};

export default function PaymentDetailsPanel() {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEmployeeDropdown().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  const filtered = useMemo(() => employees
    .filter((item) =>
      `${item.employeeCode} ${item.employeeName}`.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 40), [employees, query]);

  async function load(employeeId) {
    if (!employeeId) {
      setDetails(null);
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      setDetails(await getPaymentDetails(employeeId));
    } catch (err) {
      setDetails(null);
      if (err.status === 404) {
        setMessage("No payment details on file yet — create them below.");
      } else {
        setError(err.message || "Failed to load payment details.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(selectedId); }, [selectedId]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  function beginCreate() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function beginEdit(item) {
    setForm({
      panNumber: item.panNumber || "",
      bankName: item.bankName || "",
      accountNumber: item.accountNumber || "",
      ifscCode: item.ifscCode || "",
      paymentMode: item.paymentMode || "BANK_TRANSFER",
      uanNumber: item.uanNumber || "",
      pfNumber: item.pfNumber || "",
      esiNumber: item.esiNumber || "",
    });
    setShowForm(true);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    const payload = {
      panNumber: form.panNumber || undefined,
      bankName: form.bankName,
      accountNumber: form.accountNumber,
      ifscCode: form.ifscCode,
      paymentMode: form.paymentMode,
      uanNumber: form.uanNumber || undefined,
      pfNumber: form.pfNumber || undefined,
      esiNumber: form.esiNumber || undefined,
    };
    try {
      if (details) {
        const updated = await updatePaymentDetails(selectedId, payload);
        setDetails(updated);
        setMessage(`Payment details updated for ${updated.employeeName}.`);
      } else {
        const created = await createPaymentDetails({ employeeId: Number(selectedId), ...payload });
        setDetails(created);
        setMessage(`Payment details created for ${created.employeeName}.`);
      }
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to save payment details.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete payment details for this employee?")) return;
    setError("");
    setMessage("");
    try {
      await deletePaymentDetails(selectedId);
      setDetails(null);
      setMessage("Payment details deleted.");
    } catch (err) {
      setError(err.message || "Failed to delete payment details.");
    }
  }

  const selectedEmployee = employees.find((item) => item.id === Number(selectedId));

  return (
    <div className="payroll-stack">
      {error && <div className="form-alert">{error}</div>}
      {message && <div className="success-alert">{message}</div>}

      <section className="panel">
        <div className="payroll-toolbar" style={{ marginBottom: 0 }}>
          <div className="payroll-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee…" />
          </div>
          <select
            className="compact-select"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Select an employee…</option>
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>{item.employeeCode} · {item.employeeName}</option>
            ))}
          </select>
          {selectedId && !details && (
            <button type="button" className="btn btn-primary" onClick={beginCreate}>
              <Plus size={18} /> Add Details
            </button>
          )}
        </div>
      </section>

      {!selectedId && (
        <section className="panel">
          <EmptyState
            icon={Landmark}
            title="Choose an employee"
            note="Bank, tax and statutory details are captured per employee before payroll can be generated."
          />
        </section>
      )}

      {selectedId && loading && (
        <section className="panel"><div className="empty-inline">Loading payment details…</div></section>
      )}

      {selectedId && !loading && details && !showForm && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">On file</span>
              <h2>{details.employeeName} · {details.employeeCode}</h2>
            </div>
            <div className="payroll-actions">
              <button type="button" title="Edit" onClick={() => beginEdit(details)}><Pencil size={16} /></button>
              <button type="button" className="danger" title="Delete" onClick={remove}><Trash2 size={16} /></button>
            </div>
          </div>
          <div className="pay-details-grid">
            <div className="pay-detail-item"><span>Bank name</span><strong>{details.bankName || "—"}</strong></div>
            <div className="pay-detail-item"><span>Account number</span><strong>{details.accountNumber || "—"}</strong></div>
            <div className="pay-detail-item"><span>IFSC code</span><strong>{details.ifscCode || "—"}</strong></div>
            <div className="pay-detail-item"><span>Payment mode</span><strong>{MODE_LABELS[details.paymentMode] || details.paymentMode || "—"}</strong></div>
            <div className="pay-detail-item"><span>PAN number</span><strong>{details.panNumber || "—"}</strong></div>
            <div className="pay-detail-item"><span>UAN number</span><strong>{details.uanNumber || "—"}</strong></div>
            <div className="pay-detail-item"><span>PF number</span><strong>{details.pfNumber || "—"}</strong></div>
            <div className="pay-detail-item"><span>ESI number</span><strong>{details.esiNumber || "—"}</strong></div>
          </div>
        </section>
      )}

      {selectedId && !loading && showForm && (
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">{details ? "Update details" : "New details"}</span>
              <h2>{details ? `Edit ${details.employeeName}'s details` : `Add payment details · ${selectedEmployee?.employeeName || ""}`}</h2>
            </div>
            <button type="button" className="payroll-modal-close" onClick={resetForm} aria-label="Close"><X size={18} /></button>
          </div>
          <form className="payroll-form-grid" onSubmit={submit}>
            <label>Bank name<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} required /></label>
            <label>Account number<input value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} required /></label>
            <label>IFSC code<input value={form.ifscCode} onChange={(event) => setForm({ ...form, ifscCode: event.target.value })} required /></label>
            <label>Payment mode
              <select value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value })} required>
                {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{MODE_LABELS[mode] || mode}</option>)}
              </select>
            </label>
            <label>PAN number<input value={form.panNumber} onChange={(event) => setForm({ ...form, panNumber: event.target.value.toUpperCase() })} placeholder="ABCDE1234F" /></label>
            <label>UAN number<input value={form.uanNumber} onChange={(event) => setForm({ ...form, uanNumber: event.target.value })} /></label>
            <label>PF number<input value={form.pfNumber} onChange={(event) => setForm({ ...form, pfNumber: event.target.value })} /></label>
            <label>ESI number<input value={form.esiNumber} onChange={(event) => setForm({ ...form, esiNumber: event.target.value })} /></label>
            <div className="full-span payroll-form-actions">
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : details ? "Save Changes" : "Add Details"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
