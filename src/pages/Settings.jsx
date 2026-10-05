import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Pencil,
  Save,
  X,
  Clock,
  CalendarDays,
  Building2,
  ShieldOff,
  Inbox,
  Loader2,
  Check,
  Timer,
  Gauge,
  ListChecks,
  Repeat2,
  MapPin,
  Globe2,
  Database,
  AlertTriangle,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { hrmsService } from '../services/hrmsService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import MasterDataSettings from './settings/MasterDataSettings';
import LeaveTypesSettings from './settings/LeaveTypesSettings';
import './Settings.css';

// Each group maps 1:1 to a live SettingController group (GET/PUT /settings/{group}).
// Field lists mirror the *active* backend request DTO fields exactly (see
// Settings_Module_Frontend_API_Implementation_Guide_Final.pdf §3). The backend
// also has notification and work-log settings modules, but their controller
// endpoints are commented out — so there are no groups for them here. Re-add a
// group only after those endpoints are actually uncommented in SettingController.
//
// `sections` controls the cards on the page. Each section is one card that is
// read-only until its pencil is clicked; the edit dialog only shows that
// section's fields. Every field still lives in `fields` and is looked up by
// name, and a save still PUTs the whole group, so the DTO shape is untouched.
//
// Field extras (display only): `unit` shows a suffix ("min", "days"),
// `wide` makes the field span both columns in the edit dialog.
//
// A group with `custom: true` (Master Data) does not use get/save/fields/sections.
// It renders its own `component`, which loads and saves its own data.
//
// A group with `extra` renders that component below its cards (Leave uses it
// for the Leave Types table). It loads and saves its own data.
//
// A group with `roles` is only shown to those roles. Master Data is limited to
// HR_ADMIN and MANAGER because the backend's @PreAuthorize on the master data
// endpoints does not include SUPER_ADMIN (they get 403).
const GROUPS = [
  {
    key: 'attendance',
    label: 'Attendance',
    description: 'Office hours, grace periods & attendance rules',
    icon: Clock,
    accent: 'blue',
    get: hrmsService.getAttendanceSettings,
    save: hrmsService.updateAttendanceSettings,
    fields: [
      { name: 'officeStartTime', label: 'Office Start Time', type: 'time', required: true },
      { name: 'officeEndTime', label: 'Office End Time', type: 'time', required: true },
      { name: 'gracePeriodMinutes', label: 'Grace Period (minutes)', type: 'number', min: 0, required: true, unit: 'min' },
      { name: 'minimumWorkingMinutes', label: 'Minimum Working Minutes', type: 'number', min: 0, required: true, unit: 'min' },
      { name: 'halfDayWorkingMinutes', label: 'Half-Day Working Minutes', type: 'number', min: 0, required: true, unit: 'min' },
      { name: 'checkoutCutoffMinutes', label: 'Checkout Cutoff (minutes)', type: 'number', min: 0, required: true, unit: 'min' },
      { name: 'overtimeEnabled', label: 'Overtime Enabled', type: 'boolean', hint: 'Let employees log hours worked beyond office end time.' },
      { name: 'weekendAttendanceAllowed', label: 'Weekend Attendance Allowed', type: 'boolean', hint: 'Allow check-ins to be recorded on Saturdays & Sundays.' },
      { name: 'holidayAttendanceAllowed', label: 'Holiday Attendance Allowed', type: 'boolean', hint: 'Allow check-ins to be recorded on company holidays.' },
    ],
    sections: [
      { title: 'Working Hours', subtitle: 'Office timings and grace period', icon: Timer, fields: ['officeStartTime', 'officeEndTime', 'gracePeriodMinutes'] },
      { title: 'Working Time Thresholds', subtitle: 'Minimum, half-day and checkout limits', icon: Gauge, fields: ['minimumWorkingMinutes', 'halfDayWorkingMinutes', 'checkoutCutoffMinutes'] },
      { title: 'Attendance Rules', subtitle: 'Overtime, weekends and holidays', icon: ListChecks, fields: ['overtimeEnabled', 'weekendAttendanceAllowed', 'holidayAttendanceAllowed'] },
    ],
  },
  {
    key: 'leave',
    label: 'Leave',
    description: 'Annual quota, guidelines & carry-forward policy',
    icon: CalendarDays,
    accent: 'violet',
    get: hrmsService.getLeaveSettings,
    save: hrmsService.updateLeaveSettings,
    fields: [
      { name: 'monthlyGuideline', label: 'Monthly Guideline (days)', type: 'number', min: 0, required: true, unit: 'days' },
      { name: 'annualPaidLeave', label: 'Annual Paid Leave (days)', type: 'number', min: 0, required: true, unit: 'days' },
      { name: 'carryForwardAllowed', label: 'Carry Forward Allowed', type: 'boolean', hint: 'Let unused leave roll over into the next year.' },
    ],
    sections: [
      { title: 'Leave Allowances', subtitle: 'Monthly and annual leave quotas', icon: Gauge, fields: ['monthlyGuideline', 'annualPaidLeave'] },
      { title: 'Leave Rules', subtitle: 'Carry-forward policy', icon: Repeat2, fields: ['carryForwardAllowed'] },
    ],
    extra: LeaveTypesSettings,
  },
  {
    key: 'company',
    label: 'Company',
    description: 'Profile, address & regional configuration',
    icon: Building2,
    accent: 'teal',
    get: hrmsService.getCompanySettings,
    save: hrmsService.updateCompanySettings,
    fields: [
      { name: 'companyName', label: 'Company Name', type: 'text', required: true, maxLength: 150, wide: true },
      { name: 'companyCode', label: 'Company Code', type: 'text', required: true, maxLength: 30 },
      { name: 'email', label: 'Company Email', type: 'email', required: true, maxLength: 150 },
      { name: 'phoneNumber', label: 'Phone Number', type: 'text', pattern: '^[0-9]{10,15}$', title: '10 to 15 digits, numbers only' },
      { name: 'website', label: 'Website', type: 'text', maxLength: 150 },
      { name: 'addressLine1', label: 'Address Line 1', type: 'text', maxLength: 255, wide: true },
      { name: 'addressLine2', label: 'Address Line 2', type: 'text', maxLength: 255, wide: true },
      { name: 'city', label: 'City', type: 'text', maxLength: 100 },
      { name: 'state', label: 'State', type: 'text', maxLength: 100 },
      { name: 'country', label: 'Country', type: 'text', maxLength: 100 },
      { name: 'postalCode', label: 'Postal Code', type: 'text', maxLength: 20 },
      { name: 'timeZone', label: 'Time Zone', type: 'text', required: true },
      { name: 'currency', label: 'Currency', type: 'text', required: true, maxLength: 10 },
      { name: 'workingDaysPerWeek', label: 'Working Days per Week', type: 'number', min: 1, max: 7, unit: 'days / week' },
    ],
    sections: [
      { title: 'Company Identity', subtitle: 'Name, code and contact details', icon: Building2, fields: ['companyName', 'companyCode', 'email', 'phoneNumber', 'website'] },
      { title: 'Address', subtitle: 'Company address', icon: MapPin, fields: ['addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode'] },
      { title: 'Regional Settings', subtitle: 'Time zone, currency and working week', icon: Globe2, fields: ['timeZone', 'currency', 'workingDaysPerWeek'] },
    ],
  },
  {
    key: 'master-data',
    label: 'Master Data',
    description: 'Departments, designations & job titles',
    icon: Database,
    accent: 'blue',
    custom: true,
    component: MasterDataSettings,
    roles: ['HR_ADMIN', 'MANAGER'],
  },
];

// Backend LocalTime fields need HH:mm:ss; the <input type="time"> control only
// gives/accepts HH:mm, so convert on the way in and out.
function toTimeInputValue(value) {
  return value ? value.slice(0, 5) : '';
}
function fromTimeInputValue(value) {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

// ---------- Display helpers (read-only cards) ----------
function formatTime12(value) {
  if (!value) return '';
  const [h, m] = String(value).slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(value);
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// "Grace Period (minutes)" -> "Grace Period": the unit is shown with the value instead.
const shortLabel = (label) => label.replace(/\s*\([^)]*\)\s*$/, '');

function displayValue(field, value) {
  if (value === null || value === undefined || value === '') return { empty: true };
  if (field.type === 'time') return { main: formatTime12(value) };
  if (field.type === 'number') {
    if (field.unit === 'min') return { main: `${value} min` };
    if (field.unit) {
      const unit = field.unit.replace(/^days/, Number(value) === 1 ? 'day' : 'days');
      return { main: `${value} ${unit}` };
    }
  }
  return { main: String(value) };
}

// ---------- Edit-dialog draft helpers ----------
// Number inputs are edited as strings so a field can be cleared while typing;
// they are converted back to numbers on save.
function buildDraft(fields, data) {
  const draft = {};
  for (const field of fields) {
    const value = data[field.name];
    if (field.type === 'time') draft[field.name] = toTimeInputValue(value);
    else if (field.type === 'number') draft[field.name] = value === null || value === undefined ? '' : String(value);
    else if (field.type === 'boolean') draft[field.name] = !!value;
    else draft[field.name] = value ?? '';
  }
  return draft;
}

function ToggleField({ field, checked, disabled, onChange }) {
  return (
    <div className={`toggle-row${disabled ? ' is-disabled' : ''}`}>
      <div className="toggle-row-text">
        <strong>{field.label}</strong>
        {field.hint && <span>{field.hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={field.label}
        disabled={disabled}
        className={`switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-thumb">
          {checked && <Check size={12} strokeWidth={3} />}
        </span>
      </button>
    </div>
  );
}

function EditField({ field, value, onChange }) {
  const id = `f-${field.name}`;
  const hint = field.unit === 'min' ? minutesToHuman(value) : '';

  return (
    <div className={`settings-field${field.wide ? ' is-wide' : ''}`}>
      <label htmlFor={id}>
        {field.label}
      </label>
      <div className="sx-input-wrap">
        <input
          id={id}
          type={field.type}
          value={value}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          pattern={field.pattern}
          title={field.title}
          required={field.required}
          className={field.unit ? 'has-suffix' : undefined}
          onChange={(e) => onChange(e.target.value)}
          // scrolling over a focused number box must scroll the page, not change the value
          onWheel={field.type === 'number' ? (e) => e.currentTarget.blur() : undefined}
        />
        {field.unit && <span className="sx-suffix">{field.unit}</span>}
      </div>
      {hint && <small className="sx-hint">= {hint}</small>}
    </div>
  );
}

// ---------- One read-only card (one section) ----------
function SectionCard({ section, fields, data, index, flash, onEdit }) {
  const SectionIcon = section.icon;
  const inputs = fields.filter((f) => f.type !== 'boolean');
  const flags = fields.filter((f) => f.type === 'boolean');

  return (
    <article
      className={`sx-card${flash ? ' is-flash' : ''}`}
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <header className="sx-card-head">
        <span className="sx-card-icon"><SectionIcon size={18} /></span>
        <div className="sx-card-title">
          <h3>{section.title}</h3>
          {section.subtitle && <p>{section.subtitle}</p>}
        </div>
        <button
          type="button"
          className="sx-edit"
          onClick={onEdit}
          aria-label={`Edit ${section.title}`}
        >
          <Pencil size={14} />
          Edit
        </button>
      </header>

      {inputs.length > 0 && (
        <dl className="sx-info-grid">
          {inputs.map((field) => {
            const shown = displayValue(field, data[field.name]);
            return (
              <div className="sx-info" key={field.name}>
                <dt>{shortLabel(field.label)}</dt>
                <dd className={shown.empty ? 'is-empty' : undefined}>
                  {shown.empty ? 'Not set' : shown.main}
                  {shown.sub && <small>{shown.sub}</small>}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {flags.length > 0 && (
        <ul className="sx-flags">
          {flags.map((field) => {
            const on = !!data[field.name];
            return (
              <li key={field.name}>
                <div>
                  <strong>{field.label}</strong>
                  {field.hint && <span>{field.hint}</span>}
                </div>
                <span className={`sx-chip ${on ? 'is-on' : 'is-off'}`}>
                  {on ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  {on ? 'Enabled' : 'Disabled'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

// ---------- Edit dialog (one section at a time) ----------
function EditDialog({ group, editing, onDraftChange, saving, error, onClose, onSubmit }) {
  const { section, draft, initial } = editing;
  const dialogRef = useRef(null);
  const SectionIcon = section.icon;
  const fields = section.fields.map((name) => group.fields.find((f) => f.name === name));
  const inputs = fields.filter((f) => f.type !== 'boolean');
  const flags = fields.filter((f) => f.type === 'boolean');
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('input:not([disabled]), button.switch')?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!saving) onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    // keep keyboard focus inside the dialog
    const nodes = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled])');
    if (!nodes?.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={`sx-overlay accent-${group.accent}`}
      role="presentation"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        // a click on the dim background closes it, but never throws away typed changes
        if (event.target === event.currentTarget && !dirty && !saving) onClose();
      }}
    >
      <div ref={dialogRef} className="sx-dialog" role="dialog" aria-modal="true" aria-labelledby="sx-dialog-title">
        <header className="sx-dialog-head">
          <span className="sx-dialog-icon"><SectionIcon size={20} /></span>
          <div>
            <h3 id="sx-dialog-title">Edit {section.title}</h3>
            <p>{group.label} settings</p>
          </div>
          <button type="button" className="sx-close" onClick={onClose} disabled={saving} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={onSubmit} className="sx-dialog-form">
          <div className="sx-dialog-body">
            {inputs.length > 0 && (
              <div className="sx-form-grid">
                {inputs.map((field) => (
                  <EditField
                    key={field.name}
                    field={field}
                    value={draft[field.name]}
                    onChange={(value) => onDraftChange(field.name, value)}
                  />
                ))}
              </div>
            )}

            {flags.length > 0 && (
              <div className="toggle-list">
                {flags.map((field) => (
                  <ToggleField
                    key={field.name}
                    field={field}
                    checked={!!draft[field.name]}
                    onChange={(value) => onDraftChange(field.name, value)}
                  />
                ))}
              </div>
            )}

            {error && (
              <div className="sx-error" role="alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <footer className="sx-dialog-foot">
            <span className={`sx-dirty${dirty ? ' is-visible' : ''}`}>Unsaved changes</span>
            <div className="sx-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function Settings() {
  const [activeKey, setActiveKey] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState(null); // { section, draft, initial }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedSection, setSavedSection] = useState('');
  const returnFocusRef = useRef(null);
  const { showToast } = useToast();
  const { user } = useAuth();

  const userRole = user?.role || user?.roles?.[0];
  // Only the groups this role is allowed to see (groups without `roles` are for everyone).
  const visibleGroups = GROUPS.filter((g) => !g.roles || g.roles.includes(userRole));
  // Backend only lets HR_ADMIN and MANAGER create/edit leave types; others see a read-only table.
  const canManageLeaveTypes = userRole === 'HR_ADMIN' || userRole === 'MANAGER';

  // Opens on the first section instead of an empty panel.
  const group = visibleGroups.find((g) => g.key === (activeKey ?? visibleGroups[0]?.key)) || null;
  const groupKey = group?.key;
  const Icon = group?.icon;
  const CustomPanel = group?.component;
  const ExtraPanel = group?.extra;

  useEffect(() => {
    setEditing(null);
    setSaveError('');
    setSavedSection('');
    // A custom group (Master Data) loads its own data: reset and skip the settings GET.
    if (!group || group.custom) {
      setData(null);
      setLoading(false);
      setNotFound(false);
      setForbidden(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setForbidden(false);
    group.get()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 403) {
          setForbidden(true);
        } else if (err?.status === 404) {
          setNotFound(true);
        } else {
          setData(null);
          showToast(err.message || 'Failed to load settings.', 'error');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  // The "just saved" highlight on a card fades after a moment.
  useEffect(() => {
    if (!savedSection) return undefined;
    const timer = setTimeout(() => setSavedSection(''), 1800);
    return () => clearTimeout(timer);
  }, [savedSection]);

  const fieldByName = (name) => group?.fields.find((f) => f.name === name);

  const openEdit = (section, event) => {
    returnFocusRef.current = event.currentTarget;
    const draft = buildDraft(section.fields.map(fieldByName), data);
    setSaveError('');
    setEditing({ section, draft, initial: draft });
  };

  const closeEdit = () => {
    if (saving) return;
    setEditing(null);
    setSaveError('');
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  const changeDraft = (name, value) =>
    setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, [name]: value } } : prev));

  const save = async (event) => {
    event.preventDefault();
    if (!editing) return;
    const { section, draft } = editing;

    // Start from the full group so the PUT still carries every field.
    const payload = { ...data };
    for (const name of section.fields) {
      const field = fieldByName(name);
      const raw = draft[name];
      if (field.type === 'time') payload[name] = fromTimeInputValue(raw);
      else if (field.type === 'number') payload[name] = raw === '' ? null : Number(raw);
      else if (field.type === 'boolean') payload[name] = !!raw;
      else payload[name] = raw;
    }

    setSaving(true);
    setSaveError('');
    try {
      const saved = await group.save(payload);
      setData(saved || payload);
      setEditing(null);
      setSavedSection(section.title);
      showToast(`${section.title} saved.`, 'success');
      requestAnimationFrame(() => returnFocusRef.current?.focus());
    } catch (err) {
      const message = err.message || 'Failed to save settings.';
      setSaveError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectTab = (key) => setActiveKey(key);

  // Left/Right arrows move between the tabs.
  const handleTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const current = visibleGroups.findIndex((g) => g.key === group?.key);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = visibleGroups[(current + step + visibleGroups.length) % visibleGroups.length];
    selectTab(next.key);
    document.getElementById(`settings-tab-${next.key}`)?.focus();
  };

  const tabs = (
    <nav className="settings-tabs" role="tablist" aria-label="Settings groups" onKeyDown={handleTabKeyDown}>
      {visibleGroups.map((g) => {
        const GIcon = g.icon;
        const isActive = group?.key === g.key;
        return (
          <button
            key={g.key}
            id={`settings-tab-${g.key}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="settings-panel"
            tabIndex={isActive ? 0 : -1}
            className={`settings-tab accent-${g.accent}${isActive ? ' is-active' : ''}`}
            onClick={() => selectTab(g.key)}
          >
            <GIcon size={16} />
            <span>{g.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="page-stack settings-page">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Manage attendance, leave, company and master data configuration."
        action={tabs}
      />

      <div className="settings-shell">
        <section
          id="settings-panel"
          role="tabpanel"
          aria-labelledby={group ? `settings-tab-${group.key}` : undefined}
          className={`settings-detail${group ? ` accent-${group.accent}` : ''}`}
        >
          {!group ? (
            <div className="sx-card sx-empty">
              <span className="settings-empty-icon">
                <ListChecks size={22} />
              </span>
              <h2>Nothing to configure</h2>
              <p>There are no settings available for your role.</p>
            </div>
          ) : (
            <>
              <header className="sx-hero" key={group.key}>
                <span className="sx-hero-icon">
                  <Icon size={24} />
                </span>
                <div>
                  <h2>{group.label}</h2>
                  <p>{group.description}</p>
                </div>
                <Icon size={110} strokeWidth={1.2} className="sx-hero-watermark" aria-hidden="true" />
              </header>

              {group.custom ? (
                <div className="sx-card sx-card--plain">
                  <CustomPanel />
                </div>
              ) : (
                <div className="sx-stack">
                  {loading && (
                    <div className="sx-stack" aria-live="polite" aria-label={`Loading ${group.label.toLowerCase()} settings`}>
                      {[0, 1].map((n) => (
                        <div className="sx-card sx-card--plain settings-skeleton" key={n}>
                          <div className="skel-line skel-title" />
                          <div className="skel-grid">
                            <div className="skel-line" />
                            <div className="skel-line" />
                            <div className="skel-line" />
                            <div className="skel-line" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!loading && forbidden && (
                    <div className="settings-state">
                      <ShieldOff size={20} />
                      <p>You don't have access to {group.label.toLowerCase()} settings.</p>
                    </div>
                  )}

                  {!loading && notFound && (
                    <div className="settings-state">
                      <Inbox size={20} />
                      <p>{group.label} settings haven't been initialized yet for this company.</p>
                    </div>
                  )}

                  {!loading && !forbidden && !notFound && data && group.sections.map((section, index) => (
                    <SectionCard
                      key={`${group.key}-${section.title}`}
                      section={section}
                      fields={section.fields.map(fieldByName)}
                      data={data}
                      index={index}
                      flash={savedSection === section.title}
                      onEdit={(event) => openEdit(section, event)}
                    />
                  ))}

                  {!loading && !forbidden && !notFound && !data && (
                    <div className="settings-state">
                      <Inbox size={20} />
                      <p>No settings found.</p>
                    </div>
                  )}

                  {ExtraPanel && (
                    <div className="sx-card sx-card--plain">
                      <ExtraPanel canManage={canManageLeaveTypes} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {editing && group && (
        <EditDialog
          group={group}
          editing={editing}
          onDraftChange={changeDraft}
          saving={saving}
          error={saveError}
          onClose={closeEdit}
          onSubmit={save}
        />
      )}
    </div>
  );
}