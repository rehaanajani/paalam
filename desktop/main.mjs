// Paalam's desktop app. It starts its own Paalam server (the same code the
// website runs) in a background process, waits for it, and shows it in a native
// window. The website and the app are one codebase: a change to web/ or server/
// appears in both.
import { app, BrowserWindow, nativeTheme, shell } from "electron";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let server;
let window;
let origin = "";
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  window?.show();
  window?.focus();
});

/** A free local port, so the app never clashes with a website server already on 8080. */
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const logFile = () => {
  const dir = app.getPath("logs");
  mkdirSync(dir, { recursive: true });
  return join(dir, "server.log");
};

async function startServer() {
  if (process.env.PAALAM_URL) return process.env.PAALAM_URL.replace(/\/$/, ""); // point at a dev server instead
  const port = await freePort();
  const log = logFile();
  appendFileSync(log, `\n--- ${new Date().toISOString()} starting on ${port}\n`);
  // Electron doubles as Node here (ELECTRON_RUN_AS_NODE), so no separate Node install is needed.
  // The installed app keeps keys and data in its user-data folder, never inside the app bundle,
  // so the app can be shared without leaking keys. Running from the repo uses the project's .env and data/.
  const userData = app.getPath("userData");
  const where = app.isPackaged ? { PAALAM_ENV_FILE: join(userData, ".env"), PAALAM_DATA_DIR: join(userData, "data") } : {};
  server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: root,
    env: { ...process.env, ...where, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", (d) => appendFileSync(log, d));
  server.on("exit", (code) => {
    appendFileSync(log, `--- server exited (${code})\n`);
    if (!quitting) window?.webContents.reload();
  });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${url}/api/status`);
      if (r.ok) return url;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Paalam's server didn't start. See ${log}`);
}

function showWindow(url) {
  origin = new URL(url).origin;
  window = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 860,
    minHeight: 620,
    title: "Paalam",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#111111" : "#ffffff",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 20 },
    show: false,
    webPreferences: { preload: join(root, "desktop", "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  window.removeMenu();

  // Links Paalam opens on purpose (Maps directions, phone calls, sources) go to the system apps.
  const external = (target) => {
    if (/^(https?|tel|mailto|sms):/i.test(target)) void shell.openExternal(target);
  };
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (new URL(target).origin === origin) return { action: "allow" }; // screenshots and posters
    external(target);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, target) => {
    if (target.startsWith(origin)) return;
    event.preventDefault();
    external(target);
  });

  // Microphone (voice notes) and location are the only permissions, and only for Paalam's own page.
  const ses = window.webContents.session;
  ses.setPermissionRequestHandler((wc, permission, callback) => callback(wc.getURL().startsWith(origin) && ["media", "geolocation", "clipboard-sanitized-write"].includes(permission)));
  ses.setPermissionCheckHandler((wc, permission) => !!wc?.getURL().startsWith(origin) && ["media", "geolocation", "clipboard-sanitized-write"].includes(permission));

  window.once("ready-to-show", () => window?.show());
  window.on("closed", () => (window = undefined));
  void window.loadURL(url);
}

app
  .whenReady()
  .then(async () => {
    const url = await startServer();
    showWindow(url);
    app.on("activate", () => {
      if (!window) showWindow(url);
    });
  })
  .catch((e) => {
    console.error(e);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  quitting = true;
  server?.kill();
});
