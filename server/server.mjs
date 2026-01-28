import "../server/db/conn.mjs";
import express, { urlencoded } from "express";
import cors from "cors";
import session from "express-session"
import MongoStore from "connect-mongo";
import passport from "passport";
import os from "os"
import { createServer } from "http";
import { WebSocketServer } from "ws";
import "./auth/passport.mjs"
import 'dotenv/config';
import 'http';
import { startBackgroundSync } from "./backgroundSync.mjs";
import db from "./db/conn.mjs"; // ✅ ADD THIS for WebSocket

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import userrouter from "./routes/userrouter.mjs";
import lightsrouter from "./routes/lightsrouter.mjs";
import pcrouter from "./routes/pcrouter.mjs";
import projectorrouter from "./routes/projectorrouter.mjs";
import screensrouter from "./routes/screensrouter.mjs";
import devicerouter from "./routes/devicerouter.mjs";

import schedulerouter from "./routes/schedulerouter.mjs"

import { device_refresh } from "./routes/devicesearch.mjs"

import { executor } from "./schedule_executor.mjs";

// CHECK ideascomment (IDC) for changes and notes

const PORT = process.env.PORT || 5050;
const hostname = process.env.HOST || "192.168.1.106"//IDC: replace with wtv static ip we are using
const app = express();

app.use(cors( {
    origin: ["http://localhost:5173", "http://localhost:4173"],
    credentials: false //IDC: should disable credentials needer for now?
}));
app.use(express.json());
app.use(urlencoded({extended: true}))
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/ideas_db',
        autoRemove: 'native'
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, //24 hours till it will expire
        sameSite: 'strict'
    }
}))
 
app.use(passport.initialize())
app.use(passport.session())

app.use(express.static(path.join(__dirname, '../client/dist')));
app.use("/users", userrouter);
app.use("/device",devicerouter)
app.use("/lights", lightsrouter)
app.use("/projector", projectorrouter)
app.use("/computer", pcrouter)
app.use("/screens", screensrouter)
app.use("/schedule", schedulerouter)

const options = {
    root: __dirname
}

//---------------------- WEBSOCKET
const server = createServer(app);
const wss = new WebSocketServer({ server });
// Store connected clients
const clients = new Set();

// WebSocket connection handler
wss.on("connection", (ws) => {
  console.log("✓ New WebSocket client connected");
  clients.add(ws);

  ws.on("close", () => {
    console.log("✗ WebSocket client disconnected");
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    clients.delete(ws);
  });

  // Send initial device states on connection
  (async () => {
    try {
      const devices = await db.collection("devices").find({}).toArray();
      ws.send(JSON.stringify({
        type: "INITIAL_STATE",
        devices: devices
      }));
    } catch (error) {
      console.error("Error sending initial state:", error);
    }
  })();
});

// Function to broadcast single device update
export function broadcastDeviceUpdate(device) {
  const message = JSON.stringify({
    type: "DEVICE_UPDATE",
    device: device
  });

  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Function to broadcast multiple device updates
export function broadcastDevicesUpdate(devices) {
  const message = JSON.stringify({
    type: "DEVICES_UPDATE",
    devices: devices
  });

  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}
//---------------------- WEBSOCKET

// Catch-all ONLY for HTML5 routing (not assets)
app.get('*', (req, res, next) => {
  // If request is for a file (has extension), skip this
  if (req.path.split('/').pop().includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});
//hosting frontend

//Starting the Express Server
server.listen(PORT, hostname, () => {
  console.log(`Server running at http://${hostname}:${PORT}`);
  console.log(`WebSocket server ready`);

  startBackgroundSync();
});

device_refresh();

executor.start();
