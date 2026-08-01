import api from "./api";
import { getSection, setSection } from "./localStorageService";

function buildFallbackEmployees() {
  const stored = getSection('employees');
  if (Array.isArray(stored) && stored.length) return stored;

  const currentUser = JSON.parse(localStorage.getItem('hrms-user') || 'null');
  const today = new Date();

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fallback = [
    {
      id: 'demo-current',
      employeeCode: 'EMP-001',
      firstName: currentUser?.firstName || 'Aditi',
      lastName: currentUser?.lastName || 'Patel',
      name: currentUser?.name || 'Aditi Patel',
      email: currentUser?.email || 'aditi@example.com',
      dateOfBirth: formatDate(today),
      departmentName: 'People Ops',
      designationName: 'HR Lead',
      jobTitle: 'HR Lead',
      active: true,
    },
    {
      id: 'demo-next-1',
      employeeCode: 'EMP-002',
      firstName: 'Rahul',
      lastName: 'Verma',
      name: 'Rahul Verma',
      email: 'rahul@example.com',
      dateOfBirth: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)),
      departmentName: 'Engineering',
      designationName: 'Frontend Engineer',
      jobTitle: 'Frontend Engineer',
      active: true,
    },
    {
      id: 'demo-next-2',
      employeeCode: 'EMP-003',
      firstName: 'Neha',
      lastName: 'Singh',
      name: 'Neha Singh',
      email: 'neha@example.com',
      dateOfBirth: formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 12)),
      departmentName: 'Design',
      designationName: 'Product Designer',
      jobTitle: 'Product Designer',
      active: true,
    },
  ];

  setSection('employees', fallback);
  return fallback;
}

export function normalizeEmployeeName(member) {
  return member?.name || `${member?.firstName || ''} ${member?.lastName || ''}`.trim() || 'Employee';
}

function normalizeEmployeeDate(member) {
  return member?.dateOfBirth || member?.dob || member?.birthDate || '';
}

function normalizeBirthdayList(list, days = 30) {
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);

  return (list || [])
    .filter((member) => normalizeEmployeeDate(member))
    .map((member) => {
      const dob = new Date(`${normalizeEmployeeDate(member)}T00:00:00`);
      const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      return {
        ...member,
        name: normalizeEmployeeName(member),
        dateOfBirth: normalizeEmployeeDate(member),
        nextBirthday: next.toISOString().slice(0, 10),
        daysUntil: Math.round((next - today) / 86400000),
      };
    })
    .filter((member) => member.daysUntil >= 0 && member.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 20);
}

// ---- Employees ----
export async function getEmployees({ page = 0, size = 50, search = "", sortBy = "employeeCode", sortDirection = "asc" } = {}) {
  try {
    const { data } = await api.get("/employees", {
      params: { page, size, search, sortBy, sortDirection },
    });

    const payload = data?.data ?? data;
    const content = Array.isArray(payload?.content)
      ? payload.content
      : Array.isArray(payload)
        ? payload
        : [];

    return {
      ...(payload && typeof payload === 'object' ? payload : {}),
      content,
      page,
      size: content.length || size,
      totalElements: content.length,
      totalPages: 1,
      first: true,
      last: true,
    };
  } catch {
    const fallback = buildFallbackEmployees();
    return {
      content: fallback,
      page,
      size: fallback.length,
      totalElements: fallback.length,
      totalPages: 1,
      first: true,
      last: true,
    };
  }
}

export async function getEmployeeById(id) {
  const { data } = await api.get(`/employees/${id}`);
  return data.data;
}

export async function getEmployeeDropdown() {
  const { data } = await api.get("/employees/dropdown");
  return data.data; // [{ id, employeeCode, employeeName }]
}

export async function getMyProfile() {
  const { data } = await api.get("/employees/me");
  return data.data;
}

export async function getBirthdaysToday() {
  try {
    const { data } = await api.get("/employees/birthdays-today");
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch today's birthdays:", error);
    return [];
  }
}

export async function updateMyProfile(payload) {
  const { data } = await api.put("/employees", payload);
  return data.data;
}
export async function getProfilePhotoUrl(employeeId) {
  const response = await api.get(`/employees/${employeeId}/profile-photo`, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
}

export async function uploadMyProfilePhoto(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.put("/employees/profile-photo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

export async function changeEmployeeStatus(id, active) {
  const { data } = await api.patch(`/employees/${id}/status`, null, {
    params: { active },
  });
  return data.data;
}

// ---- Admin: create/update employee (2-step) ----
export async function registerUser({ username, email, password, role }) {
  const { data } = await api.post("/admin/users/register", {
    username,
    email,
    password,
    role,
  });
  return data.data; // { userId, username, email, roles }
}

export async function createEmployeeProfile(userId, payload) {
  const formData = new FormData();
  formData.append("request", new Blob([JSON.stringify(payload)], { type: "application/json" }));
  const { data } = await api.post(`/admin/employee-profile/${userId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

export async function updateEmployeeProfile(userId, payload) {
  const { data } = await api.put(`/admin/employee-profile/${userId}`, payload);
  return data.data;
}

// Convenience: does both steps in one call
export async function createEmployee({ username, email, password, role, ...profileFields }) {
  const registered = await registerUser({ username, email, password, role });
  const profile = await createEmployeeProfile(registered.userId, profileFields);
  return profile;
}

// ---- Master data (for dropdowns) ----
export async function getDepartments({ page = 0, size = 100 } = {}) {
  const { data } = await api.get("/departments", { params: { page, size } });
  return data.data.content;
}

export async function getDesignations({ page = 0, size = 100 } = {}) {
  const { data } = await api.get("/designations", { params: { page, size } });
  return data.data.content;
}

export async function getJobTitles({ page = 0, size = 100 } = {}) {
  const { data } = await api.get("/job-titles", { params: { page, size } });
  return data.data.content;
}