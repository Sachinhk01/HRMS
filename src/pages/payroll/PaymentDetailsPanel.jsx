import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Landmark, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { INPUT_LIMITS } from '../../utils/inputLimits';
import './PaymentDetailsPanel.css';

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

/**
 * Employee dropdown for Payment Details.
 *
 * Replaces the native <select>: a native select opens an OS-drawn popup that is not part of the
 * page DOM, so Selenium / Playwright / Cypress cannot click its options. This one is plain DOM:
 *   button  : data-testid="payment-employee-select"  (role="combobox", aria-expanded)
 *   list    : data-testid="payment-employee-list"    (role="listbox")
 *   option  : data-testid="payment-employee-option-<employeeId>", data-value="<employeeId>"
 *   reset   : data-testid="payment-employee-option-none"
 */
function EmployeeSelect({ employees, value, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const placeholder = loading
    ? "Loading employees…"
    : employees.length === 0
      ? "No employees found"
      : "Select an employee…";

  const selected = employees.find((item) => String(item.id) === String(value)) || null;
  const options = useMemo(() => [{ id: "", none: true }, ...employees], [employees]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    if (loading) return;
    const index = selected ? options.findIndex((o) => String(o.id) === String(selected.id)) : 0;
    setActive(Math.max(index, 0));
    setOpen(true);
  }

  function choose(option) {
    onChange(option.none ? "" : String(option.id));
    setOpen(false);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openList();
      else setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (open) setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) openList();
      else if (options[active]) choose(options[active]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="pd-select" ref={wrapRef}>
      <button
        type="button"
        id="payment-employee-select"
        name="employeeId"
        className={`pd-select-btn${open ? " is-open" : ""}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="payment-employee-list"
        aria-label="Select an employee"
        data-testid="payment-employee-select"
        data-value={selected ? String(selected.id) : ""}
        disabled={loading}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "" : "pd-select-placeholder"}>
          {selected ? `${selected.employeeCode} · ${selected.employeeName}` : placeholder}
        </span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <ul className="pd-select-list" id="payment-employee-list" role="listbox" ref={listRef} data-testid="payment-employee-list">
          {options.map((option, index) => {
            const isSelected = option.none ? !selected : selected && String(selected.id) === String(option.id);
            return (
              <li
                key={option.none ? "none" : option.id}
                role="option"
                aria-selected={Boolean(isSelected)}
                data-active={index === active}
                data-value={option.none ? "" : String(option.id)}
                data-testid={option.none ? "payment-employee-option-none" : `payment-employee-option-${option.id}`}
                className={`pd-select-option${index === active ? " is-active" : ""}${isSelected ? " is-selected" : ""}`}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span>{option.none ? placeholder : `${option.employeeCode} · ${option.employeeName}`}</span>
                {isSelected && <Check size={15} />}
              </li>
            );
          })}
          {employees.length === 0 && !loading && <li className="pd-select-empty">No employees found</li>}
        </ul>
      )}
    </div>
  );
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [employeesLoading, setEmployeesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getEmployeeDropdown()
      .then((list) => { if (!cancelled) setEmployees(list || []); })
      .catch((err) => {
        if (cancelled) return;
        setEmployees([]);
        showToast(err.message || "Failed to load employees.", "error");
      })
      .finally(() => { if (!cancelled) setEmployeesLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No .slice(): the old 40-item cap hid everyone after the first 40 unless you searched.
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return employees.filter((item) =>
      `${item.employeeCode} ${item.employeeName}`.toLowerCase().includes(term)
    );
  }, [employees, query]);

  const load = useCallback(async (employeeId) => {
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
  }, [showToast]);

  useEffect(() => { load(selectedId); }, [selectedId, load]);

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
    <div className="payroll-stack page-reveal">
      {error && <div className="form-alert">{error}</div>}
      {message && <div className="success-alert">{message}</div>}
      <section className="panel">
        <div className="payroll-toolbar" style={{ marginBottom: 0 }}>
          <div className="payroll-search">
            <Search size={17} />
            <input id="payment-employee-search" name="employeeSearch" data-testid="payment-employee-search" maxLength={INPUT_LIMITS.SEARCH} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee…" autoComplete="off" />
          </div>
          <EmployeeSelect
            employees={filtered}
            value={selectedId}
            onChange={setSelectedId}
            loading={employeesLoading}
          />
          {selectedId && !details && (
            <button type="button" className="btn btn-primary" data-testid="payment-add-details-btn" onClick={beginCreate}>
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
          </div>
          <form className="payroll-form-grid" onSubmit={submit} data-testid="payment-details-form">
            <label>Bank name<input name="bankName" data-testid="payment-bankName-input" placeholder="Enter bank name" value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} maxLength="100" required /></label>
            <label>Account number<input name="accountNumber" data-testid="payment-accountNumber-input" placeholder="Enter account number" value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value.replace(/\D/g, "") })} inputMode="numeric" minLength="9" maxLength="18" required /></label>
            <label>IFSC code<input name="ifscCode" data-testid="payment-ifscCode-input" value={form.ifscCode} onChange={(event) => setForm({ ...form, ifscCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) })} placeholder="Enter IFSC code" minLength="11" maxLength="11" required /></label>
            <label>Payment mode
              <select name="paymentMode" data-testid="payment-mode-select" value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value })} required>
                {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{MODE_LABELS[mode] || mode}</option>)}
              </select>
            </label>
            <label>PAN number<input name="panNumber" data-testid="payment-panNumber-input" value={form.panNumber} onChange={(event) => setForm({ ...form, panNumber: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })} placeholder="Enter PAN number" maxLength="10" /></label>
            <label>UAN number<input name="uanNumber" data-testid="payment-uanNumber-input" placeholder="Enter UAN number" value={form.uanNumber} onChange={(event) => setForm({ ...form, uanNumber: event.target.value.replace(/\D/g, "").slice(0, 12) })} inputMode="numeric" maxLength="12" /></label>
            <label>PF number<input name="pfNumber" data-testid="payment-pfNumber-input" placeholder="Enter PF number" value={form.pfNumber} onChange={(event) => setForm({ ...form, pfNumber: event.target.value.toUpperCase().slice(0, 22) })} maxLength="22" /></label>
            <label>ESI number<input name="esiNumber" data-testid="payment-esiNumber-input" placeholder="Enter ESI number" value={form.esiNumber} onChange={(event) => setForm({ ...form, esiNumber: event.target.value.replace(/\D/g, "").slice(0, 17) })} inputMode="numeric" maxLength="17" /></label>
            <div className="full-span payroll-form-actions">
              <button type="button" className="btn btn-secondary" data-testid="payment-cancel-btn" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-primary" data-testid="payment-save-btn" disabled={saving}>
                {saving ? "Saving…" : details ? "Save Changes" : "Add Details"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}