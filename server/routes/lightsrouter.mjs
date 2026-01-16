import express from "express";
import db from "../db/conn.mjs"
import 'dotenv/config';
import { cloudLogin, loginDevice, loginDeviceByIp } from 'tp-link-tapo-connect';
// const TuyAPI = (await import('tuyapi')).default;
// const { TuyaContext } = await import("@tuya/tuya-connector-nodejs");

import { broadcastDeviceUpdate } from "../server.mjs";
import { isDeviceLocked, lockDevice, unlockDevice } from "../utils/lockManager.mjs";
import axios from 'axios';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';


// const tplink_user = process.env.TPLINKUSER
// const tplink_password = process.env.TPLINKPASSWORD

let collection = db.collection("devices")


// const cloudApi = await cloudLogin(tplink_user, tplink_password);
// const devices = await cloudApi.listDevicesByType('SMART.TAPOPLUG'); //TODO use for checking if device is on network>
// console.log(devices)

//TODO also do a search for ip by mac again

const router = express.Router();
// console.log(tplink_user)
// console.log(tplink_password)

async function checkLightsStatus(device) {
  try {
    const response = await axios.get(
      `${PYTHON_SERVICE_URL}/device/${device.ip}/status`,
      { timeout: 5000 }
    );

    return response.data.data.device_on ? "ON" : "OFF";
    
  } catch (error) {
    console.log(`${device.device_name} connection failed (likely OFF):`, error.message);
    return "OFF";
  }
}

router.post("/wake/:light_name", async (req, res) => {
    const device_name = req.params.light_name;

    const light = await collection.findOne({device_name: device_name, category: "3"});

    if (!light) {
        return res.status(404).json({ error: 'Light device not found' });
    }

    // Check if locked
    if (isDeviceLocked(light._id.toString())) {
        return res.status(409).json({
            error: 'Device is currently busy',
            message: 'Another command is in progress. Please wait a moment.',
            deviceName: light.device_name
        });
    }

    // Check PENDING state
    if (light.state?.startsWith("PENDING")) {
        return res.status(409).json({
            error: 'Device is currently busy',
            message: 'Device is executing a command. Please wait.',
            deviceName: light.device_name
        });
    }

    // Lock device
    lockDevice(light._id.toString(), 10000);
    
    try {
        // Set PENDING and broadcast
        await collection.updateOne(
            { device_name: device_name },
            { $set: { state: "PENDING_ON", timestamp: new Date() } }
        );

        let updated = await collection.findOne({ device_name: device_name });
        broadcastDeviceUpdate(updated);

        console.log(`Turning on ${device_name} at ${light.ip}`);

        // Call Python service to turn on device
        const response = await axios.post(
            `${PYTHON_SERVICE_URL}/device/${light.ip}/on`,
            {},
            { timeout: 5000 }
        );

        res.status(200).json({
            success: true,
            message: `${device_name} power on command sent.`
        });

        // Verify after 3 seconds (lights respond quickly)
        setTimeout(async () => {
            try {
                const state = await checkLightsStatus(light);
                await collection.updateOne(
                    { device_name: device_name },
                    { $set: { state, timestamp: new Date() } }
                );
                updated = await collection.findOne({ device_name: device_name });
                broadcastDeviceUpdate(updated);
            } catch (err) {
                console.error(`Verification failed for ${device_name}:`, err);
            } finally {
                unlockDevice(light._id.toString());
            }
        }, 3000);

    } catch (err) {
        console.error(`Failed to wake ${device_name}`, err);
        unlockDevice(light._id.toString());

        await collection.updateOne(
            { device_name: device_name },
            { $set: { state: "ERROR", lastError: err.message, timestamp: new Date() } }
        );

        const updated = await collection.findOne({ device_name: device_name });
        broadcastDeviceUpdate(updated);

        res.status(500).json({
            error: `Failed to wake ${device_name}`,
            details: err.response?.data?.detail || err.message
        });
    }
});

// Power Off
router.post("/shutdown/:light_name", async (req, res) => {
  const device_name = req.params.light_name;
  const light = await collection.findOne({
    device_name: device_name,
    category: "3"
  });

  if (!light) {
    return res.status(404).json({ message: "Light not found" });
  }

  // Check if locked
  if (isDeviceLocked(light._id.toString())) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Another command is in progress. Please wait a moment.',
      deviceName: light.device_name
    });
  }

  if (light.state?.startsWith("PENDING")) {
    return res.status(409).json({ 
      error: 'Device is currently busy',
      message: 'Device is executing a command. Please wait.',
      deviceName: light.device_name
    });
  }

  lockDevice(light._id.toString(), 10000);

  try {
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "PENDING_OFF", timestamp: new Date() } }
    );
    
    let updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    console.log(`Turning off ${device_name} at ${light.ip}`);

    // Call Python service to turn off device
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/device/${light.ip}/off`,
      {},
      { timeout: 5000 }
    );

    res.status(200).json({
      success: true,
      message: `${device_name} power off command sent.`
    });

    setTimeout(async () => {
      try {
        const state = await checkLightsStatus(light);
        await collection.updateOne(
          { device_name: device_name },
          { $set: { state, timestamp: new Date() } }
        );
        updated = await collection.findOne({ device_name: device_name });
        broadcastDeviceUpdate(updated);
      } catch (err) {
        console.error(`Verification failed for ${device_name}:`, err);
      } finally {
        unlockDevice(light._id.toString());
      }
    }, 3000);

  } catch (err) {
    console.error(`Failed to shutdown ${device_name}`, err);
    unlockDevice(light._id.toString());
    
    await collection.updateOne(
      { device_name: device_name },
      { $set: { state: "ERROR", lastError: err.message, timestamp: new Date() } }
    );
    
    const updated = await collection.findOne({ device_name: device_name });
    broadcastDeviceUpdate(updated);

    res.status(500).json({
      error: `Failed to shutdown ${device_name}`,
      details: err.response?.data?.detail || err.message
    });
  }
});

// Get status for a single device
router.get("/status/:light_name", async (req, res) => {
    const deviceName = req.params.light_name;

    try {
        const light = await collection.findOne({device_name: deviceName, category: "3"});

        if (!light) {
            return res.status(404).json({ error: 'Light device not found' });
        }

        // Call Python service to get status
        const response = await axios.get(
            `${PYTHON_SERVICE_URL}/device/${light.ip}/status`,
            { timeout: 3000 }
        );

        res.json({
            success: true,
            device: {
                name: deviceName,
                ip: light.ip,
                state: response.data.data.device_on ? 'on' : 'off',
                timestamp: new Date().toISOString()
            }
        });

    } catch(err) {
        console.error(`Failed to get status for ${deviceName}:`, err.message);
        res.status(500).json({
            success: false,
            error: `Failed to get status for ${deviceName}`,
            details: err.response?.data?.detail || err.message
        });
    }
});

// // Get status for all devices
// router.get("/status/all", async (req, res) => {
//     try {
//         const devices = await collection.find({ category: "3" }).toArray();
//         const statuses = [];

//         for (const device of devices) {
//             try {
//                 const response = await axios.get(
//                     `${PYTHON_SERVICE_URL}/device/${device.ip}/status`,
//                     { timeout: 3000 }
//                 );

//                 statuses.push({
//                     name: device.device_name,
//                     ip: device.ip,
//                     state: response.data.data.device_on ? 'on' : 'off',
//                     timestamp: new Date().toISOString()
//                 });

//                 // Small delay between requests
//                 await new Promise(resolve => setTimeout(resolve, 200));

//             } catch(err) {
//                 console.error(`Failed to get status for ${device.device_name}:`, err.message);
//                 statuses.push({
//                     name: device.device_name,
//                     ip: device.ip,
//                     state: 'error',
//                     error: err.message,
//                     timestamp: new Date().toISOString()
//                 });
//             }
//         }

//         res.json({
//             success: true,
//             devices: statuses,
//             count: statuses.length,
//             timestamp: new Date().toISOString()
//         });

//     } catch(err) {
//         console.error('Failed to get all device statuses:', err);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to get device statuses',
//             details: err.message
//         });
//     }
// });


// router.post("/wake/:light_name", async (req,res) => {
//     const deviceName = req.params.light_name;

//     const light  = await collection.findOne({device_name: `${deviceName}`, category: "3"})

//     if (!light) {
//         return res.status(404).json({ error: 'Light device not found' });
//     }

//     console.log(light.ip)
//     try {
//         const device = await loginDeviceByIp(tplink_user,tplink_password, light.ip)
//         const checkdevice = await device.getDeviceInfo()
//         console.log(checkdevice)

//         await device.turnOn();

//         res.status(200).json({
//             success: true,
//             message: `${deviceName} successfully turned on.`
//         })

//     } catch(err){
//         console.error( `Failed to wake ${deviceName}`,err)
//         res.status(500).json({
//             error: `Failed to wake ${deviceName}`,
//             details: err.message
//         });
//     }
    
// })

// router.post("/shutdown/:light_name", async (req,res) => {
//     const deviceName = req.params.light_name;

//     const light  = await collection.findOne({device_name: `${deviceName}`, category: "3"})

//     if (!light) {
//         return res.status(404).json({ error: 'Light device not found' });
//     }

//     try {
//         const device = await loginDeviceByIp(tplink_user,tplink_password,light.ip)
//         const checkdevice = await device.getDeviceInfo()
//         console.log(checkdevice)

//         await device.turnOff();
        
//         res.status(200).json({
//             success: true,
//             message: `${deviceName} successfully turned off.`
//         })

//     } catch(err){
//         console.error( `Failed to off ${deviceName}`,err)
//         res.status(500).json({
//             error: `Failed to off ${deviceName}`,
//             details: err.message
//         });
//     }
// })

//temp to test led lights

// const context = new TuyaContext({
//   baseUrl: 'https://openapi-sg.iotbing.com', // 
//   accessKey: process.env.TUYA_ACCESS_KEY,
//   secretKey: process.env.TUYA_SECRET_KEY,
// });

// router.post("/wakeled/:light_name", async (req, res) => {
//     const deviceName = req.params.light_name;

//     const light  = await collection.findOne({device_name: `${deviceName}`, category: "3"})

//     if (!light) {
//         return res.status(404).json({ error: 'Light device not found' });
//     }

//     if (!light.tuya_id) {
//         res.status(400).json({
//             success: false,
//             message: `No such TUYA Led device with the name ${deviceName}`,
//             details: response
//         });
//     }

//     try {
//         const response = await context.request({
//             method: "POST",
//             path: `/v1.0/devices/${light.tuya_id}/commands`,
//             body: {
//                 commands: [{ code: 'switch_led', value: true }]
//             }
//         });

//         console.log('Full API Response:', JSON.stringify(response, null, 2));

//         // Check if the API actually succeeded
//         if (response.success) {
//             res.status(200).json({
//                 success: true,
//                 message: `${deviceName} successfully turned on.`,
//                 apiResponse: response
//             });
//         } else {
//             res.status(400).json({
//                 success: false,
//                 message: 'API returned failure',
//                 details: response
//             });
//         }

//     } catch (err) {
//         console.error(`Failed to wake ${deviceName}`, err);
//         console.error('Error details:', err.response?.data);
//         res.status(500).json({
//             error: `Failed to wake ${deviceName}`,
//             details: err.message,
//             fullError: err.response?.data
//         });
//     }
// });

// router.post("/shutdownled/:light_name", async (req, res) => {
//     const deviceName = req.params.light_name;

//     const light  = await collection.findOne({device_name: `${deviceName}`, category: "3"})

//     if (!light) {
//         return res.status(404).json({ error: 'Light device not found' });
//     }

//     if (!light.tuya_id) {
//         res.status(400).json({
//             success: false,
//             message: `No such TUYA Led device with the name ${deviceName}`,
//             details: response
//         });
//     }


//     try {
//         const response = await context.request({
//             method: "POST",
//             path: `/v1.0/devices/${light.tuya_id}/commands`,
//             body: {
//                 commands: [{ code: 'switch_led', value: false }]
//             }
//         });

//         console.log('Full API Response:', JSON.stringify(response, null, 2));

//         // Check if the API actually succeeded
//         if (response.success) {
//             res.status(200).json({
//                 success: true,
//                 message: `${deviceName} successfully turned off.`,
//                 apiResponse: response
//             });
//         } else {
//             res.status(400).json({
//                 success: false,
//                 message: 'API returned failure',
//                 details: response
//             });
//         }

//     } catch (err) {
//         console.error(`Failed to shut down ${deviceName}`, err);
//         console.error('Error details:', err.response?.data);
//         res.status(500).json({
//             error: `Failed to shut down ${deviceName}`,
//             details: err.message,
//             fullError: err.response?.data
//         });
//     }
// });



export default router
export { checkLightsStatus };
