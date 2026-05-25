import Link from "next/link";
import { notFound } from "next/navigation";
import RankBadge from "@/components/RankBadge";
import {
  fetchAllCandidatesLite,
  fetchCandidateRankCounts,
  fetchCandidateRanksByIds,
  type CandidateLite,
} from "@/lib/candidates-store";
import {
  computeRankHits,
  fetchResultsByParticipantId,
  isValidParticipantId,
  uniqueCandidateIds,
} from "@/lib/results";
import { RANK_INFO, RANK_ORDER } from "@/data/ranks";
import type { Rank } from "@/types";
import editStyles from "@/components/edit/Edit.module.css";
import styles from "./page.module.css";

interface PageProps {
  params: Promise<{ participantId: string }>;
}

/**
 * 未取得候補をランク別にグループ化する。
 *
 * 引数の allCandidates は **現在の** マスタ、drawnIds は参加者が引いた candidateId
 * のユニーク集合。すなわち「未取得」は「現存し、かつこの participant がまだ
 * 1 度も引いていない」候補を意味する。
 */
function groupMissingByRank(
  allCandidates: ReadonlyArray<CandidateLite>,
  drawnIds: ReadonlySet<string>,
): Record<Rank, CandidateLite[]> {
  const out: Record<Rank, CandidateLite[]> = { S: [], A: [], B: [], C: [] };
  for (const c of allCandidates) {
    if (drawnIds.has(c.id)) continue;
    out[c.rank].push(c);
  }
  return out;
}

export default async function ParticipantCompletionPage({ params }: PageProps) {
  const { participantId } = await params;
  if (!isValidParticipantId(participantId)) notFound();

  const results = await fetchResultsByParticipantId(participantId);
  const participantName = results[0]?.participantName ?? participantId;

  const drawnIds = uniqueCandidateIds(results);
  const drawnSet = new Set(drawnIds);

  const [totals, liveRanks, allCandidates] = await Promise.all([
    fetchCandidateRankCounts().catch(() => ({ S: 0, A: 0, B: 0, C: 0 })),
    fetchCandidateRanksByIds(drawnIds).catch(() => new Map<string, Rank>()),
    fetchAllCandidatesLite().catch(() => [] as CandidateLite[]),
  ]);
  const hits = computeRankHits(results, liveRanks);
  const missingByRank = groupMissingByRank(allCandidates, drawnSet);

  return (
    <div className={editStyles.page}>
      <div className={editStyles.heading}>
        <span className={editStyles.title}>Completion</span>
        <span className={editStyles.subtitle}>
          {participantName} · {participantId} · {results.length} draws
        </span>
      </div>

      <div className={editStyles.actions}>
        <Link href="/edit/participants" className={editStyles.btn}>
          ← Participants
        </Link>
        <a
          href={`/${participantId}`}
          className={editStyles.btn}
          target="_blank"
          rel="noreferrer"
        >
          公開ページを開く ↗
        </a>
      </div>

      <section className={styles.summary} aria-label="ランク別の充足状況">
        <ul className={styles.summaryRow}>
          {RANK_ORDER.map(r => {
            const hit = hits[r];
            const total = totals[r];
            const missing = Math.max(0, total - hit);
            const pct = total > 0 ? Math.round((hit / total) * 100) : 0;
            return (
              <li key={r} className={styles.summaryCell}>
                <div className={styles.summaryHead}>
                  <RankBadge rank={r} size="sm" />
                  <span className={styles.summaryLabel}>
                    {RANK_INFO[r].short}
                  </span>
                </div>
                <div className={styles.summaryNums}>
                  <span className={styles.numHit}>{hit}</span>
                  <span className={styles.numSlash}>/</span>
                  <span className={styles.numTotal}>{total}</span>
                  {total > 0 && (
                    <span className={styles.numPct}>({pct}%)</span>
                  )}
                </div>
                <div className={styles.summaryMissing}>
                  未取得 <strong>{missing}</strong> 件
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {RANK_ORDER.map(r => {
        const list = missingByRank[r];
        return (
          <details
            key={r}
            className={styles.rankBlock}
            open={list.length > 0 && list.length <= 30}
          >
            <summary className={styles.rankSummary}>
              <RankBadge rank={r} size="sm" />
              <span className={styles.rankLabel}>{RANK_INFO[r].short}</span>
              <span className={styles.rankCount}>
                未取得 {list.length} 件 / マスタ {totals[r]} 件
              </span>
            </summary>
            {list.length === 0 ? (
              <p className={styles.emptyText}>
                このランクは全て引いています ✓
              </p>
            ) : (
              <ul className={styles.list}>
                {list.map(c => (
                  <li key={c.id} className={styles.item}>
                    <span className={styles.pref}>{c.pref}</span>
                    <span className={styles.name}>{c.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
    </div>
  );
}
