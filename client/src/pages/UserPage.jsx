import { useState } from "react";
import LogoutModal from "../components/LogoutModal";
import ProfileIcon from "../assets/Profile.svg";
import LogoutIcon from "../assets/Logout.svg";
import "../styles/user.css";

export default function UserPage() {
  const [showLogout, setShowLogout] = useState(false);
  
  // This would typically come from your auth context/state
  const currentUser = {
    name: "STAFF STAFF",
    email: "STAFF@tp.edu.sg"
  };

  return (
    <div className="user-page">
      <h2 className="user-header">User</h2>
      
      <div className="user-icons">
        <img src={ProfileIcon} alt="Profile" className="user-icon" />
        <img 
          src={LogoutIcon} 
          alt="Logout" 
          className="user-icon logout-icon"
          onClick={() => setShowLogout(true)}
        />
      </div>

      <div className="user-info-container">
        <div className="user-info-row">
          <span className="user-info-label">Current User:</span>
          <span className="user-info-value">{currentUser.name}</span>
        </div>

        <div className="user-info-row">
          <span className="user-info-label">Email:</span>
          <span className="user-info-value">{currentUser.email}</span>
        </div>

        <div className="user-buttons">
          <button className="user-button">Edit User Details</button>
          <button className="user-button" onClick={() => setShowLogout(true)}>
            Sign out
          </button>
        </div>
      </div>

      {showLogout && (
        <LogoutModal onClose={() => setShowLogout(false)} />
      )}
    </div>
  );
}
