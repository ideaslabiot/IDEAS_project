import { useState } from "react";
import MenuButton from "../assets/Menu.svg";

export default function DeviceCard({ device, onToggle, onEdit }) {
  // ✅ Check if device is in a transition state (include WARMING/COOLING for projectors)
  const isPending = device.state?.startsWith("PENDING") ||
    device.state === "WARMING" ||
    device.state === "COOLING";
  const isOn = device.state === "ON";

  async function handleClick() {
    if (isPending) {
      // ✅ Custom message for projectors
      const message = device.category === "4"
        ? `${device.device_name} is warming up or cooling down. Please wait.`
        : `${device.device_name} is currently executing a command. Please wait.`;
      alert(message);
      return;
    }

    try {
      await onToggle();
    } catch (error) {
      // Error already handled in parent
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`device-card ${
        isPending ? "loading" : isOn ? "on" : "off"
      }`}
      onClick={handleClick}
    >
      {/* HEADER */}
      <div className="device-card-header">
        <div />
        <div className="device-buttons">
          <img
            src={MenuButton}
            alt="Menu"
            className={`icon-button ${isOn ? "icon-on" : "icon-off"}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="device-info">
        <div className="device-name">{device.device_name}</div>
        <div className="device-ip">{device.ip}</div>
      </div>
    </div>
  );
}
