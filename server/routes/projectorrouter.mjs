import express from "express";
import db from "../db/conn.mjs"
import 'dotenv/config';
import pjlink from "pjlink";

import { broadcastDeviceUpdate } from "../server.mjs";
import { isDeviceLocked, lockDevice, unlockDevice } from "../utils/lockManager.mjs";

//https://www.npmjs.com/package/pjlink

//pjlink pass = IDEASP1
//passphrase = 12345678

let collection = db.collection("devices")
const router = express.Router();

async function checkProjectorStatus(device) {
  return new Promise((resolve, reject) => {
    try {
      const projector = new pjlink(device.ip, "4352", device.password);
      
      // Set timeout for status check
      const timeout = setTimeout(() => {
        reject(new Error("Status check timeout"));
      }, 8000);

      projector.getPowerState((error, state) => {
        clearTimeout(timeout);
        
        if (error) {
          console.log(`${device.device_name} connection failed (likely OFF):`, error.message);
          resolve("OFF");
          return;
        }

        // PJLink power states:
        // 0 = off, 1 = on, 2 = cooling, 3 = warming
        switch(state) {
          case 0:
            resolve("OFF");
            break;
          case 1:
            resolve("ON");
            break;
          case 2:
            resolve("COOLING"); // Projector-specific state
            break;
          case 3:
            resolve("WARMING"); // Projector-specific state
            break;
          default:
            resolve("UNKNOWN");
        }
      });
    } catch (error) {
      console.log(`${device.device_name} connection failed:`, error.message);
      resolve("OFF");
    }
  });
}


router.get("/status",async (req,res) => {
    let {projector_names} = req.body;

    
})

// POWER On
router.post("/wake/:projector_name", async (req, res) => {
  const device_name = req.params.projector_name;
  const projector = await collection.findOne({
    device_name: device_name,
    category: "4"
  });

  if (!projector) {
    return res.status(404).json({ message: "Projector not found" });
  }

  // Check if locked
  if (isDeviceLocked(projector._id.toString())) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Another command is in progress. Please wait a moment.',
      deviceName: projector.device_name
    });
  }

  // Check PENDING/WARMING/COOLING state
  if (projector.state?.startsWith("PENDING") || 
      projector.state === "WARMING" || 
      projector.state === "COOLING") {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Projector is in transition state. Please wait.',
      deviceName: projector.device_name
    });
  }

  // Lock device (longer timeout for projectors)
  lockDevice(projector._id.toString(), 20000);

  try {
    // Set WARMING state (projector-specific) and broadcast
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "WARMING", timestamp: new Date() } }
    );
    
    let updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    console.log(`Turning on projector ${device_name} at ${projector.ip}`);

    // Send power on command
    const device = new pjlink(projector.ip, "4352", projector.password);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Command timeout")), 10000);
      
      device.powerOn((error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      });
    });

    res.status(200).json({
      success: true,
      message: `${device_name} power on command sent. Warming up...`
    });

    // Verify after delay (projectors take time to warm up)
    setTimeout(async () => {
      try {
        let state = await checkProjectorStatus(projector);
        
        // If still warming, check again after another delay
        if (state === "WARMING") {
          await new Promise(resolve => setTimeout(resolve, 15000));
          state = await checkProjectorStatus(projector);
        }
        
        await collection.updateOne(
          { device_name: device_name },
          { $set: { state, timestamp: new Date() } }
        );
        updated = await collection.findOne({ device_name: device_name });
        broadcastDeviceUpdate(updated);
      } catch (err) {
        console.error(`Verification failed for ${device_name}:`, err);
      } finally {
        unlockDevice(projector._id.toString());
      }
    }, 20000); // 20 seconds initial wait for projectors

  } catch (err) {
    console.error(`Failed to wake ${device_name}`, err);
    unlockDevice(projector._id.toString());
    
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "ERROR", lastError: err.message, timestamp: new Date() } }
    );
    
    const updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    res.status(500).json({
      error: `Failed to wake ${device_name}`,
      details: err.message
    });
  }
});

// Power Off
router.post("/shutdown/:projector_name", async (req, res) => {
  const device_name = req.params.projector_name;
  const projector = await collection.findOne({
    device_name: device_name,
    category: "4"
  });

  if (!projector) {
    return res.status(404).json({ message: "Projector not found" });
  }

  // Check if locked
  if (isDeviceLocked(projector._id.toString())) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Another command is in progress. Please wait a moment.',
      deviceName: projector.device_name
    });
  }

  if (projector.state?.startsWith("PENDING") || 
      projector.state === "WARMING" || 
      projector.state === "COOLING") {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Projector is in transition state. Please wait.',
      deviceName: projector.device_name
    });
  }

  lockDevice(projector._id.toString(), 20000);

  try {
    // Set COOLING state (projector-specific) and broadcast
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "COOLING", timestamp: new Date() } }
    );
    
    let updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    console.log(`Turning off projector ${device_name} at ${projector.ip}`);

    // Send power off command
    const device = new pjlink(projector.ip, "4352", projector.password);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Command timeout")), 10000);
      
      device.powerOff((error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      });
    });

    res.status(200).json({
      success: true,
      message: `${device_name} power off command sent. Cooling down...`
    });

    // Verify after delay (projectors need time to cool down)
    setTimeout(async () => {
      try {
        let state = await checkProjectorStatus(projector);
        
        // If still cooling, check again after another delay
        if (state === "COOLING") {
          await new Promise(resolve => setTimeout(resolve, 20000));
          state = await checkProjectorStatus(projector);
        }
        
        await collection.updateOne(
          { device_name: device_name },
          { $set: { state, timestamp: new Date() } }
        );
        updated = await collection.findOne({ device_name: device_name });
        broadcastDeviceUpdate(updated);
      } catch (err) {
        console.error(`Verification failed for ${device_name}:`, err);
      } finally {
        unlockDevice(projector._id.toString());
      }
    }, 25000); // 25 seconds initial wait for projector cooldown

  } catch (err) {
    console.error(`Failed to shutdown ${device_name}`, err);
    unlockDevice(projector._id.toString());
    
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "ERROR", lastError: err.message, timestamp: new Date() } }
    );
    
    const updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    res.status(500).json({
      error: `Failed to shutdown ${device_name}`,
      details: err.message
    });
  }
});

export default router;
export { checkProjectorStatus };
