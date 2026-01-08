import express from "express";
import db from "../db/conn.mjs"
import path from "path";
import 'dotenv/config';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

let collection = db.collection("devices")
//NOTE: NEED TO ADD ADDITIONAL CONSIDERATIONS FOR TUYA DEVICES (the device ID)

/**
 * Get MAC address for a given IP from ARP cache
 */
async function getMacAddress(ip) {
    try {
        // First, ping to ensure ARP entry exists
        await execAsync(`ping -n 1 ${ip}`).catch(() => {});
        
        // Wait a moment for ARP cache to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get ARP table
        const { stdout } = await execAsync('arp -a');
        const lines = stdout.split('\n');
        
        for (const line of lines) {
            if (line.includes(ip)) {
                // Extract MAC address (format: xx-xx-xx-xx-xx-xx on Windows)
                const macMatch = line.match(/([0-9a-f]{2}[-:]){5}[0-9a-f]{2}/i);
                if (macMatch) {
                    // Convert to colon format
                    return macMatch[0].replace(/-/g, ':').toLowerCase();
                }
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Find IP address for a given MAC address on the network
 * @param {string} targetMac - MAC address to find (any format: xx:xx:xx:xx:xx:xx or xx-xx-xx-xx-xx-xx)
 * @param {string} [subnet] - Optional subnet to scan (e.g., "192.168.1"). If not provided, auto-detects.
 * @param {function} [portTest] - Optional function to test if device is on specific port
 * @returns {Promise<string>} IP address of the device
 */
async function findIpByMac(targetMac, subnet = null, portTest = null) {
    if (!subnet) {
        subnet = getLocalSubnet();
    }
    
    console.log(`Scanning ${subnet}.0/24 for device with MAC ${targetMac}...`);
    
    const normalizedTarget = targetMac.toLowerCase().replace(/[:-]/g, '');
    
    // If port test is provided, scan for devices on that port first
    if (portTest) {
        console.log('Scanning for devices on specified port...');
        const scanPromises = [];
        
        for (let i = 1; i < 255; i++) {
            const ip = `${subnet}.${i}`;
            scanPromises.push(
                portTest(ip).then(async (connected) => {
                    if (connected) {
                        console.log(`Found device at ${ip}, checking MAC...`);
                        const mac = await getMacAddress(ip);
                        if (mac) {
                            const normalizedMac = mac.replace(/[:-]/g, '');
                            console.log(`  ${ip} has MAC: ${mac}`);
                            if (normalizedMac === normalizedTarget) {
                                console.log(`  ✓ Match found!`);
                                return ip;
                            }
                        }
                    }
                    return null;
                })
            );
        }
        
        const results = await Promise.all(scanPromises);
        const matchedIp = results.find(ip => ip !== null);
        
        if (matchedIp) {
            return matchedIp;
        }
    }
    
    // Fallback: Ping entire subnet and check ARP cache
    console.log('Scanning entire subnet via ping...');
    
    const pingPromises = [];
    for (let i = 1; i < 255; i++) {
        const ip = `${subnet}.${i}`;
        pingPromises.push(
            execAsync(`ping -n 1 -w 100 ${ip}`).catch(() => {})
        );
    }
    
    await Promise.all(pingPromises);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check ARP table
    const { stdout } = await execAsync('arp -a');
    const lines = stdout.split('\n');
    
    for (const line of lines) {
        const macMatch = line.match(/([0-9a-f]{2}[-:]){5}[0-9a-f]{2}/i);
        if (macMatch) {
            const mac = macMatch[0].replace(/-/g, '').toLowerCase();
            if (mac === normalizedTarget) {
                const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
                if (ipMatch) {
                    console.log(`Found MAC ${targetMac} at ${ipMatch[1]}`);
                    return ipMatch[1];
                }
            }
        }
    }
    
    throw new Error(`MAC address ${targetMac} not found on network`);
}

/**
 * Get the local subnet by examining network interfaces
 */
function getLocalSubnet() {
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
        // Skip virtual adapters
        if (name.includes('VMware') || name.includes('VMnet') || name.includes('VirtualBox') || name.includes('vEthernet')) {
            continue;
        }
        
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`Using network interface: ${name} (${iface.address})`);
                const parts = iface.address.split('.');
                return `${parts[0]}.${parts[1]}.${parts[2]}`;
            }
        }
    }
    
    return '192.168.1'; // Default fallback
}

const router = express.Router();

// Status endpoint
router.get("/refresh", async (req, res) => {
  try {

    const devices = await collection.find({}).toArray()

    console.log(devices)
    for (let device of devices) {
        console.log(device)
        try {
            let device_ip = await findIpByMac(device.mac)

            if (device.ip != device_ip) {
                await collection.findOneAndUpdate({mac:`${device.mac}`}, {$set: {ip:`${device_ip}`}})
            } else {
                console.log("No changes needed moving on to the next device entry.")
            }
        } catch(err) {
            console.log(err)
            continue
        }
    
    }

    res.status(200).json({ message: "Refreshed devices successfully"});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/add", async (req,res) => {
    let {device_name, mac = "", ip, password = "", username = "", category} = req.body

    if (!device_name) 
        return res.status(400).json({ message: "Name is required" });

    if (!ip && !mac) 
        return res.status(400).json({ message: "Either an IP or a MAC are required" });

    if (!mac) {
        const maybeMac = await getMacAddress(ip);
        if (maybeMac) {
            mac = maybeMac;
        } else {
            return res.status(400).json({ message: "Unable to find MAC from IP" });
        }
    }

    if (!category) {
        return res.status(400).json({ message: "Category is required"})
    }

    //category
    // 1 is screens
    // 2 is pc's
    // 3 is lights
    // 4 is projector

    if (category == "2") {
        if (!password || !username) {
            return res.status(400).json({ message: "PC's require the password and username of the account on the PC."})
        }
    }

    //check if device already exists TODO

    let new_device = {
        device_name: device_name,
        mac: mac,
        ip: ip,
        password: password,
        username: username,
        category: category
    }

    try {
        await collection.insertOne(new_device)

        return res.status(200).json({ message: "Device added successfully" })
    } catch(err) {
        console.error(err)
        return res.status(500).json({ message: `Error saving device: ${err}`})
    }
})

router.put("/update", async (req,res) => {
    let {device_name, mac = "", ip, password = "", username = "", category} = req.body

    if (!device_name) 
        return res.status(400).json({ message: "Name is required" });

    if (!ip && !mac) 
        return res.status(400).json({ message: "Either an IP or a MAC are required" });

    if (!mac) {
        const maybeMac = await getMacAddress(ip);
        if (maybeMac) {
            mac = maybeMac;
        } else {
            return res.status(400).json({ message: "Unable to find MAC from IP" });
        }
    }

    if (!category) {
        return res.status(400).json({ message: "Category is required"})
    }

    //category
    // 1 is screens
    // 2 is pc's
    // 3 is lights
    // 4 is projector

    if (category == "2") {
        if (!password || !username) {
            return res.status(400).json({ message: "PC's require the password and username of the account on the PC."})
        }
    }

    let new_device = {
        device_name: device_name,
        mac: mac,
        ip: ip,
        password: password,
        username: username,
        category: category
    }

    try {
        await collection.updateOne({device_name: device_name}, {$set: new_device})
    } catch(err) {
        console.error(err)
        return res.status(500).json({ message: `Error saving device: ${err}`})
    }

})

router.delete("/delete/:device", async (req,res) => {
    let {device_name} = String(req.params.device)

    var check = await collection.findOne({device_name: device_name})

    if (!check) {
        return res.status(400).json({ message: "Device cannot be found in records, do check again."})
    }
    
    try {
        await collection.findOneAndDelete({device_name: device_name})
        
        return res.status(200).json({message: "Device deleted succesfully."})
    } catch(err) {
        console.error(err)
        return res.status(500).json({message: `Error deleting device: ${err}`})
    }
})


export default router;
