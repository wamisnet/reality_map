"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { avatarPoseForRank, type CharacterPose } from "@/data/character";
import { useCharacterSrc } from "@/hooks/useCharacterSrc";
import { useVoiceLines } from "@/hooks/useVoiceLines";
import {
  pickVoiceLine,
  type VoiceCategory,
} from "@/data/voice-lines-types";
import type { Phase, Winner } from "@/types";
import styles from "./OperatorAvatar.module.css";

interface Props {
  phase: Phase;
  locked: Winner | null;
  revealRank: boolean;
}

const IDLE_ROTATE_MS = 8000;

function pickPose(
  phase: Phase,
  locked: Winner | null,
  revealRank: boolean,
): CharacterPose {
  if (phase === "scanning") return "avatarPointing";
  if (phase === "locked") {
    // ロック直後〜revealRank までの 400ms は無駄な default 切替を挟まず、
    // スキャン中のポーズ (avatarPointing) のまま保持してランク確定と同時に切り替える。
    if (revealRank && locked?.rank) return avatarPoseForRank(locked.rank);
    return "avatarPointing";
  }
  return "avatarDefault";
}

function ts() {
  return performance.now().toFixed(1);
}

export default function OperatorAvatar({
  phase,
  locked,
  revealRank,
}: Props) {
  const pose = pickPose(phase, locked, revealRank);
  const src = useCharacterSrc(pose);
  const showBadge =
    phase === "locked" && revealRank && locked?.rank ? locked.rank : null;

  const prevPoseRef = useRef<CharacterPose | null>(null);
  const prevSrcRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPoseRef.current !== pose) {
      console.log(
        `[avatar-debug] ${ts()}ms pose change ${prevPoseRef.current ?? "(init)"} -> ${pose} (phase=${phase}, revealRank=${revealRank}, rank=${locked?.rank ?? "-"})`,
      );
      prevPoseRef.current = pose;
    }
    if (prevSrcRef.current !== src) {
      console.log(
        `[avatar-debug] ${ts()}ms src change pose=${pose} url=${src ?? "(none)"}`,
      );
      prevSrcRef.current = src;
    }
  }, [pose, src, phase, revealRank, locked?.rank]);

  // ─── Voice line ──────────────────────────────────────────────────────
  const voiceLines = useVoiceLines();

  // scanning に入るたびに +1。同じ scanning 中は固定。
  const [scanKey, setScanKey] = useState(0);
  useEffect(() => {
    if (phase === "scanning") setScanKey(k => k + 1);
  }, [phase]);

  // idle 中はゆっくりローテーション。idle 以外では止める。
  const [idleTick, setIdleTick] = useState(0);
  useEffect(() => {
    if (phase !== "idle") return;
    const t = window.setInterval(
      () => setIdleTick(n => n + 1),
      IDLE_ROTATE_MS,
    );
    return () => window.clearInterval(t);
  }, [phase]);

  const { category, seed } = useMemo<{
    category: VoiceCategory;
    seed: string;
  }>(() => {
    if (phase === "scanning") return { category: "scanning", seed: `scan-${scanKey}` };
    if (phase === "locked" && revealRank && locked?.rank) {
      return {
        category: `rank${locked.rank}` as VoiceCategory,
        seed: `lock-${locked.at}`,
      };
    }
    return { category: "idle", seed: `idle-${idleTick}` };
  }, [phase, revealRank, locked?.rank, locked?.at, scanKey, idleTick]);

  const message = useMemo(
    () => pickVoiceLine(voiceLines[category], seed),
    [voiceLines, category, seed],
  );

  return (
    <div className={styles.root} aria-hidden>
      <div
        className={`${styles.circle} ${showBadge ? styles.celebrating : ""}`}
        data-phase={phase}
      >
        {src && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt=""
            className={styles.img}
            draggable={false}
            onLoad={() =>
              console.log(`[avatar-debug] ${ts()}ms <img> onLoad pose=${pose} url=${src}`)
            }
            onError={() =>
              console.log(`[avatar-debug] ${ts()}ms <img> ONERROR pose=${pose} url=${src}`)
            }
          />
        )}
      </div>
      {showBadge && (
        <span
          className={`${styles.badge} ${styles[`rank${showBadge}`] ?? ""}`}
          aria-hidden
        >
          {showBadge}
        </span>
      )}
      {message && (
        <div
          key={`${category}-${seed}`}
          className={styles.message}
          data-category={category}
        >
          {message}
        </div>
      )}
    </div>
  );
}
