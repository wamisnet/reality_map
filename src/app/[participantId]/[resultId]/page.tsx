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
import { fetchResultById, isValidParticipantId } from "@/lib/results";
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

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { participantId, resultId } = await params;
  const r = await loadResult(participantId, resultId);
  if (!r) return { title: "Not found" };
  const title = `${r.participantName} さんは「${r.candidateName}」が選ばれたよ · 咲月わみの旅ガチャ`;
  const desc = `${r.pref} · ${r.candidateName}${r.rank ? ` (RANK ${r.rank})` : ""} が選ばれました。`;
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
  const placeLabel = r.category ?? r.pref;
  const pose = poseForRank(r.rank);
  const voiceLine = await voiceLineFor(r.rank, r.id);
  const images = getCandidateImages(r);

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

        {r.desc && (
          <section className={styles.descBlock}>
            <h2 className={styles.sectionHead}>
              <span className={styles.deco}>♡</span> About this place
            </h2>
            <p className={styles.descBody}>{r.desc}</p>
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
          shareText={`${r.participantName} さんは ${r.pref}・${r.candidateName}${r.rank ? ` (RANK ${r.rank})` : ""} が選ばれたよ`}
        />
      </main>
    </div>
  );
}
