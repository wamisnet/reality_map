/**
 * OGP 画像内に表示する地図と、地点画像のローダ。
 *
 * - シルエット地図: 教科書スタイルの「本土 + 沖縄インセット」レイアウト。
 *   1. メインビュー: 本州/北海道/四国/九州 + 小笠原 (緯度26°N まで降ろして父島まで収める)
 *   2. 沖縄インセット: 琉球弧(奄美〜与那国)を左下の小窓に独立投影
 *   data は `src/data/japan-outline.json` (Natural Earth 50m, 34島 / 約1100点)
 * - GSI 淡色タイル (実地図): 単一タイルを fetch して data URL 化、ピンの相対座標を返す。
 * - 候補画像: r.image (リモート URL) を fetch して base64 data URL に。
 */

import outlineData from "@/data/japan-outline.json";

const GSI_TILE_BASE = "https://cyberjapandata.gsi.go.jp/xyz/pale";

// ─── 投影 (Web メルカトル) ────────────────────────────────────
type View = { minLon: number; maxLon: number; minLat: number; maxLat: number };

/** lat (度) を Web メルカトル の y (radian相当) に変換。 */
function mercatorY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
}

function projectIn(view: View, w: number, h: number, lon: number, lat: number) {
  const yMax = mercatorY(view.maxLat);
  const yMin = mercatorY(view.minLat);
  return {
    x: ((lon - view.minLon) / (view.maxLon - view.minLon)) * w,
    y: ((yMax - mercatorY(lat)) / (yMax - yMin)) * h,
  };
}

/** 縦横が同じスケールになるようキャンバス幅を計算 (メルカトル). */
function canvasWidthForMercator(view: View, h: number): number {
  const yRange = mercatorY(view.maxLat) - mercatorY(view.minLat);
  const xRange = ((view.maxLon - view.minLon) * Math.PI) / 180;
  return Math.round((h * xRange) / yRange);
}

// ─── メインビュー(本州 + 小笠原 を含む) ────────────────────────
const MAIN_VIEW = {
  minLon: 128,
  maxLon: 146,
  minLat: 26, // 父島 (26.7°N) を収めるため 30 → 26 へ
  maxLat: 46,
} as const;

export const SILHOUETTE_H = 2000;
export const SILHOUETTE_W = canvasWidthForMercator(MAIN_VIEW, SILHOUETTE_H);
// メルカトル本来のアスペクトでキャンバスを切る → 1442 px

// ─── 沖縄インセット(琉球弧の独立小窓) ─────────────────────────
const OKINAWA_VIEW = {
  minLon: 122,
  maxLon: 130,
  minLat: 24,
  maxLat: 29,
} as const;

const _OKINAWA_H = 360;
const _OKINAWA_W = canvasWidthForMercator(OKINAWA_VIEW, _OKINAWA_H);

/** メインキャンバスの中での沖縄インセットの位置とサイズ。
 *  メインビューの左上(日本海北側の空白域)に配置。 */
export const OKINAWA_INSET = {
  x: 40,
  y: 40,
  w: _OKINAWA_W,
  h: _OKINAWA_H,
} as const;

type Region = "main" | "okinawa";

function regionForPoint(lat: number, lon: number): Region {
  // 緯度 29°N より南で経度 132°E より西 = 琉球弧 → インセット
  return lat < 29 && lon < 132 ? "okinawa" : "main";
}

// ─── JSON データ → SVG パス ────────────────────────────────────
type LonLatRing = ReadonlyArray<readonly [number, number]>;
const RAW_OUTLINE = outlineData as unknown as LonLatRing[];

function regionForRing(ring: LonLatRing): Region {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLon = Infinity,
    maxLon = -Infinity;
  for (const [lon, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return regionForPoint((minLat + maxLat) / 2, (minLon + maxLon) / 2);
}

export interface IslandPath {
  id: string;
  d: string;
  region: Region;
}

function buildOutlinePaths(): ReadonlyArray<IslandPath> {
  return RAW_OUTLINE.map((ring, idx) => {
    const region = regionForRing(ring);
    const view = region === "okinawa" ? OKINAWA_VIEW : MAIN_VIEW;
    const w = region === "okinawa" ? OKINAWA_INSET.w : SILHOUETTE_W;
    const h = region === "okinawa" ? OKINAWA_INSET.h : SILHOUETTE_H;
    const d =
      ring
        .map(([lon, lat], i) => {
          const p = projectIn(view, w, h, lon, lat);
          return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join("") + "Z";
    return { id: `island-${idx}`, d, region };
  });
}

export const ISLANDS = buildOutlinePaths();

// ─── ピン (region とローカル座標を返す) ───────────────────────
export interface SilhouetteMapData {
  region: Region;
  pinX: number;
  pinY: number;
}

export function silhouettePin(lat: number, lon: number): SilhouetteMapData {
  const region = regionForPoint(lat, lon);
  const view = region === "okinawa" ? OKINAWA_VIEW : MAIN_VIEW;
  const w = region === "okinawa" ? OKINAWA_INSET.w : SILHOUETTE_W;
  const h = region === "okinawa" ? OKINAWA_INSET.h : SILHOUETTE_H;
  const p = projectIn(view, w, h, lon, lat);
  return { region, pinX: p.x, pinY: p.y };
}

// ─── 実地図 (GSI タイル) ─────────────────────────────────────
function lonLatToTile(lon: number, lat: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

export interface RealMapData {
  dataUrl: string;
  pinX: number;
  pinY: number;
}

export async function loadRealMapTile(
  lat: number,
  lon: number,
  zoom = 10,
): Promise<RealMapData | null> {
  try {
    const tf = lonLatToTile(lon, lat, zoom);
    const tx = Math.floor(tf.x);
    const ty = Math.floor(tf.y);
    const url = `${GSI_TILE_BASE}/${zoom}/${tx}/${ty}.png`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      dataUrl: `data:image/png;base64,${buf.toString("base64")}`,
      pinX: (tf.x - tx) * 256,
      pinY: (tf.y - ty) * 256,
    };
  } catch {
    return null;
  }
}

// ─── 候補画像 → data URL ───────────────────────────────────────
export async function loadRemoteImageDataUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
