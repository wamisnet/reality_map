import Link from "next/link";
import styles from "./PublicPageHeader.module.css";

interface Props {
  /** 大きく見せる文字列 (ホーム=ブランド名, 一覧=参加者名, 詳細=場所名 など) */
  title: string;
  /** 補足の小さい行 (例: "旅ガチャ" や "旅ガチャ · ◯◯ さん") */
  subtitle?: string;
  /** ホームへのリンクにするか (デフォルト true)。ホーム自体では false 推奨 */
  linkToHome?: boolean;
  /** リンク先を明示的に指定する場合 (linkToHome より優先) */
  href?: string;
  /** 戻るボタンとして使う場合 (✦ の代わりに ← を表示) */
  back?: boolean;
}

/**
 * 公開ページのヘッダー帯。
 * ホーム→ブランド名, 参加者一覧→参加者名, 詳細→場所名 を出すための
 * 共通スロット。subtitle に「旅ガチャ」を入れてブランド感を保つ。
 */
export default function PublicPageHeader({
  title,
  subtitle,
  linkToHome = true,
  href,
  back = false,
}: Props) {
  const inner = (
    <>
      <span className={back ? styles.arrow : styles.star} aria-hidden>
        {back ? "←" : "✦"}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </>
  );

  const target = href ?? (linkToHome ? "/" : null);
  if (target) {
    return (
      <header className={styles.header}>
        <Link
          href={target}
          className={`${styles.link} ${back ? styles.linkBack : ""}`}
        >
          {inner}
        </Link>
      </header>
    );
  }

  return <header className={styles.header}>{inner}</header>;
}
