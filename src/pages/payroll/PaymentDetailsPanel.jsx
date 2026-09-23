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
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

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

function validatePaymentDetails(form) {
  const bankName = form.bankName.trim();
  if (!/^[A-Za-z0-9 .,&()'/-]{2,100}$/.test(bankName)) {
    return "Enter a valid bank name (2–100 characters).";
  }
  if (!/^\d{9,18}$/.test(form.accountNumber)) {
    return "Account number must contain 9–18 digits.";
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode)) {
    return "Enter a valid 11-character IFSC code (for example, SBIN0001234).";
  }
  if (form.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.panNumber)) {
    return "PAN must use the format ABCDE1234F.";
  }
  if (form.uanNumber && !/^\d{12}$/.test(form.uanNumber)) {
    return "UAN number must contain exactly 12 digits.";
  }
  if (form.pfNumber && !/^[A-Z0-9/ -]{7,22}$/i.test(form.pfNumber)) {
    return "Enter a valid PF number.";
  }
  if (form.esiNumber && !/^\d{17}$/.test(form.esiNumber)) {
    return "ESI number must contain exactly 17 digits.";
  }
  return "";
}

export default function PaymentDetailsPanel() {
  const { confirm } = useConfirm();
  const { showToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
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
    try {
      setDetails(await getPaymentDetails(employeeId));
    } catch (err) {
      setDetails(null);
      showToast(
        err.status === 404
          ? "No payment details on file yet — create them below."
          : err.message || "Failed to load payment details.",
        "error"
      );
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
    const validationError = validatePaymentDetails(form);
    if (validationError) {
      setError(validationError);
      return;
    }
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
    const ok = await confirm({
      title: "Delete payment details",
      message: "Delete payment details for this employee? This can't be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
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

      {selectedId && !loading && !details && !showForm && (
        <section className="panel">
          <EmptyState
            icon={Landmark}
            title="No payment details yet"
            note="Add bank, tax and statutory details for this employee to get started."
          />
        </section>
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
            <label>Bank name<input value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} maxLength="100" required /></label>
            <label>Account number<input value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value.replace(/\D/g, "") })} inputMode="numeric" minLength="9" maxLength="18" required /></label>
            <label>IFSC code<input value={form.ifscCode} onChange={(event) => setForm({ ...form, ifscCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) })} placeholder="SBIN0001234" minLength="11" maxLength="11" required /></label>
            <label>Payment mode
              <select value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value })} required>
                {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{MODE_LABELS[mode] || mode}</option>)}
              </select>
            </label>
            <label>PAN number<input value={form.panNumber} onChange={(event) => setForm({ ...form, panNumber: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })} placeholder="ABCDE1234F" maxLength="10" /></label>
            <label>UAN number<input value={form.uanNumber} onChange={(event) => setForm({ ...form, uanNumber: event.target.value.replace(/\D/g, "").slice(0, 12) })} inputMode="numeric" maxLength="12" /></label>
            <label>PF number<input value={form.pfNumber} onChange={(event) => setForm({ ...form, pfNumber: event.target.value.toUpperCase().slice(0, 22) })} maxLength="22" /></label>
            <label>ESI number<input value={form.esiNumber} onChange={(event) => setForm({ ...form, esiNumber: event.target.value.replace(/\D/g, "").slice(0, 17) })} inputMode="numeric" maxLength="17" /></label>
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
