import api from "./api";

export const ATTENDANCE_STATE = {
  WORKING: "WORKING",
  ON_BREAK: "ON_BREAK",
  CHECKED_OUT: "CHECKED_OUT",
};

export async function getAttendanceDashboard() {
  const { data } = await api.get("/attendance/dashboard");
  return data.data;
}

export async function getAttendanceHistory(params = {}) {
  const { data } = await api.get("/attendance/history", {
    params,
  });

  return data.data;
}

export async function getAttendanceCalendar(month, year) {
  const { data } = await api.get("/attendance/calendar", {
    params: {
      month,
      year,
    },
  });

  return data.data;
}

export async function checkIn(coords) {
  const { data } = await api.post("/attendance/check-in", {
    latitude: coords.latitude,
    longitude: coords.longitude,
  });

  return data.data;
}

export async function checkOut(coords) {
  const { data } = await api.post("/attendance/check-out", {
    latitude: coords.latitude,
    longitude: coords.longitude,
  });

  return data.data;
}

export async function startBreak(breakType = "LUNCH") {
  const { data } = await api.post("/attendance/break-start", {
    breakType,
  });

  return data.data;
}

export async function endBreak() {
  const { data } = await api.post("/attendance/break-end");

  return data.data;
}