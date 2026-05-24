import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDb } from "./firebase";

const MAX_UTTER_CHARS = 500;

/**
 * `streamers/{uid}/remote_utterances` に発話依頼を投入する。
 * デスクトップ (OnAir Speaker) が拾って読み上げ後にドキュメントを delete する。
 *
 * - 空文字は何もしない (デスクトップ側でも即削除される仕様だが手前で弾く)
 * - 長すぎる本文は MAX_UTTER_CHARS で切り詰める
 * - 失敗は console.error のみ。読み上げが落ちても抽選フロー自体は止めない
 */
export function pushUtterance(uid: string | null | undefined, text: string): void {
  if (!uid) return;
  const trimmed = text.trim();
  if (trimmed.length === 0) return;
  const body =
    trimmed.length > MAX_UTTER_CHARS ? trimmed.slice(0, MAX_UTTER_CHARS) : trimmed;
  const db = getDb();
  addDoc(collection(db, "streamers", uid, "remote_utterances"), {
    text: body,
    created_at: serverTimestamp(),
  }).catch(err => {
    console.error("[pushUtterance] failed", err);
  });
}

/** 抽選開始時の発話文。参加者名のみ使う (連続抽選の初回だけ呼ぶ運用)。 */
export function utterStartLine(participantName: string): string {
  const name = participantName.trim();
  if (!name) return "抽選を開始するよ";
  return `${name}さんの抽選を開始するよ`;
}

/** 抽選結果時の発話文。説明文があれば「。」で繋いで読み上げる。 */
export function utterResultLine(
  candidateName: string,
  desc: string | null | undefined,
): string {
  const name = candidateName.trim() || "謎の地点";
  const d = (desc ?? "").trim();
  if (!d) return `${name}が出たよ`;
  return `${name}が出たよ。${d}`;
}
