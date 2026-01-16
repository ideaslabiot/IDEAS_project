// utils/lockManager.mjs
const deviceLocks = new Map();

export function isDeviceLocked(deviceId) {
  const lock = deviceLocks.get(deviceId);
  if (!lock) return false;
  
  // Lock expires after timeout
  if (Date.now() - lock.timestamp > lock.duration) {
    deviceLocks.delete(deviceId);
    return false;
  }
  
  return true;
}

export function lockDevice(deviceId, duration = 30000) {
  deviceLocks.set(deviceId, {
    timestamp: Date.now(),
    duration: duration
  });
  
  console.log(`Locked device ${deviceId} for ${duration}ms`);
  
  // Auto-unlock after duration
  setTimeout(() => {
    deviceLocks.delete(deviceId);
    console.log(`Unlocked device ${deviceId}`);
  }, duration);
}

export function unlockDevice(deviceId) {
  if (deviceLocks.has(deviceId)) {
    deviceLocks.delete(deviceId);
    console.log(`Manually unlocked device ${deviceId}`);
  }
}
