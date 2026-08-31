import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { hrmsService } from '../services/hrmsService';
import { useToast } from '../context/ToastContext';
import './Profile.css';

// Each tab maps 1:1 to a SettingController group (GET/PUT /settings/{group}).
// Field lists mirror the backend request DTOs exactly, so nothing here should
// send a key the backend doesn't expect or omit one it requires.
const TABS = [
  {
    key: 'attendance',
    label: 'Attendance',
    get: hrmsService.getAttendanceSettings,
    save: hrmsService.updateAttendanceSettings,
    fields: [
      { name: 'officeStartTime', label: 'Office Start Time', type: 'time' },
      { name: 'officeEndTime', label: 'Office End Time', type: 'time' },
      { name: 'gracePeriodMinutes', label: 'Grace Period (minutes)', type: 'number' },
      { name: 'minimumWorkingMinutes', label: 'Minimum Working Minutes', type: 'number' },
      { name: 'halfDayWorkingMinutes', label: 'Half-Day Working Minutes', type: 'number' },
      { name: 'checkoutCutoffMinutes', label: 'Checkout Cutoff (minutes)', type: 'number' },
      { name: 'maximumBreakMinutes', label: 'Maximum Break Minutes', type: 'number' },
      { name: 'maximumBreaksPerDay', label: 'Maximum Breaks per Day', type: 'number' },
      { name: 'overtimeEnabled', label: 'Overtime Enabled', type: 'boolean' },
      { name: 'attendanceRegularizationEnabled', label: 'Attendance Regularization Enabled', type: 'boolean' },
      { name: 'multipleBreaksAllowed', label: 'Multiple Breaks Allowed', type: 'boolean' },
      { name: 'weekendAttendanceAllowed', label: 'Weekend Attendance Allowed', type: 'boolean' },
      { name: 'holidayAttendanceAllowed', label: 'Holiday Attendance Allowed', type: 'boolean' },
      { name: 'lateMarkEnabled', label: 'Late Mark Enabled', type: 'boolean' },
      { name: 'earlyExitEnabled', label: 'Early Exit Enabled', type: 'boolean' },
      { name: 'autoCheckoutEnabled', label: 'Auto Checkout Enabled', type: 'boolean' },
    ],
  },
  {
    key: 'leave',
    label: 'Leave',
    get: hrmsService.getLeaveSettings,
    save: hrmsService.updateLeaveSettings,
    fields: [
      { name: 'monthlyGuideline', label: 'Monthly Guideline (days)', type: 'number' },
      { name: 'annualPaidLeave', label: 'Annual Paid Leave (days)', type: 'number' },
      { name: 'minimumAdvanceNoticeDays', label: 'Minimum Advance Notice (days)', type: 'number' },
      { name: 'maximumAdvanceNoticeDays', label: 'Maximum Advance Notice (days)', type: 'number' },
      { name: 'maximumConsecutiveLeaveDays', label: 'Maximum Consecutive Leave Days', type: 'number' },
      { name: 'halfDayLeaveAllowed', label: 'Half-Day Leave Allowed', type: 'boolean' },
      { name: 'carryForwardAllowed', label: 'Carry Forward Allowed', type: 'boolean' },
      { name: 'managerApprovalRequired', label: 'Manager Approval Required', type: 'boolean' },
      { name: 'hrApprovalRequired', label: 'HR Approval Required', type: 'boolean' },
      { name: 'allowLeaveOnHoliday', label: 'Allow Leave on Holiday', type: 'boolean' },
      { name: 'allowLeaveOnWeekend', label: 'Allow Leave on Weekend', type: 'boolean' },
      { name: 'autoApproveLeave', label: 'Auto-Approve Leave', type: 'boolean' },
      { name: 'allowNegativeLeaveBalance', label: 'Allow Negative Leave Balance', type: 'boolean' },
      { name: 'allowBackdatedLeaveApplication', label: 'Allow Backdated Leave Application', type: 'boolean' },
    ],
  },
  {
    key: 'notification',
    label: 'Notifications',
    get: hrmsService.getNotificationSettings,
    save: hrmsService.updateNotificationSettings,
    fields: [
      { name: 'emailNotificationsEnabled', label: 'Email Notifications', type: 'boolean' },
      { name: 'inAppNotificationsEnabled', label: 'In-App Notifications', type: 'boolean' },
      { name: 'attendanceNotificationsEnabled', label: 'Attendance Notifications', type: 'boolean' },
      { name: 'leaveNotificationsEnabled', label: 'Leave Notifications', type: 'boolean' },
      { name: 'workLogNotificationsEnabled', label: 'Work Log Notifications', type: 'boolean' },
      { name: 'holidayNotificationsEnabled', label: 'Holiday Notifications', type: 'boolean' },
      { name: 'birthdayNotificationsEnabled', label: 'Birthday Notifications', type: 'boolean' },
      { name: 'announcementNotificationsEnabled', label: 'Announcement Notifications', type: 'boolean' },
      { name: 'notifyManagers', label: 'Notify Managers', type: 'boolean' },
      { name: 'notifyEmployees', label: 'Notify Employees', type: 'boolean' },
    ],
  },
  {
    key: 'company',
    label: 'Company',
    get: hrmsService.getCompanySettings,
    save: hrmsService.updateCompanySettings,
    fields: [
      { name: 'companyName', label: 'Company Name', type: 'text', required: true },
      { name: 'companyCode', label: 'Company Code', type: 'text', required: true },
      { name: 'email', label: 'Company Email', type: 'email', required: true },
      { name: 'phoneNumber', label: 'Phone Number', type: 'text' },
      { name: 'website', label: 'Website', type: 'text' },
      { name: 'addressLine1', label: 'Address Line 1', type: 'text' },
      { name: 'addressLine2', label: 'Address Line 2', type: 'text' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'state', label: 'State', type: 'text' },
      { name: 'country', label: 'Country', type: 'text' },
      { name: 'postalCode', label: 'Postal Code', type: 'text' },
      { name: 'timeZone', label: 'Time Zone', type: 'text', required: true },
      { name: 'currency', label: 'Currency', type: 'text', required: true },
      { name: 'workingDaysPerWeek', label: 'Working Days per Week', type: 'number', min: 1, max: 7 },
    ],
  },
  {
    key: 'work-log',
    label: 'Work Log',
    get: hrmsService.getWorkLogSettings,
    save: hrmsService.updateWorkLogSettings,
    fields: [
      { name: 'reportSubmissionDeadline', label: 'Report Submission Deadline', type: 'time' },
      { name: 'minimumWorkLogEntries', label: 'Minimum Work Log Entries', type: 'number', min: 1 },
      { name: 'reminderIntervalMinutes', label: 'Reminder Interval (minutes)', type: 'number', min: 1 },
      { name: 'minimumWorkLogDescriptionLength', label: 'Minimum Description Length', type: 'number', min: 10 },
      { name: 'workLogSubmissionRequired', label: 'Work Log Submission Required', type: 'boolean' },
      { name: 'reportRequiredBeforeCheckout', label: 'Report Required Before Checkout', type: 'boolean' },
      { name: 'workLogReminderEnabled', label: 'Work Log Reminder Enabled', type: 'boolean' },
      { name: 'managerEmailNotification', label: 'Manager Email Notification', type: 'boolean' },
      { name: 'employeePdfDownloadAllowed', label: 'Employee PDF Download Allowed', type: 'boolean' },
      { name: 'managerApprovalRequired', label: 'Manager Approval Required', type: 'boolean' },
      { name: 'allowWorkLogEditAfterSubmission', label: 'Allow Edit After Submission', type: 'boolean' },
      { name: 'autoGenerateDailySummary', label: 'Auto-Generate Daily Summary', type: 'boolean' },
      { name: 'allowMultipleReportSubmissionsPerDay', label: 'Allow Multiple Submissions per Day', type: 'boolean' },
    ],
  },
];

// reportSubmissionDeadline is the only field the backend requires as HH:mm:ss;
// everything else round-trips fine as HH:mm.
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
  const { showToast } = useToast();

  const tab = TABS.find((t) => t.key === activeTab);

  useEffect(() => {
    setLoading(true);
    setError('');
    tab.get()
      .then(setData)
      .catch((err) => setError(err?.response?.data?.message || err.message || 'Failed to load settings.'))
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
      const msg = err?.response?.data?.message || err.message || 'Failed to save settings.';
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
        description="Manage attendance, leave, notification, company and work log configuration."
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

          {!loading && data && (
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

          {!loading && !data && !error && <p className="empty-inline">No settings found.</p>}
        </div>
      </section>
    </div>
  );
}