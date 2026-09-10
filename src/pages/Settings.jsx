import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { hrmsService } from '../services/hrmsService';
import { useToast } from '../context/ToastContext';
import './Profile.css';

// Each tab maps 1:1 to a live SettingController group (GET/PUT /settings/{group}).
// Field lists mirror the *active* backend request DTO fields exactly (see
// Settings_Module_Frontend_API_Implementation_Guide_Final.pdf §3). The backend
// also has notification and work-log settings modules, but their controller
// endpoints are commented out — so there are no tabs for them here. Re-add a
// tab only after those endpoints are actually uncommented in SettingController.
const TABS = [
  {
    key: 'attendance',
    label: 'Attendance',
    get: hrmsService.getAttendanceSettings,
    save: hrmsService.updateAttendanceSettings,
    fields: [
      { name: 'officeStartTime', label: 'Office Start Time', type: 'time', required: true },
      { name: 'officeEndTime', label: 'Office End Time', type: 'time', required: true },
      { name: 'gracePeriodMinutes', label: 'Grace Period (minutes)', type: 'number', min: 0, required: true },
      { name: 'minimumWorkingMinutes', label: 'Minimum Working Minutes', type: 'number', min: 0, required: true },
      { name: 'halfDayWorkingMinutes', label: 'Half-Day Working Minutes', type: 'number', min: 0, required: true },
      { name: 'checkoutCutoffMinutes', label: 'Checkout Cutoff (minutes)', type: 'number', min: 0, required: true },
      { name: 'overtimeEnabled', label: 'Overtime Enabled', type: 'boolean' },
      { name: 'weekendAttendanceAllowed', label: 'Weekend Attendance Allowed', type: 'boolean' },
      { name: 'holidayAttendanceAllowed', label: 'Holiday Attendance Allowed', type: 'boolean' },
    ],
  },
  {
    key: 'leave',
    label: 'Leave',
    get: hrmsService.getLeaveSettings,
    save: hrmsService.updateLeaveSettings,
    fields: [
      { name: 'carryForwardAllowed', label: 'Carry Forward Allowed', type: 'boolean' },
      { name: 'monthlyGuideline', label: 'Monthly Guideline (days)', type: 'number', min: 0, required: true },
      { name: 'annualPaidLeave', label: 'Annual Paid Leave (days)', type: 'number', min: 0, required: true },
    ],
  },
  {
    key: 'company',
    label: 'Company',
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

export default function Settings() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const { showToast } = useToast();

  const tab = TABS.find((t) => t.key === activeTab);

  useEffect(() => {
    setLoading(true);
    setError('');
    setNotFound(false);
    setForbidden(false);
    tab.get()
      .then(setData)
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
  }, [activeTab]);

  const updateField = (name, value) => setData((prev) => ({ ...prev, [name]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...data };
      for (const field of tab.fields) {
        if (field.type === 'time') payload[field.name] = fromTimeInputValue(payload[field.name]);
      }
      const saved = await tab.save(payload);
      setData(saved);
      showToast(`${tab.label} settings saved.`, 'success');
    } catch (err) {
      const msg = err.message || 'Failed to save settings.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Manage attendance, leave and company configuration."
      />

      <section className="panel">
        <div className="profile-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={activeTab === t.key ? 'active' : ''}
              onClick={() => setActiveTab(t.key)}
              role="tab"
              aria-selected={activeTab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="profile-tab-content">
          {loading && <p className="empty-inline">Loading {tab.label.toLowerCase()} settings…</p>}

          {!loading && forbidden && (
            <p className="empty-inline">
              You don't have access to {tab.label.toLowerCase()} settings.
            </p>
          )}

          {!loading && notFound && (
            <p className="empty-inline">
              {tab.label} settings haven't been initialized yet for this company.
            </p>
          )}

          {!loading && !forbidden && !notFound && data && (
            <form className="form-grid" onSubmit={save}>
              {tab.fields.map((field) => (
                <label key={field.name}>
                  {field.type === 'boolean' ? (
                    <>
                      <input
                        type="checkbox"
                        checked={!!data[field.name]}
                        onChange={(e) => updateField(field.name, e.target.checked)}
                      />
                      {' '}{field.label}
                    </>
                  ) : field.type === 'time' ? (
                    <>
                      {field.label}
                      <input
                        type="time"
                        value={toTimeInputValue(data[field.name])}
                        required={field.required}
                        onChange={(e) => updateField(field.name, e.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      {field.label}
                      <input
                        type={field.type}
                        value={data[field.name] ?? ''}
                        min={field.min}
                        max={field.max}
                        maxLength={field.maxLength}
                        pattern={field.pattern}
                        title={field.title}
                        required={field.required}
                        onChange={(e) =>
                          updateField(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)
                        }
                      />
                    </>
                  )}
                </label>
              ))}

              {error && <div className="form-alert full-span">{error}</div>}

              <button className="btn btn-primary full-span" disabled={saving}>
                <Save size={18} />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          )}

          {!loading && !forbidden && !notFound && !data && !error && (
            <p className="empty-inline">No settings found.</p>
          )}
        </div>
      </section>
    </div>
  );
}