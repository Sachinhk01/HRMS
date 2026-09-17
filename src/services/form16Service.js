import axios from 'axios';
import api from './api';
import { getToken } from './authStorage';

// Form 16 backend currently exposes two controller prefixes:
//   /api/v1/form16  -> master, quarter, challan, verification
//   /api/form16     -> salary, exemptions, deductions, Chapter VI-A, last fields, employer master
// Keep that backend contract here so the page stays clean and no existing API service is changed.
const configuredBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
const backendOrigin = configuredBase.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');

const form16Api = axios.create({
  baseURL: backendOrigin,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 15000,
});

form16Api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const dataOf = (response) => response?.data?.data ?? response?.data;
const messageOf = (error) => error?.response?.data?.message || error?.message || 'Form 16 request failed.';

async function request(config) {
  try {
    return dataOf(await form16Api.request(config));
  } catch (error) {
    const wrapped = new Error(messageOf(error));
    wrapped.status = error?.response?.status;
    throw wrapped;
  }
}

export const form16Service = {
  // Main Form 16
  create: (employeeId, payload) => request({ method: 'post', url: `/api/v1/form16/${employeeId}`, data: payload }),
  getById: (id) => request({ method: 'get', url: `/api/v1/form16/${id}` }),
  getByEmployeeYear: (employeeId, assessmentYear) => request({ method: 'get', url: `/api/v1/form16/employee/${employeeId}`, params: { assessmentYear } }),
  activate: (employeeId) => request({ method: 'patch', url: `/api/v1/form16/employee/${employeeId}/activate` }),
  deactivate: (employeeId) => request({ method: 'patch', url: `/api/v1/form16/employee/${employeeId}/deactivate` }),
  activateAll: () => request({ method: 'patch', url: '/api/v1/form16/activate-all' }),
  remove: (employeeId) => request({ method: 'delete', url: `/api/v1/form16/employee/${employeeId}` }),

  // Part A - Quarter
  getQuarter: (id) => request({ method: 'get', url: `/api/v1/form16/${id}/quarter` }),
  createQuarter: (id, payload) => request({ method: 'post', url: `/api/v1/form16/${id}/quarter`, data: payload }),
  updateQuarter: (id, payload) => request({ method: 'put', url: `/api/v1/form16/${id}/quarter`, data: payload }),

  // Part A - Challans
  getChallans: (id) => request({ method: 'get', url: `/api/v1/form16/${id}/challan` }),
  createChallan: (id, payload) => request({ method: 'post', url: `/api/v1/form16/${id}/challan`, data: payload }),
  updateChallan: (id, challanId, payload) => request({ method: 'put', url: `/api/v1/form16/${id}/challan/${challanId}`, data: payload }),
  deleteChallan: (id, challanId) => request({ method: 'delete', url: `/api/v1/form16/${id}/challan/${challanId}` }),

  // Verification
  getVerification: (id) => request({ method: 'get', url: `/api/v1/form16/${id}/verification` }),
  createVerification: (id, payload) => request({ method: 'post', url: `/api/v1/form16/${id}/verification`, data: payload }),
  updateVerification: (id, payload) => request({ method: 'put', url: `/api/v1/form16/${id}/verification`, data: payload }),

  // Part B
  getSalary: (id) => request({ method: 'get', url: `/api/form16/${id}/salary` }),
  createSalary: (id, payload) => request({ method: 'post', url: `/api/form16/${id}/salary`, data: payload }),
  updateSalary: (id, payload) => request({ method: 'put', url: `/api/form16/${id}/salary`, data: payload }),

  getExemption: (id) => request({ method: 'get', url: `/api/form16/${id}/exemption` }),
  createExemption: (id, payload) => request({ method: 'post', url: `/api/form16/${id}/exemption`, data: payload }),
  updateExemption: (id, payload) => request({ method: 'put', url: `/api/form16/${id}/exemption`, data: payload }),

  getSection16: (id) => request({ method: 'get', url: `/api/form16/${id}/section16-deduction` }),
  createSection16: (id, payload) => request({ method: 'post', url: `/api/form16/${id}/section16-deduction`, data: payload }),
  updateSection16: (id, payload) => request({ method: 'put', url: `/api/form16/${id}/section16-deduction`, data: payload }),

  getChapterVIA: (id) => request({ method: 'get', url: `/api/form16/${id}/chapter-via` }),
  createChapterVIA: (id, payload) => request({ method: 'post', url: `/api/form16/${id}/chapter-via`, data: payload }),
  updateChapterVIA: (id, payload) => request({ method: 'put', url: `/api/form16/${id}/chapter-via`, data: payload }),

  getLastFields: (id) => request({ method: 'get', url: `/api/form16/${id}/last-fields` }),
  createLastFields: (id, payload) => request({ method: 'post', url: `/api/form16/${id}/last-fields`, data: payload }),
  updateLastFields: (id, payload) => request({ method: 'put', url: `/api/form16/${id}/last-fields`, data: payload }),

  // Employer master
  getActiveEmployer: () => request({ method: 'get', url: '/api/form16/employer-master/active' }),
  getEmployers: () => request({ method: 'get', url: '/api/form16/employer-master' }),
  createEmployer: (payload) => request({ method: 'post', url: '/api/form16/employer-master', data: payload }),
  updateEmployer: (id, payload) => request({ method: 'put', url: `/api/form16/employer-master/${id}`, data: payload }),
  activateEmployer: (id) => request({ method: 'patch', url: `/api/form16/employer-master/${id}/activate` }),
  deactivateEmployer: (id) => request({ method: 'patch', url: `/api/form16/employer-master/${id}/deactivate` }),
};

// Used only for the existing employee dropdown; kept as an explicit export for this module.
export async function getForm16EmployeeDropdown() {
  const { data } = await api.get('/employees/dropdown');
  return data?.data ?? data ?? [];
}
