import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  X,
  Loader2,
  AlertTriangle,
  Building2,
  Users,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  listDepartments, createDepartment, updateDepartment, setDepartmentStatus, deleteDepartment,
  listDesignations, createDesignation, updateDesignation, setDesignationStatus, deleteDesignation,
  listJobTitles, createJobTitle, updateJobTitle, setJobTitleStatus, deleteJobTitle,
  lookupDepartments, lookupDesignations, getDesignation,
} from '../../services/masterDataService';
// Reuses .switch / .switch-thumb from the parent Settings page (Settings.css
// is already loaded whenever this component is mounted).
import './MasterDataSettings.css';

const PAGE_SIZE = 10;

// One config per resource drives the whole table + form — see
// MasterModule_frontendGuide.pdf for the backend contract this mirrors.
const RESOURCES = {
  department: {
    key: 'department',
    label: 'Departments',
    singular: 'Department',
    icon: Building2,
    nameField: 'departmentName',
    nameLabel: 'Department Name',
    codeField: 'departmentCode',
    hasDescription: true,
    maxName: 100,
    maxDescription: 255,
    defaultSortBy: 'departmentName',
    parent: null,
    api: { list: listDepartments, create: createDepartment, update: updateDepartment, setStatus: setDepartmentStatus, remove: deleteDepartment },
  },
  designation: {
    key: 'designation',
    label: 'Designations',
    singular: 'Designation',
    icon: Users,
    nameField: 'designationName',
    nameLabel: 'Designation Name',
    codeField: 'designationCode',
    hasDescription: true,
    maxName: 255,
    maxDescription: 255,
    defaultSortBy: 'designationName',
    parent: { field: 'departmentId', nameField: 'departmentName', label: 'Department' },
    api: { list: listDesignations, create: createDesignation, update: updateDesignation, setStatus: setDesignationStatus, remove: deleteDesignation },
  },
  jobTitle: {
    key: 'jobTitle',
    label: 'Job Titles',
    singular: 'Job Title',
    icon: Tag,
    nameField: 'jobTitle',
    nameLabel: 'Job Title',
    codeField: 'jobTitleCode',
    hasDescription: false,
    maxName: 100,
    defaultSortBy: 'jobTitle',
    parent: { field: 'designationId', nameField: 'designationName', label: 'Designation' },
    api: { list: listJobTitles, create: createJobTitle, update: updateJobTitle, setStatus: setJobTitleStatus, remove: deleteJobTitle },
  },
};

const TABS = [RESOURCES.department, RESOURCES.designation, RESOURCES.jobTitle];

function errMsg(err, fallback) {
  return err?.message || fallback;
}

export default function MasterDataSettings() {
  const [activeKey, setActiveKey] = useState('department');
  const resource = RESOURCES[activeKey];

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'create' | 'edit', item? }
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await resource.api.list({
        page,
        size: PAGE_SIZE,
        search,
        sortBy: resource.defaultSortBy,
        sortDirection: 'asc',
      });
      setRows(result?.content || []);
      setTotalPages(result?.totalPages ?? 1);
      setTotalElements(result?.totalElements ?? 0);
    } catch (err) {
      setError(errMsg(err, `Failed to load ${resource.label.toLowerCase()}.`));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [resource, page, search]);

  useEffect(() => { load(); }, [load]);

  function switchTab(key) {
    if (key === activeKey) return;
    setActiveKey(key);
    setPage(0);
    setSearch('');
    setSearchInput('');
  }

  function submitSearch(event) {
    event.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  }

  async function toggleStatus(item) {
    const next = !item.active;
    try {
      await resource.api.setStatus(item.id, next);
      showToast(`${resource.singular} ${next ? 'activated' : 'deactivated'}.`, 'success');
      load();
    } catch (err) {
      showToast(errMsg(err, 'Failed to update status.'), 'error');
    }
  }

  async function removeItem(item) {
    const ok = await confirm({
      title: `Delete ${resource.singular.toLowerCase()}`,
      message: `Delete "${item[resource.nameField]}"? If it's still referenced by employees${resource.parent ? ` or ${resource.parent.label.toLowerCase()}s` : ''}, the delete will fail — deactivating it is usually the safer move.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await resource.api.remove(item.id);
      showToast(`${resource.singular} deleted.`, 'success');
      if (rows.length === 1 && page > 0) setPage((p) => p - 1);
      else load();
    } catch (err) {
      showToast(errMsg(err, `Couldn't delete — it's probably still in use. Try deactivating instead.`), 'error');
    }
  }

  const colSpan = 3 + (resource.parent ? 1 : 0) + (resource.hasDescription ? 1 : 0);

  return (
    <div className="mdm">
      <div className="mdm-tabs" role="tablist" aria-label="Master data type">
        {TABS.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={activeKey === r.key}
              className={`mdm-tab${activeKey === r.key ? ' is-active' : ''}`}
              onClick={() => switchTab(r.key)}
            >
              <Icon size={15} />
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="mdm-toolbar">
        <form className="mdm-search" onSubmit={submitSearch}>
          <Search size={15} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={`Search ${resource.label.toLowerCase()}…`}
          />
        </form>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
          <Plus size={16} />
          Add {resource.singular}
        </button>
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
              <th>Code</th>
              <th>{resource.nameLabel}</th>
              {resource.parent && <th>{resource.parent.label}</th>}
              {resource.hasDescription && <th>Description</th>}
              <th>Status</th>
              <th className="mdm-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colSpan} className="mdm-loading">
                  <Loader2 size={16} className="spin" /> Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="mdm-empty">
                  No {resource.label.toLowerCase()} found{search ? ` for "${search}"` : ''}.
                </td>
              </tr>
            )}
            {!loading && rows.map((item) => (
              <tr key={item.id}>
                <td><code>{item[resource.codeField]}</code></td>
                <td><strong>{item[resource.nameField]}</strong></td>
                {resource.parent && <td>{item[resource.parent.nameField] || '—'}</td>}
                {resource.hasDescription && <td className="mdm-desc">{item.description || '—'}</td>}
                <td>
                  <button
                    type="button"
                    className={`mdm-status${item.active ? ' is-active' : ''}`}
                    onClick={() => toggleStatus(item)}
                    title={item.active ? 'Click to deactivate' : 'Click to activate'}
                  >
                    <Power size={12} />
                    {item.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="mdm-col-actions">
                  <div className="mdm-row-actions">
                    <button type="button" title={`Edit ${resource.singular}`} onClick={() => setModal({ mode: 'edit', item })}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="danger" title={`Delete ${resource.singular}`} onClick={() => removeItem(item)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && totalElements > 0 && (
        <div className="mdm-pagination">
          <span>{totalElements} total</span>
          <div className="mdm-pagination-actions">
            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 0} aria-label="Previous page">
              <ChevronLeft size={16} />
            </button>
            <strong>Page {page + 1} of {Math.max(totalPages, 1)}</strong>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages} aria-label="Next page">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {modal && (
        <MasterDataFormModal
          resource={resource}
          mode={modal.mode}
          item={modal.item}
          existingNames={rows.map((r) => (r[resource.nameField] || '').trim().toLowerCase())}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function MasterDataFormModal({ resource, mode, item, existingNames, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(isEdit ? (item[resource.nameField] || '') : '');
  const [description, setDescription] = useState(isEdit ? (item.description || '') : '');
  const [active, setActive] = useState(isEdit ? !!item.active : true);

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [loadingParents, setLoadingParents] = useState(resource.key !== 'department');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const { showToast } = useToast();

  // Load the parent dropdown(s). Lookups only return ACTIVE rows (§7 of the
  // guide), so when editing a row whose parent has since been deactivated,
  // fall back to showing that stored value as its own option.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        if (resource.key === 'designation') {
          const depts = await lookupDepartments();
          if (cancelled) return;
          let list = depts || [];
          if (isEdit && item.departmentId && !list.some((d) => String(d.id) === String(item.departmentId))) {
            list = [...list, { id: item.departmentId, name: `${item.departmentName} (inactive)` }];
          }
          setDepartments(list);
          if (isEdit) setDepartmentId(String(item.departmentId));
        } else if (resource.key === 'jobTitle') {
          const depts = await lookupDepartments();
          if (cancelled) return;
          setDepartments(depts || []);
          if (isEdit) {
            // JobTitleResponse doesn't carry departmentId, only designationId
            // (§4.2) — fetch the designation to recover it for the cascade.
            const parentDesignation = await getDesignation(item.designationId).catch(() => null);
            if (cancelled) return;
            if (parentDesignation?.departmentId) {
              const deptId = String(parentDesignation.departmentId);
              let deptList = depts || [];
              if (!deptList.some((d) => String(d.id) === deptId)) {
                deptList = [...deptList, { id: parentDesignation.departmentId, name: `${parentDesignation.departmentName} (inactive)` }];
              }
              setDepartments(deptList);
              setDepartmentId(deptId);
              const desigs = await lookupDesignations(deptId).catch(() => []);
              if (cancelled) return;
              let desigList = desigs || [];
              if (!desigList.some((d) => String(d.id) === String(item.designationId))) {
                desigList = [...desigList, { id: item.designationId, name: `${item.designationName} (inactive)` }];
              }
              setDesignations(desigList);
              setDesignationId(String(item.designationId));
            }
          }
        }
      } catch {
        // A failed lookup shouldn't block the modal — selects just stay empty
        // and the user sees "Select department" with no options.
      } finally {
        if (!cancelled) setLoadingParents(false);
      }
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.key]);

  async function onDepartmentChange(id) {
    setDepartmentId(id);
    setDesignationId('');
    setDesignations([]);
    if (resource.key === 'jobTitle' && id) {
      try {
        const desigs = await lookupDesignations(id);
        setDesignations(desigs || []);
      } catch {
        setDesignations([]);
      }
    }
  }

  const trimmedName = name.trim();
  const originalName = isEdit ? (item[resource.nameField] || '').trim().toLowerCase() : null;
  const isLikelyDuplicate = !!trimmedName
    && existingNames.includes(trimmedName.toLowerCase())
    && trimmedName.toLowerCase() !== originalName;

  function validate() {
    if (!trimmedName) return `${resource.nameLabel} is required.`;
    if (trimmedName.length > resource.maxName) return `${resource.nameLabel} must be ${resource.maxName} characters or fewer.`;
    if (resource.hasDescription && description.length > resource.maxDescription) return 'Description must be 255 characters or fewer.';
    if (resource.key === 'designation' && !departmentId) return 'Select a department.';
    if (resource.key === 'jobTitle' && !designationId) return 'Select a designation.';
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
      if (resource.key === 'department') {
        const payload = { departmentName: trimmedName, description: description.trim() || null };
        if (isEdit) await resource.api.update(item.id, { ...payload, active });
        else await resource.api.create(payload);
      } else if (resource.key === 'designation') {
        const payload = { designationName: trimmedName, departmentId: Number(departmentId), description: description.trim() || null };
        if (isEdit) await resource.api.update(item.id, { ...payload, active });
        else await resource.api.create(payload);
      } else {
        const payload = { jobTitle: trimmedName, designationId: Number(designationId) };
        if (isEdit) await resource.api.update(item.id, { ...payload, active });
        else await resource.api.create(payload);
      }
      showToast(`${resource.singular} ${isEdit ? 'updated' : 'created'}.`, 'success');
      onSaved();
    } catch (err) {
      const message = errMsg(err, 'Something went wrong.');
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const needsDepartmentSelect = resource.key === 'designation' || resource.key === 'jobTitle';

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card mdm-modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mdm-modal-head">
          <h3>{isEdit ? `Edit ${resource.singular}` : `Add ${resource.singular}`}</h3>
          <button type="button" className="mdm-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="mdm-form">
          {needsDepartmentSelect && (
            <label className="mdm-field">
              Department
              <select
                value={departmentId}
                onChange={(event) => (resource.key === 'jobTitle' ? onDepartmentChange(event.target.value) : setDepartmentId(event.target.value))}
                disabled={loadingParents}
                required
              >
                <option value="">{loadingParents ? 'Loading…' : 'Select department'}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}

          {resource.key === 'jobTitle' && (
            <label className="mdm-field">
              Designation
              <select
                value={designationId}
                onChange={(event) => setDesignationId(event.target.value)}
                disabled={!departmentId || loadingParents}
                required
              >
                <option value="">{!departmentId ? 'Select a department first' : 'Select designation'}</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}

          <label className="mdm-field">
            {resource.nameLabel}
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={resource.maxName} required autoFocus />
            {isLikelyDuplicate && <small className="mdm-field-warn">A {resource.singular.toLowerCase()} with this name may already exist.</small>}
          </label>

          {resource.hasDescription && (
            <label className="mdm-field">
              Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={resource.maxDescription} rows={3} />
            </label>
          )}

          {isEdit && (
            <div className="mdm-active-row">
              <div>
                <strong>Active</strong>
                <span>Inactive {resource.singular.toLowerCase()}s are hidden from dropdowns everywhere.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label="Active"
                className={`switch${active ? ' is-on' : ''}`}
                onClick={() => setActive((v) => !v)}
              >
                <span className="switch-thumb" />
              </button>
            </div>
          )}

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