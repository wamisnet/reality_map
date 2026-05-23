import { promises as fs } from "node:fs";
import path from "node:path";
import {
  EMPTY_VOICE_LINES,
  normalizeVoiceLines,
  pickVoiceLine,
  type VoiceCategory,
  type VoiceLines,
} from "./voice-lines-types";
import type { Rank } from "@/types";

// サーバーサイドで public/voice-lines.json を直接読む。
// /ops のクライアント側は useVoiceLines() (API 経由) を使う。
// SSR からは fs で読み、リクエストごとに毎回ディスクを叩かないよう短時間キャッシュする。

const TTL_MS = 5_000;
let cached: VoiceLines | null = null;
let cachedAt = 0;

async function readFile(): Promise<VoiceLines> {
  try {
    const buf = await fs.readFile(
      path.join(process.cwd(), "public", "voice-lines.json"),
      "utf8",
    );
    return normalizeVoiceLines(JSON.parse(buf));
  } catch {
    return EMPTY_VOICE_LINES;
  }
}

export async function getVoiceLines(): Promise<VoiceLines> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  cached = await readFile();
  cachedAt = Date.now();
  return cached;
}

const RANK_TO_CATEGORY: Record<Rank, VoiceCategory> = {
  S: "rankS",
  A: "rankA",
  B: "rankB",
  C: "rankC",
};

/**
 * 結果ページ用にランク別の一言を引く。
 * 該当ランクが空なら順に他ランク → idle → "" の順でフォールバック。
 */
export async function voiceLineFor(
  rank: Rank | null | undefined,
  seed: string,
): Promise<string> {
  const lines = await getVoiceLines();
  if (rank) {
    const hit = pickVoiceLine(lines[RANK_TO_CATEGORY[rank]], seed);
    if (hit) return hit;
  }
  // フォールバック: 何でもいいので非空なリストから 1 行返す。
  const fallbackOrder: ReadonlyArray<VoiceCategory> = [
    "rankA",
    "rankB",
    "rankC",
    "rankS",
    "idle",
  ];
  for (const cat of fallbackOrder) {
    const hit = pickVoiceLine(lines[cat], seed);
    if (hit) return hit;
  }
  return "";
}
