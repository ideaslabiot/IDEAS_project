import express from "express";
import db from "../db/conn.mjs"
import 'dotenv/config';
import pjlink from "pjlink";

// var projector = new pjlink("192.168.1.114","4352","IDEASP1")

//https://github.com/sy1vain/node-pjlink direct control via nodejs, outdated?, unmaintained
//https://github.com/Bannsaenger/ioBroker.pjlink very active, requires running ioBroker server n setting that up and all

//pjlink pass = IDEASP1
//passphrase = 12345678
let collection = db.collection("devices")
const router = express.Router();

router.post("/wake/:projector_name", async (req,res) => {
    const deviceName = req.params.projector_name;

    const projector  = await collection.findOne({device_name: `${deviceName}`, category: "4"})

    if (!projector) {
        return res.status(404).json({ error: 'Projector device not found' });
    }

    console.log(projector.ip)
    try {
        const device = new pjlink(`${projector.ip}`,"4352",`${projector.password}`)

        await device.powerOn();

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

router.post("/shutdown/:projector_name", async (req,res) => {
    const deviceName = req.params.projector_name;

    const projector  = await collection.findOne({device_name: `${deviceName}`, category: "4"})

    if (!projector) {
        return res.status(404).json({ error: 'Projector device not found' });
    }

    console.log(projector.ip)
    try {
        const device = new pjlink(`${projector.ip}`,"4352",`${projector.password}`)

        await device.powerOff();

        res.status(200).json({
            success: true,
            message: `${deviceName} successfully powered off.`
        })

    } catch(err){
        console.error( `Failed to shutdown ${deviceName}`,err)
        res.status(500).json({
            error: `Failed to shutdown ${deviceName}`,
            details: err.message
        });
    }
    
})

export default router
