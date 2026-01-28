import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutModal from "./LogoutModal";
import ProfileIcon from "../assets/Profile.svg";
import LogoutIcon from "../assets/Logout.svg";

export default function UserIcons() {
  const [showLogout, setShowLogout] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className="user-icons">
        <img src={ProfileIcon} alt="Profile" className="user-icon" onClick={() => navigate('/user')} />
        <img 
          src={LogoutIcon} 
          alt="Logout" 
          className="user-icon logout-icon"
          onClick={() => setShowLogout(true)}
        />
      </div>

      {showLogout && (
        <LogoutModal onClose={() => setShowLogout(false)} />
      )}
    </>
  );
}
