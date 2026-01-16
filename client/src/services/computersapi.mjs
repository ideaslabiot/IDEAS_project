const API_BASE = import.meta.env.VITE_API_BASE_URL;

export async function toggleComputerPower(computerName, action) {
  const response = await fetch(`${API_BASE}/computer/${action}/${computerName}`, {
    method: "POST"
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to toggle computer");
  }

  return response.json();
}

export async function getComputerStatus() {
  const response = await fetch(`${API_BASE}/computer/status`);
  return response.json();
}
