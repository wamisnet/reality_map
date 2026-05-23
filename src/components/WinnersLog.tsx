import type { Winner } from "@/types";
import styles from "./WinnersLog.module.css";

export interface DrawLogEntry {
  winner: Winner;
  participantName: string;
}

interface Props {
  entries: ReadonlyArray<DrawLogEntry>;
}

export default function WinnersLog({ entries }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span>DRAW LOG · {entries.length}</span>
      </div>
      {entries.length === 0 && (
        <div className={styles.empty}>awaiting first lock…</div>
      )}
      {entries.map((e, i) => {
        const w = e.winner;
        return (
          <div className={styles.w} key={w.at + i}>
            <div>
              <div className={styles.participant}>{e.participantName}</div>
              <div className={styles.pref}>{w.pref}</div>
              <div className={styles.name}>{w.name}</div>
            </div>
            <div className={styles.ts}>
              <div>{w.c.lat}</div>
              <div>{w.c.lon}</div>
              <div style={{ marginTop: 3, opacity: 0.6 }}>{w.at.slice(0, 8)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
