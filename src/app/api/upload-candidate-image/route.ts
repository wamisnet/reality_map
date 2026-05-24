/**
 * 候補画像のアップロード API (dev 用)。
 * - dev サーバー (`next dev`) でのみ有効。本番ビルドの read-only FS では失敗するため拒否する。
 * - 受け取った画像を `public/candidates/<lat>_<lon>_<sha8><ext>` で保存する。
 *   - 座標と内容ハッシュ両方をファイル名に含めるので、同じ座標に複数画像を載せられる。
 *   - 同じ画像 (同じ内容) を同じ座標で再アップロードすると上書きされる (冪等)。
 * - ブラウザから参照可能な相対 URL (`/candidates/...`) を返す。
 *
 * FormData フィールド:
 *   file (File, 必須)
 *   lat  (number string, 必須)
 *   lon  (number string, 必須)
 *
 * 想定ワークフロー: ローカルで地点登録 → public 配下に画像が増える → git commit → デプロイで配信。
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { optimizeCandidateImage } from "@/lib/optimize-image";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/**
 * 座標値を filesystem-safe な文字列に変換。
 * 例: 34.66205 → "34.662050", -1.5 → "m1.500000"
 * 小数6桁固定で、マイナス符号は "m" に置換 (Windows等のシェルでの解釈を避ける)。
 */
function formatCoord(n: number): string {
  const fixed = Math.abs(n).toFixed(6);
  return n < 0 ? `m${fixed}` : fixed;
}

function parseNum(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file field" }, { status: 400 });
  }

  const lat = parseNum(form.get("lat"));
  const lon = parseNum(form.get("lon"));
  if (lat === null || lon === null) {
    return NextResponse.json(
      { error: "lat and lon are required" },
      { status: 400 },
    );
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "lat/lon out of range" },
      { status: 400 },
    );
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
  const rawBuf = Buffer.from(await file.arrayBuffer());

  // サーバー側で長辺 1600px にリサイズ + 同じ形式で再エンコード + EXIF 削除。
  // 拡張子は変更せず、URL の互換性を維持する (設定は src/lib/optimize-image.ts)。
  let buf: Buffer;
  try {
    buf = await optimizeCandidateImage(rawBuf, file.type);
  } catch (e) {
    return NextResponse.json(
      { error: `image decode/encode failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 422 },
    );
  }

  // 内容ハッシュ (短縮 sha256) は最適化後バッファに対して計算する。
  // sharp の同パラメータ・同入力は決定論的なので、同じ画像の再アップロードは
  // 同じ sha → 同じファイル名 → 上書き冪等になる。
  const sha = createHash("sha256").update(buf).digest("hex").slice(0, 8);
  const filename = `${formatCoord(lat)}_${formatCoord(lon)}_${sha}${ext}`;

  const targetDir = path.join(process.cwd(), "public", "candidates");
  await fs.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, filename);

  await fs.writeFile(targetPath, buf);

  const url = `/candidates/${filename}`;
  return NextResponse.json({
    url,
    bytes: buf.byteLength,
    originalBytes: rawBuf.byteLength,
  });
}
