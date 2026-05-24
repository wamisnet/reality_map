import type { EditableCandidate, Mode } from "@/types";

/**
 * モードのランク重み + 都道府県フィルタを考慮して候補を1件選び、
 * **元配列** での index を返す。空なら -1。
 *
 * フォールバック方針:
 * - フィルタ後 0 件 → -1
 * - フィルタ後の重み合計が 0 → フィルタ後の候補から均等分布で選ぶ
 *   （ユーザーがカスタムモードで全 weight=0 にしても抽選が回るように）
 * - avoidIds で除外すると filtered が枯れる場合 → avoid を無視してフィルタ後から選ぶ
 *   (連続抽選で被るのを軽減する目的なので、候補が尽きたら被ってでも回す)
 */
export function pickWeightedIndex(
  candidates: ReadonlyArray<EditableCandidate>,
  mode: Mode | null,
  avoidIds?: ReadonlySet<string> | null,
): number {
  if (candidates.length === 0) return -1;

  const useFilter =
    mode != null && mode.prefectures.length > 0
      ? new Set(mode.prefectures)
      : null;

  // 元配列の index を保ちながらフィルタ候補リストを作る
  const filtered: Array<{ idx: number; weight: number }> = [];
  let totalWeight = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (useFilter && !useFilter.has(c.pref)) continue;
    const w = mode ? Math.max(0, mode.weights[c.rank] ?? 0) : 1;
    filtered.push({ idx: i, weight: w });
    totalWeight += w;
  }

  if (filtered.length === 0) return -1;

  // 直近被り回避: avoidIds に含まれる候補を除いたサブセットがあれば、それから選ぶ。
  // 全部 avoid に入ってしまったら諦めて filtered 全体から選ぶ (= 被ってでも回す)。
  let pool = filtered;
  let poolWeight = totalWeight;
  if (avoidIds && avoidIds.size > 0) {
    const survivors: typeof filtered = [];
    let survivorsWeight = 0;
    for (const f of filtered) {
      if (avoidIds.has(candidates[f.idx].id)) continue;
      survivors.push(f);
      survivorsWeight += f.weight;
    }
    if (survivors.length > 0) {
      pool = survivors;
      poolWeight = survivorsWeight;
    }
  }

  if (poolWeight <= 0) {
    // 全ランクの weight が 0 → 均等抽選にフォールバック
    const pick = Math.floor(Math.random() * pool.length);
    return pool[pick].idx;
  }

  const r = Math.random() * poolWeight;
  let acc = 0;
  for (const f of pool) {
    acc += f.weight;
    if (r < acc) return f.idx;
  }
  // 浮動小数の端数で抜けたら最後の要素を返す
  return pool[pool.length - 1].idx;
}
