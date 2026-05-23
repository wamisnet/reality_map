import type { Phase } from "@/types";
import styles from "./TriggerControls.module.css";

interface Props {
  phase: Phase;
  canFire: boolean;
  drawCount: number;
  remaining: number;
  onFire: () => void;
  onReset: () => void;
  onFireAgain: () => void;
  onCancelQueue: () => void;
}

export default function TriggerControls({
  phase,
  canFire,
  drawCount,
  remaining,
  onFire,
  onReset,
  onFireAgain,
  onCancelQueue,
}: Props) {
  const queued = remaining > 0;
  const fireLabel = drawCount > 1 ? `▶ FIRE × ${drawCount}` : "▶ FIRE TRIGGER";

  return (
    <div className={styles.root}>
      {phase === "idle" && !queued && (
        <button
          className={`${styles.btn} ${styles.primary}`}
          onClick={onFire}
          type="button"
          disabled={!canFire}
        >
          {fireLabel}
        </button>
      )}
      {phase === "scanning" && (
        <button className={styles.btn} disabled type="button">
          SCANNING…
        </button>
      )}
      {phase === "locked" && !queued && (
        <>
          <button
            className={`${styles.btn} ${styles.danger}`}
            onClick={onReset}
            type="button"
          >
            ↻ RESET
          </button>
          <button
            className={styles.btn}
            onClick={onFireAgain}
            type="button"
            disabled={!canFire}
          >
            ▶ FIRE AGAIN
          </button>
        </>
      )}
      {queued && phase !== "scanning" && (
        <button
          className={`${styles.btn} ${styles.danger}`}
          onClick={onCancelQueue}
          type="button"
        >
          ■ CANCEL QUEUE
        </button>
      )}
    </div>
  );
}
