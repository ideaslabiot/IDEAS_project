import express from "express";
// import db from "../db/conn.mjs"
import 'dotenv/config';
import { exec } from 'child_process';
import wol from "wake_on_lan";
import { NodeSSH } from "node-ssh";

//test pc 1 is 74-56-3c-b0-99-f4

const router = express.Router();
const computers = {
  'pc1': {
    mac: '74:56:3c:b0:99:f4',
    ip: '192.168.1.132',  // Replace with actual IP
    username: 'PC',  // Replace with Windows username
    password: '123456'   // Or use SSH keys (more secure)
  },
};

const WOL_OPTIONS = {
  address: '192.168.1.255'
};

function disposeSsh(ssh) {
  if (ssh.connection) {
    ssh.connection.on('error', function() { /* No Op */ })
    ssh.dispose()
  }
}

// wake on lan the computer
router.post('/wake/:computerId', (req, res) => {
  const computerId = req.params.computerId;
  const computer = computers[computerId];
  
  if (!computer) {
    return res.status(404).json({ error: 'Computer not found' });
  }
  
  wol.wake(computer.mac, WOL_OPTIONS, (error) => {
    if (error) {
      console.error(`Failed to wake ${computerId}:`, error);
      res.status(500).json({ 
        error: 'Failed to send WOL packet', 
        details: error.message 
      });
    } else {
      console.log(`WOL packet sent to ${computerId}`);
      res.json({ 
        success: true, 
        message: `WOL packet sent to ${computerId}` 
      });
    }
  });
});

// Wake all computers
router.post('/wake-all', async (req, res) => {
  const results = [];
  
  for (const [id, computer] of Object.entries(computers)) {
    try {
      await new Promise((resolve, reject) => {
        wol.wake(computer.mac, WOL_OPTIONS, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      results.push({ id, status: 'success', action: 'wake' });
      console.log(`✓ WOL sent to ${id}`);
    } catch (error) {
      results.push({ id, status: 'failed', action: 'wake', error: error.message });
      console.error(`✗ Failed to wake ${id}:`, error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  res.json({ results });
});

// Shutdown computer
router.post('/shutdown/:computerId', async (req, res) => {
  const computerId = req.params.computerId;
  const computer = computers[computerId];
  
  if (!computer) {
    return res.status(404).json({ error: 'Computer not found' });
  }
  
  const ssh = new NodeSSH();
  
  try {
    console.log(`Connecting to ${computerId} at ${computer.ip}...`);
    
    await ssh.connect({
      host: computer.ip,
      username: computer.username,
      password: computer.password,
      // For SSH key authentication (more secure):
      // privateKeyPath: '/path/to/private/key',
    });
    
    console.log(`Connected to ${computerId}, sending shutdown command...`);
    
    // Shutdown command: /s = shutdown, /t 0 = 0 second delay, /f = force close apps
    await ssh.execCommand('shutdown /s /t 3 /f');
    
    console.log(`Shutdown command sent to ${computerId}`);
    
    res.json({ 
      success: true, 
      message: `Shutdown command sent to ${computerId}` 
    });

    disposeSsh(ssh)
    
  } catch (error) {
    console.error(`Failed to shutdown ${computerId}:`, error);

    try {
        disposeSsh(ssh);
    } catch (disposeError) {
        //ignore for now
    }
    res.status(500).json({ 
      error: 'Failed to shutdown computer', 
      details: error.message 
    });
  }
});

// Get status of all computers (ping check)
router.get('/status', async (req, res) => {
  const results = [];
  
  for (const [id, computer] of Object.entries(computers)) {
    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host: computer.ip,
        username: computer.username,
        password: computer.password,
        readyTimeout: 5000  // 5 second timeout
      });
      
      results.push({ id, status: 'online', ip: computer.ip });
      disposeSsh(ssh)
      
    } catch (error) {
      results.push({ id, status: 'offline', ip: computer.ip });
    }
  }
  
  res.json({ computers: results });
});

export default router
