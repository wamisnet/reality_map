import RankBadge from "@/components/RankBadge";
import { RANK_ORDER } from "@/data/ranks";
import type { Rank } from "@/types";
import styles from "./ParticipantHitStats.module.css";

interface Props {
  hits: Record<Rank, number>;
  totals: Record<Rank, number>;
}

export default function ParticipantHitStats({ hits, totals }: Props) {
  const hitSum = RANK_ORDER.reduce((s, r) => s + hits[r], 0);
  const totalSum = RANK_ORDER.reduce((s, r) => s + totals[r], 0);
  const overallPct =
    totalSum > 0 ? Math.round((hitSum / totalSum) * 100) : 0;

  return (
    <section className={styles.root} aria-label="コンプリート状況">
      <div className={styles.head}>
        <span className={styles.label}>COMPLETION</span>
        <span className={styles.overall}>
          <span className={styles.overallNum}>{hitSum}</span>
          <span className={styles.overallSlash}> / </span>
          <span className={styles.overallTotal}>{totalSum}</span>
          {totalSum > 0 && (
            <span className={styles.overallPct}>({overallPct}%)</span>
          )}
        </span>
      </div>
      <ul className={styles.row}>
        {RANK_ORDER.map(r => {
          const hit = hits[r];
          const total = totals[r];
          const pct = total > 0 ? Math.min(100, (hit / total) * 100) : 0;
          return (
            <li key={r} className={styles.cell}>
              <span className={styles.badge}>
                <RankBadge rank={r} size="sm" />
              </span>
              <span className={styles.count}>
                <span className={styles.hit}>{hit}</span>
                <span className={styles.slash}> / </span>
                <span className={styles.total}>{total}</span>
              </span>
              <span
                className={styles.bar}
                aria-hidden
                data-rank={r}
              >
                <span
                  className={styles.barFill}
                  style={{ width: `${pct}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
