import { useState, useEffect } from 'react';
import LogoutModal from "../components/LogoutModal";
import EditUserModal from "../components/EditUserModal";
import ProfileIcon from "../assets/Profile.svg";
import { useNavigate } from "react-router-dom";
import "../styles/user.css";
import UserIcons from '../components/UserIcons';

export default function UserPage() {
  const [showLogout, setShowLogout] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [username, set_user_name] = useState("");
  const [useremail, set_user_email] = useState("");
  const [userId, setUserId] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    checkAuthorized();
  }, []);

  async function checkAuthorized() {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/users/auth`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include"
      });

      const message = await response.json();

      if (!response.ok) {
        navigate("/login");
        return;
      }

      set_user_name(message.name);
      set_user_email(message.email);
      
      // You'll need to get the user ID from somewhere - either from the auth response
      // or from a separate endpoint. For now, I'll assume it's in the response
      // If not, you might need to modify your backend to include it
      setUserId(message.id || message._id);

    } catch (err) {
      console.error(err);
      navigate("/login");
    }
  }

  return (
    <div className="user-page">
      <h2 className="user-header">User</h2>
      
      <UserIcons />

      <div className="user-info-container">
        <div className="user-info-row">
          <span className="user-info-label">Current User:</span>
          <span className="user-info-value">{username}</span>
        </div>

        <div className="user-info-row">
          <span className="user-info-label">Email:</span>
          <span className="user-info-value">{useremail}</span>
        </div>

        <div className="user-buttons">
          <button className="user-button" onClick={() => setShowEdit(true)}>
            Edit User Details
          </button>
          <button className="user-button" onClick={() => setShowLogout(true)}>
            Sign out
          </button>
        </div>
      </div>

      {showLogout && (
        <LogoutModal onClose={() => setShowLogout(false)} />
      )}

      {showEdit && (
        <EditUserModal 
          onClose={() => setShowEdit(false)}
          currentName={username}
          currentEmail={useremail}
          userId={userId}
        />
      )}
    </div>
  );
}
