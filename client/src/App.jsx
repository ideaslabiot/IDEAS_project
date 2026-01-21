// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import AppLayout from "./layouts/AppLayout";
import HomePage from "./pages/HomePage";
import DevicesPage from "./pages/DevicesPage";
import SchedulePage from "./pages/SchedulePage";
import UserPage from "./pages/UserPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <WebSocketProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/home" element={<HomePage/>} />
            <Route path="/devices" element={<DevicesPage/>} />
            <Route path="/devices/:category" element={<DevicesPage />} />
            <Route path="/schedule" element={<SchedulePage/>} />
            <Route path="/user" element={<UserPage/>} />
          </Route>
          <Route path ="/login" element={<LoginPage/>}/>
        </Routes>
      </WebSocketProvider>
    </BrowserRouter>
  );
}
