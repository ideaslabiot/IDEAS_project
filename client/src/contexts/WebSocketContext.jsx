// contexts/WebSocketContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';
import { useDeviceWebSocket } from '../hooks/useDeviceWebSocket.js';

const WebSocketContext = createContext();

export function WebSocketProvider({ children }) {
  const [devices, setDevices] = useState([]);

  const handleDeviceUpdate = useCallback((updatedDevices, updateType) => {
    if (updateType === "initial") {
      setDevices(updatedDevices);
    } else {
      setDevices(prev => {
        const deviceMap = new Map(prev.map(d => [d._id, d]));

        updatedDevices.forEach(updated => {
          // ✅ Handle deletions
          if (updated._deleted) {
            deviceMap.delete(updated._id);
          } else {
            deviceMap.set(updated._id, updated);
          }
        });

        return Array.from(deviceMap.values());
      });
    }
  }, []);

  const { connected } = useDeviceWebSocket(handleDeviceUpdate);

  return (
    <WebSocketContext.Provider value={{ devices, connected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
