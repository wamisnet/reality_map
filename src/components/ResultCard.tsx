import {
  getCandidateImages,
  type Candidate,
  type FormattedCoord,
  type Phase,
  type ResultStyle,
  type Winner,
} from "@/types";
import RankBadge from "./RankBadge";
import ImageCarousel from "./ImageCarousel";
import styles from "./ResultCard.module.css";

interface Props {
  phase: Phase;
  display: Candidate;
  locked: Winner | null;
  revealDetail: boolean;
  revealRank: boolean;
  resultStyle: ResultStyle;
  coord: FormattedCoord;
}

export default function ResultCard({
  phase,
  display,
  locked,
  revealDetail,
  revealRank,
  resultStyle,
  coord,
}: Props) {
  const lockedImages = locked ? getCandidateImages(locked) : [];
  const showDetail =
    phase === "locked" &&
    locked &&
    revealDetail &&
    (lockedImages.length > 0 || locked.desc);

  const wide = !!showDetail;
  const isLocked = phase === "locked";
  const showRank = isLocked && locked && revealRank;

  const classes = [styles.root, wide ? styles.wide : "", isLocked ? styles.locked : ""]
    .filter(Boolean)
    .join(" ");

  const tag = display.pref;

  return (
    <div className={classes}>
      {resultStyle !== "minimal" && (
        <div className={styles.pref}>{tag}</div>
      )}
      {resultStyle !== "minimal" && (
        <div className={styles.nameRow}>
          <div className={`${styles.name} ${isLocked ? styles.nameHit : ""}`}>
            {phase === "scanning"
              ? display.name
              : phase === "locked" && locked
                ? locked.name
                : "—"}
          </div>
          {showRank && (
            <div className={styles.rankSlot} key={`rank-${locked!.at}`}>
              <RankBadge rank={locked!.rank} size="lg" popOnMount />
            </div>
          )}
        </div>
      )}
      {showDetail && locked && (
        <div className={styles.detail} key={locked.at}>
          {lockedImages.length > 0 && (
            <div className={styles.detailImg}>
              <ImageCarousel
                images={lockedImages}
                alt={locked.name}
                autoMs={lockedImages.length > 1 ? 3500 : 0}
                resumeAfterUserMs={6000}
                fit="cover"
              />
            </div>
          )}
          {locked.desc && (
            <div className={styles.detailDesc}>{locked.desc}</div>
          )}
        </div>
      )}
      <div className={styles.coords}>
        <span className={styles.k}>LAT</span>
        {coord.lat}
      </div>
      <div className={styles.coords}>
        <span className={styles.k}>LON</span>
        {coord.lon}
      </div>
      {resultStyle === "detailed" && (
        <>
          <div className={styles.coords} style={{ marginTop: 6, opacity: 0.7 }}>
            <span className={styles.k}>DEC</span>
            {coord.dec}
          </div>
          <div className={styles.coords} style={{ opacity: 0.55 }}>
            <span className={styles.k}>EVT</span>
            {phase === "locked"
              ? "LOCKED"
              : phase === "scanning"
                ? "SCANNING"
                : "IDLE"}
          </div>
        </>
      )}
    </div>
  );
}
