import { useState, useEffect } from 'react';
import { getDevicesByCategory } from '../services/deviceapi.mjs';
import { createSchedule, getSchedules, deleteSchedule, updateSchedule } from '../services/scheduleapi.mjs';
import '../styles/schedule.css';

const CATEGORY_LABELS = {
  '1': 'Samsung Display',
  '2': 'PC',
  '3': 'Lights',
  '4': 'Projector'
};

export default function DeviceScheduler() {
  const [devices, setDevices] = useState([]);
  const [allDevices, setAllDevices] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState('1');
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [scheduleTime, setScheduleTime] = useState('18:00');
  const [action, setAction] = useState('On');
  const [scheduleName, setScheduleName] = useState('');
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);

  const days = [
    { id: 0, label: 'Sun' },
    { id: 1, label: 'Mon' },
    { id: 2, label: 'Tue' },
    { id: 3, label: 'Wed' },
    { id: 4, label: 'Thu' },
    { id: 5, label: 'Fri' },
    { id: 6, label: 'Sat' }
  ];

  // Load all devices and schedules on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch devices from all categories
        const categories = ['1', '2', '3', '4'];
        const allDevicesMap = {};
        for (const category of categories) {
          const response = await getDevicesByCategory(category);
          allDevicesMap[category] = response || [];
        }
        setAllDevices(allDevicesMap);
        setDevices(allDevicesMap['1'] || []);

        // Fetch existing schedules
        const schedulesResponse = await getSchedules({ is_active: true });
        setSchedules(schedulesResponse.schedules || []);
      } catch (err) {
        setError(err.message);
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Update displayed devices when category changes
  useEffect(() => {
    setDevices(allDevices[selectedCategory] || []);
  }, [selectedCategory, allDevices]);

  const handleDeviceToggle = (deviceId) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleDayToggle = (dayId) => {
    setSelectedDays(prev =>
      prev.includes(dayId)
        ? prev.filter(id => id !== dayId)
        : [...prev, dayId]
    );
  };

  const handleSaveSchedule = async () => {
    if (!scheduleName.trim()) {
      setError('Please enter a schedule name');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Build devices array with correct format
      const devicesForSchedule = selectedDevices.map(deviceId => {
        // Search for device across all categories
        let device = null;
        let deviceCategory = null;
        for (const [category, categoryDevices] of Object.entries(allDevices)) {
          const foundDevice = categoryDevices.find(d => d._id === deviceId);
          if (foundDevice) {
            device = foundDevice;
            deviceCategory = category;
            break;
          }
        }
        return {
          device_id: deviceId,
          category: deviceCategory || selectedCategory
        };
      });

      const scheduleData = {
        schedule_name: scheduleName,
        scheduled_time: scheduleTime,
        devices: devicesForSchedule,
        action: action,
        days_of_week: selectedDays,
        repeat_weekly: true
      };

      if (editingScheduleId) {
        // Update existing schedule
        await updateSchedule(editingScheduleId, scheduleData);
      } else {
        // Create new schedule
        await createSchedule(scheduleData);
      }
      
      // Reset form
      setScheduleName('');
      setSelectedDevices([]);
      setScheduleTime('18:00');
      setAction('On');
      setSelectedDays([1, 2, 3, 4, 5]);
      setShowForm(false);
      setEditingScheduleId(null);

      // Reload schedules
      const schedulesResponse = await getSchedules({ is_active: true });
      setSchedules(schedulesResponse.schedules || []);
    } catch (err) {
      setError(err.message);
      console.error('Error saving schedule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    try {
      setError(null);
      await deleteSchedule(scheduleId);
      
      // Reload schedules
      const schedulesResponse = await getSchedules({ is_active: true });
      setSchedules(schedulesResponse.schedules || []);
    } catch (err) {
      setError(err.message);
      console.error('Error deleting schedule:', err);
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingScheduleId(schedule._id);
    setScheduleName(schedule.schedule_name);
    setScheduleTime(schedule.scheduled_time);
    setAction(schedule.action);
    setSelectedDays(schedule.days_of_week);
    setSelectedDevices(schedule.devices.map(d => d.device_id));
    if (schedule.devices.length > 0) {
      setSelectedCategory(schedule.devices[0].category);
    }
    setShowForm(true);
  };

  const getDayLabel = (dayNum) => {
    return days.find(d => d.id === dayNum)?.label || '';
  };

  const selectedDeviceNames = selectedDevices
    .map(id => {
      // Search for device across all categories
      for (const categoryDevices of Object.values(allDevices)) {
        const device = categoryDevices.find(d => d._id === id);
        if (device) {
          return device?.device_name || device?.name;
        }
      }
      return null;
    })
    .filter(Boolean);

  return (
    <div className="schedule-page">
      <h2 className="schedule-header">Schedules</h2>

      {/* ERROR ALERT */}
      {error && (
        <div className="schedule-error-alert">
          <div className="schedule-error-content">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}


      {loading ? (
        <div className="schedule-loading-text">Loading devices...</div>
      ) : (
        <div className="schedule-container">
          {/* LEFT: Create Schedule Form */}
          <div className="schedule-form-section">
            <button 
              className="schedule-create-btn"
              onClick={() => {
                if (editingScheduleId) {
                  setEditingScheduleId(null);
                  setScheduleName('');
                  setSelectedDevices([]);
                  setScheduleTime('18:00');
                  setAction('On');
                  setSelectedDays([1, 2, 3, 4, 5]);
                  setSelectedCategory('1');
                }
                setShowForm(!showForm);
              }}
            >
              {showForm ? '✕ Close' : '+ Create Schedule'}
            </button>

            {showForm && (
              <div className="schedule-form-wrapper">
                <h3>{editingScheduleId ? 'Edit Schedule' : 'New Schedule'}</h3>

                {/* Schedule Name */}
                <div className="schedule-form-group">
                  <label>Schedule Name</label>
                  <input
                    type="text"
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    placeholder="e.g., Morning Lights"
                    className="schedule-input"
                  />
                </div>

                {/* Category Selection */}
                <div className="schedule-form-group">
                  <label>Category</label>
                  <div className="schedule-category-buttons">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        className={`schedule-category-btn ${selectedCategory === key ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Device Selection */}
                <div className="schedule-form-group">
                  <label>Select Devices ({selectedDevices.length})</label>
                  <div className="schedule-device-list">
                    {devices.length === 0 ? (
                      <p className="schedule-empty-text">No devices in this category</p>
                    ) : (
                      devices.map(device => (
                        <label key={device._id} className="schedule-device-item">
                          <input
                            type="checkbox"
                            checked={selectedDevices.includes(device._id)}
                            onChange={() => handleDeviceToggle(device._id)}
                          />
                          <span>{device.device_name || device.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Selected Devices */}
                {selectedDevices.length > 0 && (
                  <div className="schedule-selected-devices">
                    {selectedDeviceNames.map((name, idx) => (
                      <span key={idx} className="schedule-device-tag">{name}</span>
                    ))}
                  </div>
                )}

                {/* Action */}
                <div className="schedule-form-group">
                  <label>Action</label>
                  <div className="schedule-action-buttons">
                    <button
                      onClick={() => setAction('On')}
                      className={`schedule-action-btn ${action === 'On' ? 'active on' : ''}`}
                    >
                      Turn On
                    </button>
                    <button
                      onClick={() => setAction('Off')}
                      className={`schedule-action-btn ${action === 'Off' ? 'active off' : ''}`}
                    >
                      Turn Off
                    </button>
                  </div>
                </div>

                {/* Time */}
                <div className="schedule-form-group">
                  <label>Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="schedule-input"
                  />
                </div>

                {/* Days */}
                <div className="schedule-form-group">
                  <label>Days</label>
                  <div className="schedule-days-grid">
                    {days.map(day => (
                      <button
                        key={day.id}
                        onClick={() => handleDayToggle(day.id)}
                        className={`schedule-day-btn ${selectedDays.includes(day.id) ? 'active' : ''}`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveSchedule}
                  disabled={selectedDevices.length === 0 || selectedDays.length === 0 || !scheduleName.trim() || saving}
                  className="schedule-save-btn"
                >
                  {saving ? (editingScheduleId ? 'Updating...' : 'Saving...') : (editingScheduleId ? 'Update Schedule' : 'Save Schedule')}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Schedules List */}
          <div className="schedule-list-section">
            <h3>Active Schedules ({schedules.length})</h3>
            <div className="schedule-list">
              {schedules.length === 0 ? (
                <p className="schedule-empty-text">No schedules created yet</p>
              ) : (
                schedules.map(schedule => (
                  <div key={schedule._id} className="schedule-list-item" onClick={() => handleEditSchedule(schedule)} style={{cursor: 'pointer'}}>
                    <div className="schedule-item-header">
                      <div className="schedule-item-title">{schedule.schedule_name}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSchedule(schedule._id);
                        }}
                        className="schedule-delete-btn"
                        title="Delete schedule"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="schedule-item-details">
                      <div><span>Time:</span> {schedule.scheduled_time}</div>
                      <div><span>Action:</span> <span className={`action-${schedule.action.toLowerCase()}`}>{schedule.action}</span></div>
                      <div><span>Days:</span> {schedule.days_of_week.map(d => getDayLabel(d)).join(', ')}</div>
                      <div><span>Devices:</span> {schedule.devices.length}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}