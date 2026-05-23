"use client";

import { useSyncExternalStore } from "react";
import { nowStamp } from "@/lib/format";
import styles from "./Hud.module.css";

// External "store" that emits a tick every 50ms; lets us avoid setState-in-effect.
const clockStore = (() => {
  const listeners = new Set<() => void>();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let snapshot = "";

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (intervalId === null) {
        snapshot = nowStamp();
        intervalId = setInterval(() => {
          snapshot = nowStamp();
          listeners.forEach(l => l());
        }, 50);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };
    },
    getSnapshot() {
      return snapshot;
    },
    getServerSnapshot() {
      return "";
    },
  };
})();

function useClock() {
  return useSyncExternalStore(
    clockStore.subscribe,
    clockStore.getSnapshot,
    clockStore.getServerSnapshot,
  );
}

export default function HudTelemetry() {
  const stamp = useClock();

  return (
    <div className={`${styles.col} ${styles.colRight}`}>
      <div className={styles.mono}>{stamp} JST</div>
    </div>
  );
}
