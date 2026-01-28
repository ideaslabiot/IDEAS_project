import { NavLink } from "react-router-dom";
import { useWebSocket } from "../contexts/WebSocketContext";
import HomeIcon from "../assets/House.svg";
import DevicesIcon from "../assets/Devices.svg"; // Temporary until we get the actual icon
import ScheduleIcon from "../assets/Time.svg";
import UserIcon from "../assets/Profile.svg";

import "../styles/sidebar.css";

const CATEGORY_LABELS = {
  '1': 'TV/Screens',
  '2': 'Computers',
  '3': 'Lights',
  '4': 'Projectors'
};

export default function Sidebar() {
  const { devices } = useWebSocket();

  const handleBatchToggle = async (categoryId, shouldTurnOn) => {
    const categoryDevices = devices.filter(d => d.category === categoryId);

    for (const device of categoryDevices) {
      // Skip if device state doesn't match the desired action
      if (shouldTurnOn && device.state === "ON") continue;
      if (!shouldTurnOn && device.state === "OFF") continue;

      try {
        let response;
        const action = shouldTurnOn ? "wake" : "shutdown";

        if (device.category === "1") {
          response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/screens/${action}/${device.device_name}`, {
            method: "POST"
          });
        } else if (device.category === "2") {
          response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/computer/${action}/${device.device_name}`, {
            method: "POST"
          });
        } else if (device.category === "3") {
          response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lights/${action}/${device.device_name}`, {
            method: "POST"
          });
        } else if (device.category === "4") {
          response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/projector/${action}/${device.device_name}`, {
            method: "POST"
          });
        }

        if (!response?.ok) {
          console.error(`Failed to ${action} ${device.device_name}`);
        }
      } catch (error) {
        console.error(`Error toggling ${device.device_name}:`, error);
      }
    }
  };

  return (
    <aside className="sidebar">
      {/* Top menu */}
      <div className="sidebar-top">
        <h2 className="sidebar-title">Menu</h2>

        <NavLink to="/home" className="sidebar-link">
          <img src={HomeIcon} alt="" />
          <span>Home</span>
        </NavLink>

        <NavLink to="/devices" className="sidebar-link">
          <img src={DevicesIcon} alt="" />
          <span>Devices</span>
        </NavLink>

        <NavLink to="/schedule" className="sidebar-link">
          <img src={ScheduleIcon} alt="" />
          <span>Schedule</span>
        </NavLink>

        <NavLink to="/user" className="sidebar-link">
          <img src={UserIcon} alt="" />
          <span>User</span>
        </NavLink>
      </div>

      {/* Batch control */}
      <h4 className="sidebar-subtitle">Batch Control</h4>
      <div className="sidebar-batch">
        <div className="batch-grid">
          <div className="batch-category">
            <span className="batch-label">All Devices</span>
            <div className="batch-controls">
              <button 
                className="batch-btn batch-on"
                onClick={() => handleBatchToggle('1', true) && handleBatchToggle('2', true) && handleBatchToggle('3', true) && handleBatchToggle('4', true)}
              >
                On
              </button>
              <button 
                className="batch-btn batch-off"
                onClick={() => handleBatchToggle('1', false) && handleBatchToggle('2', false) && handleBatchToggle('3', false) && handleBatchToggle('4', false)}
              >
                Off
              </button>
            </div>
          </div>

          {Object.entries(CATEGORY_LABELS).map(([categoryId, categoryName]) => (
            <div key={categoryId} className="batch-category">
              <span className="batch-label">{categoryName}</span>
              <div className="batch-controls">
                <button 
                  className="batch-btn batch-on"
                  onClick={() => handleBatchToggle(categoryId, true)}
                >
                  On
                </button>
                <button 
                  className="batch-btn batch-off"
                  onClick={() => handleBatchToggle(categoryId, false)}
                >
                  Off
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
