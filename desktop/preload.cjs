// Tells the page it's inside the desktop app, so it can leave room for the window controls.
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("paalamDesktop", { platform: process.platform });
