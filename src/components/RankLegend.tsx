import { RANK_INFO, RANK_ORDER } from "@/data/ranks";
import RankBadge from "./RankBadge";
import styles from "./RankLegend.module.css";

type Variant = "compact" | "detailed" | "operator";

interface Props {
  variant: Variant;
  title?: string;
  className?: string;
}

/**
 * S/A/B/C の意味付けを表示する凡例。
 * - compact:  1行チップ風 (結果リスト上に出す視聴者向け)
 * - detailed: バッジ + 1〜2行説明のリスト (ホーム About 等の読み物向け)
 * - operator: バッジ + オペレーター用ヒント (編集画面でランクを選ぶときの判断補助)
 */
export default function RankLegend({ variant, title, className }: Props) {
  const cls = [styles.root, styles[variant], className].filter(Boolean).join(" ");

  if (variant === "compact") {
    return (
      <div className={cls} aria-label="ランクの意味">
        {title && <span className={styles.title}>{title}</span>}
        <ul className={styles.chipRow}>
          {RANK_ORDER.map(r => (
            <li key={r} className={styles.chipItem}>
              <RankBadge rank={r} size="sm" />
              <span className={styles.chipText}>{RANK_INFO[r].short}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const useLong = variant === "detailed";

  return (
    <div className={cls} aria-label="ランクの意味">
      {title && <span className={styles.title}>{title}</span>}
      <ul className={styles.list}>
        {RANK_ORDER.map(r => (
          <li key={r} className={styles.listItem}>
            <span className={styles.badgeCell}>
              <RankBadge rank={r} size="sm" />
            </span>
            <span className={styles.listText}>
              {useLong ? RANK_INFO[r].long : RANK_INFO[r].operatorHint}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
