import type { DesktopBridge } from "@review/contracts";
import { contextBridge, ipcRenderer } from "electron";

const desktopBridge: DesktopBridge = {
  getElectronVersion: () => process.versions.electron,
  getPlatform: () => process.platform,
  getSetupStatus: () => ipcRenderer.invoke("setup:read"),
  connectCodex: () => ipcRenderer.invoke("setup:connect-codex"),
  readPreferences: () => ipcRenderer.invoke("preferences:read"),
  savePreferences: (preferences) => ipcRenderer.invoke("preferences:save", preferences),
  listGitHubRepositories: () => ipcRenderer.invoke("setup:list-github-repositories"),
  listPullRequests: (repositories) => ipcRenderer.invoke("pull-requests:list", repositories),
};

contextBridge.exposeInMainWorld("reviewDesktop", desktopBridge);
