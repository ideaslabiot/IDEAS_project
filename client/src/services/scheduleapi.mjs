const BASE = import.meta.env.VITE_API_BASE_URL + "/schedule";

/**
 * Helper function to extract error message from response
 */
async function extractErrorMessage(response) {
  try {
    const data = await response.json();
    return data.error || data.message || "An error occurred";
  } catch {
    return await response.text() || "An error occurred";
  }
}

/**
 * CREATE a new schedule
 * POST /schedule/schedules
 */
export async function createSchedule(scheduleData) {
  const res = await fetch(`${BASE}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scheduleData),
  });

  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

/**
 * GET all schedules (optionally filtered)
 * GET /schedule/schedules?is_active=true&device_id=xxx&day=3&action=On
 */
export async function getSchedules(filters = {}) {
  const params = new URLSearchParams();
  if (filters.is_active !== undefined) params.append('is_active', filters.is_active);
  if (filters.device_id) params.append('device_id', filters.device_id);
  if (filters.day !== undefined) params.append('day', filters.day);
  if (filters.action) params.append('action', filters.action);

  const url = params.toString() ? `${BASE}/schedules?${params.toString()}` : `${BASE}/schedules`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

/**
 * GET schedule by ID
 * GET /schedule/schedules/:id
 */
export async function getScheduleById(id) {
  const res = await fetch(`${BASE}/schedules/${id}`);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

/**
 * UPDATE a schedule
 * PATCH /schedule/schedules/:id
 */
export async function updateSchedule(id, updateData) {
  const res = await fetch(`${BASE}/schedules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  });

  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

/**
 * DELETE a schedule
 * DELETE /schedule/schedules/:id
 */
export async function deleteSchedule(id) {
  const res = await fetch(`${BASE}/schedules/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}
