import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Power,
  X,
  Loader2,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  getAllLeaveTypes,
  createLeaveType,
  updateLeaveType,
  activateLeaveType,
  deactivateLeaveType,
} from '../../services/leaveService';
// Reuses the table / modal / form styles from the Master Data settings.
import './MasterDataSettings.css';

const NAME_MAX = 50;
const DESC_MAX = 255;
const DEFAULT_MONTHLY_GUIDELINE = 2; // backend default when not provided

function errMsg(err, fallback) {
  return err?.message || fallback;
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isWholeNumber(value) {
  return /^\d+$/.test(String(value ?? '').trim());
}

export default function LeaveTypesSettings({ canManage = false }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'create' | 'edit', item? }
  const [busyId, setBusyId] = useState(null);
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getAllLeaveTypes();
      const arr = Array.isArray(list) ? list : [];
      setTypes([...arr].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
    } catch (err) {
      setError(errMsg(err, 'Failed to load leave types.'));
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeTypes = useMemo(() => types.filter((t) => t.active), [types]);
  const totalDays = useMemo(
    () => activeTypes.reduce((sum, t) => sum + (Number(t.allocatedDays) || 0), 0),
    [activeTypes],
  );

  async function toggleStatus(item) {
    if (busyId) return;

    const ok = await confirm(
      item.active
        ? {
            title: 'Deactivate leave type',
            message: `Deactivate "${item.name}"? It will no longer appear when employees apply for leave, until you activate it again.`,
            confirmText: 'Deactivate',
            danger: true,
          }
        : {
            title: 'Activate leave type',
            message: `Activate "${item.name}"? It will appear again when employees apply for leave.`,
            confirmText: 'Activate',
            danger: false,
          }
    );
    if (!ok) return;

    setBusyId(item.id);
    try {
      if (item.active) await deactivateLeaveType(item.id);
      else await activateLeaveType(item.id);
      showToast(`${item.name} ${item.active ? 'deactivated' : 'activated'}.`, 'success');
      await load();
    } catch (err) {
      showToast(errMsg(err, 'Failed to update status.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  const colCount = 6 + (canManage ? 1 : 0);

  return (
    <div className="leave-types">
      <div className="settings-section-title">
        <Tag size={15} />
        <span>Leave Types</span>
      </div>
      <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: '#8b93a7' }}>
        Define each kind of leave (for example Sick Leave or Casual Leave) and how many days employees get per year.
      </p>

      <div className="mdm-toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: '#5b6478', fontWeight: 600 }}>
          {loading
            ? 'Loading…'
            : `Total: ${totalDays} day${totalDays === 1 ? '' : 's'}/year across ${activeTypes.length} active leave type${activeTypes.length === 1 ? '' : 's'}`}
        </span>
        {canManage && (
                   <button
                type="button"
                className="btn btn-primary"
                style={{
                  padding: '6px 12px',
                  fontSize: 12.5,
                  minHeight: 0,
                  gap: 6,
                  borderRadius: 10,
                  marginBottom: 16,
                }}
                onClick={() => setModal({ mode: 'create' })}
              >
                <Plus size={14} />
                Add Leave Type
              </button>
                    )}
      </div>

      {error && (
        <div className="mdm-alert">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      <div className="mdm-table-wrap">
        <table className="mdm-table">
          <thead>
            <tr>
              <th>Leave Type</th>
              <th>Paid</th>
              <th>Days / Year</th>
              <th>Monthly Guideline</th>
              <th>Carry Forward</th>
              <th>Status</th>
              {canManage && <th className="mdm-col-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colCount} className="mdm-loading">
                  <Loader2 size={16} className="spin" /> Loading…
                </td>
              </tr>
            )}
            {!loading && types.length === 0 && (
              <tr>
                <td colSpan={colCount} className="mdm-empty">
                  No leave types found{canManage ? '. Use "Add Leave Type" to create one.' : '.'}
                </td>
              </tr>
            )}
            {!loading && types.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  {item.description && <div className="mdm-desc">{item.description}</div>}
                </td>
                <td>{item.paid ? 'Paid' : 'Unpaid'}</td>
                <td>{item.allocatedDays}</td>
                <td>{item.monthlyGuideline}</td>
                <td>{item.carryForwardAllowed ? 'Yes' : 'No'}</td>
                <td>
                  {canManage ? (
                    <button
                      type="button"
                      className={`mdm-status${item.active ? ' is-active' : ''}`}
                      onClick={() => toggleStatus(item)}
                      disabled={busyId === item.id}
                      title={item.active ? 'Click to deactivate' : 'Click to activate'}
                    >
                      <Power size={12} />
                      {item.active ? 'Active' : 'Inactive'}
                    </button>
                  ) : (
                    <span>{item.active ? 'Active' : 'Inactive'}</span>
                  )}
                </td>
                {canManage && (
                  <td className="mdm-col-actions">
                    <div className="mdm-row-actions">
                      <button type="button" title="Edit Leave Type" onClick={() => setModal({ mode: 'edit', item })}>
                        <Pencil size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <LeaveTypeFormModal
          mode={modal.mode}
          item={modal.item}
          types={types}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function LeaveTypeFormModal({ mode, item, types, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(isEdit ? (item.name || '') : '');
  const [description, setDescription] = useState(isEdit ? (item.description || '') : '');
  const [paid, setPaid] = useState(isEdit ? !!item.paid : true);
  const [allocatedDays, setAllocatedDays] = useState(isEdit ? String(item.allocatedDays ?? '') : '');
  const [monthlyGuideline, setMonthlyGuideline] = useState(
    isEdit ? String(item.monthlyGuideline ?? DEFAULT_MONTHLY_GUIDELINE) : String(DEFAULT_MONTHLY_GUIDELINE),
  );
  const [carryForward, setCarryForward] = useState(isEdit ? !!item.carryForwardAllowed : false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const { showToast } = useToast();

  const normalizedName = normalizeName(name);
  const isDuplicate = !!normalizedName && types.some(
    (t) => t.id !== item?.id && normalizeName(t.name).toLowerCase() === normalizedName.toLowerCase(),
  );

  function validate() {
    if (!normalizedName) return 'Leave type name is required.';
    if (normalizedName.length > NAME_MAX) return `Leave type name must be ${NAME_MAX} characters or fewer.`;
    if (isDuplicate) return `A leave type named "${normalizedName}" already exists.`;
    if (description.length > DESC_MAX) return `Description must be ${DESC_MAX} characters or fewer.`;
    if (String(allocatedDays).trim() === '') return 'Days per year is required.';
    if (!isWholeNumber(allocatedDays)) return 'Days per year must be a whole number, 0 or more.';
    if (String(monthlyGuideline).trim() === '') return 'Monthly guideline is required.';
    if (!isWholeNumber(monthlyGuideline)) return 'Monthly guideline must be a whole number, 0 or more.';
    return '';
  }

  async function submit(event) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        name: normalizedName,
        description: description.trim() || null,
        paid,
        allocatedDays: Number(allocatedDays),
        monthlyGuideline: Number(monthlyGuideline),
        carryForwardAllowed: carryForward,
      };
      if (isEdit) await updateLeaveType(item.id, payload);
      else await createLeaveType(payload);
      showToast(`Leave type ${isEdit ? 'updated' : 'created'}.`, 'success');
      onSaved();
    } catch (err) {
      const message = errMsg(err, 'Something went wrong.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card mdm-modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdm-modal-head">
          <h3>{isEdit ? 'Edit Leave Type' : 'Add Leave Type'}</h3>
          <button type="button" className="mdm-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="mdm-form">
          <label className="mdm-field">
            
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={NAME_MAX}
              placeholder="e.g. Sick Leave"
              required
              autoFocus
            />
            {isDuplicate && <small className="mdm-field-warn">A leave type with this name already exists.</small>}
          </label>

              <label className="mdm-field">
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={DESC_MAX}
                  rows={2}
                />
                <small style={{ textAlign: 'right', fontSize: 11.5, opacity: 0.7 }}>
                  {description.length}/{DESC_MAX}
                </small>
              </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="mdm-field">
              Days per Year
              <input
                type="number"
                min="0"
                step="1"
                value={allocatedDays}
                onChange={(event) => setAllocatedDays(event.target.value)}
                required
              />
            </label>
            <label className="mdm-field">
              Monthly Guideline (days)
              <input
                type="number"
                min="0"
                step="1"
                value={monthlyGuideline}
                onChange={(event) => setMonthlyGuideline(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="mdm-active-row">
            <div>
              <strong>Paid leave</strong>
              <span>Turn off for unpaid leave types.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={paid}
              aria-label="Paid leave"
              className={`switch${paid ? ' is-on' : ''}`}
              onClick={() => setPaid((v) => !v)}
            >
              <span className="switch-thumb" />
            </button>
          </div>

          <div className="mdm-active-row">
            <div>
              <strong>Carry forward allowed</strong>
              <span>Unused monthly guideline days don't expire at month-end.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={carryForward}
              aria-label="Carry forward allowed"
              className={`switch${carryForward ? ' is-on' : ''}`}
              onClick={() => setCarryForward((v) => !v)}
            >
              <span className="switch-thumb" />
            </button>
          </div>

          {formError && (
            <div className="mdm-alert">
              <AlertTriangle size={15} />
              {formError}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving && <Loader2 size={16} className="spin" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}