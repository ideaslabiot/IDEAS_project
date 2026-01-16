import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";
import net from "net";
 
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
      const client = net.createConnection({ host: this.host, port: this.port });
      client.on("connect", () => {
        const pkt = [0xAA, cmd, this.displayId, data.length, ...data];
        const checksum = pkt.slice(1).reduce((a, b) => a + b, 0) & 0xff;
        pkt.push(checksum);
        client.write(Buffer.from(pkt));
      });
      client.on("data", d => resolve(d));
      client.on("error", reject);
    });
  }
 
  powerOn() { return this.send(0x11, [0x01]); }
  powerOff() { return this.send(0x11, [0x00]); }
 
  async status() {
    const r = await this.send(0x11, []);
    return r[6] === 1 ? "ON" : r[6] === 0 ? "OFF" : "UNKNOWN";
  }
}
 
/* ---------- ROUTES ---------- */
 
// GET all screens with live state
router.get("/", async (req, res) => {
  try {
    const screens = await collection.find(
      { category: "1" }, 
      { projection: { _id: 1, device_name: 1, mac: 1, ip: 1, category: 1, timestamp: 1 } }
    ).toArray();
 
    // Helper to check with timeout
    const checkWithTimeout = async (screen, timeoutMs = 3000) => {
      try {
        const display = new SamsungMDC(screen.ip);
        
        const statusPromise = display.status();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        );
        
        const check = await Promise.race([statusPromise, timeoutPromise]);
        
        return check === "ON" ? screen : null;
      } catch (error) {
        return null;
      }
    };

    const results = await Promise.all(
      screens.map(s => checkWithTimeout(s))
    );
    const live_screens = results.filter(s => s !== null);
    
    res.json(live_screens);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
 
// POWER On
router.post("/wake/:screen_name", async (req, res) => {
    const device_name = req.params.screen_name
    const screen = await collection.findOne({
        device_name: device_name,
        category: "1"
    });

    if (!screen) return res.status(404).json({ message: "Screen not found" });

    try {
        const display = new SamsungMDC(screen.ip);
        await display.powerOn()

        res.status(200).json({
            success: true,
            message: `${device_name} successfully turned on.`
        })

    } catch (err) {
        console.error(`Failed to wake ${device_name}`, err)
        res.status(500).json({
            error: `Failed to wake ${device_name}`,
            details: err.message
        });
    }
});

// Power Off

router.post("/shutdown/:screen_name", async (req, res) => {
    const device_name = req.params.screen_name
    const screen = await collection.findOne({
        device_name: device_name,
        category: "1"
    });

    if (!screen) return res.status(404).json({ message: "Screen not found" });

    try {
        const display = new SamsungMDC(screen.ip);
        await display.powerOff()
        const check = await display.status()

        res.status(200).json({
            success: true,
            message: `${device_name} successfully turned off.`
        })

    } catch (err) {
        console.error(`Failed to shutdown ${device_name}`, err)
        res.status(500).json({
            error: `Failed to shutdown ${device_name}`,
            details: err.message
        });
    }
});

export default router;
