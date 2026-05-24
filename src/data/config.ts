import type { Tweak } from "@/types";

/**
 * 固定設定。コードを直接編集して変えてください。
 */
export const CONFIG: Tweak = {
  speed: 1,           // アニメ速度倍率
  sound: true,        // 効果音
  autoFire: false,    // 自動発火モード
  theme: "light",     // light | amber | red | green | cyan
  resultStyle: "standard",  // minimal | standard | detailed
  ogMapStyle: "silhouette", // silhouette | real (OGP内に出す地図のスタイル)
  autoCloseSec: 55,   // ロックから自動クローズまでの秒数
  detailDelaySec: 1.6, // ロック後に画像/説明文を出すまでの秒数
  lockZoom: 12,       // ロック時のズーム
  continuousLockSec: 15, // 連続抽選時、ロック表示を維持してから次へ進むまでの秒数
  avoidRecentRepeat: 10, // 直近 N 件の当選候補を除外する (0 で機能オフ)。候補が枯れたら自動でフォールバック
};

export const THEMES = {
  // White/pastel skin — used by the new /ops design
  light: {
    primary: "oklch(0.7 0.16 350)",      // raspberry pink (visible on light map)
    soft:    "oklch(0.78 0.12 350 / 0.4)",
    danger:  "oklch(0.62 0.22 25)",      // coral red for lock/danger
  },
  amber: { primary: "oklch(0.82 0.18 75)",  soft: "oklch(0.82 0.18 75 / 0.5)",  danger: "oklch(0.65 0.22 25)" },
  red:   { primary: "oklch(0.7 0.22 25)",   soft: "oklch(0.7 0.22 25 / 0.5)",   danger: "oklch(0.65 0.22 25)" },
  green: { primary: "oklch(0.82 0.18 145)", soft: "oklch(0.82 0.18 145 / 0.5)", danger: "oklch(0.7 0.22 25)" },
  cyan:  { primary: "oklch(0.82 0.16 210)", soft: "oklch(0.82 0.16 210 / 0.5)", danger: "oklch(0.7 0.22 25)" },
} as const;
