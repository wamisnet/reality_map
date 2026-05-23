"use client";

import { type CharacterPose } from "@/data/character";
import { useCharacterSrc } from "@/hooks/useCharacterSrc";
import styles from "./Character.module.css";

interface Props {
  pose: CharacterPose;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  float?: boolean;
}

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
};

export default function Character({
  pose,
  size = "md",
  className,
  float = false,
}: Props) {
  const src = useCharacterSrc(pose);
  return (
    <div
      className={[
        styles.root,
        SIZE_CLASS[size],
        float ? styles.float : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {src && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt=""
          aria-hidden
          className={styles.img}
          draggable={false}
        />
      )}
    </div>
  );
}
