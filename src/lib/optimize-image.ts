import "server-only";
import sharp from "sharp";

/**
 * 候補画像 (public/candidates/) の最適化パラメータ。
 *
 * 設計方針:
 * - 表示最大は公開結果ページの 900x506 (16/9)。長辺 1600px で Retina ~1.8x まで担保。
 * - 入力 MIME を維持する (拡張子を変えると Firestore 側 URL の張替えが必要になり、抜け漏れ事故の温床になる)。
 * - EXIF は撮影位置・機種を含むので必ず削除する (sharp はデフォルトで metadata を落とす)。
 * - 出力が入力より小さくならない場合の判定は呼び出し側で。
 */
export const IMAGE_MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 80;
export const WEBP_QUALITY = 80;

/**
 * sharp で受け入れる候補画像 MIME。
 * upload-candidate-image の ALLOWED_MIME と一致させる。
 */
const SUPPORTED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isSupportedImageMime(mime: string): boolean {
  return SUPPORTED_MIMES.has(mime);
}

/**
 * 画像を長辺 1600px 以内にリサイズし、同じ MIME (= 同じ拡張子) で再エンコードして返す。
 *
 * - JPEG/WebP: quality 80 で再エンコード (mozjpeg / WebP の標準エンコーダ)。
 * - PNG: 同形式のまま compressionLevel 9。写真 PNG は形式由来で重いままだが、
 *   リサイズで主要な節約は得られる。
 * - GIF: アニメーション保持のため animated:true で読む。
 *
 * 入力 buffer に対し失敗時は例外を投げる (デコード不能, etc)。
 */
export async function optimizeCandidateImage(
  buf: Buffer,
  mime: string,
): Promise<Buffer> {
  if (!isSupportedImageMime(mime)) {
    throw new Error(`unsupported mime: ${mime}`);
  }

  // アニメーション GIF/WebP はフレーム保持。静止画にはコスト無し。
  const animated = mime === "image/gif" || mime === "image/webp";

  const pipeline = sharp(buf, { failOn: "none", animated })
    // EXIF の orientation を画素に焼き込んでからメタデータを落とす (sharp デフォルト動作)
    .rotate()
    .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });

  switch (mime) {
    case "image/jpeg":
      return pipeline
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
        .toBuffer();
    case "image/png":
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    case "image/webp":
      return pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
    case "image/gif":
      return pipeline.gif().toBuffer();
    default:
      throw new Error(`unreachable: ${mime}`);
  }
}
