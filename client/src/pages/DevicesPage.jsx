// pages/DevicesPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { addDevice, updateDevice, deleteDevice } from "../services/deviceapi.mjs";
import { useWebSocket } from "../contexts/WebSocketContext";

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
  const { category = "0" } = useParams();
  const navigate = useNavigate();
  
  const { devices: globalDevices, connected } = useWebSocket();

  const [showAdd, setShowAdd] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [addError, setAddError] = useState(null);
  const [editError, setEditError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const devices = category === "0" 
    ? globalDevices 
    : globalDevices.filter(d => d.category === category);

  async function handleToggle(device) {
    try {
      let response;

      if (device.category === "1") {
        // Screens
        const action = device.state === "ON" ? "shutdown" : "wake";
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/screens/${action}/${device.device_name}`, {
          method: "POST"
        });
      } else if (device.category === "2") {
        // Computers
        const action = device.state === "ON" ? "shutdown" : "wake";
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/computers/${action}/${device.device_name}`, {
          method: "POST"
        });
      } else if (device.category === "3") {
        // Tapo Lights
        const action = device.state === "ON" ? "shutdown" : "wake";
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lights/${action}/${device.device_name}`, {
          method: "POST"
        });
      } else if (device.category === "4") {
        // Projectors
        const action = device.state === "ON" ? "shutdown" : "wake";
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/projector/${action}/${device.device_name}`, {
          method: "POST"
        });
      }

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || "Failed to toggle device");
        } else {
          const text = await response.text();
          console.error("Server returned HTML:", text);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error("Toggle failed:", error);
      alert(error.message || "Failed to toggle device");
      throw error;
    }
  }

  async function handleAddDevice(data) {
    try {
      setAddError(null);
      await addDevice(data);
      setShowAdd(false);
    } catch (error) {
      setAddError(error.message || "Failed to add device");
    }
  }

  async function handleEditDevice(id, data) {
    try {
      setEditError(null);
      await updateDevice(id, data);
      setEditDevice(null);
    } catch (error) {
      setEditError(error.message || "Failed to update device");
    }
  }

  async function handleDeleteDevice(data) {
    try {
      setDeleteError(null);
      await deleteDevice(data.device_name);
      setEditDevice(null);
    } catch (error) {
      setDeleteError(error.message || "Failed to delete device");
    }
  }
  
  return (
    <div className="devices-page">
      <h2 className="device-header">
        Devices
        {!connected && <span className="connection-status"> (Reconnecting...)</span>}
      </h2>

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
        <div className="device-card off add-card" onClick={() => setShowAdd(true)}>
          <div className="add-icon">+</div>
          <span>Add device</span>
        </div>
        
        {devices.length === 0 ? (
          <div className="loading-text">No devices found</div>
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
