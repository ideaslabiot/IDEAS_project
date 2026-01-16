import { useState } from "react";
import CustomSelect from "./CustomSelect.jsx";

export default function AddDeviceModal({ category, error, onClose, onAdd }) {
  const [form, setForm] = useState({
    device_name: "",
    ip: "",
    mac: "",
    category: category || "1", // default to TV / Screens
    username: "",
    password: ""
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    console.log(form);
    e.preventDefault();

    await onAdd({ ...form });
  }

  return (
    <div className="popup">
      <div className="popup-content-add" onClick={(e) => e.stopPropagation()}>
        <h2 className="popup-header">New Device</h2>
        {error && <div className="error-message">{error}</div>}

        <h4 className="popup-label">Device Name</h4>
        <input
          className="popup-input"
          name="device_name"
          placeholder="Device name"
          value={form.device_name}
          onChange={handleChange}
          required
        />

        <h4 className="popup-label">IP Address</h4>
        <input
          className="popup-input"
          name="ip"
          placeholder="IP address"
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
          </>
        )}
        {(form.category === "2" || form.category === "4") && (
          <>
            <h4 className="popup-label">Password</h4>
            <input
              className="popup-input"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </>
        )}


        <div className="popup-actions">
          <button className="popup-button" onClick={onClose}>Cancel</button>
          <button className="popup-button" onClick={handleSubmit}>Add</button>
        </div>
      </div>
    </div>
  );
}
