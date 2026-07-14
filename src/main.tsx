import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { Loupe } from "./components/Loupe";
import { Region } from "./components/Region";
import "./index.css";

// Auxiliary windows load the same bundle; route by window label
const label = getCurrentWindow().label;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {label === "loupe" ? <Loupe /> : label === "region" ? <Region /> : <App />}
  </React.StrictMode>
);
