import express from "express";
// import db from "../db/conn.mjs"
import 'dotenv/config';
import { exec } from 'child_process';
import db from "../db/conn.mjs"
import wol from "wake_on_lan";
import { NodeSSH } from "node-ssh";

import { broadcastDeviceUpdate } from "../server.mjs";
import { isDeviceLocked, lockDevice, unlockDevice } from "../utils/lockManager.mjs";

//test pc 1 is 74-56-3c-b0-99-f4
//TODO also do a search for ip by mac again

const router = express.Router();
// const computers = {};
let collection = db.collection("devices")

// 'pc1': {
//     mac: '74:56:3c:b0:99:f4',
//     ip: '192.168.1.132',  // Replace with actual IP
//     username: 'PC',  // Replace with Windows username
//     password: '123456'   // Or use SSH keys (more secure)
//   },

const WOL_OPTIONS = {
  address: '192.168.1.255'//router broadcast
};

function disposeSsh(ssh) {
  if (ssh.connection) {
    ssh.connection.on('error', function() { /* No Op */ })
    ssh.dispose()
  }
}

/* ---------- Status Check Function ---------- */
async function checkComputerStatus(device) {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: device.ip,
      username: device.username,
      password: device.password,
      readyTimeout: 5000
    });
    
    disposeSsh(ssh);
    return "ON";
    
  } catch (error) {
    console.log(`${device.device_name} connection failed (likely OFF):`, error.message);
    return "OFF";
  }
}

// wake on lan the computer
router.post('/wake/:computer_name', async (req, res) => {

  const computerName = req.params.computer_name;
  const computer = await collection.findOne({ device_name: `${computerName}`, category: "2"})
  
  if (!computer) {
    return res.status(404).json({ error: 'Computer not found' });
  }

  // Check if locked
  if (isDeviceLocked(computer._id.toString())) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Another command is in progress. Please wait a moment.',
      deviceName: computer.device_name
    });
  }

  // Check PENDING state
  if (computer.state?.startsWith("PENDING")) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Device is executing a command. Please wait.',
      deviceName: computer.device_name
    });
  }

  // Lock device
  lockDevice(computer._id.toString(), 15000);
try {
    // Set PENDING and broadcast
    await collection.updateOne(
      { device_name: computerName },
      { $set: { state: "PENDING_ON", timestamp: new Date() } }
    );
    
    let updated = await collection.findOne({ device_name: computerName });
    broadcastDeviceUpdate(updated);

    // Send WOL packet
    await new Promise((resolve, reject) => {
      wol.wake(computer.mac, WOL_OPTIONS, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    console.log(`WOL packet sent to ${computerName}`);

    res.status(200).json({
      success: true,
      message: `${computerName} power on command sent.`
    });

    // Verify after delay (computers take longer to boot)
    setTimeout(async () => {
      try {
        let state = await checkComputerStatus(computer);
        
        // If still not ON, try one more time after 10 seconds
        if (state !== "ON") {
          await new Promise(resolve => setTimeout(resolve, 10000));
          state = await checkComputerStatus(computer);
        }
        
        await collection.updateOne(
          { device_name: computerName },
          { $set: { state, timestamp: new Date() } }
        );
        updated = await collection.findOne({ device_name: computerName });
        broadcastDeviceUpdate(updated);
      } catch (err) {
        console.error(`Verification failed for ${computerName}:`, err);
      } finally {
        unlockDevice(computer._id.toString());
      }
    }, 15000); // 15 seconds initial wait for computers

  } catch (err) {
    console.error(`Failed to wake ${computerName}`, err);
    unlockDevice(computer._id.toString());
    
    await collection.updateOne(
      { device_name: computerName },
      { $set: { state: "ERROR", lastError: err.message, timestamp: new Date() } }
    );
    
    const updated = await collection.findOne({ device_name: computerName });
    broadcastDeviceUpdate(updated);

    res.status(500).json({
      error: `Failed to wake ${computerName}`,
      details: err.message
    });
  }
});

// Wake all computers
router.post('/wake-all', async (req, res) => {
  const results = [];
  let computers = await collection.find({category: "2"}).toArray()
  
  for (let i =0; i < computers.length; i++) {
    try {
      var computer = computers[i]
      await new Promise((resolve, reject) => {
        wol.wake(computer.mac, WOL_OPTIONS, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      results.push({ name: computer.device_name, status: 'success', action: 'wake' });
      console.log(`✓ WOL sent to ${computer.device_name}`);
    } catch (error) {
      results.push({ id: computer.device_name, status: 'failed', action: 'wake', error: error.message });
      console.error(`✗ Failed to wake ${computer.device_name}:`, error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  res.json({ results });
});

// Shutdown computer
router.post('/shutdown/:computer_name', async (req, res) => {
  const device_name = req.params.computer_name;
  const computer = await collection.findOne({
    device_name: device_name,
    category: "2"
  });
  
  if (!computer) {
    return res.status(404).json({ message: "Computer not found" });
  }

  // Check if locked
  if (isDeviceLocked(computer._id.toString())) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Another command is in progress. Please wait a moment.',
      deviceName: computer.device_name
    });
  }

  if (computer.state?.startsWith("PENDING")) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Device is executing a command. Please wait.',
      deviceName: computer.device_name
    });
  }

  lockDevice(computer._id.toString(), 15000);

  const ssh = new NodeSSH();
  
  try {
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "PENDING_OFF", timestamp: new Date() } }
    );
    
    let updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    console.log(`Connecting to ${device_name} at ${computer.ip}...`);
    
    await ssh.connect({
      host: computer.ip,
      username: computer.username,
      password: computer.password,
    });
    
    console.log(`Connected to ${device_name}, sending shutdown command...`);
    
    // Shutdown command: /s = shutdown, /t 3 = 3 second delay, /f = force close apps
    await ssh.execCommand('shutdown /s /t 3 /f');
    
    console.log(`Shutdown command sent to ${device_name}`);
    
    res.status(200).json({
      success: true,
      message: `${device_name} shutdown command sent.`
    });

    disposeSsh(ssh);

    // Verify after delay
    setTimeout(async () => {
      try {
        let state = await checkComputerStatus(computer);
        
        // If still not OFF, try one more time after 10 seconds
        if (state !== "OFF") {
          await new Promise(resolve => setTimeout(resolve, 10000));
          state = await checkComputerStatus(computer);
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
        unlockDevice(computer._id.toString());
      }
    }, 10000);
    
  } catch (error) {
    console.error(`Failed to shutdown ${device_name}:`, error);

    try {
      disposeSsh(ssh);
    } catch (disposeError) {
      // ignore
    }

    unlockDevice(computer._id.toString());
    
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "ERROR", lastError: error.message, timestamp: new Date() } }
    );
    
    const updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    res.status(500).json({ 
      error: `Failed to shutdown ${device_name}`, 
      details: error.message 
    });
  }
});

// Get status of all computers (for manual refresh if needed)
router.get('/status', async (req, res) => {
  const results = [];
  let computers = await collection.find({ category: "2" }).toArray();
  
  for (let computer of computers) {
    const state = await checkComputerStatus(computer);
    results.push({ 
      name: computer.device_name, 
      status: state, 
      ip: computer.ip 
    });
  }
  
  res.json({ computers: results });
});

export default router
export { checkComputerStatus };
