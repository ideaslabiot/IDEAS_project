from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tapo import ApiClient
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Tapo Lab Control Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TPLINK_USER = os.getenv('TPLINKUSER')
TPLINK_PASSWORD = os.getenv('TPLINKPASSWORD')

# Create API client once
tapo_client = ApiClient(TPLINK_USER, TPLINK_PASSWORD)

class DeviceResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[dict] = None

async def get_device(ip_address: str):
    """Connect to P110 device"""
    try:
        device = await tapo_client.p110(ip_address)
        return device
    except Exception as e:
        logger.error(f"Failed to connect to device {ip_address}: {e}")
        raise

@app.post("/device/{ip}/on")
async def turn_on(ip: str):
    try:
        device = await get_device(ip)
        await device.on()
        logger.info(f"Device {ip} turned ON")
        return {"success": True, "message": f"Device {ip} turned on"}
    except Exception as e:
        logger.error(f"Failed to turn on {ip}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/device/{ip}/off")
async def turn_off(ip: str):
    try:
        device = await get_device(ip)
        await device.off()
        logger.info(f"Device {ip} turned OFF")
        return {"success": True, "message": f"Device {ip} turned off"}
    except Exception as e:
        logger.error(f"Failed to turn off {ip}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/device/{ip}/status")
async def get_status(ip: str):
    try:
        device = await get_device(ip)
        info = await device.get_device_info()
        
        return {
            "success": True,
            "data": {
                "device_on": info.device_on
            }
        }
    except Exception as e:
        logger.error(f"Failed to get status for {ip}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)

# ## API Endpoints

# **Turn On:**
# ```
# POST /device/{ip}/on
# Response: {"success": true, "message": "Device 192.168.1.102 turned on"}
# ```

# **Turn Off:**
# ```
# POST /device/{ip}/off
# Response: {"success": true, "message": "Device 192.168.1.102 turned off"}
# ```

# **Get Status (on/off only):**
# ```
# GET /device/{ip}/status
# Response: {"success": true, "data": {"device_on": true}}
# ```
