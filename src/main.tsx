import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// A password reset email lands on /?reset=1&code=... Send it to the reset screen.
if (new URLSearchParams(window.location.search).get("reset") === "1" && !window.location.hash.startsWith("#/reset")) {
  window.location.hash = "#/reset";
}

createRoot(document.getElementById("root")!).render(<App />);
