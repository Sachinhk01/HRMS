import api from "./api";

export const ATTENDANCE_STATE = {
  WORKING: "WORKING",
  ON_BREAK: "ON_BREAK",
  CHECKED_OUT: "CHECKED_OUT",
};

export async function getAttendanceDashboard() {
  const { data } = await api.get("/attendance/dashboard");
  return data.data;
}

export async function getAttendanceHistory(params = {}) {
  const { data } = await api.get("/attendance/history", {
    params,
  });

  return data.data;
}

export async function getAttendanceCalendar(month, year) {
  const { data } = await api.get("/attendance/calendar", {
    params: {
      month,
      year,
    },
  });

  return data.data;
}

export async function checkIn(coords) {
  const { data } = await api.post("/attendance/check-in", {
    latitude: coords.latitude,
    longitude: coords.longitude,
  });

  return data.data;
}

export async function checkOut(coords) {
  const { data } = await api.post("/attendance/check-out", {
    latitude: coords.latitude,
    longitude: coords.longitude,
  });

  return data.data;
}

export async function startBreak(breakType = "LUNCH") {
  const { data } = await api.post("/attendance/break-start", {
    breakType,
  });

  return data.data;
}

export async function endBreak() {
  const { data } = await api.post("/attendance/break-end");

  return data.data;
}

// ---- Viewing another employee's attendance (Manager/HR) ----
// Confirmed live on the backend (AdminController.java, main branch):
//   GET /api/v1/admin/attendance/employee/{employeeId}?page&size&sortBy&sortDirection&fromDate&toDate&status
// Class-level @PreAuthorize on AdminController allows SUPER_ADMIN, MANAGER,
// and HR_ADMIN. Note: there is currently no team/reporting-manager check in
// AttendanceServiceImpl.getAttendanceByEmployeeId — any manager can pull any
// employee's attendance by ID, not just their direct reports. Worth raising
// with the Java team, but not a frontend blocker.
// There's no separate monthly-summary-by-employee endpoint, so the panel
// fetches the month's history (one page, generous size) and computes the
// summary stats client-side.

export async function getEmployeeAttendanceHistory(employeeId, params = {}) {
  const { data } = await api.get(`/admin/attendance/employee/${employeeId}`, {
    params,
  });

  return data.data;
}

// ---- Attendance Report (HR_ADMIN / MANAGER only) ----
// GET /reports/attendance?format=json — NOTE: unlike almost every other
// endpoint in this app, the response is NOT wrapped in { success, message,
// data }. The JSON body IS the AttendanceReportPageResponse directly:
//   { content: [...], summary: {...}, page, size, totalElements, ... }
// summary is computed over the full filtered result set, not just the
// current page, so callers that only need the summary can pass size: 1.
//
// Backend note: the controller currently guards this with
// hasAnyRole('HR','MANAGER') while every other controller uses 'HR_ADMIN'.
// hradmin/superadmin accounts will get a 403 until that's fixed on the
// Java side.
export async function getAttendanceReport(params = {}) {
  const { data } = await api.get("/reports/attendance", {
    params: { format: "json", ...params },
  });
  return data;
}

// Downloads the attendance report as a file (excel/pdf) using the existing
// /reports/attendance endpoint (format=excel|pdf). Returns the raw blob +
// a filename pulled from the Content-Disposition header when available.
export async function exportAttendanceReport(format, filters = {}) {
  const params = { format, ...filters };
  const response = await api.get("/reports/attendance", {
    params,
    responseType: "blob",
  });

  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const fallbackExt = format === "excel" ? "xlsx" : "pdf";
  const filename = match?.[1] || `attendance-report.${fallbackExt}`;

  return { blob: response.data, filename };
}