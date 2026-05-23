export type VoiceCategory =
  | "idle"
  | "scanning"
  | "rankS"
  | "rankA"
  | "rankB"
  | "rankC";

export const VOICE_CATEGORIES: ReadonlyArray<VoiceCategory> = [
  "idle",
  "scanning",
  "rankS",
  "rankA",
  "rankB",
  "rankC",
];

export type VoiceLines = Record<VoiceCategory, string[]>;

export const EMPTY_VOICE_LINES: VoiceLines = {
  idle: [],
  scanning: [],
  rankS: [],
  rankA: [],
  rankB: [],
  rankC: [],
};

export function isVoiceCategory(v: unknown): v is VoiceCategory {
  return (
    typeof v === "string" &&
    (VOICE_CATEGORIES as ReadonlyArray<string>).includes(v)
  );
}

/**
 * 与えられた seed (任意の文字列) から決定論的に行を 1 つ選ぶ。
 * 空配列のときは null を返す。
 */
export function pickVoiceLine(
  lines: ReadonlyArray<string>,
  seed: string,
): string | null {
  if (lines.length === 0) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return lines[Math.abs(h) % lines.length] ?? null;
}

/**
 * 任意の JSON 入力を VoiceLines に正規化する。未知キーは無視し、
 * 文字列以外の要素や空文字列は除外する。
 */
export function normalizeVoiceLines(input: unknown): VoiceLines {
  const out: VoiceLines = {
    idle: [],
    scanning: [],
    rankS: [],
    rankA: [],
    rankB: [],
    rankC: [],
  };
  if (!input || typeof input !== "object") return out;
  const rec = input as Record<string, unknown>;
  for (const cat of VOICE_CATEGORIES) {
    const arr = rec[cat];
    if (!Array.isArray(arr)) continue;
    out[cat] = arr
      .filter((v): v is string => typeof v === "string")
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  return out;
}
