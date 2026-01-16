// backgroundSync.mjs
import db from "./db/conn.mjs";
import { broadcastDeviceUpdate } from "./server.mjs";
import { isDeviceLocked } from "./utils/lockManager.mjs";
import { checkScreenStatus } from "./routes/screensrouter.mjs";
import { checkComputerStatus } from "./routes/pcrouter.mjs";
import { checkLightsStatus } from "./routes/lightsrouter.mjs";
import { checkProjectorStatus } from "./routes/projectorrouter.mjs";
// Import your other check functions as needed

const collection = db.collection("devices");

// Configuration
const SYNC_CONFIG = {
  "1": { pendingTimeout: 30000, checkInterval: 10000 }, // Screens
  "2": { pendingTimeout: 120000, checkInterval: 15000 }, // Computers
  "3": { pendingTimeout: 30000, checkInterval: 10000 }, // Tapo
  "4": { pendingTimeout: 60000, checkInterval: 15000 }, // Projectors
};

function shouldSkipDevice(device, category) {
  if (isDeviceLocked(device._id.toString())) {
    return { skip: true, reason: 'locked' };
  }
  
  const config = SYNC_CONFIG[category];
  const transitionStates = ['PENDING_ON', 'PENDING_OFF', 'WARMING', 'COOLING'];
  
  if (transitionStates.includes(device.state)) {
    const stateAge = Date.now() - new Date(device.timestamp).getTime();
    
    if (stateAge < config.pendingTimeout) {
      return { skip: true, reason: `${device.state} (recent)` };
    } else {
      return { skip: false, reason: `${device.state} (timeout - forcing check)` };
    }
  }
  
  return { skip: false, reason: null };
}

async function syncScreens() {
  const screens = await collection.find({ category: "1" }).toArray();
  
  for (const screen of screens) {
    const { skip, reason } = shouldSkipDevice(screen, "1");
    
    if (skip) {
      console.log(`Skipping ${screen.device_name} - ${reason}`);
      continue;
    }
    
    try {
      const state = await checkScreenStatus(screen);
      
      if (screen.state !== state) {
        await collection.updateOne(
          { _id: screen._id },
          { $set: { state, timestamp: new Date() } }
        );
        const updated = await collection.findOne({ _id: screen._id });
        broadcastDeviceUpdate(updated);
        console.log(`Screen ${screen.device_name}: ${screen.state} -> ${state}`);
      }
    } catch (error) {
      console.error(`Error checking ${screen.device_name}:`, error.message);
    }
  }
}

async function syncComputers() {
  const computers = await collection.find({ category: "2" }).toArray();
  
  for (const computer of computers) {
    const { skip, reason } = shouldSkipDevice(computer, "2");
    
    if (skip) {
      console.log(`Skipping ${computer.device_name} - ${reason}`);
      continue;
    }
    
    try {
      const state = await checkComputerStatus(computer);
      
      if (computer.state !== state) {
        await collection.updateOne(
          { _id: computer._id },
          { $set: { state, timestamp: new Date() } }
        );
        const updated = await collection.findOne({ _id: computer._id });
        broadcastDeviceUpdate(updated);
        console.log(`Computer ${computer.device_name}: ${computer.state} -> ${state}`);
      }
    } catch (error) {
      console.error(`Error checking ${computer.device_name}:`, error.message);
    }
  }
}

async function syncLights() {
  const lights = await collection.find({ category: "3" }).toArray();
  
  for (const light of lights) {
    const { skip, reason } = shouldSkipDevice(light, "3");
    
    if (skip) {
      console.log(`Skipping ${light.device_name} - ${reason}`);
      continue;
    }
    
    try {
      const state = await checkLightsStatus(light);
      
      if (light.state !== state) {
        await collection.updateOne(
          { _id: light._id },
          { $set: { state, timestamp: new Date() } }
        );
        const updated = await collection.findOne({ _id: light._id });
        broadcastDeviceUpdate(updated);
        console.log(`Tapo ${light.device_name}: ${light.state} -> ${state}`);
      }
    } catch (error) {
      console.error(`Error checking ${light.device_name}:`, error.message);
    }
  }
}

async function syncProjectors() {
  const projectors = await collection.find({ category: "4" }).toArray();
  
  for (const projector of projectors) {
    const { skip, reason } = shouldSkipDevice(projector, "4");
    
    if (skip) {
      console.log(`Skipping ${projector.device_name} - ${reason}`);
      continue;
    }
    
    try {
      const state = await checkProjectorStatus(projector);
      
      if (projector.state !== state) {
        await collection.updateOne(
          { _id: projector._id },
          { $set: { state, timestamp: new Date() } }
        );
        const updated = await collection.findOne({ _id: projector._id });
        broadcastDeviceUpdate(updated);
        console.log(`Projector ${projector.device_name}: ${projector.state} -> ${state}`);
      }
    } catch (error) {
      console.error(`Error checking ${projector.device_name}:`, error.message);
    }
  }
}

export function startBackgroundSync() {
  // Screens - every 10 seconds
  setInterval(syncScreens, 10 * 1000);
  syncScreens(); // Run immediately

  // ✅ Computers - every 15 seconds
  setInterval(syncComputers, SYNC_CONFIG["2"].checkInterval);
  syncComputers(); // Run immediately

  setInterval(syncLights, SYNC_CONFIG["3"].checkInterval);
  syncLights();
  
  setInterval(syncProjectors, SYNC_CONFIG["4"].checkInterval);
  syncProjectors();
  
  console.log('✓ Background sync started');
  console.log('  - Screens: every 10s');
  console.log('  - Computers: every 15s')
  console.log('  - Tapo: every 10s');
  console.log('  - Projectors: every 15s');
}
