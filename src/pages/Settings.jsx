import { useEffect, useState } from 'react';
import {
  Pencil,
  Save,
  X,
  Clock,
  CalendarDays,
  Building2,
  ChevronRight,
  ShieldOff,
  Inbox,
  AlertTriangle,
  Loader2,
  Check,
  Timer,
  Gauge,
  ListChecks,
  Repeat2,
  MapPin,
  Globe2,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { hrmsService } from '../services/hrmsService';
import { useToast } from '../context/ToastContext';
import './Settings.css';

// Each group maps 1:1 to a live SettingController group (GET/PUT /settings/{group}).
// Field lists mirror the *active* backend request DTO fields exactly (see
// Settings_Module_Frontend_API_Implementation_Guide_Final.pdf §3). The backend
// also has notification and work-log settings modules, but their controller
// endpoints are commented out — so there are no groups for them here. Re-add a
// group only after those endpoints are actually uncommented in SettingController.
//
// `sections` purely controls layout/grouping within a group's detail panel —
// every field still lives in `fields` and is looked up by name, so the DTO
// shape driving get/save is untouched.
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
      { name: 'gracePeriodMinutes', label: 'Grace Period (minutes)', type: 'number', min: 0, required: true },
      { name: 'minimumWorkingMinutes', label: 'Minimum Working Minutes', type: 'number', min: 0, required: true },
      { name: 'halfDayWorkingMinutes', label: 'Half-Day Working Minutes', type: 'number', min: 0, required: true },
      { name: 'checkoutCutoffMinutes', label: 'Checkout Cutoff (minutes)', type: 'number', min: 0, required: true },
      { name: 'overtimeEnabled', label: 'Overtime Enabled', type: 'boolean', hint: 'Let employees log hours worked beyond office end time.' },
      { name: 'weekendAttendanceAllowed', label: 'Weekend Attendance Allowed', type: 'boolean', hint: 'Allow check-ins to be recorded on Saturdays & Sundays.' },
      { name: 'holidayAttendanceAllowed', label: 'Holiday Attendance Allowed', type: 'boolean', hint: 'Allow check-ins to be recorded on company holidays.' },
    ],
    sections: [
      { title: 'Working Hours', icon: Timer, fields: ['officeStartTime', 'officeEndTime', 'gracePeriodMinutes'] },
      { title: 'Working Time Thresholds', icon: Gauge, fields: ['minimumWorkingMinutes', 'halfDayWorkingMinutes', 'checkoutCutoffMinutes'] },
      { title: 'Attendance Rules', icon: ListChecks, fields: ['overtimeEnabled', 'weekendAttendanceAllowed', 'holidayAttendanceAllowed'] },
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
      { name: 'monthlyGuideline', label: 'Monthly Guideline (days)', type: 'number', min: 0, required: true },
      { name: 'annualPaidLeave', label: 'Annual Paid Leave (days)', type: 'number', min: 0, required: true },
      { name: 'carryForwardAllowed', label: 'Carry Forward Allowed', type: 'boolean', hint: 'Let unused leave roll over into the next year.' },
    ],
    sections: [
      { title: 'Leave Allowances', icon: Gauge, fields: ['monthlyGuideline', 'annualPaidLeave'] },
      { title: 'Leave Rules', icon: Repeat2, fields: ['carryForwardAllowed'] },
    ],
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
      { name: 'companyName', label: 'Company Name', type: 'text', required: true, maxLength: 150 },
      { name: 'companyCode', label: 'Company Code', type: 'text', required: true, maxLength: 30 },
      { name: 'email', label: 'Company Email', type: 'email', required: true, maxLength: 150 },
      { name: 'phoneNumber', label: 'Phone Number', type: 'text', pattern: '^[0-9]{10,15}$', title: '10 to 15 digits, numbers only' },
      { name: 'website', label: 'Website', type: 'text', maxLength: 150 },
      { name: 'addressLine1', label: 'Address Line 1', type: 'text', maxLength: 255 },
      { name: 'addressLine2', label: 'Address Line 2', type: 'text', maxLength: 255 },
      { name: 'city', label: 'City', type: 'text', maxLength: 100 },
      { name: 'state', label: 'State', type: 'text', maxLength: 100 },
      { name: 'country', label: 'Country', type: 'text', maxLength: 100 },
      { name: 'postalCode', label: 'Postal Code', type: 'text', maxLength: 20 },
      { name: 'timeZone', label: 'Time Zone', type: 'text', required: true },
      { name: 'currency', label: 'Currency', type: 'text', required: true, maxLength: 10 },
      { name: 'workingDaysPerWeek', label: 'Working Days per Week', type: 'number', min: 1, max: 7 },
    ],
    sections: [
      { title: 'Company Identity', icon: Building2, fields: ['companyName', 'companyCode', 'email', 'phoneNumber', 'website'] },
      { title: 'Address', icon: MapPin, fields: ['addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode'] },
      { title: 'Regional Settings', icon: Globe2, fields: ['timeZone', 'currency', 'workingDaysPerWeek'] },
    ],
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

function InputField({ field, value, disabled, onChange }) {
  return (
    <div className="settings-field">
      <label htmlFor={`f-${field.name}`}>
        {field.label}
        {field.required && <span className="req-dot" aria-hidden="true" />}
      </label>
      {field.type === 'time' ? (
        <input
          id={`f-${field.name}`}
          type="time"
          value={toTimeInputValue(value)}
          required={field.required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={`f-${field.name}`}
          type={field.type}
          value={value ?? ''}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          pattern={field.pattern}
          title={field.title}
          required={field.required}
          disabled={disabled}
          onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        />
      )}
    </div>
  );
}

export default function Settings() {
  const [activeKey, setActiveKey] = useState(GROUPS[0].key);
  const [data, setData] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const { showToast } = useToast();

  const group = GROUPS.find((g) => g.key === activeKey);
  const Icon = group.icon;

  useEffect(() => {
    setLoading(true);
    setError('');
    setNotFound(false);
    setForbidden(false);
    setEditMode(false);
    group.get()
      .then((res) => {
        setData(res);
        setOriginalData(res);
      })
      .catch((err) => {
        if (err?.status === 403) {
          setForbidden(true);
        } else if (err?.status === 404) {
          setNotFound(true);
        } else {
          setError(err.message || 'Failed to load settings.');
        }
      })
      .finally(() => setLoading(false));
  }, [activeKey]);

  const updateField = (name, value) => setData((prev) => ({ ...prev, [name]: value }));

  const startEdit = () => setEditMode(true);

  const cancelEdit = () => {
    setData(originalData);
    setEditMode(false);
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...data };
      for (const field of group.fields) {
        if (field.type === 'time') payload[field.name] = fromTimeInputValue(payload[field.name]);
      }
      const saved = await group.save(payload);
      setData(saved);
      setOriginalData(saved);
      setEditMode(false);
      showToast(`${group.label} settings saved.`, 'success');
    } catch (err) {
      const msg = err.message || 'Failed to save settings.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const fieldByName = (name) => group.fields.find((f) => f.name === name);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Manage attendance, leave and company configuration."
      />

      <div className="settings-shell">
        <nav className="settings-nav" role="tablist" aria-label="Settings groups">
          <div className="settings-nav-label">Configuration</div>
          {GROUPS.map((g) => {
            const GIcon = g.icon;
            const isActive = activeKey === g.key;
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`settings-nav-item accent-${g.accent}${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveKey(g.key)}
              >
                <span className="settings-nav-icon">
                  <GIcon size={18} />
                </span>
                <span className="settings-nav-text">
                  <strong>{g.label}</strong>
                  <small>{g.description}</small>
                </span>
                <ChevronRight size={16} className="settings-nav-chevron" />
              </button>
            );
          })}
        </nav>

        <section className={`settings-detail panel accent-${group.accent}`}>
          <div className="settings-detail-banner" aria-hidden="true" />
          <header className="settings-detail-header">
            <div className="settings-detail-heading">
              <span className="settings-detail-icon">
                <Icon size={20} />
              </span>
              <div>
                <h2>{group.label}</h2>
                <p>{group.description}</p>
              </div>
            </div>

            {!loading && !forbidden && !notFound && data && (
              <div className="settings-detail-actions">
                {!editMode ? (
                  <button type="button" className="btn btn-primary" onClick={startEdit}>
                    <Pencil size={16} />
                    Edit
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>
                      <X size={16} />
                      Cancel
                    </button>
                    <button type="submit" form="settings-form" className="btn btn-primary" disabled={saving}>
                      {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </>
                )}
              </div>
            )}
          </header>

          <div className="settings-detail-body">
            {loading && (
              <div className="settings-skeleton" aria-live="polite" aria-label={`Loading ${group.label.toLowerCase()} settings`}>
                <div className="skel-line skel-title" />
                <div className="skel-grid">
                  <div className="skel-line" />
                  <div className="skel-line" />
                  <div className="skel-line" />
                  <div className="skel-line" />
                </div>
                <div className="skel-line skel-title" />
                <div className="skel-row" />
                <div className="skel-row" />
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

            {!loading && !forbidden && !notFound && data && (
              <form id="settings-form" onSubmit={save}>
                {group.sections.map((section, sIdx) => {
                  const SectionIcon = section.icon;
                  const toggleFields = section.fields.map(fieldByName).filter((f) => f.type === 'boolean');
                  const inputFields = section.fields.map(fieldByName).filter((f) => f.type !== 'boolean');

                  return (
                    <div
                      className="settings-section"
                      key={section.title}
                      style={{ animationDelay: `${sIdx * 0.06}s` }}
                    >
                      <div className="settings-section-title">
                        <SectionIcon size={15} />
                        <span>{section.title}</span>
                      </div>

                      {inputFields.length > 0 && (
                        <div className="settings-field-grid">
                          {inputFields.map((field) => (
                            <InputField
                              key={field.name}
                              field={field}
                              value={data[field.name]}
                              disabled={!editMode}
                              onChange={(val) => updateField(field.name, val)}
                            />
                          ))}
                        </div>
                      )}

                      {toggleFields.length > 0 && (
                        <div className="toggle-list">
                          {toggleFields.map((field) => (
                            <ToggleField
                              key={field.name}
                              field={field}
                              checked={!!data[field.name]}
                              disabled={!editMode}
                              onChange={(val) => updateField(field.name, val)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {error && (
                  <div className="settings-alert">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}
              </form>
            )}

            {!loading && !forbidden && !notFound && !data && !error && (
              <div className="settings-state">
                <Inbox size={20} />
                <p>No settings found.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}