import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Character from "@/components/public/Character";
import PublicPageHeader from "@/components/public/PublicPageHeader";
import ImageCarousel from "@/components/ImageCarousel";
import LocationMap from "@/components/public/LocationMapClient";
import { poseForRank } from "@/data/character";
import { voiceLineFor } from "@/data/voice-lines";
import { getCandidateImages } from "@/types";
import { fmtCoord } from "@/lib/japan-data";
import { fetchCandidateById } from "@/lib/candidates-store";
import {
  fetchResultById,
  isValidParticipantId,
  type ResultDoc,
} from "@/lib/results";
import ShareButtons from "./ShareButtons";
import styles from "./page.module.css";

interface PageProps {
  params: Promise<{ participantId: string; resultId: string }>;
}

async function loadResult(participantId: string, resultId: string) {
  if (!isValidParticipantId(participantId)) return null;
  const r = await fetchResultById(resultId).catch(() => null);
  if (!r) return null;
  if (r.participantId !== participantId) return null;
  return r;
}

// Twitter は 280 文字制限。URL は t.co 短縮で約 23 文字扱い。
// 結果行 + 誘い文 + URL でおよそ 100 文字消費するので、説明文は ~120 文字で打ち切る。
const DESC_MAX = 120;

function truncate(s: string, max: number): string {
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

function buildShareText(r: ResultDoc, descOverride: string | null): string {
  const rankSuffix = r.rank ? ` (RANK ${r.rank})` : "";
  // 投稿者本人視点。「○○さんは」は冗長なので入れない。
  const head = `旅ガチャで ${r.pref}・${r.candidateName}${rankSuffix} を引き当てたよ✨`;
  const descSource = descOverride ?? r.desc;
  const desc = descSource ? truncate(descSource, DESC_MAX) : "";
  const invite = "咲月わみの Reality 枠に遊びにいって旅ガチャを引きに来ない?";
  return [head, desc, invite].filter(Boolean).join("\n\n");
}

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { participantId, resultId } = await params;
  const r = await loadResult(participantId, resultId);
  if (!r) return { title: "Not found" };
  const title = `${r.participantName} さんが「${r.candidateName}」を引き当てたよ · 咲月わみの旅ガチャ`;
  const desc = `${r.pref} · ${r.candidateName}${r.rank ? ` (RANK ${r.rank})` : ""} を引き当てました。`;
  return {
    title,
    description: desc,
    openGraph: {
      title: `${r.candidateName}${r.rank ? ` · RANK ${r.rank}` : ""}`,
      description: desc,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${r.candidateName}${r.rank ? ` · RANK ${r.rank}` : ""}`,
      description: desc,
    },
  };
}

export default async function ResultPage({ params }: PageProps) {
  const { participantId, resultId } = await params;
  const r = await loadResult(participantId, resultId);
  if (!r) notFound();

  const coord = fmtCoord(r.lat, r.lon);
  const placeLabel = r.pref;
  const pose = poseForRank(r.rank);
  const voiceLine = await voiceLineFor(r.rank, r.id);

  // 画像と説明文は最新の候補ドキュメントから引き直す。
  // 候補が削除済み・古い結果で candidateId 未保存のときはスナップショットを使う。
  const liveCandidate = r.candidateId
    ? await fetchCandidateById(r.candidateId).catch(() => null)
    : null;
  const images = liveCandidate
    ? getCandidateImages(liveCandidate)
    : getCandidateImages(r);
  const effectiveDesc = liveCandidate?.desc ?? r.desc;

  return (
    <div className={styles.root}>
      <div className={styles.blob1} aria-hidden />
      <div className={styles.blob2} aria-hidden />

      <main className={styles.main}>
        <PublicPageHeader
          title={`${r.participantName} さんの結果一覧`}
          subtitle="咲月わみの旅ガチャ"
          href={`/${participantId}`}
          back
        />

        <section className={styles.hero}>
          <div className={styles.heroHead}>
            <div className={styles.prefRow}>
              <span className={styles.pref}>{placeLabel}</span>
              {r.rank && (
                <span
                  className={`${styles.rankPill} ${styles[`rank${r.rank}`] ?? ""}`}
                >
                  RANK {r.rank}
                </span>
              )}
            </div>
            <h1 className={styles.city}>{r.candidateName}</h1>
            <div className={styles.coord}>
              <span>{coord.lat}</span>
              <span>{coord.lon}</span>
            </div>
          </div>

          <div className={styles.charBlock}>
            <Character pose={pose} size="lg" float />
            <p className={styles.voiceLine}>{voiceLine}</p>
          </div>
        </section>

        {images.length > 0 && (
          <section className={styles.imageBlock}>
            <ImageCarousel
              images={images}
              alt={r.candidateName}
              autoMs={images.length > 1 ? 4500 : 0}
              resumeAfterUserMs={8000}
              fit="cover"
              className={styles.image}
            />
          </section>
        )}

        {effectiveDesc && (
          <section className={styles.descBlock}>
            <h2 className={styles.sectionHead}>
              <span className={styles.deco}>♡</span> 咲月わみからのコメント
            </h2>
            <p className={styles.descBody}>{effectiveDesc}</p>
          </section>
        )}

        <section className={styles.mapBlock}>
          <h2 className={styles.sectionHead}>
            <span className={styles.deco}>♢</span> Map
          </h2>
          <div className={styles.mapWrap}>
            <LocationMap
              lat={r.lat}
              lon={r.lon}
              label={r.candidateName}
              zoom={13}
            />
          </div>
          <a
            className={styles.mapsLink}
            href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="この場所を Google マップで開く"
          >
            <span className={styles.mapsLinkIcon} aria-hidden>
              ◉
            </span>
            <span className={styles.mapsLinkLabel}>
              <span className={styles.mapsLinkTitle}>
                Google マップで開く
              </span>
              <span className={styles.mapsLinkSub}>
                ルート検索・ストリートビュー
              </span>
            </span>
            <span className={styles.mapsLinkArrow} aria-hidden>
              ↗
            </span>
          </a>
        </section>

        <ShareButtons
          shareText={buildShareText(r, effectiveDesc)}
        />
      </main>
    </div>
  );
}
