import api from "./api";

/* Employee lookup used by the payroll admin panels */
export { getEmployeeDropdown } from "./employeeService";

/* =====================================================================
   Payroll runs — /api/v1/payroll
   Access: SUPER_ADMIN, HR_ADMIN, PAYROLL_ADMIN (EMPLOYEE only for
   /employee/{id} and payslip download of their own records).

   NOTE: the payroll controllers return raw bodies (List<...> / DTO),
   NOT the ApiResponse { success, message, data } envelope — so every
   call below returns the response body directly.
   ===================================================================== */

export async function generatePayroll({ payrollMonth, employeeIds, remarks, saveAsDraft = false }) {
  const { data } = await api.post("/payroll/generate", {
    payrollMonth,
    employeeIds: employeeIds?.length ? employeeIds : undefined,
    remarks,
    saveAsDraft,
  });
  return data; // PayrollSummaryResponse
}

export async function getPayrollById(id) {
  const { data } = await api.get(`/payroll/${id}`);
  return data; // PayrollResponse
}

export async function getPayrollByNumber(payrollNumber) {
  const { data } = await api.get(`/payroll/number/${payrollNumber}`);
  return data; // PayrollResponse
}

export async function getPayrollByEmployee(employeeId) {
  const { data } = await api.get(`/payroll/employee/${employeeId}`);
  return Array.isArray(data) ? data : []; // PayrollResponse[]
}

// Backward-compatible alias used by payrollNotificationService and older Payroll views.
export async function getEmployeePayrollHistory(employeeId) {
  return getPayrollByEmployee(employeeId);
}

export async function getPayrollsByMonth(payrollMonth) {
  const { data } = await api.get("/payroll/month", { params: { payrollMonth } });
  return Array.isArray(data) ? data : []; // PayrollResponse[]
}

export async function getPayrollsByStatus(status) {
  const { data } = await api.get("/payroll/status", { params: { status } });
  return Array.isArray(data) ? data : []; // PayrollResponse[]
}

export async function updateDraftPayroll(id, payload) {
  const { data } = await api.put(`/payroll/${id}`, payload);
  return data; // PayrollResponse
}

export async function updatePayrollStatus(id, { status, paymentReference }) {
  const { data } = await api.patch(`/payroll/${id}/status`, {
    status,
    paymentReference,
  });
  return data; // PayrollResponse
}

export async function regeneratePayroll(id) {
  const { data } = await api.post(`/payroll/${id}/regenerate`);
  return data; // PayrollResponse
}

export async function downloadPayslip(id) {
  const response = await api.get(`/payroll/${id}/payslip`, { responseType: "blob" });
  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return {
    blob: response.data,
    filename: match?.[1] || `payslip-${id}.pdf`,
  };
}

/* =====================================================================
   Salary Templates — /api/v1/payroll/salary-templates
   Access: SUPER_ADMIN, HR_ADMIN
   ===================================================================== */

export async function getSalaryTemplates({ activeOnly = false } = {}) {
  const { data } = await api.get("/payroll/salary-templates", { params: { activeOnly } });
  return Array.isArray(data) ? data : []; // SalaryTemplateResponse[]
}

export async function getSalaryTemplateById(id) {
  const { data } = await api.get(`/payroll/salary-templates/${id}`);
  return data;
}

export async function getSalaryTemplateByEmployeeType(employeeType) {
  const { data } = await api.get(`/payroll/salary-templates/employee-type/${employeeType}`);
  return data;
}

export async function createSalaryTemplate(payload) {
  const { data } = await api.post("/payroll/salary-templates", payload);
  return data;
}

export async function updateSalaryTemplate(id, payload) {
  const { data } = await api.put(`/payroll/salary-templates/${id}`, payload);
  return data;
}

export async function updateSalaryTemplateStatus(id, active) {
  const { data } = await api.patch(`/payroll/salary-templates/${id}/status`, { active });
  return data;
}

/* =====================================================================
   Salary Structures — /api/v1/payroll/salary-structures
   Access: SUPER_ADMIN, HR_ADMIN, PAYROLL_ADMIN
   ===================================================================== */

export async function getSalaryStructures({ activeOnly = false } = {}) {
  const { data } = await api.get("/payroll/salary-structures", { params: { activeOnly } });
  return Array.isArray(data) ? data : []; // SalaryStructureResponse[]
}

export async function getSalaryStructureById(id) {
  const { data } = await api.get(`/payroll/salary-structures/${id}`);
  return data;
}

export async function getSalaryStructuresByEmployee(employeeId, { activeOnly = false } = {}) {
  const { data } = await api.get(`/payroll/salary-structures/employee/${employeeId}`, {
    params: { activeOnly },
  });
  return Array.isArray(data) ? data : [];
}

export async function createSalaryStructure(payload) {
  const { data } = await api.post("/payroll/salary-structures", payload);
  return data;
}

export async function createSalaryStructureRevision(payload) {
  const { data } = await api.post("/payroll/salary-structures/revision", payload);
  return data;
}

/* =====================================================================
   Employee Payment Details — /api/v1/payroll/payment-details
   Access: HR_ADMIN, SUPER_ADMIN (EMPLOYEE/MANAGER read-only)
   ===================================================================== */

export async function getPaymentDetails(employeeId) {
  const { data } = await api.get(`/payroll/payment-details/${employeeId}`);
  return data; // EmployeePaymentDetailsResponse
}

export async function createPaymentDetails(payload) {
  const { data } = await api.post("/payroll/payment-details", payload);
  return data;
}

export async function updatePaymentDetails(employeeId, payload) {
  const { data } = await api.put(`/payroll/payment-details/${employeeId}`, payload);
  return data;
}

export async function deletePaymentDetails(employeeId) {
  await api.delete(`/payroll/payment-details/${employeeId}`);
}

/* =====================================================================
   Shared helpers
   ===================================================================== */

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];
export const PAYROLL_STATUSES = ["DRAFT", "GENERATED", "APPROVED", "PAID", "SUPERSEDED", "CANCELLED"];
export const PAYMENT_MODES = ["BANK_TRANSFER", "UPI", "CHEQUE", "CASH"];

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(value) {
  const amount = Number(value || 0);
  return inrFormatter.format(amount);
}

export function formatPayrollDate(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function payrollMonthLabel(value) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
