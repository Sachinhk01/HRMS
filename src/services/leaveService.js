import { getSection, setSection } from './localStorageService';

const key = 'leaveRequests';
const all = () => getSection(key) || [];
const save = (value) => setSection(key, value);

export const LEAVE_ALLOWANCES = {
  'Casual Leave': 12,
  'Sick Leave': 8,
  'Earned Leave': 18,
};

export const getApproverRole = () => 'MANAGER';

export function applyLeave(user, data) {
  if (!['EMPLOYEE', 'HR_ADMIN', 'MANAGER'].includes(user?.role)) {
    throw new Error('This role cannot apply for leave.');
  }
  if (!data.type || !data.fromDate || !data.toDate || !data.reason?.trim()) {
    throw new Error('Please complete all leave fields.');
  }
  if (new Date(data.toDate) < new Date(data.fromDate)) {
    throw new Error('To date cannot be before from date.');
  }

  const days = Math.floor((new Date(data.toDate) - new Date(data.fromDate)) / 86400000) + 1;
  const balance = getLeaveBalance(user.id).find((item) => item.type === data.type);
  if (balance && days > balance.left) {
    throw new Error(`Only ${balance.left} ${data.type.toLowerCase()} day(s) are available.`);
  }

  const item = {
    id: `leave-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    applicantId: user.id,
    applicantName: user.name,
    applicantRole: user.role,
    type: data.type,
    fromDate: data.fromDate,
    toDate: data.toDate,
    days,
    status: 'PENDING',
    reason: data.reason.trim(),
    approverRole: 'MANAGER',
    createdAt: new Date().toISOString(),
  };
  save([item, ...all()]);
  return item;
}

export const getMyLeaves = (id) => all().filter((item) => item.applicantId === id);

export function getLeaveBalance(userId) {
  const approved = getMyLeaves(userId).filter((item) => item.status === 'APPROVED');
  return Object.entries(LEAVE_ALLOWANCES).map(([type, allowance]) => {
    const taken = approved.filter((item) => item.type === type).reduce((sum, item) => sum + Number(item.days || 0), 0);
    return { type, allowance, taken, left: Math.max(allowance - taken, 0) };
  });
}

export function getLeaveSummary(userId) {
  const balances = getLeaveBalance(userId);
  const requests = getMyLeaves(userId);
  return {
    allowance: balances.reduce((sum, item) => sum + item.allowance, 0),
    taken: balances.reduce((sum, item) => sum + item.taken, 0),
    left: balances.reduce((sum, item) => sum + item.left, 0),
    pending: requests.filter((item) => item.status === 'PENDING').reduce((sum, item) => sum + Number(item.days || 0), 0),
    balances,
  };
}

export const getPendingApprovals = (managerId) => all().filter(
  (item) => item.status === 'PENDING' && item.approverRole === 'MANAGER' && item.applicantId !== managerId,
);

export function decideLeave(id, manager, status, rejectionReason = '') {
  if (manager?.role !== 'MANAGER') throw new Error('Only a manager can approve or reject leave.');
  if (!['APPROVED', 'REJECTED'].includes(status)) throw new Error('Invalid leave decision.');
  const request = all().find((item) => item.id === id);
  if (!request) throw new Error('Leave request was not found.');
  if (request.applicantId === manager.id) throw new Error('Managers cannot approve their own leave request.');

  const next = all().map((item) => item.id === id ? {
    ...item,
    status,
    approvedBy: manager.id,
    approvedByName: manager.name,
    approvedAt: new Date().toISOString(),
    rejectionReason: status === 'REJECTED' ? rejectionReason : '',
  } : item);
  save(next);
  return next.find((item) => item.id === id);
}
