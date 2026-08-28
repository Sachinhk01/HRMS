import { getSection, setSection } from './localStorageService';

const EMPLOYEE_KEY = 'employeeOfMonth';

const emptyEmployee = { employeeId: '', employeeName: '', designation: '', department: '', month: '', message: '', photoUrl: '', updatedAt: '' };

export function getEmployeeOfMonth() {
  return getSection(EMPLOYEE_KEY) || emptyEmployee;
}

export function saveEmployeeOfMonth(actor, data) {
  if (!['HR_ADMIN', 'MANAGER'].includes(actor?.role)) throw new Error('Only HR or Manager can update Employee of the Month.');
  const item = {
    ...emptyEmployee,
    ...data,
    employeeName: data.employeeName?.trim() || '',
    designation: data.designation?.trim() || '',
    department: data.department?.trim() || '',
    message: data.message?.trim() || '',
    updatedAt: new Date().toISOString(),
    updatedBy: actor.id,
  };
  setSection(EMPLOYEE_KEY, item);
  return item;
}
