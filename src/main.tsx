import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource-variable/inter";
import "./styles.css";
import { getPhaseState } from "./db/repo";

void getPhaseState();
// Ask the browser not to evict our IndexedDB data (no-op if already granted or unsupported).
try {
  void navigator.storage?.persist?.();
} catch { /* unsupported */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
