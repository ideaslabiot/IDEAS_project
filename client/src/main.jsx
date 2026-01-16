import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./styles/layout.css";   // global layout
import "./styles/sidebar.css";  // sidebar styling
import "./styles/device.css";   // device styling

ReactDOM.createRoot(document.getElementById("root")).render(
    <App />
);
