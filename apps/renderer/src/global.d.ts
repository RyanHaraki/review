import type { DesktopBridge } from "@review/contracts";

declare global {
  interface Window {
    reviewDesktop: DesktopBridge;
  }
}

export {};

