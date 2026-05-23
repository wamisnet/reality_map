import type { Phase } from "@/types";
import styles from "./StatusBar.module.css";

interface Props {
  phase: Phase;
  frame: number;
  autoFire: boolean;
}

export default function StatusBar({ phase, frame, autoFire }: Props) {
  return (
    <div className={styles.root}>
      <div>
        {phase === "idle" && "● STANDBY · AWAITING TRIGGER"}
        {phase === "scanning" && "◐ SCANNING · TARGET ACQUISITION"}
        {phase === "locked" && "● TARGET LOCKED"}
        {autoFire && " · AUTO-FIRE ENABLED"}
      </div>
      <div>FRAME {String(frame).padStart(6, "0")} · UPLINK OK</div>
    </div>
  );
}
