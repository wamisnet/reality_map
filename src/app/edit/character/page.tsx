"use client";

import { useCallback, useEffect, useState } from "react";
import { CHARACTER_SRC, type CharacterPose } from "@/data/character";
import { invalidateCharacterManifest } from "@/hooks/useCharacterSrc";
import editStyles from "@/components/edit/Edit.module.css";
import styles from "./page.module.css";

interface PoseEntry {
  key: CharacterPose;
  label: string;
  description: string;
}

interface PoseSection {
  title: string;
  hint: string;
  aspectHint: string;
  entries: ReadonlyArray<PoseEntry>;
}

const POSE_SECTIONS: ReadonlyArray<PoseSection> = [
  {
    title: "Full body — 公開ページ用 (大きい表示)",
    hint: "TOPページ・参加者リスト・結果詳細・OGP で使用",
    aspectHint: "縦長 (約 240 × 340)・背景透過 PNG / SVG 推奨",
    entries: [
      {
        key: "default",
        label: "default",
        description: "TOPページのヒーロー画像。サイトの第一印象。",
      },
      {
        key: "pointing",
        label: "pointing",
        description: "参加者リストページのナビゲーター。",
      },
      {
        key: "rankS",
        label: "rank · S",
        description: "結果詳細ページの S ランク反応 + OGP。",
      },
      {
        key: "rankA",
        label: "rank · A",
        description: "A ランク当選時のリアクション。",
      },
      {
        key: "rankB",
        label: "rank · B",
        description: "B ランク当選時のリアクション。",
      },
      {
        key: "rankC",
        label: "rank · C",
        description: "C ランク当選時のリアクション。",
      },
    ],
  },
  {
    title: "Avatar — /ops 用 (小さい円形アイコン)",
    hint: "オペレーターコンソール右上の 86×86 円形アバター用に、顔/上半身に寄せた別カット",
    aspectHint: "正方形 (約 240 × 240)・背景透過推奨。顔を中央に",
    entries: [
      {
        key: "avatarDefault",
        label: "avatar · default",
        description: "/ops 待機 (idle) 時の表情。",
      },
      {
        key: "avatarPointing",
        label: "avatar · pointing",
        description: "/ops スキャン中 (scanning) の集中した表情。",
      },
      {
        key: "avatarRankS",
        label: "avatar · rank S",
        description: "/ops の S ランク当選時。",
      },
      {
        key: "avatarRankA",
        label: "avatar · rank A",
        description: "/ops の A ランク当選時。",
      },
      {
        key: "avatarRankB",
        label: "avatar · rank B",
        description: "/ops の B ランク当選時。",
      },
      {
        key: "avatarRankC",
        label: "avatar · rank C",
        description: "/ops の C ランク当選時。",
      },
    ],
  },
];

const POSE_ENTRIES: ReadonlyArray<PoseEntry> = POSE_SECTIONS.flatMap(
  s => s.entries,
);

type Manifest = Partial<Record<CharacterPose, string>>;

async function fetchManifest(): Promise<Manifest> {
  try {
    const res = await fetch("/character/manifest.json", { cache: "no-store" });
    if (!res.ok) return {};
    return (await res.json()) as Manifest;
  } catch {
    return {};
  }
}

export default function EditCharacterPage() {
  const [manifest, setManifest] = useState<Manifest>({});
  const [busy, setBusy] = useState<CharacterPose | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Cache-busting key for <img> so newly uploaded files render immediately
  const [cacheBust, setCacheBust] = useState(0);

  useEffect(() => {
    void fetchManifest().then(setManifest);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(prev => (prev === msg ? null : prev)), 2200);
  };

  const refresh = useCallback(async () => {
    const m = await fetchManifest();
    setManifest(m);
    setCacheBust(v => v + 1);
    invalidateCharacterManifest();
  }, []);

  const onUpload = useCallback(
    async (pose: CharacterPose, file: File) => {
      setError(null);
      setBusy(pose);
      try {
        const body = new FormData();
        body.append("pose", pose);
        body.append("file", file);
        const res = await fetch("/api/upload-character-image", {
          method: "POST",
          body,
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        await refresh();
        showToast(`uploaded · ${pose}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const onReset = useCallback(
    async (pose: CharacterPose) => {
      if (!confirm(`${pose} をプレースホルダーに戻しますか?`)) return;
      setError(null);
      setBusy(pose);
      try {
        const res = await fetch(
          `/api/upload-character-image?pose=${encodeURIComponent(pose)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        await refresh();
        showToast(`reset · ${pose}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const renderEntry = (entry: PoseEntry) => {
    const customSrc = manifest[entry.key];
    const isCustom = Boolean(customSrc);
    const placeholderSrc = CHARACTER_SRC[entry.key];
    const displaySrc = customSrc ?? placeholderSrc;
    const isBusy = busy === entry.key;
    return (
      <div key={entry.key} className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.poseLabel}>{entry.label}</span>
          {isCustom ? (
            <span className={`${styles.badge} ${styles.badgeCustom}`}>
              customized
            </span>
          ) : (
            <span className={`${styles.badge} ${styles.badgePlaceholder}`}>
              placeholder
            </span>
          )}
        </div>

        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${displaySrc}?v=${cacheBust}`}
            alt={entry.key}
            className={styles.previewImg}
          />
        </div>

        <p className={styles.desc}>{entry.description}</p>

        <div className={styles.actions}>
          <label
            className={`${editStyles.btn} ${editStyles.btnPrimary} ${styles.uploadBtn}`}
          >
            {isBusy ? "uploading…" : "↑ upload"}
            <input
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
              className={styles.hiddenInput}
              disabled={isBusy}
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onUpload(entry.key, file);
              }}
            />
          </label>
          {isCustom && (
            <button
              type="button"
              className={`${editStyles.btn} ${editStyles.btnDanger}`}
              onClick={() => void onReset(entry.key)}
              disabled={isBusy}
            >
              reset
            </button>
          )}
        </div>

        {customSrc && (
          <div className={styles.pathRow}>
            <code className={styles.pathCode}>{customSrc}</code>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={editStyles.page}>
      <div className={editStyles.heading}>
        <span className={editStyles.title}>Character</span>
        <span className={editStyles.subtitle}>
          {POSE_ENTRIES.length} slots · {Object.keys(manifest).length} customized
        </span>
      </div>

      <div className={editStyles.note}>
        <p>
          公開ページや /ops のオペレーターアバターで表示されるキャラクター画像を、ポーズごとにアップロードできます。
          <strong>全身用</strong>と<strong>アバター用(/opsの小さい円形)</strong>は表示エリアが大きく違うので、それぞれ最適なカットを別画像として登録できます。
        </p>
        <ul>
          <li>
            アップロードした画像は <code>public/character/uploads/</code>{" "}
            に保存され、<code>manifest.json</code> に反映されます。プレースホルダーSVGは残ったままで、いつでも「リセット」で戻せます。
          </li>
          <li>
            対応形式: <code>SVG</code> / <code>PNG</code> / <code>JPG</code> /{" "}
            <code>WEBP</code> / <code>GIF</code> (最大 8MB)
          </li>
          <li>
            <em>
              この機能は <code>next dev</code> のローカル開発時のみ動作します。本番デプロイ環境ではアップロードできません(git で公開すると配信されます)。
            </em>
          </li>
        </ul>
      </div>

      {POSE_SECTIONS.map(section => (
        <section key={section.title} className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            <p className={styles.sectionHint}>
              {section.hint} · 推奨: {section.aspectHint}
            </p>
          </div>
          <div className={styles.grid}>
            {section.entries.map(renderEntry)}
          </div>
        </section>
      ))}

      {error && (
        <div className={styles.error}>
          <strong>ERROR</strong>
          <span>{error}</span>
          <button
            type="button"
            className={styles.errorClose}
            onClick={() => setError(null)}
            aria-label="dismiss"
          >
            ×
          </button>
        </div>
      )}

      {toast && <div className={editStyles.toast}>{toast}</div>}
    </div>
  );
}
