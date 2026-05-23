/**
 * 候補画像をローカル dev サーバーにアップロードする。
 * 内部的には POST /api/upload-candidate-image を呼ぶ。
 * ファイル名は lat/lon から自動決定されるので、同じ地点に再アップロードすると上書きされる。
 *
 * 本番ビルドでは API 側が 403 を返すため、戻り値の Promise が reject される。
 */
export async function uploadCandidateImage(args: {
  file: File;
  lat: number;
  lon: number;
}): Promise<string> {
  const body = new FormData();
  body.append("file", args.file);
  body.append("lat", String(args.lat));
  body.append("lon", String(args.lon));

  const res = await fetch("/api/upload-candidate-image", {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}
