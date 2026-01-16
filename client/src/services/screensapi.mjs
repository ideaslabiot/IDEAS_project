const BASE = import.meta.env.VITE_API_BASE_URL + "/screens";

/**
 * GET all screens
 * (category = 1 handled server-side or by route)
 */
export async function getScreens() {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * GET single screen by ID
 */
export async function getScreen(id) {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * TOGGLE SCREEN POWER (stateless)
 * Backend decides what "on/off" means
 */
export async function toggleScreenPower(screen_name, action) {
  // action: "on" | "off"
  if (action !== "on" && action !== "off") {
    throw new Error("Invalid action for toggleScreenPower");
  }
  action = action === "on" ? "wake" : "shutdown";
  console.log(`Toggling screen power: ${screen_name} -> ${action}`);
  const res = await fetch(`${BASE}/${action}/${screen_name}`, {
    method: "POST",
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * OPTIONAL: Power helpers (nice DX)
 */
export function powerOnScreen(id) {
  return toggleScreenPower(id, "on");
}

export function powerOffScreen(id) {
  return toggleScreenPower(id, "off");
}
