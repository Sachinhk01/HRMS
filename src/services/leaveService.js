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