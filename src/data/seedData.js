export const STORAGE_VERSION = 4;

export const emptyStore = {
  users: [],
  attendanceRecords: [],
  leaveRequests: [],
  holidays: [],
  posts: [],
  announcements: [],
  events: [],
  performanceRecords: [],
  notifications: [],
  employeeOfMonth: null,
  settings: { notifications: true, theme: 'light', sessionTimeout: 30 },
};