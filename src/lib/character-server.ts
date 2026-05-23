/**
 * Server-side character image resolver.
 *
 * `public/character/manifest.json` を読んで pose → URL を返す。
 * manifest が無い・該当 pose のエントリが無い場合は SVG プレースホルダーへフォールバックする。
 *
 * Server components (OGP routes, page metadata 等) から使用。
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { CHARACTER_SRC, type CharacterPose } from "@/data/character";

type Manifest = Partial<Record<CharacterPose, string>>;

async function readManifest(): Promise<Manifest> {
  try {
    const p = path.join(process.cwd(), "public", "character", "manifest.json");
    const buf = await readFile(p, "utf8");
    const parsed = JSON.parse(buf) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Manifest) : {};
  } catch {
    return {};
  }
}

/** Get the character image src URL for the given pose. */
export async function getCharacterSrc(pose: CharacterPose): Promise<string> {
  const m = await readManifest();
  return m[pose] ?? CHARACTER_SRC[pose];
}

const MIME_BY_EXT: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * OGP 等で <img> に埋め込むための data URL を返す。
 * 失敗時は null。
 */
export async function loadCharacterDataUrl(
  pose: CharacterPose,
): Promise<string | null> {
  const srcPath = await getCharacterSrc(pose);
  try {
    const fsPath = path.join(
      process.cwd(),
      "public",
      srcPath.replace(/^\//, ""),
    );
    const buf = await readFile(fsPath);
    const ext = path.extname(srcPath).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
