import api from "./api";

export function normalizeEmployeeName(member) {
  return member?.name || `${member?.firstName || ''} ${member?.lastName || ''}`.trim() || 'Employee';
}

function normalizeEmployeeDate(member) {
  return member?.dateOfBirth || member?.dob || member?.birthDate || '';
}

function normalizeBirthdayList(list, days = 30) {
  const today = new Date();

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

// Stores only currently running getEmployees requests.
// This prevents identical simultaneous API requests.
const employeesRequestCache = new Map();

export async function getEmployees({
  page = 0,
  size = 50,
  search = "",
  sortBy = "employeeCode",
  sortDirection = "asc"
} = {}) {
  const params = {
    page,
    size,
    search,
    sortBy,
    sortDirection,
  };

  // Create a unique key based on the existing request parameters.
  const cacheKey = JSON.stringify(params);

  // If the exact same request is already running,
  // return that existing request instead of sending another API call.
  if (employeesRequestCache.has(cacheKey)) {
    return employeesRequestCache.get(cacheKey);
  }

  const request = api
    .get("/employees", {
      params,
    })
    .then(({ data }) => {
      const payload = data?.data ?? data;

      const content = Array.isArray(payload?.content)
        ? payload.content
        : Array.isArray(payload)
          ? payload
          : [];

      return {
        ...(payload && typeof payload === "object" ? payload : {}),
        content,
        page,
        size: content.length || size,
        totalElements: payload?.totalElements ?? content.length,
        totalPages: payload?.totalPages ?? 1,
        first: payload?.first ?? true,
        last: payload?.last ?? true,
      };
    })
    .finally(() => {
      // Remove the request from the cache after it completes,
      // whether it succeeds or fails.
      employeesRequestCache.delete(cacheKey);
    });

  // Store the currently running request.
  employeesRequestCache.set(cacheKey, request);

  return request;
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
    const res = await getEmployees({ size: 100 });
    const employees = res.content || [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();

    return employees.filter((member) => {
      const dobStr = member?.dateOfBirth || member?.dob;
      if (!dobStr) return false;

      const dob = new Date(dobStr);

      return (
        dob.getMonth() === currentMonth &&
        dob.getDate() === currentDate
      );
    });
  } catch (error) {
    console.warn(
      "Could not fetch birthdays from employees list:",
      error
    );
    return [];
  }
}

export async function updateMyProfile(payload) {
  const { data } = await api.put("/employees", payload);
  return data.data;
}

export async function getProfilePhotoUrl(employeeId) {
  const response = await api.get(
    `/employees/${employeeId}/profile-photo`,
    {
      responseType: "blob",
    }
  );

  return URL.createObjectURL(response.data);
}

export async function uploadMyProfilePhoto(file) {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.put(
    "/employees/profile-photo",
    formData
  );

  return data.data;
}

export async function changeEmployeeStatus(id, active) {
  const { data } = await api.patch(
    `/employees/${id}/status`,
    null,
    {
      params: { active },
    }
  );

  return data.data;
}

// ---- Admin: create/update employee (2-step) ----

export async function registerUser({
  username,
  email,
  password,
  role
}) {
  const { data } = await api.post(
    "/admin/users/register",
    {
      username,
      email,
      password,
      role,
    }
  );

  return data.data; // { userId, username, email, roles }
}

export async function createEmployeeProfile(userId, payload) {
  const formData = new FormData();

  formData.append(
    "request",
    new Blob(
      [JSON.stringify(payload)],
      {
        type: "application/json",
      }
    )
  );

  const { data } = await api.post(
    `/admin/employee-profile/${userId}`,
    formData
  );

  return data.data;
}

export async function updateEmployeeProfile(userId, payload) {
  const { data } = await api.put(
    `/admin/employee-profile/${userId}`,
    payload
  );

  return data.data;
}

// Convenience: does both steps in one call

export async function createEmployee({
  username,
  email,
  password,
  role,
  ...profileFields
}) {
  const registered = await registerUser({
    username,
    email,
    password,
    role,
  });

  const profile = await createEmployeeProfile(
    registered.userId,
    profileFields
  );

  return profile;
}

// ---- Master data (for dropdowns) — via LookupController, active-only, server-side cascading ----

export async function getDepartments() {
  const { data } = await api.get(
    "/lookups/departments"
  );

  return data.data; // [{ id, name }]
}

export async function getDesignations(departmentId) {
  // LookupController's designations endpoint currently binds departmentId via
  // @RequestParam even though the path also declares {departmentId} — sending
  // both keeps this working whether or not that controller gets fixed to use @PathVariable.

  const { data } = await api.get(
    `/lookups/departments/${departmentId}/designations`,
    {
      params: { departmentId },
    }
  );

  return data.data; // [{ id, name }]
}

export async function getJobTitles(designationId) {
  const { data } = await api.get(
    `/lookups/designations/${designationId}/job-titles`,
    {
      params: { designationId },
    }
  );

  return data.data;
}