import { useEffect } from "react";

export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    if ("wakeLock" in navigator) {
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) void l.release();
          else lock = l;
        })
        .catch(() => {
          /* not allowed, ignore */
        });
    }

    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, []);
}
