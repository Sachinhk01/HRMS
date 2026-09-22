import api from './api';

// Departments -> Designations -> Job Titles master data module.
// Mirrors MasterModule_frontendGuide.pdf exactly — see that doc for the
// backend quirks referenced in comments below (§ numbers refer to it).

const DEFAULT_LIST = { page: 0, size: 10, search: '', sortDirection: 'asc' };

function buildListParams({ page, size, search, sortBy, sortDirection }) {
  const params = { page, size, sortDirection };
  // The backend treats a blank/absent `search` as "return everything" but
  // still needs the param present for a predictable query string.
  params.search = search || '';
  if (sortBy) params.sortBy = sortBy;
  return params;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
export async function listDepartments({ page = 0, size = 10, search = '', sortBy = 'departmentName', sortDirection = 'asc' } = DEFAULT_LIST) {
  const { data } = await api.get('/departments', { params: buildListParams({ page, size, search, sortBy, sortDirection }) });
  return data.data; // PageResponse<DepartmentResponse>
}

export async function getDepartment(id) {
  const { data } = await api.get(`/departments/${id}`);
  return data.data;
}

export async function createDepartment({ departmentName, description }) {
  const { data } = await api.post('/departments', { departmentName, description });
  return data.data;
}

// §11.6: `active` is a primitive boolean server-side — omitting it silently
// deactivates the row. Callers must always pass the current value back.
export async function updateDepartment(id, { departmentName, description, active }) {
  const { data } = await api.put(`/departments/${id}`, { departmentName, description, active });
  return data.data;
}

// PATCH .../status?active=<bool> — `active` MUST be a query param, never a body field (§11.1/§2.4).
export async function setDepartmentStatus(id, active) {
  const { data } = await api.patch(`/departments/${id}/status`, null, { params: { active } });
  return data.data;
}

// §11.2: hard delete, no dependency check server-side. Only call this for
// rows the UI has confirmed are unreferenced; prefer setDepartmentStatus.
export async function deleteDepartment(id) {
  const { data } = await api.delete(`/departments/${id}`);
  return data.data;
}

// ---------------------------------------------------------------------------
// Designations
// ---------------------------------------------------------------------------
export async function listDesignations({ page = 0, size = 10, search = '', sortBy = 'designationName', sortDirection = 'asc' } = DEFAULT_LIST) {
  const { data } = await api.get('/designations', { params: buildListParams({ page, size, search, sortBy, sortDirection }) });
  return data.data;
}

export async function getDesignation(id) {
  const { data } = await api.get(`/designations/${id}`);
  return data.data;
}

export async function createDesignation({ designationName, departmentId, description }) {
  const { data } = await api.post('/designations', { designationName, departmentId, description });
  return data.data;
}

export async function updateDesignation(id, { designationName, departmentId, description, active }) {
  const { data } = await api.put(`/designations/${id}`, { designationName, departmentId, description, active });
  return data.data;
}

export async function setDesignationStatus(id, active) {
  const { data } = await api.patch(`/designations/${id}/status`, null, { params: { active } });
  return data.data;
}

export async function deleteDesignation(id) {
  const { data } = await api.delete(`/designations/${id}`);
  return data.data;
}

// ---------------------------------------------------------------------------
// Job titles
// ---------------------------------------------------------------------------
export async function listJobTitles({ page = 0, size = 10, search = '', sortBy = 'jobTitle', sortDirection = 'asc' } = DEFAULT_LIST) {
  const { data } = await api.get('/job-titles', { params: buildListParams({ page, size, search, sortBy, sortDirection }) });
  return data.data;
}

export async function getJobTitle(id) {
  const { data } = await api.get(`/job-titles/${id}`);
  return data.data;
}

export async function createJobTitle({ jobTitle, designationId }) {
  const { data } = await api.post('/job-titles', { jobTitle, designationId });
  return data.data;
}

export async function updateJobTitle(id, { jobTitle, designationId, active }) {
  const { data } = await api.put(`/job-titles/${id}`, { jobTitle, designationId, active });
  return data.data;
}

// Note: the frontend guide's §3 table lists this path without the hyphen
// (/jobtitles/{id}/status) — checked against JobTitleController directly,
// and the controller's @RequestMapping is "/api/v1/job-titles" throughout,
// including this endpoint. Treating the guide's table as a typo here.
export async function setJobTitleStatus(id, active) {
  const { data } = await api.patch(`/job-titles/${id}/status`, null, { params: { active } });
  return data.data;
}

export async function deleteJobTitle(id) {
  const { data } = await api.delete(`/job-titles/${id}`);
  return data.data;
}

// ---------------------------------------------------------------------------
// Lookups (active-only, for cascading dropdowns)
// §11.1: the id must be sent BOTH as the path segment AND as a query param —
// the backend's @RequestParam binding makes the path segment decorative.
// ---------------------------------------------------------------------------
export async function lookupDepartments() {
  const { data } = await api.get('/lookups/departments');
  return data.data; // [{ id, name }]
}

export async function lookupDesignations(departmentId) {
  const { data } = await api.get(`/lookups/departments/${departmentId}/designations`, {
    params: { departmentId },
  });
  return data.data;
}

export async function lookupJobTitles(designationId) {
  const { data } = await api.get(`/lookups/designations/${designationId}/job-titles`, {
    params: { designationId },
  });
  return data.data;
}