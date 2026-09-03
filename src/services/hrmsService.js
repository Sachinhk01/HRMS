import { getMyProfile, updateMyProfile, uploadMyProfilePhoto } from './employeeService';
import { getEmployeePayrollHistory } from './payrollService';
import api from './api';

const normalizePayslip = (item, index = 0) => {
  const month = item?.payrollMonth || item?.month || `Month ${index + 1}`;
  const toEntries = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).map(([label, amount]) => [label, Number(amount) || 0]);
  };

  return {
    ...item,
    id: item?.id ?? `${month}-${index}`,
    month,
    netPay: Number(item?.netPay ?? item?.totalNetPay ?? item?.netSalary ?? 0),
    earnings: toEntries(item?.earnings),
    deductions: toEntries(item?.deductions),
  };
};

export const hrmsService = {
  getProfile: () => getMyProfile(),
  saveProfile: (updates) => updateMyProfile(updates),
  uploadPhoto: (file) => uploadMyProfilePhoto(file),

  getPayslips: async () => {
    try {
      const profile = await getMyProfile().catch(() => null);
      const employeeId = profile?.employeeId || profile?.employee?.id || profile?.id;

      if (!employeeId) return [];

      const history = await getEmployeePayrollHistory(employeeId).catch(() => []);
      const items = Array.isArray(history) ? history : [];
      return items.map((item, index) => normalizePayslip(item, index));
    } catch {
      return [];
    }
  },

  changePassword: async ({ oldPassword, newPassword, confirmPassword }) => {
    const { data } = await api.post('/auth/change-password', {
      oldPassword,
      newPassword,
      confirmPassword,
    });
    return data;
  },

  // Access: SUPER_ADMIN, HR_ADMIN, MANAGER (enforced server-side via @PreAuthorize)
  getAttendanceSettings: async () => {
    const { data } = await api.get('/settings/attendance');
    return data.data;
  },
  updateAttendanceSettings: async (settings) => {
    const { data } = await api.put('/settings/attendance', settings);
    return data.data;
  },

  getLeaveSettings: async () => {
    const { data } = await api.get('/settings/leave');
    return data.data;
  },
  updateLeaveSettings: async (settings) => {
    const { data } = await api.put('/settings/leave', settings);
    return data.data;
  },

  getNotificationSettings: async () => {
    const { data } = await api.get('/settings/notification');
    return data.data;
  },
  updateNotificationSettings: async (settings) => {
    const { data } = await api.put('/settings/notification', settings);
    return data.data;
  },

  getCompanySettings: async () => {
    const { data } = await api.get('/settings/company');
    return data.data;
  },
  updateCompanySettings: async (settings) => {
    const { data } = await api.put('/settings/company', settings);
    return data.data;
  },

  getWorkLogSettings: async () => {
    const { data } = await api.get('/settings/work-log');
    return data.data;
  },
  updateWorkLogSettings: async (settings) => {
    const { data } = await api.put('/settings/work-log', settings);
    return data.data;
  },
};