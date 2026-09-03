import api from './api';

const PAYROLL_KEY = 'payroll_records';

const generateId = (prefix = 'payroll') => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;

const readStorage = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
};

const unwrap = (response) => response?.data?.data ?? response?.data;
const list = (value) => {
  if (Array.isArray(value)) return value;
  const candidates = [
    value?.content,
    value?.items,
    value?.records,
    value?.results,
    value?.payrolls,
    value?.payrollRecords,
    value?.data,
  ];
  const found = candidates.find(Array.isArray);
  return found || [];
};

export function getPayrollRecords() {
  return readStorage(PAYROLL_KEY, []);
}

export function createPayrollRecord(admin, payrollData) {
  if (admin.role !== 'PAYROLL_ADMIN' && admin.role !== 'SUPER_ADMIN') {
    throw new Error('You do not have permission to create payroll.');
  }

  const records = getPayrollRecords();

  const newRecord = {
    id: generateId('payroll'),
    employeeId: payrollData.employeeId,
    employeeName: payrollData.employeeName,
    month: payrollData.month,
    year: payrollData.year,
    earnings: payrollData.earnings || {},
    deductions: payrollData.deductions || {},
    grossPay: Number(payrollData.grossPay || 0),
    totalDeductions: Number(payrollData.totalDeductions || 0),
    netPay: Number(payrollData.netPay || 0),
    status: payrollData.status || 'DRAFT',
    payslipUrl: payrollData.payslipUrl || '',
    createdBy: admin.id,
    createdByName: admin.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeStorage(PAYROLL_KEY, [newRecord, ...records]);
  return newRecord;
}

export function getEmployeePayroll(employeeId) {
  return getPayrollRecords().filter((record) => record.employeeId === employeeId);
}

export function getPayrollByMonth(employeeId, month, year) {
  return (
    getPayrollRecords().find(
      (record) =>
        record.employeeId === employeeId &&
        Number(record.month) === Number(month) &&
        Number(record.year) === Number(year),
    ) || null
  );
}

export function updatePayrollRecord(recordId, updates) {
  const records = getPayrollRecords();

  const updatedRecords = records.map((record) =>
    record.id === recordId
      ? {
          ...record,
          ...updates,
          id: record.id,
          updatedAt: new Date().toISOString(),
        }
      : record,
  );

  writeStorage(PAYROLL_KEY, updatedRecords);
  return updatedRecords.find((record) => record.id === recordId);
}

export const createEmployeePaymentDetails = async (payload) => unwrap(await api.post('/payroll/payment-details', payload));
export const updateEmployeePaymentDetails = async (employeeId, payload) => unwrap(await api.put(`/payroll/payment-details/${employeeId}`, payload));
export const getEmployeePaymentDetails = async (employeeId) => unwrap(await api.get(`/payroll/payment-details/${employeeId}`));
export const deleteEmployeePaymentDetails = async (employeeId) => unwrap(await api.delete(`/payroll/payment-details/${employeeId}`));

export const createSalaryTemplate = async (payload) => unwrap(await api.post('/payroll/salary-templates', payload));
export const updateSalaryTemplate = async (id, payload) => unwrap(await api.put(`/payroll/salary-templates/${id}`, payload));
export const getSalaryTemplateById = async (id) => unwrap(await api.get(`/payroll/salary-templates/${id}`));
export const getSalaryTemplateByEmployeeType = async (employeeType) => unwrap(await api.get(`/payroll/salary-templates/employee-type/${employeeType}`));
export const getSalaryTemplates = async (activeOnly = false) => list(unwrap(await api.get('/payroll/salary-templates', { params: { activeOnly } })));
export const updateSalaryTemplateStatus = async (id, active) => unwrap(await api.patch(`/payroll/salary-templates/${id}/status`, { active }));

export const createSalaryStructure = async (payload) => unwrap(await api.post('/payroll/salary-structures', payload));
export const createSalaryRevision = async (payload) => unwrap(await api.post('/payroll/salary-structures/revision', payload));
export const getSalaryStructureById = async (id) => unwrap(await api.get(`/payroll/salary-structures/${id}`));
export const getEmployeeSalaryStructures = async (employeeId, activeOnly = false) => list(unwrap(await api.get(`/payroll/salary-structures/employee/${employeeId}`, { params: { activeOnly } })));
export const getSalaryStructures = async (activeOnly = false) => list(unwrap(await api.get('/payroll/salary-structures', { params: { activeOnly } })));

export const generatePayroll = async (payload) => unwrap(await api.post('/payroll/generate', payload));
export const getPayrollById = async (id) => unwrap(await api.get(`/payroll/${id}`));
export const getPayrollByNumber = async (payrollNumber) => unwrap(await api.get(`/payroll/number/${encodeURIComponent(payrollNumber)}`));
export const getEmployeePayrollHistory = async (employeeId) => list(unwrap(await api.get(`/payroll/employee/${employeeId}`)));
export const getPayrollsByMonth = async (payrollMonth) => list(unwrap(await api.get('/payroll/month', { params: { payrollMonth } })));
export const getPayrollsByStatus = async (status) => list(unwrap(await api.get('/payroll/status', { params: { status } })));
export const updateDraftPayroll = async (id, payload) => unwrap(await api.put(`/payroll/${id}`, payload));
export const updatePayrollStatus = async (id, payload) => unwrap(await api.patch(`/payroll/${id}/status`, payload));
export const regeneratePayroll = async (id) => unwrap(await api.post(`/payroll/${id}/regenerate`));

export async function downloadPayslip(id, fileName = 'payslip') {
  const response = await api.get(`/payroll/${id}/payslip`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
