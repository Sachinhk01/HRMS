import {
  generateId,
  readStorage,
  writeStorage,
} from "./localStorageService";

const PAYROLL_KEY = "payroll_records";

export function getPayrollRecords() {
  return readStorage(PAYROLL_KEY, []);
}

export function createPayrollRecord(admin, payrollData) {
  if (
    admin.role !== "PAYROLL_ADMIN" &&
    admin.role !== "SUPER_ADMIN"
  ) {
    throw new Error("You do not have permission to create payroll.");
  }

  const records = getPayrollRecords();

  const newRecord = {
    id: generateId("payroll"),
    employeeId: payrollData.employeeId,
    employeeName: payrollData.employeeName,
    month: payrollData.month,
    year: payrollData.year,
    earnings: payrollData.earnings || {},
    deductions: payrollData.deductions || {},
    grossPay: Number(payrollData.grossPay || 0),
    totalDeductions: Number(payrollData.totalDeductions || 0),
    netPay: Number(payrollData.netPay || 0),
    status: payrollData.status || "DRAFT",
    payslipUrl: payrollData.payslipUrl || "",
    createdBy: admin.id,
    createdByName: admin.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeStorage(PAYROLL_KEY, [newRecord, ...records]);

  return newRecord;
}

export function getEmployeePayroll(employeeId) {
  return getPayrollRecords().filter(
    (record) => record.employeeId === employeeId
  );
}

export function getPayrollByMonth(employeeId, month, year) {
  return (
    getPayrollRecords().find(
      (record) =>
        record.employeeId === employeeId &&
        Number(record.month) === Number(month) &&
        Number(record.year) === Number(year)
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
      : record
  );

  writeStorage(PAYROLL_KEY, updatedRecords);

  return updatedRecords.find((record) => record.id === recordId);
}