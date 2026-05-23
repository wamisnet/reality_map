import { POINTS, type Point } from "@/data/japan-points";
import type { FormattedCoord } from "@/types";

export const VIEW = { minLon: 128, maxLon: 146, minLat: 30, maxLat: 46 };
export const WIDTH = 1800;
export const HEIGHT = 1600;

export function project(lon: number, lat: number) {
  const x = ((lon - VIEW.minLon) / (VIEW.maxLon - VIEW.minLon)) * WIDTH;
  const y = ((VIEW.maxLat - lat) / (VIEW.maxLat - VIEW.minLat)) * HEIGHT;
  return { x, y };
}

function poly(points: ReadonlyArray<readonly [number, number]>) {
  return (
    points
      .map(([lon, lat], i) => {
        const { x, y } = project(lon, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join("") + "Z"
  );
}

// Simplified coastline approximations.
const HOKKAIDO: ReadonlyArray<readonly [number, number]> = [
  [140.4, 41.5], [140.0, 41.8], [139.8, 42.4], [140.0, 43.0], [139.8, 43.4],
  [140.3, 43.5], [140.4, 43.9], [140.6, 44.4], [141.4, 45.4], [141.7, 45.5],
  [142.4, 44.7], [143.2, 44.3], [143.9, 44.2], [144.8, 44.0], [145.5, 43.9],
  [145.3, 43.2], [144.6, 42.9], [144.1, 42.9], [143.4, 42.3], [142.6, 42.3],
  [142.0, 42.5], [141.7, 42.6], [141.4, 42.4], [141.0, 42.5], [140.7, 41.8],
  [140.4, 41.5],
];

const HONSHU: ReadonlyArray<readonly [number, number]> = [
  [140.5, 41.4], [140.9, 40.5], [141.4, 40.7], [141.5, 41.4], [141.6, 40.4],
  [141.8, 39.6], [142.1, 39.6], [142.0, 38.9], [141.6, 38.3], [141.0, 38.4],
  [141.1, 37.8], [140.9, 37.0], [140.7, 36.0], [140.6, 35.7], [140.9, 35.7],
  [140.9, 35.4], [140.4, 35.2], [139.8, 34.9], [139.6, 35.1], [139.2, 35.1],
  [138.9, 34.6], [138.6, 34.6], [138.2, 34.6], [137.8, 34.7], [137.0, 34.7],
  [136.8, 34.3], [136.5, 34.2], [135.9, 33.5], [135.4, 33.5], [135.1, 33.7],
  [135.0, 34.3], [134.6, 34.7], [134.2, 34.7], [133.6, 34.4], [132.9, 34.1],
  [132.3, 34.2], [131.8, 34.0], [131.0, 33.9], [130.9, 34.4], [131.3, 34.4],
  [131.5, 34.7], [132.4, 35.4], [133.0, 35.6], [134.0, 35.6], [134.8, 35.7],
  [135.5, 35.7], [135.9, 35.5], [136.3, 35.8], [136.7, 36.1], [136.9, 36.8],
  [137.2, 37.5], [137.3, 36.9], [138.0, 37.2], [138.7, 37.8], [139.4, 38.5],
  [139.8, 39.3], [139.9, 39.9], [140.0, 40.5], [140.5, 41.4],
];

const SHIKOKU: ReadonlyArray<readonly [number, number]> = [
  [134.0, 34.3], [134.5, 34.3], [134.6, 34.0], [134.4, 33.5], [134.2, 33.3],
  [133.8, 33.0], [133.2, 33.3], [132.7, 32.9], [132.4, 33.1], [132.4, 33.5],
  [132.8, 33.7], [133.4, 34.2], [134.0, 34.3],
];

const KYUSHU: ReadonlyArray<readonly [number, number]> = [
  [131.0, 33.7], [131.7, 33.6], [131.6, 33.0], [131.4, 32.4], [131.4, 31.7],
  [131.2, 31.4], [130.7, 31.0], [130.6, 30.5], [130.3, 30.7], [130.1, 31.2],
  [129.7, 31.5], [129.7, 32.4], [130.2, 32.5], [130.2, 33.0], [129.7, 33.2],
  [129.7, 33.6], [130.1, 33.6], [130.4, 33.9], [130.9, 33.9], [131.0, 33.7],
];

const SADO: ReadonlyArray<readonly [number, number]> = [
  [138.2, 38.3], [138.6, 38.3], [138.6, 37.8], [138.2, 37.8], [138.2, 38.3],
];
const AWAJI: ReadonlyArray<readonly [number, number]> = [
  [134.8, 34.6], [135.1, 34.6], [135.0, 34.2], [134.8, 34.2], [134.8, 34.6],
];
const TSUSHIMA: ReadonlyArray<readonly [number, number]> = [
  [129.2, 34.7], [129.5, 34.7], [129.4, 34.1], [129.2, 34.1], [129.2, 34.7],
];
const IKI: ReadonlyArray<readonly [number, number]> = [
  [129.7, 33.8], [129.85, 33.8], [129.85, 33.7], [129.7, 33.7], [129.7, 33.8],
];
const GOTO: ReadonlyArray<readonly [number, number]> = [
  [128.7, 33.0], [129.0, 33.0], [129.0, 32.6], [128.7, 32.6], [128.7, 33.0],
];
const YAKU: ReadonlyArray<readonly [number, number]> = [
  [130.4, 30.4], [130.7, 30.4], [130.7, 30.2], [130.4, 30.2], [130.4, 30.4],
];
const OKINAWA: ReadonlyArray<readonly [number, number]> = [
  [127.7, 26.8], [128.1, 26.8], [128.3, 26.6], [128.1, 26.4], [128.0, 26.2],
  [127.8, 26.1], [127.6, 26.2], [127.65, 26.5], [127.7, 26.8],
];

export const ISLAND_DOTS: ReadonlyArray<readonly [number, number]> = [
  [129.0, 28.4], [130.0, 28.1], [128.9, 27.7], [128.5, 27.4], [127.2, 26.3],
  [126.2, 26.2], [124.2, 24.4], [124.0, 24.3], [123.0, 24.45], [139.3, 33.1],
  [139.5, 34.1], [142.2, 27.1],
];

export const ISLANDS = [
  { id: "hokkaido", d: poly(HOKKAIDO) },
  { id: "honshu", d: poly(HONSHU) },
  { id: "shikoku", d: poly(SHIKOKU) },
  { id: "kyushu", d: poly(KYUSHU) },
  { id: "sado", d: poly(SADO) },
  { id: "awaji", d: poly(AWAJI) },
  { id: "tsushima", d: poly(TSUSHIMA) },
  { id: "iki", d: poly(IKI) },
  { id: "goto", d: poly(GOTO) },
  { id: "yaku", d: poly(YAKU) },
  { id: "okinawa", d: poly(OKINAWA) },
];

export { POINTS };
export type { Point };

const POLYGONS = [
  HOKKAIDO, HONSHU, SHIKOKU, KYUSHU, SADO, AWAJI, TSUSHIMA, IKI, GOTO, YAKU, OKINAWA,
].map(arr =>
  arr.map(([lon, lat]) => {
    const { x, y } = project(lon, lat);
    return [x, y] as const;
  }),
);

function pointInPolygon(x: number, y: number, points: ReadonlyArray<readonly [number, number]>) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isLand(lon: number, lat: number) {
  const { x, y } = project(lon, lat);
  return POLYGONS.some(p => pointInPolygon(x, y, p));
}

export function randomLandPoint(opts: { cityBias?: number } = {}) {
  if (Math.random() < (opts.cityBias ?? 0.8)) {
    const p = POINTS[Math.floor(Math.random() * POINTS.length)];
    return { name: p[0], pref: p[1], lon: p[2], lat: p[3] };
  }
  for (let i = 0; i < 200; i++) {
    const lon = VIEW.minLon + Math.random() * (VIEW.maxLon - VIEW.minLon);
    const lat = VIEW.minLat + Math.random() * (VIEW.maxLat - VIEW.minLat);
    if (isLand(lon, lat)) {
      let nearest = POINTS[0];
      let nd = Infinity;
      for (const p of POINTS) {
        const d = (p[2] - lon) ** 2 + (p[3] - lat) ** 2;
        if (d < nd) { nd = d; nearest = p; }
      }
      return { name: "—", pref: nearest[1], lon, lat };
    }
  }
  const p = POINTS[Math.floor(Math.random() * POINTS.length)];
  return { name: p[0], pref: p[1], lon: p[2], lat: p[3] };
}

/**
 * 与えられた座標から最も近い POINTS の都道府県を返す。
 * /edit/map のクリック時 pref 推測に使用。
 */
export function nearestPrefecture(lon: number, lat: number): string | null {
  let nearest: Point | null = null;
  let nd = Infinity;
  for (const p of POINTS) {
    const d = (p[2] - lon) ** 2 + (p[3] - lat) ** 2;
    if (d < nd) {
      nd = d;
      nearest = p;
    }
  }
  return nearest ? nearest[1] : null;
}

export function fmtCoord(lat: number, lon: number): FormattedCoord {
  const latH = lat >= 0 ? "N" : "S";
  const lonH = lon >= 0 ? "E" : "W";
  const latD = Math.abs(lat);
  const lonD = Math.abs(lon);
  const latDeg = Math.floor(latD);
  const latMin = (latD - latDeg) * 60;
  const lonDeg = Math.floor(lonD);
  const lonMin = (lonD - lonDeg) * 60;
  return {
    lat: `${latDeg}°${latMin.toFixed(3).padStart(6, "0")}′${latH}`,
    lon: `${lonDeg}°${lonMin.toFixed(3).padStart(6, "0")}′${lonH}`,
    dec: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
  };
}
