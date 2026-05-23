/**
 * OpenStreetMap Overpass API で近隣のランドマーク（POI）を取得する。
 * - API キー不要・無料
 * - 利用規約: https://operations.osmfoundation.org/policies/nominatim/ に準じた節度ある利用を想定
 */

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export interface LandmarkHit {
  id: string;
  name: string;
  /** 日本語ラベル化したカテゴリ (例: 美術館, 動物園, 城)。判別不能なら null。 */
  category: string | null;
  lat: number;
  lon: number;
  /** ピンからの距離 (m) */
  distance: number;
}

/**
 * OSM タグ → 日本語カテゴリへの簡易マッピング。
 * よく使いそうな観光/文化系を優先。未マップは null（カテゴリ入力欄は手動で）。
 */
const TAG_TO_CATEGORY: ReadonlyArray<[string, string, string]> = [
  // [tagKey, tagValue, 日本語ラベル]
  ["tourism", "museum", "美術館"],
  ["tourism", "gallery", "ギャラリー"],
  ["tourism", "zoo", "動物園"],
  ["tourism", "aquarium", "水族館"],
  ["tourism", "theme_park", "テーマパーク"],
  ["tourism", "attraction", "観光名所"],
  ["tourism", "viewpoint", "展望スポット"],
  ["tourism", "artwork", "アート"],
  ["historic", "castle", "城"],
  ["historic", "monument", "記念碑"],
  ["historic", "memorial", "記念碑"],
  ["historic", "ruins", "遺跡"],
  ["historic", "archaeological_site", "遺跡"],
  ["amenity", "place_of_worship", "寺社"],
  ["amenity", "library", "図書館"],
  ["amenity", "theatre", "劇場"],
  ["amenity", "cinema", "映画館"],
  ["amenity", "marketplace", "市場"],
  ["leisure", "park", "公園"],
  ["leisure", "garden", "庭園"],
  ["natural", "peak", "山"],
  ["natural", "volcano", "火山"],
  ["natural", "waterfall", "滝"],
  ["natural", "hot_spring", "温泉"],
  ["railway", "station", "駅"],
];

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function deriveCategory(tags: Record<string, string>): string | null {
  for (const [k, v, label] of TAG_TO_CATEGORY) {
    if (tags[k] === v) return label;
  }
  return null;
}

function pickName(tags: Record<string, string>): string | null {
  return tags["name:ja"] || tags["name"] || tags["name:en"] || null;
}

/** Haversine: 2点間距離 (m) */
function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 指定座標から `radiusMeters` 以内のランドマークを取得。
 * AbortSignal を受け取って外部キャンセル可能。
 */
export async function fetchNearbyLandmarks(
  lat: number,
  lon: number,
  options: { radiusMeters?: number; signal?: AbortSignal } = {},
): Promise<LandmarkHit[]> {
  const r = options.radiusMeters ?? 400;
  // 観光/歴史/文化/自然系の名前付き node/way/relation を取得
  const q = `
[out:json][timeout:15];
(
  nwr["name"]["tourism"](around:${r},${lat},${lon});
  nwr["name"]["historic"](around:${r},${lat},${lon});
  nwr["name"]["leisure"~"park|garden"](around:${r},${lat},${lon});
  nwr["name"]["natural"~"peak|volcano|waterfall|hot_spring"](around:${r},${lat},${lon});
  nwr["name"]["amenity"~"place_of_worship|library|theatre|cinema|marketplace"](around:${r},${lat},${lon});
  nwr["name"]["railway"="station"](around:${r},${lat},${lon});
);
out center 30;
`.trim();

  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: q }),
    signal: options.signal,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = (await res.json()) as OverpassResponse;
  const elements = json.elements ?? [];

  const hits: LandmarkHit[] = [];
  const seen = new Set<string>(); // 同名重複の抑制
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = pickName(tags);
    if (!name) continue;
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (typeof elLat !== "number" || typeof elLon !== "number") continue;
    const key = name;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      id: `${el.type}/${el.id}`,
      name,
      category: deriveCategory(tags),
      lat: elLat,
      lon: elLon,
      distance: distanceMeters(lat, lon, elLat, elLon),
    });
  }
  hits.sort((a, b) => a.distance - b.distance);
  return hits.slice(0, 10);
}
