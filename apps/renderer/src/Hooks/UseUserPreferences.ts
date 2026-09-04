import type { ReviewPreferences } from "@review/contracts";
import { useCallback, useEffect, useState } from "react";

import {
  readPreferences,
  savePreferences,
} from "../pages/setup/setup-persistence";

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<ReviewPreferences | null>(null);
  const [preferenceError, setPreferenceError] = useState(false);

  useEffect(() => {
    void readPreferences()
      .then(setPreferences)
      .catch(() => setPreferenceError(true));
  }, []);

  const updatePreferences = useCallback(async (nextPreferences: ReviewPreferences) => {
    setPreferences(nextPreferences);
    setPreferenceError(false);

    try {
      await savePreferences(nextPreferences);
    } catch (error) {
      setPreferenceError(true);
      throw error;
    }
  }, []);

  return {
    preferences,
    preferenceError,
    updatePreferences,
  };
}
