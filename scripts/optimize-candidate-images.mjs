#!/usr/bin/env node
// 既存の public/candidates/* を一括で長辺 1600px + 再エンコードする。
// ファイル名・拡張子は変えない (Firestore 側 URL の整合性を維持)。
// 使い方:
//   node scripts/optimize-candidate-images.mjs            (実行)
//   node scripts/optimize-candidate-images.mjs --dry-run  (計算のみ)
//
// 設定値は src/lib/optimize-image.ts と一致させること。
// 失敗時は git checkout public/candidates/ で復元可能。

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DIR = path.join(ROOT, "public", "candidates");
const MAX = 1600;
const JPEG_Q = 80;
const WEBP_Q = 80;
const DRY = process.argv.includes("--dry-run");

// 出力が元の 95% 以上なら上書きしない (再エンコードのオーバーヘッドを避ける)。
const SAVING_THRESHOLD = 0.95;

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

async function optimize(buf, mime) {
  const animated = mime === "image/gif" || mime === "image/webp";
  const pipeline = sharp(buf, { failOn: "none", animated })
    .rotate()
    .resize(MAX, MAX, { fit: "inside", withoutEnlargement: true });

  switch (mime) {
    case "image/jpeg":
      return pipeline
        .jpeg({ quality: JPEG_Q, mozjpeg: true, progressive: true })
        .toBuffer();
    case "image/png":
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    case "image/webp":
      return pipeline.webp({ quality: WEBP_Q }).toBuffer();
    case "image/gif":
      return pipeline.gif().toBuffer();
    default:
      throw new Error(`unsupported mime: ${mime}`);
  }
}

function fmtKB(n) {
  return `${(n / 1024).toFixed(0).padStart(5)} KB`;
}

const files = (await fs.readdir(DIR)).sort();
let totalBefore = 0;
let totalAfter = 0;
let written = 0;
let skipped = 0;
let unchanged = 0;
let failed = 0;

console.log(
  `${DRY ? "[DRY RUN] " : ""}processing ${files.length} files in ${DIR}\n` +
    `target: longest side ≤ ${MAX}px, q=${JPEG_Q} (jpg/webp)\n`,
);

for (const name of files) {
  const ext = path.extname(name).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    console.log(`-- skip   ${name}  (unsupported extension)`);
    skipped++;
    continue;
  }

  const full = path.join(DIR, name);
  const before = (await fs.stat(full)).size;
  totalBefore += before;

  let outBuf;
  try {
    const inBuf = await fs.readFile(full);
    outBuf = await optimize(inBuf, mime);
  } catch (e) {
    console.log(`!! fail   ${name}  ${e instanceof Error ? e.message : e}`);
    failed++;
    totalAfter += before;
    continue;
  }

  if (outBuf.length >= before * SAVING_THRESHOLD) {
    console.log(`== same   ${name}  ${fmtKB(before)}  (already small)`);
    unchanged++;
    totalAfter += before;
    continue;
  }

  const saved = before - outBuf.length;
  const pct = ((saved / before) * 100).toFixed(0);
  console.log(
    `${DRY ? "?? plan  " : "✓✓ wrote "} ${name}  ${fmtKB(before)} → ${fmtKB(outBuf.length)}  (-${pct}%)`,
  );

  if (!DRY) {
    const tmp = `${full}.tmp`;
    await fs.writeFile(tmp, outBuf);
    await fs.rename(tmp, full);
  }
  written++;
  totalAfter += outBuf.length;
}

console.log(
  `\nsummary: ${written} ${DRY ? "would-write" : "written"}, ${unchanged} unchanged, ${skipped} skipped, ${failed} failed`,
);
console.log(
  `total: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(totalAfter / 1024 / 1024).toFixed(1)} MB  ` +
    `(-${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(0)}%)`,
);
