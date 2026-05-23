import { ImageResponse } from "next/og";
import { loadCharacterDataUrl } from "@/lib/character-server";
import { poseForRank } from "@/data/character";
import { fetchResultsByParticipantId, isValidParticipantId } from "@/lib/results";
import { loadNotoJp } from "@/lib/og-fonts";
import type { Rank } from "@/types";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "咲月わみの旅ガチャ · Participant";

const BG = "#fffaf3";
const INK = "#3a2a25";
const INK_SOFT = "#8a7670";
const ACCENT = "#ff9fb6";

interface RouteParams {
  params: Promise<{ participantId: string }>;
}

// 結果リストから最上位ランクを返す。S > A > B > C。何もなければ null。
function pickTopRank(ranks: ReadonlyArray<Rank | null>): Rank | null {
  const order: Rank[] = ["S", "A", "B", "C"];
  for (const r of order) {
    if (ranks.includes(r)) return r;
  }
  return null;
}

export default async function Image({ params }: RouteParams) {
  const { participantId } = await params;

  let participantName = "—";
  let count = 0;
  let recent: string[] = [];
  let topRank: Rank | null = null;

  if (isValidParticipantId(participantId)) {
    const results = await fetchResultsByParticipantId(participantId).catch(() => []);
    if (results.length > 0) {
      participantName = results[0].participantName;
      count = results.length;
      recent = results.slice(0, 5).map(r => r.candidateName);
      topRank = pickTopRank(results.map(r => r.rank));
    }
  }

  // ランクが取れたらそのポーズ、無ければ pointing にフォールバック。
  const pose = topRank ? poseForRank(topRank) : "pointing";
  const characterUrl = await loadCharacterDataUrl(pose);

  const jpText =
    `${participantName}${recent.join("")}抽選結果さんの` +
    `ロックランク咲月わみの旅ガチャけっかリストTARGETS LOCKED`;
  const font = await loadNotoJp(jpText, 700);

  const fonts = font
    ? [{ name: "NotoJP", data: font, style: "normal" as const, weight: 700 as const }]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: BG,
          fontFamily: "NotoJP, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -80,
            width: 420,
            height: 420,
            background: "#ffd4e0",
            opacity: 0.55,
            filter: "blur(40px)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -120,
            left: -80,
            width: 380,
            height: 380,
            background: "#d4eafa",
            opacity: 0.55,
            filter: "blur(40px)",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 36,
            left: 56,
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
        <div
          style={{
            position: "absolute",
            top: 38,
            right: 56,
            fontSize: 16,
            letterSpacing: "0.32em",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          PARTICIPANT
        </div>

        {characterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={characterUrl}
            alt=""
            width={440}
            height={574}
            style={{
              position: "absolute",
              right: 0,
              top: 56,
              objectFit: "contain",
              objectPosition: "bottom",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            left: 56,
            top: 130,
            right: 440,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 20,
              letterSpacing: "0.28em",
              color: INK_SOFT,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            Participant
          </div>
          <div
            style={{
              // 字数で 4 段階に縮小。≥15 文字は 2 行折り返しを許容する前提でサイズ確保。
              // 列幅: 1200 - left:56 - right:440 = 約 704px
              fontSize:
                participantName.length >= 15
                  ? 60 // 2 lines OK
                  : participantName.length >= 11
                    ? 80
                    : participantName.length >= 7
                      ? 100
                      : 120,
              fontWeight: 700,
              lineHeight: participantName.length >= 15 ? 1.1 : 1.05,
              color: INK,
              display: "flex",
            }}
          >
            {participantName}
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 26,
              color: ACCENT,
              fontWeight: 700,
              letterSpacing: "0.16em",
              display: "flex",
            }}
          >
            TARGETS LOCKED · {count}
          </div>
          {recent.length > 0 && (
            <div
              style={{
                marginTop: 14,
                fontSize: 20,
                color: INK_SOFT,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {recent.map((c, i) => (
                <span key={i} style={{ display: "flex" }}>
                  {c}
                  {i < recent.length - 1 && (
                    <span style={{ opacity: 0.4, marginLeft: 12 }}>·</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar — end before the character on the right to avoid overlap */}
        <div
          style={{
            position: "absolute",
            left: 56,
            right: 440,
            bottom: 32,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 14,
            color: INK_SOFT,
            letterSpacing: "0.18em",
            paddingTop: 18,
            borderTop: "1px dashed rgba(170,130,120,0.25)",
          }}
        >
          <span>咲月わみの旅ガチャ · Public Page</span>
          <span>ID · {participantId}</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
