import express from 'express';
import db from "../db/conn.mjs"
import { ObjectId } from 'mongodb';

const router = express.Router();

// Helper function to validate time format
function isValidTime(time) {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

// ============ SCHEDULE ROUTES ============

// Create a new schedule
router.post('/schedules', async (req, res) => {
  try {
    const { schedule_name, scheduled_time, devices, action, days_of_week, repeat_weekly } = req.body;

    // Validate required fields
    if (!schedule_name || !scheduled_time || !devices || !action || !days_of_week) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Validate time format
    if (!isValidTime(scheduled_time)) {
      return res.status(400).json({
        success: false,
        error: 'Time must be in HH:MM format (e.g., 08:30, 14:00)'
      });
    }

    // Validate devices array
    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one device is required'
      });
    }

    // Validate days_of_week array
    if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one day of week is required'
      });
    }

    // Validate days are between 0-6
    const invalidDays = days_of_week.filter(day => day < 0 || day > 6);
    if (invalidDays.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Days of week must be between 0 (Sunday) and 6 (Saturday)'
      });
    }

    // Validate action
    if (!['On', 'Off'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "On" or "Off"'
      });
    }

    // Validate all devices exist
    const devicesCollection = db.collection('devices');
    for (const deviceInfo of devices) {
      const device = await devicesCollection.findOne({ _id: new ObjectId(deviceInfo.device_id) });
      if (!device) {
        return res.status(404).json({
          success: false,
          error: `Device id "${deviceInfo.device_id}" not found`
        });
      }
      // Verify category matches
      if (device.category !== deviceInfo.category) {
        return res.status(400).json({
          success: false,
          error: `Device id "${deviceInfo.id}" category mismatch. Expected: ${device.category}, Got: ${deviceInfo.category}`
        });
      }
    }

    const schedule = {
      schedule_name,
      scheduled_time,
      devices,
      action,
      days_of_week,
      repeat_weekly: repeat_weekly !== undefined ? repeat_weekly : true,
      is_active: true,
      last_executed: null,
      last_execution_results: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection('schedules').insertOne(schedule);
    schedule._id = result.insertedId;

    res.status(201).json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all schedules
router.get('/schedules', async (req, res) => {
  try {
    const { is_active, device_id, day, action } = req.query;

    const filter = {};
    if (is_active !== undefined) filter.is_active = is_active == 'true';
    if (device_id) filter['devices.device_id'] = device_id;
    if (day !== undefined) filter.days_of_week = parseInt(day);
    if (action) filter.action = action;

    const schedules = await db.collection('schedules')
      .find(filter)
      .sort({ scheduled_time: 1 })
      .toArray();

    res.json({ success: true, count: schedules.length, schedules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get schedule by ID
router.get('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid schedule ID' });
    }

    const schedule = await db.collection('schedules').findOne({ _id: new ObjectId(id) });
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    res.json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// // Get schedules for today
// router.get('/schedules/filter/today', async (req, res) => {
//   try {
//     const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday

//     const schedules = await db.collection('schedules')
//       .find({
//         is_active: true,
//         days_of_week: today
//       })
//       .sort({ scheduled_time: 1 })
//       .toArray();

//     res.json({ success: true, count: schedules.length, day: today, schedules });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// Update a schedule
router.patch('/schedules/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;

    // Don't allow changing these fields
    delete updates._id;
    delete updates.last_executed;
    delete updates.last_execution_results;
    delete updates.created_at;

    // Validate time format if being updated
    if (updates.scheduled_time && !isValidTime(updates.scheduled_time)) {
      return res.status(400).json({
        success: false,
        error: 'Time must be in HH:MM format'
      });
    }

    // If updating devices, validate they exist
    if (updates.devices) {
      const devicesCollection = db.collection('devices');
      for (const deviceInfo of updates.devices) {
        const device = await devicesCollection.findOne({ _id: new ObjectId(deviceInfo.device_id) });
        if (!device) {
          return res.status(404).json({
            success: false,
            error: `Device id "${deviceInfo.device_id}" not found`
          });
        }
        if (device.category !== deviceInfo.category) {
          return res.status(400).json({
            success: false,
            error: `Device id "${deviceInfo.device_id}" category mismatch`
          });
        }
      }
    }

    // Validate days_of_week if being updated
    if (updates.days_of_week) {
      if (!Array.isArray(updates.days_of_week) || updates.days_of_week.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one day of week is required'
        });
      }
      const invalidDays = updates.days_of_week.filter(day => day < 0 || day > 6);
      if (invalidDays.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Days of week must be between 0 (Sunday) and 6 (Saturday)'
        });
      }
    }

    // Validate action if being updated
    if (updates.action && !['On', 'Off'].includes(updates.action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "On" or "Off"'
      });
    }

    updates.updated_at = new Date();

    const result = await db.collection('schedules').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    res.json({ success: true, schedule: result.value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// // Toggle schedule active status
// router.patch('/schedules/:id/toggle', async (req, res) => {
//   try {
//     const { id } = req.params;

//     const schedule = await db.collection('schedules').findOne({ _id: new ObjectId(id) });
//     if (!schedule) {
//       return res.status(404).json({ success: false, error: 'Schedule not found' });
//     }

//     const newActiveState = !schedule.is_active;
    
//     const result = await db.collection('schedules').findOneAndUpdate(
//       { _id: new ObjectId(id) },
//       { 
//         $set: { 
//           is_active: newActiveState,
//           updated_at: new Date()
//         } 
//       },
//       { returnDocument: 'after' }
//     );

//     res.json({ 
//       success: true, 
//       message: `Schedule ${newActiveState ? 'activated' : 'deactivated'}`,
//       schedule: result.value 
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// Delete a schedule
router.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection('schedules').deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    res.json({ success: true, message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


// {
//     "schedule_name":"test1",
//     "scheduled_time":"11:25",
//     "devices":[
//         {
//             "device_name":"com1",
//             "category":"2"
//         },
//         {
//             "device_name":"proj1",
//             "category":"4"
//         }
//     ],
//     "action":"On",
//     "days_of_week": [
//         4
//     ],
//     "repeat_weekly":false
// }
