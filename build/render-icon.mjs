// Renders build/icon.svg to a 1024×1024 PNG with a transparent background (Quick Look fills it white).
import { app, BrowserWindow } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
  w.webContents.setZoomFactor(1);
  const svg = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
  await w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)}`);
  await new Promise((r) => setTimeout(r, 400));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  writeFileSync(new URL("./icon.png", import.meta.url), img.resize({ width: 1024, height: 1024 }).toPNG());
  app.quit();
});
