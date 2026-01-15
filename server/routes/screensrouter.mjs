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
  const screens = await collection.find({ category: "1" }).toArray();

  for (const s of screens) {
    try {
      const display = new SamsungMDC(s.ip);
      s.state = await display.status();
    } catch {
      s.state = "Loading...";
    }
  }

  res.json(screens);
});

// POWER
router.post("/:id/power/:action", async (req, res) => {
  const screen = await collection.findOne({
    _id: new ObjectId(req.params.id),
    category: "1"
  });

  if (!screen) return res.status(404).json({ message: "Screen not found" });

  const display = new SamsungMDC(screen.ip);
  req.params.action === "on"
    ? await display.powerOn()
    : await display.powerOff();

  res.json({ state: req.params.action.toUpperCase() });
});

export default router;
