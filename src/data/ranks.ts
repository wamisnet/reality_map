import type { Rank } from "@/types";

/**
 * S/A/B/C のランク付けの意味付け。
 * 編集画面・公開画面の凡例で共通参照する単一の真実 (single source of truth)。
 *
 * オペレーターが地図に登録するときに迷わないよう、4つの独立したカテゴリに整理:
 *   S: 超おすすめ
 *   A: 行ったことがある
 *   B: 気になっているところ
 *   C: 安定の場所
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
    short: "超おすすめ",
    long: "配信者がイチオシしたい、特別に強くおすすめしたい場所。",
    operatorHint: "ここはぜひ紹介したい、という一押しの場所に。",
  },
  A: {
    short: "行ったことがある",
    long: "配信者が実際に訪れたことのある、体験ベースで話せる場所。",
    operatorHint: "訪問経験あり。自分の言葉で語れる場所に。",
  },
  B: {
    short: "気になっているところ",
    long: "まだ行っていないけれど、気になっていて行ってみたい場所。",
    operatorHint: "未訪問だが関心あり。話題のきっかけにしたい場所に。",
  },
  C: {
    short: "安定の場所",
    long: "外れがなく、安心して紹介できる定番の場所。",
    operatorHint: "定番・安定枠。迷ったときに入れておける候補に。",
  },
};

export const RANK_ORDER: ReadonlyArray<Rank> = ["S", "A", "B", "C"];
