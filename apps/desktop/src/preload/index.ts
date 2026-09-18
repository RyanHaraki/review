import type { DesktopBridge } from "@review/contracts";
import { contextBridge, ipcRenderer } from "electron";

const desktopBridge: DesktopBridge = {
  readReviewedFiles: (input) => ipcRenderer.invoke("pull-requests:reviewed-read", input),
  setFileReviewed: (input) => ipcRenderer.invoke("pull-requests:reviewed-write", input),
  readReviewGuide: (key) => ipcRenderer.invoke("review-guide:read", key),
  generateReviewGuide: (key) => ipcRenderer.invoke("review-guide:generate", key),
  getElectronVersion: () => process.versions.electron,
  getPlatform: () => process.platform,
  getSetupStatus: () => ipcRenderer.invoke("setup:read"),
  connectCodex: () => ipcRenderer.invoke("setup:connect-codex"),
  readGitHubSession: () => ipcRenderer.invoke("github:session"),
  readGitHubProfile: () => ipcRenderer.invoke("github:profile"),
  signInGitHub: () => ipcRenderer.invoke("github:sign-in"),
  cancelGitHubSignIn: () => ipcRenderer.invoke("github:cancel"),
  signOutGitHub: () => ipcRenderer.invoke("github:sign-out"),
  openGitHubInstallations: () => ipcRenderer.invoke("github:install"),
  onGitHubSessionChanged: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, status: Parameters<typeof listener>[0]) => listener(status);
    ipcRenderer.on("github:changed", receive);
    return () => ipcRenderer.removeListener("github:changed", receive);
  },
  readPreferences: () => ipcRenderer.invoke("preferences:read"),
  savePreferences: (preferences) =>
    ipcRenderer.invoke("preferences:save", preferences),
  listGitHubRepositories: () =>
    ipcRenderer.invoke("setup:list-github-repositories"),
  readPullRequestOverview: (key) =>
    ipcRenderer.invoke("pull-requests:overview", key),
  readPullRequestDiff: (key) => ipcRenderer.invoke("pull-requests:diff", key),
  listPullRequestDrafts: (key) =>
    ipcRenderer.invoke("pull-requests:drafts-list", key),
  savePullRequestDraft: (input) =>
    ipcRenderer.invoke("pull-requests:draft-save", input),
  deletePullRequestDraft: (input) =>
    ipcRenderer.invoke("pull-requests:draft-delete", input),
  submitPullRequestDraft: (input) =>
    ipcRenderer.invoke("pull-requests:draft-submit", input),
  setPullRequestThreadResolved: (input) =>
    ipcRenderer.invoke("pull-requests:thread-resolve", input),
  listPullRequests: (repositories) =>
    ipcRenderer.invoke("pull-requests:list", repositories),
};

contextBridge.exposeInMainWorld("reviewDesktop", desktopBridge);
