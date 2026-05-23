import type { Rank } from "@/types";
import styles from "./RankBadge.module.css";

interface Props {
  rank: Rank;
  size?: "lg" | "sm";
  popOnMount?: boolean;
}

const RANK_CLASS: Record<Rank, string> = {
  S: styles.rankS,
  A: styles.rankA,
  B: styles.rankB,
  C: styles.rankC,
};

const FILL_COLOR: Record<Rank, string> = {
  S: "oklch(0.85 0.18 90)",
  A: "var(--danger, oklch(0.7 0.22 25))",
  B: "oklch(0.78 0.05 230)",
  C: "oklch(0.55 0.02 80)",
};

function ShapeFor({ rank }: { rank: Rank }) {
  const fill = FILL_COLOR[rank];
  if (rank === "S") {
    // 5点星
    return (
      <svg
        className={styles.shape}
        viewBox="-50 -50 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <polygon
          points="0,-46 13,-15 46,-14 19,7 28,38 0,21 -28,38 -19,7 -46,-14 -13,-15"
          fill={fill}
        />
      </svg>
    );
  }
  if (rank === "A") {
    // 盾形
    return (
      <svg
        className={styles.shape}
        viewBox="-50 -50 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d="M -38 -42 L 38 -42 L 38 8 Q 38 32 0 44 Q -38 32 -38 8 Z"
          fill={fill}
        />
      </svg>
    );
  }
  if (rank === "B") {
    // 角形 (45度回転した四角)
    return (
      <svg
        className={styles.shape}
        viewBox="-50 -50 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <polygon points="0,-42 42,0 0,42 -42,0" fill={fill} />
      </svg>
    );
  }
  // C: 小ドット (円形)
  return (
    <svg
      className={styles.shape}
      viewBox="-50 -50 100 100"
      preserveAspectRatio="xMidYMid meet"
    >
      <circle cx="0" cy="0" r="32" fill={fill} />
    </svg>
  );
}

export default function RankBadge({ rank, size = "lg", popOnMount = false }: Props) {
  const classes = [
    styles.root,
    size === "lg" ? styles.lg : styles.sm,
    RANK_CLASS[rank],
    popOnMount ? styles.pop : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} role="img" aria-label={`Rank ${rank}`}>
      <ShapeFor rank={rank} />
      <span className={styles.label}>{rank}</span>
      {rank === "S" && size === "lg" && (
        <span className={styles.particles} aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
      )}
    </span>
  );
}
