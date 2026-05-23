/**
 * キャラクター画像のアップロード API (dev 用)。
 *
 * - dev サーバー専用。本番ビルドの read-only FS では機能しないため拒否する。
 * - 受け取った画像を `public/character/uploads/<pose-basename>.<ext>` に保存し、
 *   `public/character/manifest.json` の該当 pose を新しい URL に差し替える。
 * - 既存のアップロードファイル(同 baseName で別拡張子)は削除。
 * - DELETE では manifest 該当 pose のエントリと uploads/ 配下の画像を消し、SVG プレースホルダーへ戻す。
 *
 * POST body (FormData):
 *   pose (string, 必須) — "default" | "pointing" | "rankS" | "rankA" | "rankB" | "rankC"
 *   file (File, 必須)
 *
 * DELETE query:
 *   ?pose=...
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_POSES = new Set([
  "default",
  "pointing",
  "rankS",
  "rankA",
  "rankB",
  "rankC",
  "avatarDefault",
  "avatarPointing",
  "avatarRankS",
  "avatarRankA",
  "avatarRankB",
  "avatarRankC",
]);

const POSE_BASENAME: Record<string, string> = {
  default: "default",
  pointing: "pointing",
  rankS: "rank-s",
  rankA: "rank-a",
  rankB: "rank-b",
  rankC: "rank-c",
  avatarDefault: "avatar-default",
  avatarPointing: "avatar-pointing",
  avatarRankS: "avatar-rank-s",
  avatarRankA: "avatar-rank-a",
  avatarRankB: "avatar-rank-b",
  avatarRankC: "avatar-rank-c",
};

const ALLOWED_MIME = new Set([
  "image/svg+xml",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/svg+xml": ".svg",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function manifestPath(): string {
  return path.join(process.cwd(), "public", "character", "manifest.json");
}

function uploadsDir(): string {
  return path.join(process.cwd(), "public", "character", "uploads");
}

async function readManifest(): Promise<Record<string, string>> {
  try {
    const buf = await fs.readFile(manifestPath(), "utf8");
    const parsed = JSON.parse(buf) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeManifest(m: Record<string, string>): Promise<void> {
  const dir = path.join(process.cwd(), "public", "character");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(manifestPath(), JSON.stringify(m, null, 2) + "\n", "utf8");
}

export async function POST(req: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "uploads are disabled in production" },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  const pose = form.get("pose");
  if (typeof pose !== "string" || !ALLOWED_POSES.has(pose)) {
    return NextResponse.json(
      { error: `invalid pose: ${String(pose)}` },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file field" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported type: ${file.type || "unknown"}` },
      { status: 415 },
    );
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES} bytes)` },
      { status: 413 },
    );
  }

  const ext = EXT_BY_MIME[file.type];
  const baseName = POSE_BASENAME[pose];
  const filename = `${baseName}${ext}`;

  await fs.mkdir(uploadsDir(), { recursive: true });

  // 既存の同 baseName 別拡張子ファイルを掃除
  try {
    const entries = await fs.readdir(uploadsDir());
    for (const entry of entries) {
      if (entry === filename) continue;
      const m = entry.match(new RegExp(`^${baseName}\\.\\w+$`));
      if (m) {
        await fs.unlink(path.join(uploadsDir(), entry)).catch(() => {});
      }
    }
  } catch {
    // dir didn't exist
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadsDir(), filename), buf);

  // manifest 更新
  const m = await readManifest();
  m[pose] = `/character/uploads/${filename}`;
  await writeManifest(m);

  return NextResponse.json({
    pose,
    url: m[pose],
    bytes: buf.byteLength,
  });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "uploads are disabled in production" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const pose = url.searchParams.get("pose");
  if (!pose || !ALLOWED_POSES.has(pose)) {
    return NextResponse.json(
      { error: `invalid pose: ${String(pose)}` },
      { status: 400 },
    );
  }

  // uploads/ 配下の該当ファイルを削除
  const baseName = POSE_BASENAME[pose];
  try {
    const entries = await fs.readdir(uploadsDir());
    for (const entry of entries) {
      if (entry.startsWith(`${baseName}.`)) {
        await fs.unlink(path.join(uploadsDir(), entry)).catch(() => {});
      }
    }
  } catch {
    // dir didn't exist
  }

  // manifest からエントリ削除
  const m = await readManifest();
  delete m[pose];
  await writeManifest(m);

  return NextResponse.json({ pose, reset: true });
}
