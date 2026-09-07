import { getMyProfile } from './employeeService';
import { getEmployeePayrollHistory } from './payrollService';

const keyFor = (employeeId) => `myhourly_payroll_notifications_${employeeId}`;

function read(employeeId) {
  try { return JSON.parse(localStorage.getItem(keyFor(employeeId)) || '[]'); }
  catch { return []; }
}
function write(employeeId, items) {
  localStorage.setItem(keyFor(employeeId), JSON.stringify(items));
}

export async function resolveEmployeeId(user) {
  const profile = await getMyProfile().catch(() => null);
  return user?.employeeId || user?.employee?.id || profile?.employeeId || profile?.employee?.id || profile?.id || null;
}

async function resolveEmployeeHistory(user) {
  const profile = await getMyProfile().catch(() => null);
  const ids = [user?.employeeId, user?.employee?.id, profile?.employeeId, profile?.employee?.id, profile?.id]
    .filter((value, index, values) => value != null && value !== '' && values.indexOf(value) === index);
  let fallback = { employeeId: ids[0] || null, history: [] };
  for (const employeeId of ids) {
    try {
      const history = await getEmployeePayrollHistory(employeeId);
      fallback = { employeeId, history: Array.isArray(history) ? history : [] };
      if (fallback.history.length) return fallback;
    } catch {
      // Try The Next Profile Identifier Shape.
    }
  }
  return fallback;
}

export async function syncPayrollNotifications(user) {
  const role = user?.role || user?.roles?.[0];
  if (role !== 'EMPLOYEE') return [];
  const { employeeId, history } = await resolveEmployeeHistory(user);
  if (!employeeId) return [];
  const existing = read(employeeId);
  const existingIds = new Set(existing.map((n) => String(n.payrollId)));
  const additions = (history || [])
    .filter((p) => p?.id != null && !existingIds.has(String(p.id)))
    .map((p) => ({
      id: `payroll-${p.id}`,
      payrollId: p.id,
      notificationType: 'PAYROLL_GENERATED',
      title: 'Payroll Generated',
      message: `${p.payrollNumber || 'Your payroll'} for ${p.payrollMonth || 'the current month'} is ready. You can download your payslip from Payroll.`,
      createdAt: p.createdAt || p.updatedAt || new Date().toISOString(),
      isRead: false,
    }));

  const merged = [...additions, ...existing].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  write(employeeId, merged);
  return merged;
}

export async function getLocalPayrollNotifications(user) {
  const employeeId = await resolveEmployeeId(user);
  if (!employeeId) return [];
  return read(employeeId);
}

export async function markLocalPayrollNotificationRead(user, notificationId) {
  const employeeId = await resolveEmployeeId(user);
  if (!employeeId) return;
  write(employeeId, read(employeeId).map((n) => n.id === notificationId ? { ...n, isRead: true } : n));
}

export async function markAllLocalPayrollNotificationsRead(user) {
  const employeeId = await resolveEmployeeId(user);
  if (!employeeId) return;
  write(employeeId, read(employeeId).map((n) => ({ ...n, isRead: true })));
}
