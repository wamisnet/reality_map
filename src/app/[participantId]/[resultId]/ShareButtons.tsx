"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

interface Props {
  shareText: string;
}

export default function ShareButtons({ shareText }: Props) {
  const [url, setUrl] = useState("");
  const [ogUrl, setOgUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrl(window.location.href);

    // Next.js が opengraph-image.tsx から自動生成する <meta property="og:image">
    // をそのまま使う。無ければパス末尾に /opengraph-image を付けたパスにフォールバック。
    const meta = document.querySelector(
      'meta[property="og:image"]',
    ) as HTMLMetaElement | null;
    if (meta?.content) {
      setOgUrl(meta.content);
    } else {
      const trimmed = window.location.pathname.replace(/\/$/, "");
      setOgUrl(`${trimmed}/opengraph-image`);
    }
  }, []);

  const onCopy = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // noop
    }
  }, [url]);

  const twitterHref = url
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
    : "#";

  return (
    <>
      <div className={styles.shareBar}>
        <a
          className={`${styles.shareBtn} ${styles.shareBtnPrimary}`}
          href={ogUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!ogUrl}
          aria-label="シェア用画像を開く"
        >
          ↗ シェア用画像を開く
        </a>
        <a
          className={styles.shareBtn}
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          X (Twitter) に投稿
        </a>
        <button
          className={styles.shareBtn}
          type="button"
          onClick={onCopy}
          disabled={!url}
        >
          {copied ? "✓ Copied" : "URL コピー"}
        </button>
      </div>
      <p className={styles.shareNote}>
        画像はスマホなら長押し、PC なら右クリック →
        「画像を保存」で保存できます。
      </p>
    </>
  );
}
