const BASE = import.meta.env.VITE_API_BASE_URL + "/device";

/**
 * Helper function to extract error message from response
 */
async function extractErrorMessage(response) {
  try {
    const data = await response.json();
    return data.message || "An error occurred";
  } catch {
    return await response.text() || "An error occurred";
  }
}

/**
 * GET all devices (optionally filtered by category)
 */
export async function getDevicesByCategory(category) {
  const url = category ? `${BASE}/get?category=${category}` : `${BASE}/get`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

/**
 * ADD device
 * POST /device/add
 */
export async function addDevice(data) {
  const res = await fetch(`${BASE}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

/**
 * UPDATE device
 * PUT /device/update
 */
export async function updateDevice(id, data) {
  const res = await fetch(`${BASE}/update/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

/**
 * DELETE device (by device_name)
 * DELETE /device/delete/:device_name
 */
export async function deleteDevice(device_name) {
  console.log("Deleting device:", device_name);
  const res = await fetch(`${BASE}/delete/${device_name}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}

/**
 * REFRESH IPs via MAC scan
 * GET /device/refresh
 */
export async function refreshDevices() {
  const res = await fetch(`${BASE}/refresh`);
  if (!res.ok) throw new Error(await extractErrorMessage(res));
  return res.json();
}
