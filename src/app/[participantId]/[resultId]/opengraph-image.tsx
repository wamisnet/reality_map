import { ImageResponse } from "next/og";
import { CONFIG } from "@/data/config";
import { poseForRank } from "@/data/character";
import { loadCharacterDataUrl } from "@/lib/character-server";
import {
  loadRealMapTile,
  loadRemoteImageDataUrl,
  silhouettePin,
  ISLANDS,
  SILHOUETTE_W,
  SILHOUETTE_H,
  OKINAWA_INSET,
} from "@/lib/og-map";
import { fetchResultById, isValidParticipantId } from "@/lib/results";
import { fetchCandidateById } from "@/lib/candidates-store";
import { voiceLineFor } from "@/data/voice-lines";
import { loadNotoJp } from "@/lib/og-fonts";
import { getCandidateImages, type Rank } from "@/types";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "咲月わみの旅ガチャ · Target Locked";

// ─── Color tokens ────────────────────────────────────────────────
const BG = "#fffaf3";
const INK = "#3a2a25";
const INK_SOFT = "#8a7670";
const ACCENT = "#ff9fb6";

const RANK_COLOR: Record<Rank, string> = {
  S: "#d68a1e", // gold
  A: "#ff5070", // coral
  B: "#6f95cd", // steel blue
  C: "#a8967f", // warm gray
};

// ─── Rank frames ─────────────────────────────────────────────────
// Each rank gets a different border treatment for the "trading card" feel.
interface RankFrame {
  /** Outer container background — visible as the border around the inner content. */
  outerBackground: string;
  /** Padding (= visible border thickness in px) */
  pad: number;
  /** Optional thin accent line on the inner content edge. */
  innerOutline?: string;
  /** Inner background overlay (subtle tint over the cream BG). */
  innerTint?: string;
  /** Whether to draw S-rank style corner decorations. */
  withStars?: boolean;
  /** Color used by accent text bits ("TARGET LOCKED" dot etc.) */
  accent: string;
}

const RANK_FRAMES: Record<Rank | "none", RankFrame> = {
  S: {
    outerBackground:
      "linear-gradient(135deg, #fff0c2 0%, #f5c46a 25%, #d68a1e 50%, #f5c46a 75%, #fff0c2 100%)",
    pad: 18,
    innerOutline: "2px solid rgba(214, 138, 30, 0.6)",
    innerTint: "rgba(255, 220, 150, 0.18)",
    withStars: true,
    accent: "#d68a1e",
  },
  A: {
    outerBackground:
      "linear-gradient(135deg, #ff8e9e 0%, #ff5070 50%, #ff8e9e 100%)",
    pad: 12,
    innerOutline: "1px solid rgba(255, 159, 182, 0.5)",
    innerTint: "rgba(255, 200, 210, 0.1)",
    accent: "#ff5070",
  },
  B: {
    outerBackground:
      "linear-gradient(135deg, #c8dcf2 0%, #6f95cd 50%, #c8dcf2 100%)",
    pad: 10,
    innerOutline: "1px solid rgba(111, 149, 205, 0.45)",
    accent: "#6f95cd",
  },
  C: {
    outerBackground: "#d8cbb8",
    pad: 8,
    innerOutline: "1px solid rgba(168, 150, 127, 0.4)",
    accent: "#a8967f",
  },
  none: {
    outerBackground: "#e8d8c6",
    pad: 6,
    accent: INK_SOFT,
  },
};

// ─── Map dimensions ──────────────────────────────────────────────
// 地図サムネは 1:1 (正方形)。日本列島は南北に細長いので、
// SVG 側で正方形 viewBox にして横にパディングを入れる (下を参照)。
const THUMB_PHOTO_W = 280;
const THUMB_PHOTO_H = 175;
const THUMB_MAP_W = 175;
const THUMB_MAP_H = 175;
const THUMB_GAP = 18;

// 日本シルエットを正方形枠に収めるための viewBox オフセット。
// SILHOUETTE_W < SILHOUETTE_H なので、横方向に均等パディングを入れて
// W:H = H:H の正方形 viewBox にする。Satori が preserveAspectRatio を
// 完全に解釈しなくても、コンテナと viewBox のアスペクトが一致するため
// 縦横比が潰れない。
const SIL_VIEWBOX_OFFSET_X = (SILHOUETTE_W - SILHOUETTE_H) / 2;
const SIL_VIEWBOX_SIZE = SILHOUETTE_H;

interface RouteParams {
  params: Promise<{ participantId: string; resultId: string }>;
}

export default async function Image({ params }: RouteParams) {
  const { participantId, resultId } = await params;

  let participantName = "—";
  let pref = "—";
  let city = "—";
  let rank: Rank | null = null;
  let coordStr = "";
  let lat = 0;
  let lon = 0;
  let imageUrl: string | null = null;
  let desc: string | null = null;
  let found = false;

  if (isValidParticipantId(participantId)) {
    const r = await fetchResultById(resultId).catch(() => null);
    if (r && r.participantId === participantId) {
      participantName = r.participantName;
      pref = r.pref;
      city = r.candidateName;
      rank = r.rank;
      lat = r.lat;
      lon = r.lon;
      coordStr = `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`;
      // 画像と説明文は最新の候補ドキュメントから引き直す (result page と同じロジック)。
      // 候補が削除済み・古い結果で candidateId 未保存のときはスナップショットを使う。
      const liveCandidate = r.candidateId
        ? await fetchCandidateById(r.candidateId).catch(() => null)
        : null;
      const sourceImages = liveCandidate
        ? getCandidateImages(liveCandidate)
        : getCandidateImages(r);
      imageUrl = sourceImages[0] ?? null;
      desc = liveCandidate?.desc ?? r.desc ?? null;
      found = true;
    }
  }

  const pose = poseForRank(rank ?? null);
  const characterUrl = await loadCharacterDataUrl(pose);
  const photoDataUrl = found ? await loadRemoteImageDataUrl(imageUrl) : null;

  // Map data (silhouette / real per CONFIG.ogMapStyle)
  const mapStyle = CONFIG.ogMapStyle;
  const realMap =
    found && mapStyle === "real" ? await loadRealMapTile(lat, lon, 10) : null;
  const silMap = found && mapStyle === "silhouette" ? silhouettePin(lat, lon) : null;

  // 結果ページと同じシード (resultId) で 1 行ピック → 同じ結果なら毎回同じ台詞になる
  const voiceLine = found ? await voiceLineFor(rank, resultId) : "";

  // Font subset
  const jpText =
    `${participantName}${pref}${city}${desc ?? ""}${voiceLine}抽選結果ターゲットさんの` +
    `ロックランク咲月わみの旅ガチャからのコメント`;
  const font = await loadNotoJp(jpText, 700);
  const fonts = font
    ? [
        {
          name: "NotoJP",
          data: font,
          style: "normal" as const,
          weight: 700 as const,
        },
      ]
    : [];

  const frame = RANK_FRAMES[rank ?? "none"];
  const rankCol = rank ? RANK_COLOR[rank] : INK_SOFT;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: frame.outerBackground,
          padding: frame.pad,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            position: "relative",
            background: BG,
            borderRadius: 14,
            overflow: "hidden",
            ...(frame.innerOutline
              ? { boxShadow: `inset 0 0 0 ${frame.innerOutline}` }
              : {}),
            fontFamily: "NotoJP, sans-serif",
          }}
        >
          {/* Soft tinted overlay (S-rank gold haze etc.) */}
          {frame.innerTint && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: frame.innerTint,
                display: "flex",
              }}
            />
          )}

          {/* Soft gradient blobs (decorative) */}
          <div
            style={{
              position: "absolute",
              top: -100,
              right: -80,
              width: 420,
              height: 420,
              background: "#ffd4e0",
              opacity: 0.5,
              filter: "blur(40px)",
              borderRadius: "50%",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -120,
              left: -80,
              width: 380,
              height: 380,
              background: "#e0d4ff",
              opacity: 0.5,
              filter: "blur(40px)",
              borderRadius: "50%",
              display: "flex",
            }}
          />

          {/* Brand top-left */}
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 48,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 20,
              color: ACCENT,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: ACCENT,
              }}
            />
            <span style={{ color: INK }}>咲月わみの旅ガチャ</span>
          </div>

          {/* TARGET LOCKED top-right */}
          <div
            style={{
              position: "absolute",
              top: 30,
              right: 48,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 16,
              letterSpacing: "0.32em",
              color: frame.accent,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: frame.accent,
              }}
            />
            <span>TARGET LOCKED</span>
          </div>

          {/* Character (left column). Centered vertically in the inner area
              (≈y:108-488 when a voice-line is shown). When there's no voice line
              the character keeps its larger height anchored toward the bottom. */}
          {characterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={characterUrl}
              alt=""
              width={360}
              height={voiceLine ? 380 : 568}
              style={{
                position: "absolute",
                left: 16,
                top: voiceLine ? 108 : 30,
                objectFit: "contain",
                objectPosition: "bottom",
              }}
            />
          )}

          {/* Voice line bubble — directly below the (now centered) character.
              2-line clamp keeps total height ≤ ~72px so the bubble does not
              cross past the bottom-bar baseline on S-rank (594px inner height). */}
          {voiceLine && (
            <div
              style={{
                position: "absolute",
                left: 24,
                top: 498,
                width: 344,
                padding: "12px 16px",
                boxSizing: "border-box",
                background: "#ffffff",
                borderRadius: 18,
                border: "1.5px solid rgba(255, 159, 182, 0.45)",
                boxShadow: "0 6px 18px rgba(170,130,120,0.18)",
                fontSize: 17,
                lineHeight: 1.4,
                color: INK,
                fontWeight: 600,
                letterSpacing: "0.02em",
                textAlign: "center",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
              }}
            >
              {voiceLine}
            </div>
          )}

          {/* Text block (middle column — narrower to make room for the right-side photo) */}
          <div
            style={{
              position: "absolute",
              left: 380,
              top: 96,
              right: photoDataUrl ? 460 : 48,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 22,
                letterSpacing: "0.28em",
                color: INK_SOFT,
                textTransform: "uppercase",
                fontWeight: 700,
                display: "flex",
              }}
            >
              {pref}
            </div>
            <div
              style={{
                // 実描画では和文 1 文字が fontSize より僅かに広い (kerning / advance width のずれ)。
                // 理論幅 (写真あり 324 / 写真なし 736) に約 10% のマージンを引いた
                // 実効幅 ≈ 写真あり 292 / 写真なし 660 を基準にフォントを決定する。
                fontSize: photoDataUrl
                  ? city.length >= 41
                    ? 20 // 3 行 (60)
                    : city.length >= 27
                      ? 22 // 2-3 行 (≤66)
                      : city.length >= 23
                        ? 24 // 2 行 (48)
                        : city.length >= 21
                          ? 26 // 2 行 (52)
                          : city.length >= 19
                            ? 28 // 2 行 (56)
                            : city.length >= 17
                              ? 32 // 2 行 (64)
                              : city.length >= 8
                                ? 36 // 1-2 行 (chars 8 は 1 行 288; 9-16 は 2 行 ≤72)
                                : city.length >= 7
                                  ? 40 // 1 行 (280)
                                  : city.length >= 6
                                    ? 48 // 1 行 (288)
                                    : city.length >= 5
                                      ? 56 // 1 行 (280)
                                      : 72 // ≤4 字 (288)
                  : city.length >= 41
                    ? 26 // 3 行 (78)
                    : city.length >= 33
                      ? 32 // 3 行 (96)
                      : city.length >= 27
                        ? 42 // 2 行 (84)
                        : city.length >= 14
                          ? 50 // 2 行 (100)
                          : city.length >= 12
                            ? 54 // 1 行 (648)
                            : city.length >= 11
                              ? 58 // 1 行 (638)
                              : city.length >= 10
                                ? 64 // 1 行 (640) ※ナガシマスパーランド
                                : city.length >= 9
                                  ? 72 // 1 行 (648)
                                  : city.length >= 8
                                    ? 80 // 1 行 (640)
                                    : city.length >= 7
                                      ? 92 // 1 行 (644)
                                      : city.length >= 5
                                        ? 104 // 1 行 (624)
                                        : 112, // ≤4 字 (448)
                fontWeight: 700,
                // lineHeight 1.0 で「N 行 = N × fontSize」が厳密に一致する
                lineHeight: 1,
                color: INK,
                maxHeight: photoDataUrl ? 80 : 112,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
              }}
            >
              {found ? city : "NOT FOUND"}
            </div>
            {rank && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: rankCol,
                    color: "#ffffff",
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                >
                  {rank}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    fontSize: 16,
                    color: INK_SOFT,
                    letterSpacing: "0.08em",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: rankCol,
                      letterSpacing: "0.18em",
                    }}
                  >
                    RANK {rank}
                  </span>
                  <span>{coordStr || "—"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Map thumbnail (mid-bottom column, under the text block).
              The candidate photo is rendered separately on the right column below. */}
          {(realMap || silMap) && (
            <div
              style={{
                position: "absolute",
                left: 380,
                bottom: 92,
                display: "flex",
                gap: THUMB_GAP,
                alignItems: "stretch",
              }}
            >
              {/* Real map (single GSI tile + pin overlay) */}
              {realMap && (
                <div
                  style={{
                    position: "relative",
                    width: THUMB_MAP_W,
                    height: THUMB_MAP_H,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "2px solid rgba(170,130,120,0.18)",
                    display: "flex",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={realMap.dataUrl}
                    alt=""
                    width={THUMB_MAP_W}
                    height={THUMB_MAP_H}
                    style={{ objectFit: "cover", display: "block" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: (realMap.pinX * THUMB_MAP_W) / 256 - 9,
                      top: (realMap.pinY * THUMB_MAP_H) / 256 - 9,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      background: "#ff3a4a",
                      border: "3px solid #ffffff",
                      display: "flex",
                    }}
                  />
                </div>
              )}

              {/* Silhouette map (main view + Okinawa inset) */}
              {silMap && (
                <div
                  style={{
                    width: THUMB_MAP_W,
                    height: THUMB_MAP_H,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "2px solid rgba(170,130,120,0.18)",
                    background: "#f8f0e6",
                    display: "flex",
                  }}
                >
                  <svg
                    width={THUMB_MAP_W}
                    height={THUMB_MAP_H}
                    viewBox={`${SIL_VIEWBOX_OFFSET_X} 0 ${SIL_VIEWBOX_SIZE} ${SIL_VIEWBOX_SIZE}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* メインビュー(本州+小笠原 等) */}
                    {ISLANDS.filter(i => i.region === "main").map((island, i) => (
                      <path
                        key={`m-${i}`}
                        d={island.d}
                        fill="#e0cdb6"
                        stroke="#c7a983"
                        strokeWidth={3}
                      />
                    ))}

                    {/* メインビューのピン */}
                    {silMap.region === "main" && (
                      <g>
                        <circle
                          cx={silMap.pinX}
                          cy={silMap.pinY}
                          r={80}
                          fill="#ff3a4a"
                          opacity={0.25}
                        />
                        <circle
                          cx={silMap.pinX}
                          cy={silMap.pinY}
                          r={36}
                          fill="#ff3a4a"
                          stroke="#ffffff"
                          strokeWidth={9}
                        />
                      </g>
                    )}

                    {/* 沖縄インセット */}
                    <g
                      transform={`translate(${OKINAWA_INSET.x} ${OKINAWA_INSET.y})`}
                    >
                      {/* インセット背景枠 */}
                      <rect
                        x={0}
                        y={0}
                        width={OKINAWA_INSET.w}
                        height={OKINAWA_INSET.h}
                        rx={16}
                        fill="rgba(255, 248, 235, 0.92)"
                        stroke="#c7a983"
                        strokeWidth={4}
                      />
                      {/* 琉球弧の島々 */}
                      {ISLANDS.filter(i => i.region === "okinawa").map((island, i) => (
                        <path
                          key={`o-${i}`}
                          d={island.d}
                          fill="#e0cdb6"
                          stroke="#c7a983"
                          strokeWidth={4}
                        />
                      ))}
                      {/* インセット用ピン */}
                      {silMap.region === "okinawa" && (
                        <g>
                          <circle
                            cx={silMap.pinX}
                            cy={silMap.pinY}
                            r={45}
                            fill="#ff3a4a"
                            opacity={0.3}
                          />
                          <circle
                            cx={silMap.pinX}
                            cy={silMap.pinY}
                            r={22}
                            fill="#ff3a4a"
                            stroke="#ffffff"
                            strokeWidth={6}
                          />
                        </g>
                      )}
                    </g>
                  </svg>
                </div>
              )}

            </div>
          )}

          {/* Right column: candidate photo (large) + description.
              Bottom aligned to the map's bottom edge (bottom: 92) so the
              right-column frame ends on the same horizontal line as the map. */}
          {photoDataUrl && (
            <div
              style={{
                position: "absolute",
                right: 40,
                bottom: 92,
                width: 400,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 400,
                  height: 250,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "2px solid rgba(170,130,120,0.18)",
                  display: "flex",
                  boxShadow: "0 6px 18px rgba(170,130,120,0.18)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoDataUrl}
                  alt=""
                  width={400}
                  height={250}
                  style={{ objectFit: "cover", display: "block" }}
                />
              </div>
              {desc && (
                <div
                  style={{
                    width: 400,
                    boxSizing: "border-box",
                    padding: "14px 18px",
                    background: "rgba(255, 255, 255, 0.78)",
                    border: "1px solid rgba(170, 130, 120, 0.22)",
                    borderRadius: 14,
                    boxShadow: "0 4px 14px rgba(170, 130, 120, 0.12)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: "0.22em",
                      color: ACCENT,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      textTransform: "uppercase",
                    }}
                  >
                    咲月わみからのコメント
                  </div>
                  <div
                    style={{
                      // 写真ありの右カラム可用高さ ≈ 480px。
                      // 写真250 + gap16 + 枠padding28 + ラベル18 + gap6 を引いた
                      // 残り ≈ 162px に desc が入る。fontSize 16 / lineHeight 1.5
                      // = 24px/行 → 6行 (144px) が安全な上限。
                      maxHeight: 144,
                      overflow: "hidden",
                      fontSize: 16,
                      lineHeight: 1.5,
                      color: INK,
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 6,
                    }}
                  >
                    {desc}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description without a photo — sits where the photo column would be.
              Same bottom-anchored layout & header label as the photo branch.
              Bottom edge aligned with the map's bottom (bottom: 92). */}
          {!photoDataUrl && desc && (
            <div
              style={{
                position: "absolute",
                right: 40,
                bottom: 92,
                width: 400,
                boxSizing: "border-box",
                padding: "18px 22px",
                background: "rgba(255, 255, 255, 0.78)",
                border: "1px solid rgba(170, 130, 120, 0.22)",
                borderRadius: 16,
                boxShadow: "0 6px 18px rgba(170, 130, 120, 0.14)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: "0.22em",
                  color: ACCENT,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  textTransform: "uppercase",
                }}
              >
                咲月わみからのコメント
              </div>
              <div
                style={{
                  // 写真なしの右カラム可用高さ ≈ 474px。
                  // 枠padding36 + ラベル18 + gap10 を引いた 410px が desc に使える。
                  // fontSize 17 / lineHeight 1.55 = 26.35px/行 → 15行までは安全。
                  maxHeight: 396,
                  overflow: "hidden",
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: INK,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 15,
                }}
              >
                {desc}
              </div>
            </div>
          )}

          {/* Bottom bar (clear of character) — Participant only; ID label removed. */}
          <div
            style={{
              position: "absolute",
              left: 380,
              right: 48,
              bottom: 24,
              display: "flex",
              alignItems: "center",
              fontSize: 15,
              color: INK_SOFT,
              letterSpacing: "0.06em",
              paddingTop: 14,
              borderTop: "1px dashed rgba(170,130,120,0.25)",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                maxWidth: "100%",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.32em",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                Participant
              </span>
              {/* 長い名前は 1 行に切り詰め (Satori が ellipsis をサポートしている範囲で) */}
              <span
                style={{
                  // 12+ 文字でフォントを縮小、長文でも 1 行に収まりやすく
                  color: INK,
                  fontWeight: 700,
                  fontSize:
                    participantName.length >= 16
                      ? 14
                      : participantName.length >= 12
                        ? 17
                        : 20,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {participantName}
              </span>
            </span>
          </div>

          {/* S-rank: sparkly corner decorations */}
          {frame.withStars &&
            [
              { top: 14, left: 14 },
              { top: 14, right: 14 },
              { bottom: 14, left: 14 },
              { bottom: 14, right: 14 },
            ].map((pos, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  ...pos,
                  width: 22,
                  height: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  color: "#f0b34a",
                }}
              >
                <svg width="22" height="22" viewBox="-12 -12 24 24">
                  <path
                    d="M 0 -11 L 2.6 -2.6 L 11 0 L 2.6 2.6 L 0 11 L -2.6 2.6 L -11 0 L -2.6 -2.6 Z"
                    fill="#f0b34a"
                  />
                </svg>
              </div>
            ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
