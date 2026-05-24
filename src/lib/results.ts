import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { Rank, Winner } from "@/types";

export interface ResultDoc {
  id: string;
  participantId: string;
  participantName: string;
  participantKey: string;
  operatorUid: string;
  operatorName: string | null;
  /** 元の候補ドキュメントの ID。古い結果には無いので null。 */
  candidateId: string | null;
  candidateName: string;
  pref: string;
  lon: number;
  lat: number;
  /** 代表画像 1 枚 (cover)。常に images[0] と一致。後方互換と OGP のため残す。 */
  image: string | null;
  /** 抽選時点でスナップショットされた全画像。null = 画像なし。 */
  images: string[] | null;
  desc: string | null;
  at: string;
  createdAt: Date | null;
  rank: Rank | null;
  modeId: string | null;
  modeName: string | null;
  /** ギフト連動抽選なら streamers/{uid}/gifts/{auto_id} の ID。手動入力なら null。 */
  giftId: string | null;
  /** ギフトの user_raw (絵文字/装飾を含む生表示名)。名寄せの一意キー。 */
  giftUserRaw: string | null;
  /** participantKey と同じ値だが、明示的に「ギフト由来」と分かるよう保存 (= "gift:" + user_raw.toLowerCase())。 */
  giftKey: string | null;
  /** ギフトのコイン数。誤検出修正で編集された場合は編集後の値。 */
  giftAmount: number | null;
  /** ギフト名。誤検出修正で編集された場合は編集後の値。 */
  giftName: string | null;
  /** OnAir Speaker 側の source フィールド (`"manual"` か null)。 */
  giftSource: string | null;
}

export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

const PID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const PID_LEN = 8;

export function generateParticipantId(): string {
  const buf = new Uint8Array(PID_LEN);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < PID_LEN; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  let s = "";
  for (let i = 0; i < PID_LEN; i++) {
    s += PID_CHARS[buf[i] % PID_CHARS.length];
  }
  return s;
}

export function isValidParticipantId(s: string): boolean {
  return /^[a-z0-9]{6,16}$/.test(s);
}

async function lookupByKey(key: string): Promise<string | null> {
  if (!key) return null;
  const db = getDb();
  const q = query(
    collection(db, "results"),
    where("participantKey", "==", key),
    limit(1),
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const pid = (d.data() as Record<string, unknown>).participantId;
    if (typeof pid === "string" && pid.length > 0) return pid;
  }
  return null;
}

/**
 * participantKey で既存の participantId を引き当てる。
 * primaryKey が見つからない場合は fallbackKey でも検索。
 * ギフト連動抽選では primary=`gift:{user_raw}`、fallback=`normalizeName(displayName)`
 * を渡すことで、user_raw 由来の安定キーを最優先しつつ表示名でも救済する。
 */
async function findExistingParticipantId(
  primaryKey: string,
  fallbackKey?: string | null,
): Promise<string | null> {
  const primary = await lookupByKey(primaryKey);
  if (primary) return primary;
  if (fallbackKey && fallbackKey !== primaryKey) {
    return await lookupByKey(fallbackKey);
  }
  return null;
}

export function giftParticipantKey(userRaw: string): string {
  return `gift:${userRaw.trim().toLowerCase()}`;
}

interface SaveArgs {
  winner: Winner;
  participantName: string;
  operatorUid: string;
  operatorName: string | null;
  modeId: string | null;
  modeName: string | null;
  /** ギフト由来抽選なら指定。null/undefined は手動入力フロー。 */
  gift?: {
    giftId: string;
    /** 名寄せの一意キー (絵文字含む生表示名)。空のときは fallback として参加者名で検索。 */
    userRaw: string | null;
    amount: number;
    giftName: string;
    /** OnAir Speaker の source ("manual" か null) */
    source: string | null;
  } | null;
}

export interface SaveResult {
  participantId: string;
  resultId: string;
}

export async function saveResult({
  winner,
  participantName,
  operatorUid,
  operatorName,
  modeId,
  modeName,
  gift,
}: SaveArgs): Promise<SaveResult> {
  const normalizedName = normalizeName(participantName);
  const giftUserRaw = gift?.userRaw?.trim() || null;
  const giftKey = giftUserRaw ? giftParticipantKey(giftUserRaw) : null;
  // ギフト由来は giftKey を最優先、なければ表示名 (normalizedName) で名寄せ。
  const primaryKey = giftKey ?? normalizedName;
  const fallbackKey = giftKey ? normalizedName : null;
  const existing = await findExistingParticipantId(primaryKey, fallbackKey);
  const participantId = existing ?? generateParticipantId();
  const db = getDb();
  const snapshotImages =
    Array.isArray(winner.images) && winner.images.length > 0
      ? [...winner.images]
      : winner.image
        ? [winner.image]
        : null;
  const ref = await addDoc(collection(db, "results"), {
    participantId,
    participantName: participantName.trim(),
    participantKey: primaryKey,
    operatorUid,
    operatorName,
    candidateId: winner.candidateId ?? null,
    candidateName: winner.name,
    pref: winner.pref,
    lon: winner.lon,
    lat: winner.lat,
    image: snapshotImages?.[0] ?? null,
    images: snapshotImages,
    desc: winner.desc ?? null,
    at: winner.at,
    rank: winner.rank,
    modeId,
    modeName,
    giftId: gift?.giftId ?? null,
    giftUserRaw: giftUserRaw,
    giftKey: giftKey,
    giftAmount: gift?.amount ?? null,
    giftName: gift?.giftName ?? null,
    giftSource: gift?.source ?? null,
    createdAt: serverTimestamp(),
  });
  return { participantId, resultId: ref.id };
}

function decodeImages(
  rawImages: unknown,
  rawImage: unknown,
): { image: string | null; images: string[] | null } {
  if (Array.isArray(rawImages)) {
    const filtered = rawImages.filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (filtered.length > 0) {
      return { image: filtered[0], images: filtered };
    }
  }
  if (typeof rawImage === "string" && rawImage.length > 0) {
    return { image: rawImage, images: [rawImage] };
  }
  return { image: null, images: null };
}

function decodeDoc(id: string, data: Record<string, unknown>): ResultDoc {
  const ts = data.createdAt as Timestamp | null | undefined;
  const rawRank = data.rank;
  const rank: Rank | null =
    rawRank === "S" || rawRank === "A" || rawRank === "B" || rawRank === "C"
      ? rawRank
      : null;
  const imageFields = decodeImages(data.images, data.image);
  return {
    id,
    participantId: String(data.participantId ?? ""),
    participantName: String(data.participantName ?? ""),
    participantKey: String(data.participantKey ?? ""),
    operatorUid: String(data.operatorUid ?? ""),
    operatorName: (data.operatorName as string | null) ?? null,
    candidateId: typeof data.candidateId === "string" && data.candidateId.length > 0
      ? data.candidateId
      : null,
    candidateName: String(data.candidateName ?? ""),
    pref: String(data.pref ?? ""),
    lon: Number(data.lon ?? 0),
    lat: Number(data.lat ?? 0),
    image: imageFields.image,
    images: imageFields.images,
    desc: (data.desc as string | null) ?? null,
    at: String(data.at ?? ""),
    createdAt: ts ? ts.toDate() : null,
    rank,
    modeId: (data.modeId as string | null) ?? null,
    modeName: (data.modeName as string | null) ?? null,
    giftId: typeof data.giftId === "string" && data.giftId.length > 0
      ? data.giftId
      : null,
    giftUserRaw: typeof data.giftUserRaw === "string" && data.giftUserRaw.length > 0
      ? data.giftUserRaw
      : null,
    giftKey: typeof data.giftKey === "string" && data.giftKey.length > 0
      ? data.giftKey
      : null,
    giftAmount: typeof data.giftAmount === "number" && Number.isFinite(data.giftAmount)
      ? data.giftAmount
      : null,
    giftName: typeof data.giftName === "string" && data.giftName.length > 0
      ? data.giftName
      : null,
    giftSource: typeof data.giftSource === "string" && data.giftSource.length > 0
      ? data.giftSource
      : null,
  };
}

export async function fetchResultsByParticipantId(
  participantId: string,
): Promise<ResultDoc[]> {
  const pid = participantId.trim().toLowerCase();
  if (!isValidParticipantId(pid)) return [];
  const db = getDb();
  const q = query(
    collection(db, "results"),
    where("participantId", "==", pid),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => decodeDoc(d.id, d.data() as Record<string, unknown>));
}

export async function fetchResultById(resultId: string): Promise<ResultDoc | null> {
  if (!resultId) return null;
  const db = getDb();
  const ref = doc(db, "results", resultId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return decodeDoc(snap.id, snap.data() as Record<string, unknown>);
}
