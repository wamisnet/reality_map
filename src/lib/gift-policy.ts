/**
 * ギフトのコイン数から推奨される抽選回数と抽選モードを決める。
 *
 * Why: 配信中のオペレーターがコイン数を見て毎回手動で換算するのは負担。
 *      ボタン1つで盛り上がりに応じた連続抽選を回せるよう、ここで方針を集約する。
 *
 * 階段マッピング（オペレーター側で個別上書き可能）:
 *   <10C       : 抽選しない (スキップ)
 *   10-99C     : Default モードで floor(amount/10) 回 (1〜9)
 *   100-999C   : プレミアムモードで floor(amount/100) 回 (1〜9)
 *   ≥1000C     : プレミアムモードで 10 回 (打ち切り)
 */

export interface GiftPolicyRecommendation {
  count: number;
  modeId: string;
}

export const DEFAULT_MODE_ID = "default";
export const PREMIUM_MODE_ID = "premium";
export const MAX_DRAWS = 10;

export function recommendedFromAmount(
  amount: number,
): GiftPolicyRecommendation | null {
  if (!Number.isFinite(amount) || amount < 10) return null;
  if (amount < 100) {
    return { count: Math.floor(amount / 10), modeId: DEFAULT_MODE_ID };
  }
  if (amount >= 1000) {
    return { count: MAX_DRAWS, modeId: PREMIUM_MODE_ID };
  }
  return { count: Math.floor(amount / 100), modeId: PREMIUM_MODE_ID };
}
