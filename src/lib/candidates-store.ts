import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { EditableCandidate, Rank } from "@/types";

const COLLECTION = "candidates";

interface RawCandidate {
  name?: unknown;
  pref?: unknown;
  lon?: unknown;
  lat?: unknown;
  image?: unknown;
  images?: unknown;
  desc?: unknown;
  rank?: unknown;
  order?: unknown;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

function toImages(images: unknown, image: unknown): string[] | null {
  if (Array.isArray(images)) {
    const filtered = images.filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (filtered.length > 0) return filtered;
  }
  if (typeof image === "string" && image.length > 0) return [image];
  return null;
}

const VALID_RANKS: ReadonlyArray<Rank> = ["S", "A", "B", "C"];

function toRank(v: unknown): Rank {
  return typeof v === "string" && (VALID_RANKS as ReadonlyArray<string>).includes(v)
    ? (v as Rank)
    : "C";
}

function toEditable(id: string, data: RawCandidate): EditableCandidate {
  const images = toImages(data.images, data.image);
  return {
    id,
    name: String(data.name ?? ""),
    pref: String(data.pref ?? ""),
    lon: Number(data.lon ?? 0),
    lat: Number(data.lat ?? 0),
    image: images?.[0] ?? null,
    images,
    desc: typeof data.desc === "string" ? data.desc : null,
    rank: toRank(data.rank),
    order: typeof data.order === "number" ? data.order : 0,
  };
}

/**
 * Firestore の `candidates` コレクションをリアルタイム監視。
 * 並び順は order asc → name asc (name は安定化のため Firestore 側で実装、ここではクライアントソート)。
 */
/**
 * 単一の候補ドキュメントを ID で取得する。
 * 結果ページが「最新の画像/説明文」を引き直すために使う。
 * 候補が削除済みなら null を返す。
 */
export async function fetchCandidateById(
  id: string,
): Promise<EditableCandidate | null> {
  if (!id) return null;
  const db = getDb();
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toEditable(snap.id, snap.data() as RawCandidate);
}

export function subscribeCandidates(
  onChange: (list: EditableCandidate[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb();
  const q = query(collection(db, COLLECTION), orderBy("order", "asc"));
  return onSnapshot(
    q,
    snap => {
      const list = snap.docs.map(d => toEditable(d.id, d.data() as RawCandidate));
      // order が同値でも安定するように name で2次ソート
      list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja"));
      onChange(list);
    },
    err => onError?.(err),
  );
}

export interface CandidateInput {
  name: string;
  pref: string;
  lon: number;
  lat: number;
  /** 全画像。空配列なら画像なし。 */
  images: string[];
  desc: string | null;
  rank: Rank;
  order: number;
}

/**
 * 入力の images から Firestore へ書き込む image / images フィールドの組を作る。
 * image は常に images[0] (or null) と一致させる。
 */
function imageFieldsFor(images: string[]) {
  const cleaned = images
    .map(s => (typeof s === "string" ? s.trim() : ""))
    .filter(s => s.length > 0);
  return {
    image: cleaned[0] ?? null,
    images: cleaned.length > 0 ? cleaned : null,
  };
}

export async function addCandidate(
  input: CandidateInput,
  createdBy: string | null,
): Promise<string> {
  const db = getDb();
  const { images, ...rest } = input;
  const ref = await addDoc(collection(db, COLLECTION), {
    ...rest,
    ...imageFieldsFor(images),
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCandidate(
  id: string,
  patch: Partial<CandidateInput>,
): Promise<void> {
  const db = getDb();
  const { images, ...rest } = patch;
  const imageFields = images !== undefined ? imageFieldsFor(images) : {};
  await updateDoc(doc(db, COLLECTION, id), {
    ...rest,
    ...imageFields,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCandidate(id: string): Promise<void> {
  const db = getDb();
  await deleteDoc(doc(db, COLLECTION, id));
}
