import type { ReviewPreferences } from "@review/contracts";

export function readPreferences(): Promise<ReviewPreferences> {
  return window.reviewDesktop.readPreferences();
}

export function savePreferences(preferences: ReviewPreferences): Promise<void> {
  return window.reviewDesktop.savePreferences(preferences);
}
