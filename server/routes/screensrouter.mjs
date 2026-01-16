import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import net from "net";

import { broadcastDeviceUpdate } from "../server.mjs";
import { isDeviceLocked, lockDevice, unlockDevice } from "../utils/lockManager.mjs"
 
const router = express.Router();
const collection = db.collection("devices");
 
/* ---------- Samsung MDC ---------- */
 
class SamsungMDC {
  constructor(host, port = 1515, displayId = 0) {
    this.host = host;
    this.port = port;
    this.displayId = displayId;
  }

  send(cmd, data = []) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      client.setTimeout(5000);

      client.connect(this.port, this.host, () => {
        const pkt = [0xAA, cmd, this.displayId, data.length, ...data];
        const checksum = pkt.slice(1).reduce((a, b) => a + b, 0) & 0xff;
        pkt.push(checksum);
        client.write(Buffer.from(pkt));
      });

      client.on("data", (data) => {
        resolve(data);
        client.end();
      });

      client.on("timeout", () => {
        client.destroy();
        reject(new Error("MDC socket timeout"));
      });

      client.on("error", (err) => {
        client.destroy();
        reject(err);
      });
    });
  }

 
  powerOn() { return this.send(0x11, [0x01]); }
  powerOff() { return this.send(0x11, [0x00]); }
 
  async status() {
    const r = await this.send(0x11, []);
    return r[6] === 1 ? "ON" : r[6] === 0 ? "OFF" : "UNKNOWN"
  }
}
 
/* ---------- ROUTES ---------- */

// Status check function
async function checkScreenStatus(device) {
  try {
    const display = new SamsungMDC(device.ip);
    const statusPromise = display.status();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 8000)
    );
    
    const status = await Promise.race([statusPromise, timeoutPromise]);
    return status;
    
  } catch (error) {
    // Connection errors = screen is powered off
    console.log(`${device.device_name} connection failed (likely OFF):`, error.message);
    return "OFF";
  }
}
 
// GET all screens
router.get("/", async (req, res) => {
  try {
    const screens = await collection.find({ category: "1" }).toArray();
    res.json(screens);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
 
// POWER On
router.post("/wake/:screen_name", async (req, res) => {
  const device_name = req.params.screen_name;
  const screen = await collection.findOne({
    device_name: device_name,
    category: "1"
  });

  if (!screen) return res.status(404).json({ message: "Screen not found" });

  // Check if locked
  if (isDeviceLocked(screen._id.toString())) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Another command is in progress. Please wait a moment.',
      deviceName: screen.device_name
    });
  }

  // Check PENDING state
  if (screen.state?.startsWith("PENDING")) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Device is executing a command. Please wait.',
      deviceName: screen.device_name
    });
  }

  // Lock device
  lockDevice(screen._id.toString(), 15000);

  try {
    const display = new SamsungMDC(screen.ip);
    
    // Set PENDING and broadcast
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "PENDING_ON", timestamp: new Date() } }
    );
    
    let updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    // Send command
    await display.powerOn();

    res.status(200).json({
      success: true,
      message: `${device_name} power on command sent.`
    });

    // Verify after 3 seconds CHECK WITH CLD LATER
    setTimeout(async () => {
      try {
        const state = await checkScreenStatus(screen);
        await collection.updateOne(
          { device_name: device_name },
          { $set: { state, timestamp: new Date() } }
        );
        updated = await collection.findOne({ device_name: device_name });
        broadcastDeviceUpdate(updated);
      } catch (err) {
        console.error(`Verification failed for ${device_name}:`, err);
      }
    }, 8000);

  } catch (err) {
    console.error(`Failed to wake ${device_name}`, err);
    unlockDevice(screen._id.toString());
    
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
router.post("/shutdown/:screen_name", async (req, res) => {
  const device_name = req.params.screen_name;
  const screen = await collection.findOne({
    device_name: device_name,
    category: "1"
  });

  if (!screen) return res.status(404).json({ message: "Screen not found" });

  // Check if locked
  if (isDeviceLocked(screen._id.toString())) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Another command is in progress. Please wait a moment.',
      deviceName: screen.device_name
    });
  }

  if (screen.state?.startsWith("PENDING")) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Device is executing a command. Please wait.',
      deviceName: screen.device_name
    });
  }

  lockDevice(screen._id.toString(), 15000);

  try {
    const display = new SamsungMDC(screen.ip);
    
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "PENDING_OFF", timestamp: new Date() } }
    );
    
    let updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    await display.powerOff();

    res.status(200).json({
      success: true,
      message: `${device_name} power off command sent.`
    });

    setTimeout(async () => {
      try {
        const state = await checkScreenStatus(screen);
        await collection.updateOne(
          { device_name: device_name },
          { $set: { state, timestamp: new Date() } }
        );
        updated = await collection.findOne({ device_name: device_name });
        broadcastDeviceUpdate(updated);
      } catch (err) {
        console.error(`Verification failed for ${device_name}:`, err);
      }
    }, 8000);

  } catch (err) {
    console.error(`Failed to shutdown ${device_name}`, err);
    unlockDevice(screen._id.toString());
    
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
export { checkScreenStatus };
