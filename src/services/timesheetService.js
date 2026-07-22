import {
  generateId,
  readStorage,
  writeStorage,
} from "./localStorageService";

const TIMESHEETS_KEY = "timesheets";

export function getTimesheets() {
  return readStorage(TIMESHEETS_KEY, []);
}

export function createTimesheet(user, formData) {
  if (!Array.isArray(formData.entries) || formData.entries.length === 0) {
    throw new Error("At least one timesheet entry is required.");
  }

  const timesheets = getTimesheets();

  const totalHours = formData.entries.reduce(
    (total, entry) => total + Number(entry.hours || 0),
    0
  );

  const newTimesheet = {
    id: generateId("timesheet"),
    employeeId: user.id,
    employeeName: user.name,
    employeeRole: user.role,
    weekStart: formData.weekStart,
    weekEnd: formData.weekEnd,
    projectId: formData.projectId || null,
    projectName: formData.projectName || "",
    entries: formData.entries,
    totalHours,
    status: "DRAFT",
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeStorage(TIMESHEETS_KEY, [newTimesheet, ...timesheets]);

  return newTimesheet;
}

export function submitTimesheet(timesheetId, userId) {
  const timesheets = getTimesheets();

  const updatedTimesheets = timesheets.map((timesheet) =>
    timesheet.id === timesheetId &&
    timesheet.employeeId === userId
      ? {
          ...timesheet,
          status: "PENDING",
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : timesheet
  );

  writeStorage(TIMESHEETS_KEY, updatedTimesheets);

  return updatedTimesheets.find(
    (timesheet) => timesheet.id === timesheetId
  );
}

export function approveTimesheet(timesheetId, approver) {
  const timesheets = getTimesheets();

  const updatedTimesheets = timesheets.map((timesheet) =>
    timesheet.id === timesheetId
      ? {
          ...timesheet,
          status: "APPROVED",
          approvedBy: approver.id,
          approvedByName: approver.name,
          approvedAt: new Date().toISOString(),
          rejectionReason: null,
          updatedAt: new Date().toISOString(),
        }
      : timesheet
  );

  writeStorage(TIMESHEETS_KEY, updatedTimesheets);

  return updatedTimesheets.find(
    (timesheet) => timesheet.id === timesheetId
  );
}

export function rejectTimesheet(timesheetId, approver, reason) {
  const timesheets = getTimesheets();

  const updatedTimesheets = timesheets.map((timesheet) =>
    timesheet.id === timesheetId
      ? {
          ...timesheet,
          status: "REJECTED",
          approvedBy: approver.id,
          approvedByName: approver.name,
          approvedAt: new Date().toISOString(),
          rejectionReason: reason,
          updatedAt: new Date().toISOString(),
        }
      : timesheet
  );

  writeStorage(TIMESHEETS_KEY, updatedTimesheets);

  return updatedTimesheets.find(
    (timesheet) => timesheet.id === timesheetId
  );
}

export function getUserTimesheets(userId) {
  return getTimesheets().filter(
    (timesheet) => timesheet.employeeId === userId
  );
}

export function getPendingTimesheetApprovals() {
  return getTimesheets().filter(
    (timesheet) => timesheet.status === "PENDING"
  );
}