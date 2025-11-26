import express from "express";
import db from "../db/conn.mjs"
import 'dotenv/config';
import { cloudLogin, loginDevice, loginDeviceByIp } from 'tp-link-tapo-connect';

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


export default router
