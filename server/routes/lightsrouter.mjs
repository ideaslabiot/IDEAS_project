import express from "express";
import db from "../db/conn.mjs"
import 'dotenv/config';
import { cloudLogin, loginDevice, loginDeviceByIp } from 'tp-link-tapo-connect';
// const TuyAPI = (await import('tuyapi')).default;
const { TuyaContext } = await import("@tuya/tuya-connector-nodejs");

const tplink_user = process.env.TPLINKUSER
const tplink_password = process.env.TPLINKPASSWORD

let collection = db.collection("devices")


// const cloudApi = await cloudLogin(tplink_user, tplink_password);
// const devices = await cloudApi.listDevicesByType('SMART.TAPOPLUG'); //TODO use for checking if device is on network>
// console.log(devices)

//TODO also do a search for ip by mac again

const router = express.Router();
console.log(tplink_user)
console.log(tplink_password)

router.post("/wake/:light_name", async (req,res) => {
    const deviceName = req.params.light_name;

    const light  = await collection.findOne({device_name: `${deviceName}`, category: "3"})

    if (!light) {
        return res.status(404).json({ error: 'Light device not found' });
    }

    console.log(light.ip)
    try {
        const device = await loginDeviceByIp(tplink_user,tplink_password, light.ip)
        const checkdevice = await device.getDeviceInfo()
        console.log(checkdevice)

        await device.turnOn();

        res.status(200).json({
            success: true,
            message: `${deviceName} successfully turned on.`
        })

    } catch(err){
        console.error( `Failed to wake ${deviceName}`,err)
        res.status(500).json({
            error: `Failed to wake ${deviceName}`,
            details: err.message
        });
    }
    
})

router.post("/shutdown/:light_name", async (req,res) => {
    const deviceName = req.params.light_name;

    const light  = await collection.findOne({device_name: `${deviceName}`, category: "3"})

    if (!light) {
        return res.status(404).json({ error: 'Light device not found' });
    }

    try {
        const device = await loginDeviceByIp(tplink_user,tplink_password,light.ip)
        const checkdevice = await device.getDeviceInfo()
        console.log(checkdevice)

        await device.turnOff();
        
        res.status(200).json({
            success: true,
            message: `${deviceName} successfully turned off.`
        })

    } catch(err){
        console.error( `Failed to off ${deviceName}`,err)
        res.status(500).json({
            error: `Failed to off ${deviceName}`,
            details: err.message
        });
    }
})

//temp to test led lights

const context = new TuyaContext({
  baseUrl: 'https://openapi-sg.iotbing.com', // 
  accessKey: 'uadhheywrmevxpvk455s',
  secretKey: '6d9fd7f8710f4fc4a7bc3337202b30f8',
});

const testdeviceid = "a33f7fdfa3af27ca2axft3"

router.post("/wakeled/:light_name", async (req, res) => {
    const deviceName = req.params.light_name;

    const light  = await collection.findOne({device_name: `${deviceName}`, category: "3"})

    if (!light) {
        return res.status(404).json({ error: 'Light device not found' });
    }

    if (!light.tuya_id) {
        res.status(400).json({
            success: false,
            message: `No such TUYA Led device with the name ${deviceName}`,
            details: response
        });
    }

    try {
        const response = await context.request({
            method: "POST",
            path: `/v1.0/devices/${light.tuya_id}/commands`,
            body: {
                commands: [{ code: 'switch_led', value: true }]
            }
        });

        console.log('Full API Response:', JSON.stringify(response, null, 2));

        // Check if the API actually succeeded
        if (response.success) {
            res.status(200).json({
                success: true,
                message: `${deviceName} successfully turned on.`,
                apiResponse: response
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'API returned failure',
                details: response
            });
        }

    } catch (err) {
        console.error(`Failed to wake ${deviceName}`, err);
        console.error('Error details:', err.response?.data);
        res.status(500).json({
            error: `Failed to wake ${deviceName}`,
            details: err.message,
            fullError: err.response?.data
        });
    }
});

router.post("/shutdownled/:light_name", async (req, res) => {
    const deviceName = req.params.light_name;

    const light  = await collection.findOne({device_name: `${deviceName}`, category: "3"})

    if (!light) {
        return res.status(404).json({ error: 'Light device not found' });
    }

    if (!light.tuya_id) {
        res.status(400).json({
            success: false,
            message: `No such TUYA Led device with the name ${deviceName}`,
            details: response
        });
    }


    try {
        const response = await context.request({
            method: "POST",
            path: `/v1.0/devices/${light.tuya_id}/commands`,
            body: {
                commands: [{ code: 'switch_led', value: false }]
            }
        });

        console.log('Full API Response:', JSON.stringify(response, null, 2));

        // Check if the API actually succeeded
        if (response.success) {
            res.status(200).json({
                success: true,
                message: `${deviceName} successfully turned off.`,
                apiResponse: response
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'API returned failure',
                details: response
            });
        }

    } catch (err) {
        console.error(`Failed to shut down ${deviceName}`, err);
        console.error('Error details:', err.response?.data);
        res.status(500).json({
            error: `Failed to shut down ${deviceName}`,
            details: err.message,
            fullError: err.response?.data
        });
    }
});



export default router
