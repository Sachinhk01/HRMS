import api from "./api";

export const HOLIDAY_TYPES = ["HOLIDAY", "PUBLIC_HOLIDAY", "OPTIONAL_HOLIDAY", "WEEKEND"];

export async function getHolidays({
  page = 0,
  size = 50,
  sortBy = "holidayDate",
  sortDirection = "asc",
  holidayName,
  holidayType,
  fromDate,
  toDate,
  active,
} = {}) {
  const { data } = await api.get("/holidays", {
    params: { page, size, sortBy, sortDirection, holidayName, holidayType, fromDate, toDate, active },
  });
  return data.data; // { content, page, size, totalElements, totalPages, first, last }
}

export async function getHolidayById(id) {
  const { data } = await api.get(`/holidays/${id}`);
  return data.data;
}

export async function createHoliday({ holidayDate, holidayName, holidayType, description, recurring = false }) {
  const { data } = await api.post("/holidays", {
    holidayDate,
    holidayName,
    holidayType,
    description,
    recurring,
  });
  return data.data;
}

export async function updateHoliday(id, { holidayDate, holidayName, holidayType, description, attendanceAllowed, recurring, active }) {
  const { data } = await api.put(`/holidays/${id}`, {
    holidayDate,
    holidayName,
    holidayType,
    description,
    attendanceAllowed,
    recurring,
    active,
  });
  return data.data;
}

export async function deleteHoliday(id) {
  const { data } = await api.delete(`/holidays/${id}`);
  return data.data;
}

export async function getHolidayCalendar(month, year) {
  const { data } = await api.get("/holidays/calendar", { params: { month, year } });
  return data.data; // [{ holidayDate, holidayName, holidayType }]
}

export async function getUpcomingHolidays() {
  const { data } = await api.get("/holidays/upcoming");
  return data.data; // array of HolidayResponse
}