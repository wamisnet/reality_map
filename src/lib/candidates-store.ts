import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { unstable_cache } from "next/cache";
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

export type CandidateRankCounts = Record<Rank, number>;

/**
 * 候補ドキュメントの全件数をランク別に集計する。
 * Firestore の getCountFromServer (4回 / S A B C) を使うので
 * 候補本体は転送されず、課金も 1000 件あたり 1 read で済む。
 */
async function fetchCandidateRankCountsLive(): Promise<CandidateRankCounts> {
  const db = getDb();
  const col = collection(db, COLLECTION);
  const ranks = VALID_RANKS;
  const snaps = await Promise.all(
    ranks.map(r => getCountFromServer(query(col, where("rank", "==", r)))),
  );
  const counts = { S: 0, A: 0, B: 0, C: 0 } as CandidateRankCounts;
  ranks.forEach((r, i) => {
    counts[r] = snaps[i].data().count;
  });
  return counts;
}

/**
 * 公開ページで使う集計関数。ページ表示のたびに 4 read が走らないよう
 * Next.js のサーバキャッシュ (revalidate=300s) でラップする。
 * 候補が変わってもキャッシュは最大 5 分残るが、母数の表示としては許容範囲。
 */
export const fetchCandidateRankCounts = unstable_cache(
  fetchCandidateRankCountsLive,
  ["candidate-rank-counts:v1"],
  { revalidate: 300, tags: ["candidate-counts"] },
);

export interface CandidateLite {
  id: string;
  name: string;
  pref: string;
  rank: Rank;
}

/**
 * 全候補を最小フィールド (id/name/pref/rank) で取得する。
 * Admin の「未取得候補一覧」など、件数より中身を見たいケース向け。
 * 候補数が増えてもページ単位の data 量はたかが知れているので Cache 無し。
 */
export async function fetchAllCandidatesLite(): Promise<CandidateLite[]> {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy("order", "asc")),
  );
  return snap.docs.map(d => {
    const data = d.data() as RawCandidate;
    return {
      id: d.id,
      name: String(data.name ?? ""),
      pref: String(data.pref ?? ""),
      rank: toRank(data.rank),
    };
  });
}

/**
 * 指定 ID 群の候補について、**現在の** rank を引いて Map で返す。
 *
 * 抽選結果ドキュメントには抽選時点のランクがスナップショットとして保存されているが、
 * 後から候補側でランクが変わると hits[R] と totals[R] の比較で不整合が出る
 * (例: 35 / 34)。コンプリート率は「いま存在する rank=R 候補のうち何件引いたか」が
 * 自然な意味付けなので、結果に出てきた candidateId の現ランクを引き直して使う。
 *
 * 存在しない (削除済み) ID は Map に入らない。rank フィールドが壊れている候補も
 * 同様に除外する (toRank では default に流れないので、生の値で判定)。
 *
 * Firestore の `where(documentId(), "in", ...)` は 1 クエリ 30 件まで対応。
 */
export async function fetchCandidateRanksByIds(
  ids: ReadonlyArray<string>,
): Promise<Map<string, Rank>> {
  const out = new Map<string, Rank>();
  if (ids.length === 0) return out;

  const db = getDb();
  const col = collection(db, COLLECTION);
  const BATCH = 30;

  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const snap = await getDocs(query(col, where(documentId(), "in", chunk)));
    for (const d of snap.docs) {
      const raw = (d.data() as RawCandidate).rank;
      if (raw === "S" || raw === "A" || raw === "B" || raw === "C") {
        out.set(d.id, raw);
      }
    }
  }
  return out;
}
