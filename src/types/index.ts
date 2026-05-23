export type Phase = "idle" | "scanning" | "locked";

export type Theme = "light" | "amber" | "red" | "green" | "cyan";
export type ResultStyle = "minimal" | "standard" | "detailed";

export type Rank = "S" | "A" | "B" | "C";

export interface RankWeights {
  S: number;
  A: number;
  B: number;
  C: number;
}

export interface Candidate {
  name: string;
  pref: string;
  lon: number;
  lat: number;
  /** 代表画像 1 枚 (cover)。images が無い・古いデータの後方互換のため残す。
   *  保存時は images[0] と一致するように書き込む。 */
  image?: string | null;
  /** 全画像。複数登録できる。読み出し時は images を優先し、
   *  無ければ image を 1 枚として扱う。空配列は「画像なし」と等価。 */
  images?: string[] | null;
  desc?: string | null;
  /** 場所の種類/カテゴリ (例: "動物園", "美術館", "城")。
   *  設定されていれば結果カード上で都道府県の代わりに表示される。 */
  category?: string | null;
}

/**
 * Candidate / Winner / ResultDoc などから「全画像配列」を取り出す共通ヘルパー。
 * images が無い古いデータも image を 1 枚扱いとして扱う。
 */
export function getCandidateImages(c: {
  image?: string | null;
  images?: string[] | null;
}): string[] {
  if (Array.isArray(c.images) && c.images.length > 0) {
    return c.images.filter((s): s is string => typeof s === "string" && s.length > 0);
  }
  return c.image ? [c.image] : [];
}

/**
 * Candidate as stored in Firestore (or normalized from the in-code list).
 * Carries rank and ordering metadata used by the editor and weighted picker.
 */
export interface EditableCandidate extends Candidate {
  id: string;          // Firestore doc id (or synthetic id for in-code fallback)
  rank: Rank;
  order: number;
}

export interface Mode {
  id: string;
  name: string;
  description: string | null;
  weights: RankWeights;
  prefectures: string[];   // [] = all
  enabled: boolean;
  order: number;
}

export interface Winner extends Candidate {
  c: FormattedCoord;
  at: string;
  rank: Rank;
  // image / images は Candidate から継承。images はスナップショット時に固める。
}

export interface FormattedCoord {
  lat: string;
  lon: string;
  dec: string;
}

export interface Telemetry {
  signal: number;
  noise: number;
  drift: number;
  frame: number;
}

export interface LatLon {
  lon: number;
  lat: number;
}

export type OgMapStyle = "silhouette" | "real";

export interface Tweak {
  speed: number;
  sound: boolean;
  autoFire: boolean;
  theme: Theme;
  resultStyle: ResultStyle;
  /** OGP 画像内に表示する地図のスタイル。"silhouette" は SVG の日本シルエット、"real" は GSI 淡色タイル。 */
  ogMapStyle: OgMapStyle;
  autoCloseSec: number;
  detailDelaySec: number;
  lockZoom: number;
  continuousLockSec: number;
}

export interface MapController {
  flyTo: (lon: number, lat: number, zoom?: number, duration?: number) => void;
  reset: (duration?: number) => void;
  getZoom: () => number | undefined;
}

export type ProjectFn = (lon: number, lat: number) => { x: number; y: number };

/**
 * Tuple input format for CANDIDATES (legacy compatibility, in-code data source).
 * [name, pref, lon, lat, image?, desc?]
 */
export type CandidateTuple = [
  string,
  string,
  number,
  number,
  string?,
  string?,
];
