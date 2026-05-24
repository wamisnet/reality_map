import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "./firebase";

/**
 * 参加者ごとの集計レコード (results をグルーピングしたもの)。
 * /edit/participants の一覧で表示し、コピー用 URL を組み立てる元になる。
 */
export interface ParticipantSummary {
  /** 8文字の base36 ID。/[participantId] の URL になる */
  participantId: string;
  /** 表示名 (オペレーターが入力した名前)。同名は participantKey で同一視 */
  participantName: string;
  /** 件数 */
  resultCount: number;
  /** 最新抽選の Date */
  lastAt: Date | null;
  /** 一番古い抽選の Date */
  firstAt: Date | null;
  /** 最新抽選 result の Firestore doc id */
  latestResultId: string;
}

/**
 * 全 results を新しい順に取得して participantId でグルーピングする。
 * 読み出しは1クエリ (orderBy のみ) なので Firestore の複合インデックスは不要。
 * results が極端に多くなった場合のページングは未対応。
 */
export async function fetchParticipantSummaries(): Promise<ParticipantSummary[]> {
  const db = getDb();
  const q = query(collection(db, "results"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  const map = new Map<string, ParticipantSummary>();
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const pid = String(data.participantId ?? "");
    if (!pid) continue;
    const name = String(data.participantName ?? "");
    const ts = data.createdAt as Timestamp | null | undefined;
    const at = ts ? ts.toDate() : null;

    const existing = map.get(pid);
    if (existing) {
      existing.resultCount += 1;
      if (at && (!existing.firstAt || at < existing.firstAt)) {
        existing.firstAt = at;
      }
      // 一覧は createdAt desc なので最初に出会った行が最新
    } else {
      map.set(pid, {
        participantId: pid,
        participantName: name,
        resultCount: 1,
        lastAt: at,
        firstAt: at,
        latestResultId: d.id,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const la = a.lastAt ? a.lastAt.getTime() : 0;
    const lb = b.lastAt ? b.lastAt.getTime() : 0;
    return lb - la;
  });
}

const BATCH_LIMIT = 500;

/**
 * 複数の participantId を1つに統合する。
 *
 * 動作:
 *   1. 各 fromId について results を全件取得 (where participantId == fromId)
 *   2. 各 doc の `participantId` / `participantKey` を toId 側に書き換え、
 *      `mergedFrom` / `mergedAt` / `mergedBy` メタを付与
 *   3. Firestore の writeBatch は500件上限なので分割コミット
 *
 * toId 側の participantKey を統合先と揃えるため、まず toId の最新 result を
 * 1件読んで参照 key を取得する。statesless: 失敗しても再実行で完了状態に
 * 寄せられる (= idempotent)。
 *
 * Firestore rules で `results` の update は participantId/participantKey/merged*
 * の限定5フィールド + 同一 operatorUid のみ許可する想定。
 */
export async function mergeParticipants(
  fromIds: string[],
  toId: string,
  operatorUid: string,
): Promise<{ updated: number }> {
  if (!toId) throw new Error("merge: toId is empty");
  const targets = Array.from(new Set(fromIds.filter(id => id && id !== toId)));
  if (targets.length === 0) return { updated: 0 };

  const db = getDb();

  // 統合先の participantKey を取得 (最新 1 件で十分)
  const toQ = query(
    collection(db, "results"),
    where("participantId", "==", toId),
    fsLimit(1),
  );
  const toSnap = await getDocs(toQ);
  if (toSnap.empty) {
    throw new Error(`merge: 統合先 (${toId}) の results が見つかりません`);
  }
  const toKey = String(
    (toSnap.docs[0].data() as Record<string, unknown>).participantKey ?? "",
  );
  if (!toKey) {
    throw new Error(`merge: 統合先 (${toId}) の participantKey が空です`);
  }

  let updated = 0;
  for (const fromId of targets) {
    const fromQ = query(
      collection(db, "results"),
      where("participantId", "==", fromId),
    );
    const fromSnap = await getDocs(fromQ);
    if (fromSnap.empty) continue;

    let batch = writeBatch(db);
    let count = 0;
    for (const d of fromSnap.docs) {
      batch.update(doc(db, "results", d.id), {
        participantId: toId,
        participantKey: toKey,
        mergedFrom: fromId,
        mergedAt: serverTimestamp(),
        mergedBy: operatorUid,
      });
      count += 1;
      if (count >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
    updated += fromSnap.size;
  }
  return { updated };
}
