import {
  collection,
  getDocs,
  orderBy,
  query,
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
