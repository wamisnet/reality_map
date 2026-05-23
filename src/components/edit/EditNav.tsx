"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./EditNav.module.css";

export default function EditNav() {
  const pathname = usePathname();
  const isCandidates = pathname === "/edit";
  const isMap = pathname?.startsWith("/edit/map");
  const isCharacter = pathname?.startsWith("/edit/character");
  const isVoice = pathname?.startsWith("/edit/voice-lines");
  const isParticipants = pathname?.startsWith("/edit/participants");
  return (
    <nav className={styles.nav}>
      <span className={styles.brand}>咲月わみの旅ガチャ · ADMIN</span>
      <Link
        href="/edit"
        className={`${styles.link} ${isCandidates ? styles.linkActive : ""}`}
      >
        Candidates
      </Link>
      <Link
        href="/edit/map"
        className={`${styles.link} ${isMap ? styles.linkActive : ""}`}
      >
        Map
      </Link>
      <Link
        href="/edit/character"
        className={`${styles.link} ${isCharacter ? styles.linkActive : ""}`}
      >
        Character
      </Link>
      <Link
        href="/edit/voice-lines"
        className={`${styles.link} ${isVoice ? styles.linkActive : ""}`}
      >
        Voice
      </Link>
      <Link
        href="/edit/participants"
        className={`${styles.link} ${isParticipants ? styles.linkActive : ""}`}
      >
        Participants
      </Link>
      <span className={styles.spacer} />
      <Link href="/" className={styles.back}>
        ← console
      </Link>
    </nav>
  );
}
