/**
 * /ops 用ボイスライン (キャラクター下に表示する一言メッセージ) の読み書き API。
 *
 * - GET: 現在の public/voice-lines.json を返す。
 * - PUT: 受け取った VoiceLines JSON を public/voice-lines.json に保存する。
 *   PUT は dev サーバー専用。本番ビルドの read-only FS では拒否する。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  normalizeVoiceLines,
  type VoiceLines,
} from "@/data/voice-lines-types";

export const runtime = "nodejs";

function filePath(): string {
  return path.join(process.cwd(), "public", "voice-lines.json");
}

async function readFile(): Promise<VoiceLines> {
  try {
    const buf = await fs.readFile(filePath(), "utf8");
    return normalizeVoiceLines(JSON.parse(buf));
  } catch {
    return normalizeVoiceLines({});
  }
}

export async function GET(): Promise<NextResponse> {
  const lines = await readFile();
  return NextResponse.json(lines);
}

export async function PUT(req: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "voice-lines edits are disabled in production" },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const normalized = normalizeVoiceLines(body);
  await fs.writeFile(
    filePath(),
    JSON.stringify(normalized, null, 2) + "\n",
    "utf8",
  );
  return NextResponse.json(normalized);
}
