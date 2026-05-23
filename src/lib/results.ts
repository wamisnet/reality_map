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
  category: string | null;
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

async function findExistingParticipantId(key: string): Promise<string | null> {
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

interface SaveArgs {
  winner: Winner;
  participantName: string;
  operatorUid: string;
  operatorName: string | null;
  modeId: string | null;
  modeName: string | null;
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
}: SaveArgs): Promise<SaveResult> {
  const key = normalizeName(participantName);
  const existing = await findExistingParticipantId(key);
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
    participantKey: key,
    operatorUid,
    operatorName,
    candidateName: winner.name,
    pref: winner.pref,
    lon: winner.lon,
    lat: winner.lat,
    image: snapshotImages?.[0] ?? null,
    images: snapshotImages,
    desc: winner.desc ?? null,
    category: winner.category ?? null,
    at: winner.at,
    rank: winner.rank,
    modeId,
    modeName,
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
    category: (data.category as string | null) ?? null,
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
