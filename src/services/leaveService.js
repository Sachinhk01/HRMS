import api from "./api";

// ---- Leave Types ----
export async function getActiveLeaveTypes() {
  const { data } = await api.get("/leave-types/active");
  return data.data;
}

export async function getAllLeaveTypes() {
  const { data } = await api.get("/leave-types");
  return data.data;
}

export async function getLeaveType(leaveTypeId) {
  const { data } = await api.get(`/leave-types/${leaveTypeId}`);
  return data.data;
}

// POST /leave-types  (HR_ADMIN, MANAGER)
// name: required, max 50 · description: max 255 · paid: required
// allocatedDays: required, >= 0 · monthlyGuideline: >= 0 (backend defaults to 2)
export async function createLeaveType({
  name,
  description,
  paid,
  allocatedDays,
  monthlyGuideline,
  carryForwardAllowed,
}) {
  const { data } = await api.post("/leave-types", {
    name,
    description,
    paid,
    allocatedDays,
    monthlyGuideline,
    // Primitive boolean on the backend: if omitted it silently becomes false.
    carryForwardAllowed: !!carryForwardAllowed,
  });
  return data.data;
}

// PUT /leave-types/{id}  (HR_ADMIN, MANAGER) — full replace, always send every field.
export async function updateLeaveType(
  leaveTypeId,
  { name, description, paid, allocatedDays, monthlyGuideline, carryForwardAllowed }
) {
  const { data } = await api.put(`/leave-types/${leaveTypeId}`, {
    name,
    description,
    paid,
    allocatedDays,
    monthlyGuideline,
    carryForwardAllowed: !!carryForwardAllowed,
  });
  return data.data;
}

// PATCH — 400 if the type is already in that state.
export async function activateLeaveType(leaveTypeId) {
  const { data } = await api.patch(`/leave-types/${leaveTypeId}/activate`);
  return data.data;
}

export async function deactivateLeaveType(leaveTypeId) {
  const { data } = await api.patch(`/leave-types/${leaveTypeId}/deactivate`);
  return data.data;
}

export async function syncLeaveTypeBalances(leaveTypeId) {
  const { data } = await api.post(`/leave-allocation/leave-type/${leaveTypeId}`);
  return data.data;
}

// ---- Leave Requests ----
export async function applyLeave({ leaveTypeId, startDate, endDate, reason }) {
  const { data } = await api.post("/leave-requests", {
    leaveTypeId,
    startDate,
    endDate,
    reason,
  });
  return data.data;
}

export async function cancelLeave(leaveRequestId) {
  const { data } = await api.put(`/leave-requests/${leaveRequestId}/cancel`);
  return data.data;
}

export async function getLeaveRequest(leaveRequestId) {
  const { data } = await api.get(`/leave-requests/${leaveRequestId}`);
  return data.data;
}

export async function getMyLeaveRequests() {
  const { data } = await api.get("/leave-requests/my");
  return data.data;
}

export async function getTeamLeaveRequests() {
  const { data } = await api.get("/leave-requests/team");
  return data.data;
}

export async function getAllLeaveRequests() {
  const { data } = await api.get("/leave-requests");
  return data.data;
}

// ---- Leave Approvals (Manager only) ----
export async function managerLeaveAction(leaveRequestId, action, reason = "") {
  const { data } = await api.put(
    `/leave-approvals/${leaveRequestId}/leave-approval-by-manager`,
    { action, reason }
  );
  return data.data;
}

export async function getApprovalHistory(leaveRequestId) {
  const { data } = await api.get(`/leave-approvals/leave-request/${leaveRequestId}`);
  return data.data;
}

// ---- Leave Balances ----
export async function getMyLeaveBalances() {
  const { data } = await api.get("/leave-balances/my");
  return data.data;
}

export async function getEmployeeLeaveBalances(employeeId) {
  const { data } = await api.get(`/leave-balances/employee/${employeeId}`);
  return data.data;
}

export async function getAllLeaveBalances() {
  const { data } = await api.get("/leave-balances");
  return data.data;
}

// ---- Leave Transactions ----
export async function getMyLeaveTransactions() {
  const { data } = await api.get("/leave-transactions/my");
  return data.data;
}

// ---- Leave Report (HR_ADMIN / MANAGER only) ----
// GET /reports/leave?format=json — same caveat as getAttendanceReport:
// the response is NOT wrapped in { data: ... }, it IS the
// LeaveReportPageResponse directly: { content, summary, page, size, ... }.
// summary covers the full filtered set regardless of page size.
export async function getLeaveReport(params = {}) {
  const { data } = await api.get("/reports/leave", {
    params: { format: "json", ...params },
  });
  return data;
}

// Downloads the leave report as a file (excel/pdf) using the existing
// /reports/leave endpoint (format=excel|pdf). Returns the raw blob + a
// filename pulled from the Content-Disposition header when available.
export async function exportLeaveReport(format, filters = {}) {
  const params = { format, ...filters };
  const response = await api.get("/reports/leave", {
    params,
    responseType: "blob",
  });

  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const fallbackExt = format === "excel" ? "xlsx" : "pdf";
  const filename = match?.[1] || `leave-report.${fallbackExt}`;

  return { blob: response.data, filename };
}