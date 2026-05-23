import type { Rank } from "@/types";

/**
 * S/A/B/C のランク付けの意味付け。
 * 編集画面・公開画面の凡例で共通参照する単一の真実 (single source of truth)。
 *
 * 軸: 自分の体験の濃さ × 推し度
 *   S/A は「自分の体験ベース」(行った / 気になっている)
 *   B/C は「情報ベース」(人や記事から知った / 地域カバー)
 */
export interface RankInfo {
  /** 編集画面のチップ凡例で出す短い説明 (〜18文字) */
  short: string;
  /** 公開ホーム About 等で読み物的に出す説明 (1〜2行) */
  long: string;
  /** オペレーターの判断補助 (編集画面で出す, 〜40文字) */
  operatorHint: string;
}

export const RANK_INFO: Record<Rank, RankInfo> = {
  S: {
    short: "行った & おすすめ",
    long: "配信者が実際に行ったことがあって、強くおすすめしたい場所。",
    operatorHint: "実体験あり。視聴者にも自信を持って勧められる場所。",
  },
  A: {
    short: "気になる / 行った",
    long: "気になっていて行ってみたい、もしくは一度行ったことがある場所。",
    operatorHint: "個人的な関心がある。S ほど強くは推さないが思い入れあり。",
  },
  B: {
    short: "人づて・記事で知った",
    long: "まだ自分では行っていないけれど、人や記事から知って気になった場所。",
    operatorHint: "間接的に知った場所。話題のきっかけにしたいもの。",
  },
  C: {
    short: "地域カバーの候補",
    long: "プールの偏りをならすために入れている、地域カバー用の中立的な候補。",
    operatorHint: "中立。地域や種類の幅を出すための候補。",
  },
};

export const RANK_ORDER: ReadonlyArray<Rank> = ["S", "A", "B", "C"];
