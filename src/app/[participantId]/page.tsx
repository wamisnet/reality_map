import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Character from "@/components/public/Character";
import PublicPageHeader from "@/components/public/PublicPageHeader";
import RankLegend from "@/components/RankLegend";
import { fetchResultsByParticipantId, isValidParticipantId } from "@/lib/results";
import styles from "./page.module.css";

interface PageProps {
  params: Promise<{ participantId: string }>;
}

// このページは Vercel 上で SSR されるため、Vercel のデフォルト TZ (UTC) を避け、
// 明示的に Asia/Tokyo で整形する。視聴者は日本にいる前提なので JST 固定で問題ない。
const JST_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23", // 深夜を "00" にする (ja-JP デフォルトは "h24" の処理系がある)
});

function formatDate(d: Date | null, fallback: string): string {
  if (!d) return fallback;
  const parts = JST_FORMATTER.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { participantId } = await params;
  if (!isValidParticipantId(participantId)) return { title: "Not found" };
  const results = await fetchResultsByParticipantId(participantId).catch(() => []);
  const name = results[0]?.participantName ?? participantId;
  const n = results.length;
  return {
    title: `${name} さんの結果 (${n}件) · 咲月わみの旅ガチャ`,
    description: `${name} さんの抽選結果リスト。咲月わみの旅ガチャの公開ページ。`,
    openGraph: {
      title: `${name} さんの結果 (${n}件)`,
      description: `咲月わみの旅ガチャ で抽選された ${n}件の当選地`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} さんの結果 (${n}件)`,
      description: `咲月わみの旅ガチャ で抽選された ${n}件の当選地`,
    },
  };
}

export default async function ParticipantPage({ params }: PageProps) {
  const { participantId } = await params;
  if (!isValidParticipantId(participantId)) notFound();

  const results = await fetchResultsByParticipantId(participantId);
  const participantName = results[0]?.participantName ?? null;

  return (
    <div className={styles.root}>
      <div className={styles.blob1} aria-hidden />
      <div className={styles.blob2} aria-hidden />

      <main className={styles.main}>
        <PublicPageHeader
          title="トップへ戻る"
          subtitle="咲月わみの旅ガチャ"
          href="/"
          back
        />

        <section className={styles.hero}>
          <div className={styles.heroHead}>
            <div className={styles.heroLabel}>PARTICIPANT</div>
            <h1 className={styles.heroName}>
              {participantName ?? <span className={styles.dim}>UNKNOWN</span>}
            </h1>
            <div className={styles.heroCount}>{results.length} 件の結果</div>
          </div>

          <div className={styles.charBlock}>
            <Character pose="pointing" size="md" float />
            <p className={styles.voiceLine}>
              {participantName
                ? `${participantName} さんの結果リストだよ♪`
                : "このIDの結果はまだないみたい…"}
            </p>
          </div>
        </section>

        {results.length === 0 ? (
          <p className={styles.empty}>
            このIDの抽選結果はまだ登録されていません。
          </p>
        ) : (
          <>
            <div className={styles.legendWrap}>
              <RankLegend variant="compact" title="ランクの意味" />
            </div>
            <ul className={styles.list}>
            {results.map((r, i) => (
              <li key={r.id} className={styles.item}>
                <Link href={`/${participantId}/${r.id}`} className={styles.itemLink}>
                  <span className={styles.index}>
                    #{String(results.length - i).padStart(3, "0")}
                  </span>
                  <span className={styles.cityCol}>
                    <span className={styles.pref}>{r.pref}</span>
                    <span className={styles.city}>{r.candidateName}</span>
                  </span>
                  {r.rank && (
                    <span
                      className={`${styles.rank} ${styles[`rank${r.rank}`] ?? ""}`}
                      aria-label={`Rank ${r.rank}`}
                    >
                      {r.rank}
                    </span>
                  )}
                  <span className={styles.when}>
                    {formatDate(r.createdAt, r.at)}
                  </span>
                  <span className={styles.chevron} aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
