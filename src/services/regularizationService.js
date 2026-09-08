import api from "./api";

// ---- Enums (mirrors backend) ----
export const REGULARIZATION_STATUS = {
  PENDING: "PENDING",
  PARTIALLY_APPROVED: "PARTIALLY_APPROVED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
};

export const REGULARIZATION_DETAIL_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVERTED: "REVERTED",
};

// Attendance statuses that are actually eligible for regularization
// (per the guide's "Valid Status Transitions" table).
export const REGULARIZABLE_STATUSES = ["LATE", "HALF_DAY", "ABSENT", "MISSED_CHECKOUT"];

// ---- Employee APIs ----

// Create a regularization request.
// payload: { fromDate, toDate, reason, details: [{ attendanceId, requestedStatus }] }
export async function createRegularization(payload) {
  const { data } = await api.post("/attendance-regularizations", payload);
  return data.data;
}

// Get all regularization requests submitted by the logged-in employee.
export async function getMyRegularizations() {
  const { data } = await api.get("/attendance-regularizations/my");
  return data.data;
}

// ---- Manager / HR Admin APIs ----

// Pending (or partially-approved) requests for the manager's direct subordinates.
export async function getPendingRegularizations() {
  const { data } = await api.get("/attendance-regularizations/pending");
  return data.data;
}

// All requests (any status) for the manager's subordinates.
export async function getAllRegularizations() {
  const { data } = await api.get("/attendance-regularizations/all");
  return data.data;
}

// ---- Shared ----

// Get a single regularization request with full detail lines.
export async function getRegularizationById(id) {
  const { data } = await api.get(`/attendance-regularizations/${id}`);
  return data.data;
}

// Approve a detail line.
// approvedStatus should normally match the detail's requestedStatus.
export async function approveRegularizationDetail(regularizationId, detailId, { approvedStatus, remarks = "" }) {
  const { data } = await api.patch(
    `/attendance-regularizations/${regularizationId}/details/${detailId}`,
    {
      status: REGULARIZATION_DETAIL_STATUS.APPROVED,
      approvedStatus,
      remarks,
    }
  );
  return data.data;
}

// Reject a detail line.
export async function rejectRegularizationDetail(regularizationId, detailId, { remarks = "" }) {
  const { data } = await api.patch(
    `/attendance-regularizations/${regularizationId}/details/${detailId}`,
    {
      status: REGULARIZATION_DETAIL_STATUS.REJECTED,
      approvedStatus: null,
      remarks,
    }
  );
  return data.data;
}

// Revert a previously approved detail back to its original attendance state.
// HR_ADMIN, MANAGER, SUPER_ADMIN only. No request body.
export async function revertRegularizationDetail(regularizationId, detailId) {
  const { data } = await api.post(
    `/attendance-regularizations/${regularizationId}/details/${detailId}/revert`
  );
  return data.data;
}