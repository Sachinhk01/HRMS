import api from './api';

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

// 17 - Employee Payment Details
export const createEmployeePaymentDetails = async (payload) => unwrap(await api.post('/payroll/payment-details', payload));
export const updateEmployeePaymentDetails = async (employeeId, payload) => unwrap(await api.put(`/payroll/payment-details/${employeeId}`, payload));
export const getEmployeePaymentDetails = async (employeeId) => unwrap(await api.get(`/payroll/payment-details/${employeeId}`));
export const deleteEmployeePaymentDetails = async (employeeId) => unwrap(await api.delete(`/payroll/payment-details/${employeeId}`));

// 18 - Salary Template
export const createSalaryTemplate = async (payload) => unwrap(await api.post('/payroll/salary-templates', payload));
export const updateSalaryTemplate = async (id, payload) => unwrap(await api.put(`/payroll/salary-templates/${id}`, payload));
export const getSalaryTemplateById = async (id) => unwrap(await api.get(`/payroll/salary-templates/${id}`));
export const getSalaryTemplateByEmployeeType = async (employeeType) => unwrap(await api.get(`/payroll/salary-templates/employee-type/${employeeType}`));
export const getSalaryTemplates = async (activeOnly = false) => list(unwrap(await api.get('/payroll/salary-templates', { params: { activeOnly } })));
export const updateSalaryTemplateStatus = async (id, active) => unwrap(await api.patch(`/payroll/salary-templates/${id}/status`, { active }));

// 19 - Salary Structure
export const createSalaryStructure = async (payload) => unwrap(await api.post('/payroll/salary-structures', payload));
export const createSalaryRevision = async (payload) => unwrap(await api.post('/payroll/salary-structures/revision', payload));
export const getSalaryStructureById = async (id) => unwrap(await api.get(`/payroll/salary-structures/${id}`));
export const getEmployeeSalaryStructures = async (employeeId, activeOnly = false) => list(unwrap(await api.get(`/payroll/salary-structures/employee/${employeeId}`, { params: { activeOnly } })));
export const getSalaryStructures = async (activeOnly = false) => list(unwrap(await api.get('/payroll/salary-structures', { params: { activeOnly } })));

// 20 - Payroll
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
