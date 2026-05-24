import {
  collection,
  deleteField,
  doc,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * OnAir Speaker (デスクトップ) が `streamers/{uid}/gifts/{auto_id}` に
 * 書き込むギフト1件のスキーマ。詳細は docs / Firestore スキーマ参照。
 *
 * - `at` は SERVER_TIMESTAMP の pending 中に null になり得る
 * - `source === "manual"` のときだけ手動入力マーカーが入る
 */
export interface GiftDoc {
  id: string;
  user_raw: string;
  user_display: string;
  gift_name: string;
  amount: number;
  at: Date | null;
  source: string | null;
  /** 抽選アプリで処理済みになった時刻。null = 未処理。 */
  lottery_processed_at: Date | null;
  /** 抽選アプリで処理したオペレーター uid (= streamerId と同じはず)。 */
  lottery_processed_by: string | null;
}

interface RawGift {
  user_raw?: unknown;
  user_display?: unknown;
  gift_name?: unknown;
  amount?: unknown;
  at?: Timestamp | null;
  source?: unknown;
  lottery_processed_at?: Timestamp | null;
  lottery_processed_by?: unknown;
}

function toGift(id: string, data: RawGift): GiftDoc {
  return {
    id,
    user_raw: typeof data.user_raw === "string" ? data.user_raw : "",
    user_display: typeof data.user_display === "string" ? data.user_display : "",
    gift_name: typeof data.gift_name === "string" ? data.gift_name.trim() : "",
    amount: typeof data.amount === "number" && Number.isFinite(data.amount)
      ? data.amount
      : 0,
    at: data.at ? data.at.toDate() : null,
    source: typeof data.source === "string" ? data.source : null,
    lottery_processed_at: data.lottery_processed_at
      ? data.lottery_processed_at.toDate()
      : null,
    lottery_processed_by:
      typeof data.lottery_processed_by === "string" && data.lottery_processed_by.length > 0
        ? data.lottery_processed_by
        : null,
  };
}

/**
 * `streamers/{uid}/gifts` を at desc で購読する。
 * uid が空文字なら呼び出し側で先に弾くこと（ここでは undefined チェックのみ）。
 */
export function subscribeGifts(
  uid: string,
  onChange: (list: GiftDoc[]) => void,
  onError?: (err: Error) => void,
  limit = 100,
): Unsubscribe {
  if (!uid) {
    onChange([]);
    return () => {};
  }
  const db = getDb();
  const q = query(
    collection(db, "streamers", uid, "gifts"),
    orderBy("at", "desc"),
    fsLimit(limit),
  );
  return onSnapshot(
    q,
    snap => {
      onChange(snap.docs.map(d => toGift(d.id, d.data() as RawGift)));
    },
    err => onError?.(err),
  );
}

/**
 * ギフトに「抽選アプリで処理済み」フラグを書き戻す (merge update)。
 * 既存フィールド (user_raw / amount / gift_name 等) は触らない。
 * 連続抽選で複数回呼ばれても冪等 (最新の processed_at で上書きされる)。
 *
 * Firestore rules: streamers/{uid}/gifts/{giftId} で affectedKeys を
 * ['lottery_processed_at','lottery_processed_by'] に限定して許可している。
 */
export async function markGiftProcessed(
  streamerUid: string,
  giftId: string,
  operatorUid: string,
): Promise<void> {
  if (!streamerUid || !giftId) return;
  const db = getDb();
  await setDoc(
    doc(db, "streamers", streamerUid, "gifts", giftId),
    {
      lottery_processed_at: serverTimestamp(),
      lottery_processed_by: operatorUid,
    },
    { merge: true },
  );
}

/**
 * 抽選済みフラグを取り消す。「処理済み行を未処理に戻したい」ような操作用。
 * 現状 UI からは呼んでいないが、将来の取り消し操作のために露出しておく。
 */
export async function unmarkGiftProcessed(
  streamerUid: string,
  giftId: string,
): Promise<void> {
  if (!streamerUid || !giftId) return;
  const db = getDb();
  await setDoc(
    doc(db, "streamers", streamerUid, "gifts", giftId),
    {
      lottery_processed_at: deleteField(),
      lottery_processed_by: deleteField(),
    },
    { merge: true },
  );
}
