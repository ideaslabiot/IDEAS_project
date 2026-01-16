// pages/HomePage.jsx
import { useWebSocket } from "../contexts/WebSocketContext";

export default function HomePage() {
  const { devices, connected } = useWebSocket();

  // Calculate stats from devices
  const stats = {
    total: devices.length,
    on: devices.filter(d => d.state === "ON").length,
    off: devices.filter(d => d.state === "OFF").length,
    // Add more stats as needed
  };

  return (
    <div className="home-page">
      <h1>Device Dashboard</h1>
      
      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Devices</div>
        </div>
        
        <div className="stat-card on">
          <div className="stat-number">{stats.on}</div>
          <div className="stat-label">Online</div>
        </div>
        
        <div className="stat-card off">
          <div className="stat-number">{stats.off}</div>
          <div className="stat-label">Offline</div>
        </div>
      </div>

      {!connected && (
        <div className="connection-warning">
          Reconnecting to server...
        </div>
      )}
    </div>
  );
}
