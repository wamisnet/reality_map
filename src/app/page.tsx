"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { isValidParticipantId } from "@/lib/results";
import Character from "@/components/public/Character";
import SpeechBubble from "@/components/public/SpeechBubble";
import PublicPageHeader from "@/components/public/PublicPageHeader";
import RankLegend from "@/components/RankLegend";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = id.trim().toLowerCase();
      if (!trimmed) {
        setError("IDを入力してください");
        return;
      }
      if (!isValidParticipantId(trimmed)) {
        setError("IDは英数字 6〜16 文字です");
        return;
      }
      setError(null);
      router.push(`/${trimmed}`);
    },
    [id, router],
  );

  return (
    <div className={styles.root}>
      <div className={styles.blob1} aria-hidden />
      <div className={styles.blob2} aria-hidden />
      <div className={styles.blob3} aria-hidden />

      <main className={styles.main}>
        <PublicPageHeader title="咲月わみの旅ガチャ" linkToHome={false} />

        <section className={styles.hero}>
          <div className={styles.heroChar}>
            <Character pose="default" size="xl" float />
          </div>

          <div className={styles.heroPanel}>
            <SpeechBubble pointer="left" tone="pink">
              こんにちは! <br />
              あなたのIDを入れて、抽選結果を見にいきましょ♪
            </SpeechBubble>

            <form className={styles.form} onSubmit={onSubmit}>
              <label className={styles.fieldLabel} htmlFor="participantId">
                Participant ID
              </label>
              <div className={styles.row}>
                <input
                  id="participantId"
                  className={styles.input}
                  type="text"
                  value={id}
                  onChange={e => setId(e.target.value)}
                  placeholder="abcd1234"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={16}
                />
                <button className={styles.btn} type="submit">
                  けっかを みる
                </button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <p className={styles.hint}>
                IDは英数字 6〜16文字 (例: <code>k4f9q2x1</code>)
              </p>
            </form>
          </div>
        </section>

        <section className={styles.about}>
          <h2 className={styles.aboutHead}>
            <span className={styles.aboutDeco}>♡</span> About
          </h2>
          <p className={styles.aboutBody}>
            このサイトでは、ライブ配信中におこなわれる「咲月わみの旅ガチャ」の抽選結果を公開しています。
            あなた専用のIDから、過去に抽選された旅の行き先や、それぞれの場所の情報を見ることができます。
            SNSでお気に入りの結果をシェアして応援を伝えてね!
          </p>
          <p className={styles.aboutBody}>
            それぞれの場所には <strong>S / A / B / C</strong>{" "}
            のランクが付いています。配信者自身がどれくらいその場所を「推している」かを表していて、
            S に近いほど思い入れが強い場所です。
          </p>
          <div className={styles.rankLegendWrap}>
            <RankLegend variant="detailed" title="ランクの意味" />
          </div>
        </section>

        <footer className={styles.foot}>
          <Link href="/ops" className={styles.opsLink}>
            ▶ operator console
          </Link>
        </footer>
      </main>
    </div>
  );
}
