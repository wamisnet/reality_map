"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ImageCarousel.module.css";

interface Props {
  images: ReadonlyArray<string>;
  alt: string;
  /** 自動進行間隔 (ms)。0 か未指定で自動進行しない。 */
  autoMs?: number;
  /** ユーザー操作後に自動進行を再開するか (default false: 一度操作したら停止) */
  resumeAfterUserMs?: number;
  /** 画像のフィット方法 (default "cover") */
  fit?: "cover" | "contain";
  className?: string;
  /** アスペクト比 (例: "16/9"). 指定するとそのアスペクトでスロットが固定される。 */
  aspectRatio?: string;
}

const SWIPE_THRESHOLD_PX = 40;

/**
 * 複数枚画像のスライダー。
 * - autoMs を指定すると自動進行 (デフォルトは無し)。ユーザー操作で停止。
 * - 画像クリック / タップでも次へ進む。
 * - 左右スワイプで前後移動 (touch)。
 * - prev/next ボタン + ドットインジケーター付き。
 *
 * 画像 1 枚のときはコントロールを出さない。0 枚のときは何も描画しない。
 */
export default function ImageCarousel({
  images,
  alt,
  autoMs,
  resumeAfterUserMs = 0,
  fit = "cover",
  className,
  aspectRatio,
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const count = images.length;

  // images が変わったら index を範囲内に丸める
  useEffect(() => {
    if (count === 0) return;
    setIndex(i => (i >= count ? 0 : i));
  }, [count]);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  const onUserInteract = useCallback(() => {
    setPaused(true);
    if (resumeAfterUserMs > 0) {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
      resumeTimerRef.current = window.setTimeout(() => {
        setPaused(false);
        resumeTimerRef.current = null;
      }, resumeAfterUserMs);
    }
  }, [resumeAfterUserMs]);

  // 自動進行
  useEffect(() => {
    if (!autoMs || autoMs <= 0 || paused || count <= 1) return;
    const t = window.setInterval(() => {
      setIndex(i => (i + 1) % count);
    }, autoMs);
    return () => window.clearInterval(t);
  }, [autoMs, paused, count]);

  useEffect(
    () => () => {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
    },
    [],
  );

  if (count === 0) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartXRef.current;
    touchStartXRef.current = null;
    if (start === null) return;
    const end = e.changedTouches[0]?.clientX;
    if (typeof end !== "number") return;
    const dx = end - start;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    onUserInteract();
    if (dx < 0) goNext();
    else goPrev();
  };

  const handleImageClick = () => {
    if (count <= 1) return;
    onUserInteract();
    goNext();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (count <= 1) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onUserInteract();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onUserInteract();
      goPrev();
    }
  };

  const styleVars = aspectRatio
    ? ({ aspectRatio } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={`${styles.root} ${className ?? ""}`}
      style={styleVars}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role={count > 1 ? "group" : undefined}
      aria-roledescription={count > 1 ? "carousel" : undefined}
      aria-label={count > 1 ? `${alt} (${count} 枚)` : undefined}
      tabIndex={count > 1 ? 0 : -1}
      onKeyDown={handleKey}
    >
      <div className={styles.slider}>
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${i}`}
            src={src}
            alt={i === 0 ? alt : `${alt} (${i + 1}/${count})`}
            className={`${styles.slide} ${
              fit === "contain" ? styles.slideContain : styles.slideCover
            } ${i === index ? styles.slideActive : ""}`}
            onClick={handleImageClick}
            draggable={false}
            onError={e => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navPrev}`}
            onClick={e => {
              e.stopPropagation();
              onUserInteract();
              goPrev();
            }}
            aria-label="前の画像"
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navNext}`}
            onClick={e => {
              e.stopPropagation();
              onUserInteract();
              goNext();
            }}
            aria-label="次の画像"
          >
            ›
          </button>

          <div className={styles.dots} aria-hidden>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
                onClick={e => {
                  e.stopPropagation();
                  onUserInteract();
                  goTo(i);
                }}
                aria-label={`${i + 1} 枚目を表示`}
              />
            ))}
          </div>

          <div className={styles.count}>
            {index + 1} / {count}
          </div>
        </>
      )}
    </div>
  );
}
