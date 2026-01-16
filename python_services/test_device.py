import asyncio
from tapo import ApiClient
from dotenv import load_dotenv
import os

load_dotenv()

TPLINK_USER = os.getenv('TPLINKUSER')
TPLINK_PASSWORD = os.getenv('TPLINKPASSWORD')
DEVICE_IP = "192.168.1.102"

async def test_connection():
    try:
        print(f"Testing connection to {DEVICE_IP}")
        print(f"Username: {TPLINK_USER}")
        print("-" * 50)
        
        # Create API client
        client = ApiClient(TPLINK_USER, TPLINK_PASSWORD)
        
        # Connect to device
        print("Connecting to device...")
        device = await client.p110(DEVICE_IP)
        print("✓ Connection successful!")
        
        # Get device info
        print("\nGetting device info...")
        info = await device.get_device_info()
        print(f"✓ Device Type: {info.type}")
        print(f"✓ Model: {info.model}")
        print(f"✓ Device ON: {info.device_on}")
        print(f"✓ Firmware: {info.fw_ver}")
        
        # Turn OFF
        print("\nTurning device OFF...")
        await device.off()
        print("✓ Device turned OFF!")
        
        # Wait a moment
        await asyncio.sleep(2)
        
        # Turn ON
        print("\nTurning device ON...")
        await device.on()
        print("✓ Device turned ON!")
        
        # Get energy usage (P110 specific)
        print("\nGetting energy usage...")
        energy = await device.get_energy_usage()
        print(f"✓ Today's runtime: {energy.today_runtime} minutes")
        print(f"✓ Current power: {energy.current_power} watts")
        
        print("\n" + "=" * 50)
        print("All tests passed!")
        
    except Exception as e:
        print(f"✗ Error: {type(e).__name__}")
        print(f"✗ Details: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_connection())
