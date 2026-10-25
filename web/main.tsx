import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

// Inside the desktop app: leave room for the window controls and make the top bar draggable.
const desktop = (window as unknown as { paalamDesktop?: { platform: string } }).paalamDesktop;
if (desktop) document.documentElement.classList.add("desktop", `platform-${desktop.platform}`);

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD && !desktop) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
