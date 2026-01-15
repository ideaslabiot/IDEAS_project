import { useState } from "react";
import PowerButton from "../assets/Power.svg";
import MenuButton from "../assets/Menu.svg";

export default function DeviceCard({ device, onToggle, onEdit }) {
  const [loading, setLoading] = useState(false);

  const isOn = device.state === "ON";

  async function handleClick() {
    if (loading) return;

    setLoading(true);
    await onToggle();
    setLoading(false);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={`device-card ${
        loading ? "loading" : isOn ? "on" : "off" // for css styling
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
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
          <img
            src={PowerButton}
            alt="Power"
            className="icon-button"
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
