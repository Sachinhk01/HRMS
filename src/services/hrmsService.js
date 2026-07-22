import api from './api';
import { getSection, setSection } from './localStorageService';

const useLocal = (import.meta.env.VITE_DATA_MODE || 'local') !== 'api';
const wait = (v) => Promise.resolve(v);
const remote = (path, o) => api({ url: path, ...o }).then((r) => r.data);

export const hrmsService = {
  getProfile: (email) =>
    useLocal
      ? wait(
          (getSection('users') || []).find(
            (u) => u.email.toLowerCase() === email?.toLowerCase()
          ) || null
        )
      : remote('/auth/me').then((res) => res.data),

  saveProfile: (profile) =>
    useLocal
      ? wait(
          (() => {
            const users = (getSection('users') || []).map((u) =>
              u.id === profile.id ? { ...u, ...profile } : u
            );
            setSection('users', users);
            return users.find((u) => u.id === profile.id);
          })()
        )
      : remote('/profile', { method: 'put', data: profile }),

  getPerformance: () =>
    useLocal ? wait(getSection('performanceRecords') || []) : remote('/performance'),

  getReports: () =>
    useLocal
      ? wait({
          attendance: getSection('attendanceRecords') || [],
          leaves: getSection('leaveRequests') || [],
          employees: (getSection('users') || []).map(({ password, ...u }) => u),
        })
      : remote('/reports'),
};