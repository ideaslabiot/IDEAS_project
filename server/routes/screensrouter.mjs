import express from "express";
// import db from "../db/conn.mjs"
import 'dotenv/config';
import net from 'net';

class SamsungMDC {
    constructor(host, port = 1515, displayId = 0) {
        this.host = host;
        this.port = port;
        this.displayId = displayId;
    }

    /**
     * Send MDC command to display
     * @param {number} command - Command byte (e.g., 0x11 for power)
     * @param {number[]} data - Data bytes
     * @returns {Promise<Buffer>}
     */
    sendCommand(command, data = []) {
        return new Promise((resolve, reject) => {
            const client = net.createConnection({ 
                host: this.host, 
                port: this.port,
                timeout: 5000
            });

            client.on('connect', () => {
                // MDC packet structure:
                // [Header: 0xAA][Command][Display ID][Data Length][Data...][Checksum]
                
                const header = 0xAA;
                const dataLength = data.length;
                
                // Build packet
                let packet = [header, command, this.displayId, dataLength, ...data];
                
                // Calculate checksum (sum of all bytes except header, mod 256)
                let checksum = 0;
                for (let i = 1; i < packet.length; i++) {
                    checksum += packet[i];
                }
                checksum = checksum & 0xFF;
                
                packet.push(checksum);
                
                console.log('Sending packet:', packet.map(b => '0x' + b.toString(16)).join(' '));
                client.write(Buffer.from(packet));
            });

            client.on('data', (data) => {
                console.log('Received:', data);
                resolve(data);
                client.end();
            });

            client.on('error', (err) => {
                reject(err);
            });

            client.on('timeout', () => {
                client.destroy();
                reject(new Error('Connection timeout'));
            });
        });
    }

    /**
     * Turn display ON
     * Command: 0x11, Data: 0x01
     */
    async powerOn() {
        try {
            const response = await this.sendCommand(0x11, [0x01]);
            return this.parseResponse(response);
        } catch (error) {
            throw new Error(`Failed to power on: ${error.message}`);
        }
    }

    /**
     * Turn display OFF
     * Command: 0x11, Data: 0x00
     */
    async powerOff() {
        try {
            const response = await this.sendCommand(0x11, [0x00]);
            return this.parseResponse(response);
        } catch (error) {
            throw new Error(`Failed to power off: ${error.message}`);
        }
    }

    /**
     * Get power status
     * Command: 0x11 with no data (query)
     */
    async getPowerStatus() {
        try {
            const response = await this.sendCommand(0x11, []);
            // Parse response: [0xAA][0xFF][0x11][0x03][ACK][Data Length][Power State][Checksum]
            if (response.length >= 7 && response[4] === 0x41) { // 0x41 = ACK
                const powerState = response[6];
                return {
                    raw: powerState,
                    state: powerState === 0x01 ? 'ON' : 
                           powerState === 0x00 ? 'OFF' : 
                           powerState === 0x02 ? 'STANDBY' : 'UNKNOWN'
                };
            }
            throw new Error('Invalid response');
        } catch (error) {
            throw new Error(`Failed to get power status: ${error.message}`);
        }
    }

    parseResponse(response) {
        if (response.length < 5) {
            return { success: false, error: 'Response too short' };
        }
        console.log(`response in parseResponse ${response[4]}`);
        const ack = response[4];
        console.log(ack)
        if (ack === 0x41) { // 'A' = ACK (success)
            return { success: true, data: response };
        } else if (ack === 0x4E) { // 'N' = NAK (error)
            const errorCode = response[5] || 0;
            return { 
                success: false, 
                error: `NAK received, error code: 0x${errorCode.toString(16)}` 
            };
        }
        
        return { success: false, error: 'Unknown response' };
    }
}

// Usage example
const display = new SamsungMDC('192.168.1.19', 1515, 0);

const router = express.Router();

// Add power on endpoint
router.post("/power/on", async (req, res) => {
    try {
        const result = await display.powerOn();
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add power off endpoint
router.post("/power/off", async (req, res) => {
    try {
        const result = await display.powerOff();
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Status endpoint
router.get("/status", async (req, res) => {
    try {
        const status = await display.getPowerStatus();
        console.log('Power status:', status.state);
        res.status(200).json({ message: status.state });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
