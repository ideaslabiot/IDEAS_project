import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDevicesByCategory, addDevice, updateDevice, deleteDevice } from "../services/deviceapi.mjs";
import { toggleScreenPower } from "../services/screensapi.mjs";

import DeviceCard from "../components/DeviceCard";
import AddDeviceModal from "../components/AddDeviceModal";
import EditDeviceModal from "../components/EditDeviceModal";

import "../styles/device.css";

const CATEGORY_LABELS = {
  "0": "All",
  "1": "TV / Screens",
  "2": "Computers",
  "3": "Lights",
  "4": "Projectors",
};

export default function DevicesPage() {
  const { category = "0" } = useParams(); // default to "All"
  const navigate = useNavigate();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [addError, setAddError] = useState(null);
  const [editError, setEditError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  async function loadDevices(isInitial = false) {
    if (isInitial) {
      setLoading(true);
    }

    const data =
      category === "0"
        ? await getDevicesByCategory() // all devices
        : await getDevicesByCategory(category);

    setDevices(data);
    
    if (isInitial) {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices(true); // Initial load with loading state
    const interval = setInterval(() => loadDevices(false), 5000); // Refresh without loading state
    return () => clearInterval(interval);
  }, [category]);

  async function handleToggle(device) {
    if (device.category === "1") {
      const action = device.state === "ON" ? "off" : "on";
      await toggleScreenPower(device.device_name, action);
    }

    loadDevices();
  }

  async function handleAddDevice(data) {
    try {
      setAddError(null);
      await addDevice(data);
      setShowAdd(false);
      loadDevices();
    } catch (error) {
      setAddError(error.message || "Failed to add device");
    }
  }

  async function handleEditDevice(id, data) {
    try {
      setEditError(null);
      await updateDevice(id, data);
      setEditDevice(null);
      loadDevices();
    } catch (error) {
      setEditError(error.message || "Failed to update device");
    }
  }

  async function handleDeleteDevice(data) {
    try {
      setDeleteError(null);
      await deleteDevice(data.device_name);
      setEditDevice(null);
      loadDevices();
    } catch (error) {
      setDeleteError(error.message || "Failed to delete device");
    }
  }
  
  return (
    <div className="devices-page">
      <h2 className="device-header">Devices</h2>

      {/* CATEGORY TABS */}
      <div className="device-tabs">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            className={`device-tab ${category === key ? "active" : ""}`}
            onClick={() => navigate(`/devices/${key}`)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* DEVICE GRID */}
      <div className="device-grid">
        {(
          <div className="device-card off add-card" onClick={() => setShowAdd(true)}>
            <div className="add-icon">+</div>
            <span>Add device</span>
          </div>
        )}
        {loading ? (
          <div className="loading-text">Loading devices…</div>
        ) : (
          devices.map(device => (
            <DeviceCard
              key={device._id}
              device={device}
              onToggle={() => handleToggle(device)}
              onEdit={() => setEditDevice(device)}
            />
          ))
        )}
      </div>
      {showAdd && (
        <AddDeviceModal
          category={category}
          error={addError}
          onClose={() => {
            setShowAdd(false);
            setAddError(null);
          }}
          onAdd={handleAddDevice}
        />
      )}

      {editDevice && (
        <EditDeviceModal
          device={editDevice}
          editError={editError}
          deleteError={deleteError}
          onClose={() => {
            setEditDevice(null);
            setEditError(null);
            setDeleteError(null);
          }}
          onSave={handleEditDevice}
          onDelete={handleDeleteDevice}
        />
      )}

    </div>
  );
}
