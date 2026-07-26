import api from "./api";



// ---- Employees ----
export async function getEmployees({ page = 0, size = 50, search = "", sortBy = "employeeCode", sortDirection = "asc" } = {}) {
  const { data } = await api.get("/employees", {
    params: { page, size, search, sortBy, sortDirection },
  });
  return data.data; // { content, page, size, totalElements, totalPages, first, last }
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