import {
  generateId,
  readStorage,
  writeStorage,
} from "./localStorageService";

const PERFORMANCE_KEY = "performance_records";

export function getPerformanceRecords() {
  return readStorage(PERFORMANCE_KEY, []);
}

export function createPerformanceRecord(manager, recordData) {
  if (
    manager.role !== "MANAGER" &&
    manager.role !== "HR_ADMIN" &&
    manager.role !== "SUPER_ADMIN"
  ) {
    throw new Error("You do not have permission to add performance data.");
  }

  const records = getPerformanceRecords();

  const newRecord = {
    id: generateId("performance"),
    employeeId: recordData.employeeId,
    employeeName: recordData.employeeName,
    reviewPeriod: recordData.reviewPeriod,
    goals: recordData.goals || [],
    progressPercentage: Number(
      recordData.progressPercentage || 0
    ),
    managerFeedback: recordData.managerFeedback || "",
    rating: Number(recordData.rating || 0),
    reviewedBy: manager.id,
    reviewedByName: manager.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeStorage(PERFORMANCE_KEY, [newRecord, ...records]);

  return newRecord;
}

export function getEmployeePerformance(employeeId) {
  return getPerformanceRecords().filter(
    (record) => record.employeeId === employeeId
  );
}

export function updatePerformanceRecord(recordId, updates) {
  const records = getPerformanceRecords();

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

  writeStorage(PERFORMANCE_KEY, updatedRecords);

  return updatedRecords.find((record) => record.id === recordId);
}