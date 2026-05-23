"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_VOICE_LINES,
  VOICE_CATEGORIES,
  normalizeVoiceLines,
  type VoiceCategory,
  type VoiceLines,
} from "@/data/voice-lines-types";
import { invalidateVoiceLines } from "@/hooks/useVoiceLines";
import editStyles from "@/components/edit/Edit.module.css";
import styles from "./page.module.css";

interface CategoryMeta {
  key: VoiceCategory;
  label: string;
  hint: string;
}

const CATEGORY_META: ReadonlyArray<CategoryMeta> = [
  {
    key: "idle",
    label: "idle · 待機中",
    hint: "誰も抽選していない時にローテーション表示。約 8 秒ごとに切替。",
  },
  {
    key: "scanning",
    label: "scanning · 抽選中",
    hint: "FIRE 直後〜結果ロックまで。スキャン開始時にランダムで 1 つ選ぶ。",
  },
  {
    key: "rankS",
    label: "rank · S",
    hint: "S ランク当選時の一言。1 抽選につき 1 つランダム。",
  },
  {
    key: "rankA",
    label: "rank · A",
    hint: "A ランク当選時の一言。",
  },
  {
    key: "rankB",
    label: "rank · B",
    hint: "B ランク当選時の一言。",
  },
  {
    key: "rankC",
    label: "rank · C",
    hint: "C ランク当選時の一言。",
  },
];

type Draft = Record<VoiceCategory, string>;

function toDraft(lines: VoiceLines): Draft {
  const d = {} as Draft;
  for (const cat of VOICE_CATEGORIES) {
    d[cat] = (lines[cat] ?? []).join("\n");
  }
  return d;
}

function fromDraft(d: Draft): VoiceLines {
  const out = { ...EMPTY_VOICE_LINES };
  for (const cat of VOICE_CATEGORIES) {
    out[cat] = (d[cat] ?? "")
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  return out;
}

export default function EditVoiceLinesPage() {
  const [draft, setDraft] = useState<Draft>(() => toDraft(EMPTY_VOICE_LINES));
  const [saved, setSaved] = useState<Draft>(() => toDraft(EMPTY_VOICE_LINES));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(prev => (prev === msg ? null : prev)), 2200);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/voice-lines", { cache: "no-store" });
      const j = res.ok ? ((await res.json()) as unknown) : {};
      const lines = normalizeVoiceLines(j);
      const d = toDraft(lines);
      setDraft(d);
      setSaved(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(
    () => VOICE_CATEGORIES.some(c => draft[c] !== saved[c]),
    [draft, saved],
  );

  const counts = useMemo(() => {
    const out = {} as Record<VoiceCategory, number>;
    for (const cat of VOICE_CATEGORIES) {
      out[cat] = (draft[cat] ?? "")
        .split(/\r?\n/)
        .filter(s => s.trim().length > 0).length;
    }
    return out;
  }, [draft]);

  const totalCount = useMemo(
    () => VOICE_CATEGORIES.reduce((sum, c) => sum + counts[c], 0),
    [counts],
  );

  const onSave = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const body = fromDraft(draft);
      const res = await fetch("/api/voice-lines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const savedLines = normalizeVoiceLines((await res.json()) as unknown);
      const d = toDraft(savedLines);
      setDraft(d);
      setSaved(d);
      invalidateVoiceLines();
      showToast("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [draft, showToast]);

  const onRevert = useCallback(() => {
    if (!isDirty) return;
    if (!confirm("変更を破棄して保存済みの内容に戻しますか?")) return;
    setDraft(saved);
  }, [isDirty, saved]);

  return (
    <div className={editStyles.page}>
      <div className={editStyles.heading}>
        <span className={editStyles.title}>Voice Lines</span>
        <span className={editStyles.subtitle}>
          {VOICE_CATEGORIES.length} categories · {totalCount} lines
        </span>
      </div>

      <div className={editStyles.note}>
        <p>
          /ops のキャラクター下に表示される<strong>一言メッセージ</strong>を、状態(待機 / 抽選中 / ランク別)ごとに複数登録できます。
          1 行 = 1 メッセージ。空行と前後スペースは自動で除去されます。
        </p>
        <ul>
          <li>
            保存先: <code>public/voice-lines.json</code>(git にコミット可)
          </li>
          <li>
            待機中はリストの中から約 8 秒ごとに順次切替、抽選中・結果表示は 1 抽選につき 1 つランダム選択。
          </li>
          <li>
            <em>
              編集 (PUT) は <code>next dev</code> のローカル開発時のみ動作します。本番デプロイでは表示のみ。
            </em>
          </li>
        </ul>
      </div>

      <div className={editStyles.actions}>
        <button
          type="button"
          className={`${editStyles.btn} ${editStyles.btnPrimary}`}
          onClick={() => void onSave()}
          disabled={busy || !isDirty}
        >
          {busy ? "saving…" : isDirty ? "↑ save" : "saved"}
        </button>
        <button
          type="button"
          className={editStyles.btn}
          onClick={onRevert}
          disabled={busy || !isDirty}
        >
          revert
        </button>
        <button
          type="button"
          className={editStyles.btn}
          onClick={() => void load()}
          disabled={busy}
        >
          reload
        </button>
      </div>

      <div className={styles.grid}>
        {CATEGORY_META.map(meta => (
          <section key={meta.key} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardLabel}>{meta.label}</span>
              <span className={styles.cardCount}>{counts[meta.key]} lines</span>
            </div>
            <p className={styles.cardHint}>{meta.hint}</p>
            <textarea
              className={styles.area}
              value={draft[meta.key] ?? ""}
              onChange={e =>
                setDraft(prev => ({ ...prev, [meta.key]: e.target.value }))
              }
              rows={6}
              spellCheck={false}
              placeholder="1 行 1 メッセージ"
            />
          </section>
        ))}
      </div>

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
