import { useState } from "react";
import CustomSelect from "./CustomSelect.jsx";

export default function EditDeviceModal({ device, editError, deleteError, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    device_name: device.device_name,
    ip: device.ip || "",
    mac: device.mac || "",
    category: device.category,
    username: device.username || "",
    password: device.password || ""
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit() {
    await onSave(device._id, form);
  }
  
  async function handleDelete() {
    await onDelete(device);
  }

  return (
    <div className="popup">
      <div className="popup-content-edit">
        <h2 className="popup-header">Edit Device</h2>
        {editError && <div className="error-message">{editError}</div>}
        {deleteError && <div className="error-message">{deleteError}</div>}

        <h4 className="popup-label">Device Name</h4>
        <input
          className="popup-input"
          name="device_name"
          value={form.device_name}
          onChange={handleChange}
        />

        <h4 className="popup-label">IP Address</h4>
        <input
          className="popup-input"
          name="ip"
          value={form.ip}
          onChange={handleChange}
        />

        <h4 className="popup-label">Category</h4>
        <CustomSelect
          name="category"
          value={form.category}
          onChange={handleChange}
        />
        {form.category === "2" && (
          <>
            <h4 className="popup-label">Username</h4>
            <input
              className="popup-input"
              name="username"
              placeholder="Computer username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
            />

            <h4 className="popup-label">Password</h4>
            <input
              className="popup-input"
              name="password"
              placeholder="Computer password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </>
        )}

        <div className="popup-actions">
          <button className="popup-button" onClick={onClose}>Cancel</button>
          <button className="popup-button" onClick={() => { 
            handleSubmit();
          }}>Save</button>
          <button className="popup-button popup-button-danger" onClick={() => {
            if (window.confirm("Are you sure you want to delete this device?")) {
              handleDelete();
            }
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}
