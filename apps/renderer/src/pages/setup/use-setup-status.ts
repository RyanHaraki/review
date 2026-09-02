import type { SetupStatus } from "@review/contracts";
import { useEffect, useState } from "react";
import {
  cacheSetup,
  readCachedSetup,
} from "./setup-persistence";

export type SetupStatusError = "status" | "connect" | null;

export function useSetupStatus() {
  const [setup, setSetup] = useState<SetupStatus | null>(readCachedSetup);
  const [checking, setChecking] = useState(setup === null);
  const [connectingCodex, setConnectingCodex] = useState(false);
  const [error, setError] = useState<SetupStatusError>(null);
  const updateSetup = (nextSetup: SetupStatus) => {
    cacheSetup(nextSetup);
    setSetup(nextSetup);
  };

  const refresh = async () => {
    setChecking(true);
    setError(null);
    try {
      updateSetup(await window.reviewDesktop.getSetupStatus());
    } catch {
      setError("status");
    } finally {
      setChecking(false);
    }
  };

  const connectCodex = async () => {
    setConnectingCodex(true);
    setError(null);
    try {
      await window.reviewDesktop.connectCodex();
    } catch {
      setConnectingCodex(false);
      setError("connect");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!connectingCodex) {
      return;
    }

    const interval = window.setInterval(() => {
      window.reviewDesktop
        .getSetupStatus()
        .then((nextSetup) => {
          updateSetup(nextSetup);
          if (nextSetup.codex.state === "connected") {
            setConnectingCodex(false);
          }
        })
        .catch(() => {
          setError("status");
        });
    }, 1_500);

    return () => window.clearInterval(interval);
  }, [connectingCodex]);
  return { setup, checking, connectingCodex, error, refresh, connectCodex };
}
