import type { Rank } from "@/types";

/**
 * キャラクター画像のポーズ識別子。
 * - 全身系 (default / pointing / rankX) : TOP・リスト・詳細・OGP など、ある程度大きく出す場面用
 * - アバター系 (avatar*)                : /ops の小さい円形アイコン用に、顔/上半身に寄せた別カット
 */
export type CharacterPose =
  | "default"
  | "pointing"
  | "rankS"
  | "rankA"
  | "rankB"
  | "rankC"
  | "avatarDefault"
  | "avatarPointing"
  | "avatarRankS"
  | "avatarRankA"
  | "avatarRankB"
  | "avatarRankC";

// public/ 配下のパス。実画像に差し替える場合はここを変えるだけで全体に反映。
export const CHARACTER_SRC: Record<CharacterPose, string> = {
  default: "/character/default.svg",
  pointing: "/character/pointing.svg",
  rankS: "/character/rank-s.svg",
  rankA: "/character/rank-a.svg",
  rankB: "/character/rank-b.svg",
  rankC: "/character/rank-c.svg",
  avatarDefault: "/character/avatar-default.svg",
  avatarPointing: "/character/avatar-pointing.svg",
  avatarRankS: "/character/avatar-rank-s.svg",
  avatarRankA: "/character/avatar-rank-a.svg",
  avatarRankB: "/character/avatar-rank-b.svg",
  avatarRankC: "/character/avatar-rank-c.svg",
};

export function poseForRank(rank: Rank | null | undefined): CharacterPose {
  switch (rank) {
    case "S":
      return "rankS";
    case "A":
      return "rankA";
    case "B":
      return "rankB";
    case "C":
      return "rankC";
    default:
      return "default";
  }
}

export function avatarPoseForRank(rank: Rank | null | undefined): CharacterPose {
  switch (rank) {
    case "S":
      return "avatarRankS";
    case "A":
      return "avatarRankA";
    case "B":
      return "avatarRankB";
    case "C":
      return "avatarRankC";
    default:
      return "avatarDefault";
  }
}
