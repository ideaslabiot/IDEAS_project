// pages/HomePage.jsx
import { useState, useEffect } from 'react';
import { useWebSocket } from "../contexts/WebSocketContext";
import '../styles/home.css';

const CATEGORY_LABELS = {
  '1': 'TV/Screens',
  '2': 'Computers',
  '3': 'Lights',
  '4': 'Projectors'
};

export default function HomePage() {
  const { devices, connected } = useWebSocket();

  // Get recently used devices - sorted by timestamp (most recent first), limited to 4
  const recentlyUsedDevices = devices
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Most recent first
    })
    .slice(0, 4);

  // Handle device toggle
  const handleDeviceToggle = async (device) => {
    try {
      let response;

      if (device.category === "1") {
        const action = device.state === "ON" ? "shutdown" : "wake";
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/screens/${action}/${device.device_name}`, {
          method: "POST"
        });
      } else if (device.category === "2") {
        const action = device.state === "ON" ? "shutdown" : "wake";
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/computer/${action}/${device.device_name}`, {
          method: "POST"
        });
      } else if (device.category === "3") {
        const action = device.state === "ON" ? "shutdown" : "wake";
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lights/${action}/${device.device_name}`, {
          method: "POST"
        });
      } else if (device.category === "4") {
        const action = device.state === "ON" ? "shutdown" : "wake";
        response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/projector/${action}/${device.device_name}`, {
          method: "POST"
        });
      }

      if (response?.ok) {
        // Device toggle successful - timestamp will be updated by backend via WebSocket
      }
    } catch (error) {
      console.error("Toggle failed:", error);
    }
  };

  // Format timestamp
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="home-page">
      <p className="home-header">Home</p>

      {/* RECENTLY USED */}
      <div className="recently-used-section">
        <h3 className="section-title">Recently Used</h3>
        <div className="recently-used-grid">
          {recentlyUsedDevices.length > 0 ? (
            recentlyUsedDevices.map((device, idx) => {
              const isPending = device.state?.startsWith("PENDING") ||
                device.state === "WARMING" ||
                device.state === "COOLING";
              const isOn = device.state === "ON";

              async function handleClick() {
                if (isPending) {
                  const message = device.category === "4"
                    ? `${device.device_name} is warming up or cooling down. Please wait.`
                    : `${device.device_name} is currently executing a command. Please wait.`;
                  alert(message);
                  return;
                }

                try {
                  await handleDeviceToggle(device);
                } catch (error) {
                  console.error('Error:', error);
                }
              }

              return (
                <div
                  key={device._id}
                  role="button"
                  tabIndex={0}
                  className={`device-card ${isPending ? "loading" : isOn ? "on" : "off"}`}
                  onClick={handleClick}
                >
                  {/* HEADER */}
                  <div className="device-card-header">
                    <div />
                  </div>

                  {/* FOOTER */}
                  <div className="device-info">
                    <div className="device-name">{device.device_name}</div>
                    <div className="device-ip">{device.ip}</div>
                  </div>
                </div>
              );
            })
          ) : (
            [...Array(4)].map((_, idx) => (
              <div key={idx} className="recently-used-card empty">
                <div className="empty-text">No device used</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* STATUS OVERVIEW */}
      <div className="status-overview-section">
        <h3 className="section-title">Status Overview</h3>
        <div className="status-overview">
          {Object.entries(CATEGORY_LABELS).map(([categoryId, categoryName]) => {
            const categoryDevices = devices.filter(d => d.category === categoryId);
            const devicesOn = categoryDevices.filter(d => d.state === "ON").length;

            return (
              <div key={categoryId} className="status-category">
                <div className="status-category-title">
                  <span>{categoryName}</span>
                  <span className="status-count">{devicesOn}/{categoryDevices.length}</span>
                </div>
                <div className="status-devices-grid">
                  {categoryDevices.length === 0 ? (
                    <div style={{ color: '#666', fontSize: '0.8rem' }}>No devices</div>
                  ) : (
                    categoryDevices.map(device => (
                      <div key={device._id} className="device-status">
                        <div className={`device-status-dot ${device.state === "ON" ? 'on' : 'off'}`}></div>
                        <div className="device-status-name">{device.device_name}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!connected && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          color: '#fca5a5'
        }}>
          Reconnecting to server...
        </div>
      )}
    </div>
  );
}
