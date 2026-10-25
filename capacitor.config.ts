import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app is a native shell around Paalam's web app. It loads the Paalam server
 * at PAALAM_SERVER_URL (your Cloud Run URL, or http://<your-computer's-LAN-IP>:8080 for a
 * phone on the same Wi-Fi), and adds what a website can't do reliably on a phone:
 * reminders scheduled on the device itself, so they fire even offline or with the app closed.
 */
const server = process.env.PAALAM_SERVER_URL;

const config: CapacitorConfig = {
  appId: "app.paalam.mobile",
  appName: "Paalam",
  webDir: "dist",
  ...(server ? { server: { url: server, cleartext: server.startsWith("http:"), androidScheme: "https" } } : {}),
  plugins: {
    LocalNotifications: { iconColor: "#8f6fe0" },
  },
};

export default config;
