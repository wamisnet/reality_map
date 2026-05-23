import { RANK_INFO, RANK_ORDER } from "@/data/ranks";
import type { EditableCandidate, Rank } from "@/types";
import RankBadge from "./RankBadge";
import styles from "./CandidatesPool.module.css";

interface Props {
  candidates: ReadonlyArray<EditableCandidate>;
}

export default function CandidatesPool({ candidates }: Props) {
  const counts: Record<Rank, number> = { S: 0, A: 0, B: 0, C: 0 };
  for (const c of candidates) counts[c.rank] += 1;
  const total = candidates.length;

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span>POOL · {total}</span>
        <span style={{ opacity: 0.5 }}>BY RANK</span>
      </div>
      <ul className={styles.rankList}>
        {RANK_ORDER.map(r => {
          const n = counts[r];
          const empty = n === 0;
          return (
            <li
              key={r}
              className={`${styles.rankRow} ${empty ? styles.empty : ""}`}
            >
              <span className={styles.badgeCell}>
                <RankBadge rank={r} size="sm" />
              </span>
              <span className={styles.rankText}>{RANK_INFO[r].short}</span>
              <span className={styles.rankCount}>
                {n}
                <span className={styles.unit}>件</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
