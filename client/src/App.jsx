// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import AppLayout from "./layouts/AppLayout";
import HomePage from "./pages/HomePage";
import DevicesPage from "./pages/DevicesPage";
import SchedulePage from "./pages/SchedulePage";
import UserPage from "./pages/UserPage";

export default function App() {
  return (
    <BrowserRouter>
      <WebSocketProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/home" />} />
            <Route path="/home" element={<HomePage/>} />
            <Route path="/devices" element={<DevicesPage/>} />
            <Route path="/devices/:category" element={<DevicesPage />} />
            <Route path="/schedule" element={<SchedulePage/>} />
            <Route path="/user" element={<UserPage/>} />
          </Route>
        </Routes>
      </WebSocketProvider>
    </BrowserRouter>
  );
}
