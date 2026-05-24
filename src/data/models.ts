import type { Mode } from "@/types";

/**
 * 抽選モデル（重み付けプリセット）の固定リスト。
 * Firebase には保存せず、ここで管理する。
 * id は localStorage に永続化されるので、変更時は後方互換に注意。
 *
 * Mode インターフェースと互換性を持たせている（enabled/order を含む）。
 */
export const MODELS: ReadonlyArray<Mode> = [
  {
    id: "default",
    name: "Default",
    description: "C(安定)中心、まれに上位がのぞく",
    weights: { S: 1, A: 2, B: 4, C: 8 },
    prefectures: [],
    enabled: true,
    order: 0,
  },
  {
    id: "premium",
    name: "プレミアム",
    description: "S(超おすすめ)を厚く、安定枠は少しだけ",
    weights: { S: 8, A: 4, B: 2, C: 1 },
    prefectures: [],
    enabled: true,
    order: 1,
  },
];

export const DEFAULT_MODEL_ID = MODELS[0]?.id ?? null;
