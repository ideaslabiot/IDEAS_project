import cron from 'node-cron';
import axios from 'axios';
import db from "./db/conn.mjs"
import os from "os"

class ScheduleExecutor {
  constructor() {
    this.isRunning = false;
    this.db = null;
    this.hostname = this.getLocalIPAddress();
    this.port = process.env.PORT || 5050;
    this.baseUrl = `http://${this.hostname}:${this.port}`;

    // Map category to control function
    this.categoryHandlers = {
      '1': this.controlSamsungDisplay.bind(this),
      '2': this.controlPC.bind(this),
      '3': this.controlLights.bind(this),
      '4': this.controlProjector.bind(this)
    };
  }

  getLocalIPAddress() {
    // const interfaces = os.networkInterfaces();
    
    // for (const name of Object.keys(interfaces)) {
    //   for (const iface of interfaces[name]) {
    //     if (iface.family === 'IPv4' && !iface.internal) {
    //       return iface.address;
    //     }
    //   }
    // }
    
    return "192.168.1.103";
  }

  // Start the scheduler (runs every minute)
  async start() {
    if (this.isRunning) return;
    
    this.db = db;
    console.log('Schedule executor started');
    this.isRunning = true;

    // Run every minute
    this.job = cron.schedule('* * * * *', async () => {
      await this.checkAndExecuteSchedules();
    });
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.isRunning = false;
      console.log('Schedule executor stopped');
    }
  }

  async checkAndExecuteSchedules() {
    try {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const oneMinuteAgo = currentMinutes - 1;

      // Get all active schedules for today
      const allSchedules = await this.db.collection('schedules')
        .find({
          days_of_week: currentDay
        })
        .toArray();

      // Filter schedules that should have run in the last minute
      const schedulesToRun = allSchedules.filter(schedule => {
        const [hours, minutes] = schedule.scheduled_time.split(':').map(Number);
        const scheduleMinutes = hours * 60 + minutes;
        
        // Run if schedule time is within the last minute (inclusive)
        return scheduleMinutes >= oneMinuteAgo && scheduleMinutes <= currentMinutes;
      });

      console.log(`[${currentTime}] Day ${currentDay} - Found ${schedulesToRun.length} schedule(s) to run`);

      for (const schedule of schedulesToRun) {
        // Check if already executed in the last 2 minutes (avoid duplicates)
        if (schedule.last_executed) {
          const timeSinceLastExecution = now - schedule.last_executed;
          if (timeSinceLastExecution < 120000) { // Less than 2 minutes
            console.log(`Skipping "${schedule.schedule_name}" - already executed recently`);
            continue;
          }
        }

        await this.executeSchedule(schedule);
      }
    } catch (err) {
      console.error('Error checking schedules:', err);
    }
  }

  async executeSchedule(schedule) {
    console.log(`Executing: "${schedule.schedule_name}" - Action: ${schedule.action}`);

    const executionResults = [];

    try {
      // Execute all devices in parallel
      const devicePromises = schedule.devices.map(deviceInfo =>
        this.executeDeviceAction(deviceInfo, schedule.action)
      );

      const results = await Promise.allSettled(devicePromises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          executionResults.push(result.value);
        } else {
          executionResults.push({
            device_name: schedule.devices[index].device_name,
            category: schedule.devices[index].category,
            success: false,
            error: result.reason?.message || 'Unknown error',
            executed_at: new Date()
          });
        }
      });

      const successCount = executionResults.filter(r => r.success).length;
      console.log(`"${schedule.schedule_name}": ${successCount}/${executionResults.length} devices successful`);

      // If not repeating weekly, delete after execution
      if (!schedule.repeat_weekly) {
        await this.db.collection('schedules').deleteOne({ _id: schedule._id });
        console.log(`"${schedule.schedule_name}" completed and deleted (one-time schedule)`);
      } else {
        // Update repeating schedule with execution results
        await this.db.collection('schedules').updateOne(
          { _id: schedule._id },
          {
            $set: {
              last_executed: new Date(),
              last_execution_results: executionResults,
              updated_at: new Date()
            }
          }
        );
      }

    } catch (err) {
      console.error(`Error executing schedule ${schedule._id}:`, err);

      // Even if execution fails, update the schedule (or delete if one-time)
      if (!schedule.repeat_weekly) {
        await this.db.collection('schedules').deleteOne({ _id: schedule._id });
        console.log(`"${schedule.schedule_name}" deleted after failed execution (one-time schedule)`);
      } else {
        await this.db.collection('schedules').updateOne(
          { _id: schedule._id },
          {
            $set: {
              last_executed: new Date(),
              last_execution_results: [{
                device_name: 'system',
                category: 'error',
                success: false,
                error: err.message,
                executed_at: new Date()
              }],
              updated_at: new Date()
            }
          }
        );
      }
    }
  }

  async executeDeviceAction(deviceInfo, action) {
    const result = {
      device_name: deviceInfo.device_name,
      category: deviceInfo.category,
      success: false,
      error: null,
      executed_at: new Date()
    };

    try {
      // Get device from database
      const device = await this.db.collection('devices').findOne({ 
        device_name: deviceInfo.device_name 
      });
      
      if (!device) {
        result.error = 'Device not found';
        return result;
      }

      // Verify category matches
      if (device.category !== deviceInfo.category) {
        result.error = `Category mismatch: expected ${deviceInfo.category}, got ${device.category}`;
        return result;
      }

      // Route to appropriate handler based on category
      const handler = this.categoryHandlers[device.category];
      
      if (!handler) {
        result.error = `No handler for category ${device.category}`;
        return result;
      }

      // Execute the control function
      await handler(device, action);
      result.success = true;
      
      console.log(`  ✓ ${device.device_name} (${this.getCategoryName(device.category)}) → ${action}`);

    } catch (err) {
      result.error = err.message;
      console.error(`  ✗ ${deviceInfo.device_name}: ${err.message}`);
    }

    return result;
  }

  // ============ CATEGORY-SPECIFIC CONTROL FUNCTIONS ============

  async controlSamsungDisplay(device, action) {
    // Category 1: Samsung Display Screens
    try {
      if (action == "On") {
        await axios.post(`${this.baseUrl}/screens/wake/${device.device_name}`);
      } else if (action == "Off") {
        await axios.post(`${this.baseUrl}/screens/shutdown/${device.device_name}`);
      }
      
    } catch (err) {
      throw new Error(`Samsung display control failed: ${err.message}`);
    }
  }

  async controlPC(device, action) {
    // Category 2: PC
    try {
      if (action == "On") {
        await axios.post(`${this.baseUrl}/computer/wake/${device.device_name}`);
      } else if (action == "Off") {
        await axios.post(`${this.baseUrl}/computer/shutdown/${device.device_name}`);
      }
    } catch (err) {
      throw new Error(`PC control failed: ${err.message}`);
    }
  }

  async controlLights(device, action) {
    // Category 3: Lights
    try {
      if (action == "On") {
        await axios.post(`${this.baseUrl}/lights/wake/${device.device_name}`);
      } else if (action == "Off") {
        await axios.post(`${this.baseUrl}/lights/shutdown/${device.device_name}`);
      }
    } catch (err) {
      throw new Error(`Lights control failed: ${err.message}`);
    }
  }

  async controlProjector(device, action) {
    // Category 4: Projectors
    try {
      if (action == "On") {
        await axios.post(`${this.baseUrl}/projector/wake/${device.device_name}`);
      } else if (action == "Off") {
        await axios.post(`${this.baseUrl}/projector/shutdown/${device.device_name}`);
      }
    } catch (err) {
      throw new Error(`Projector control failed: ${err.message}`);
    }
  }

  // ============ HELPER FUNCTIONS ============

  getCategoryName(category) {
    const names = {
      '1': 'Samsung Display',
      '2': 'PC',
      '3': 'Tapo Plug',
      '4': 'Projector'
    };
    return names[category] || 'Unknown';
  }
}

// Singleton instance
const executor = new ScheduleExecutor();

export {executor}
