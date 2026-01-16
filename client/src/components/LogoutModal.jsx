export default function LogoutModal({ onClose }) {
  function handleLogout() {
    // Add your logout logic here
    // For example: clear auth tokens, redirect to login, etc.
    console.log("Logging out...");
    onClose();
  }

  return (
    <div className="popup" onClick={onClose}>
      <div className="popup-content-logout" onClick={(e) => e.stopPropagation()}>
        <h2 className="popup-header">Sign Out</h2>
        <p className="logout-message">Are you sure you want to sign out?</p>

        <div className="popup-actions">
          <button className="popup-button" onClick={onClose}>
            Cancel
          </button>
          <button className="popup-button popup-button-danger" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
