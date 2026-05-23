"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchNearbyLandmarks, type LandmarkHit } from "@/lib/overpass";
import { uploadCandidateImage } from "@/lib/upload-image";
import { useImageDropzone } from "@/hooks/useImageDropzone";
import RankLegend from "@/components/RankLegend";
import type { LatLon, Rank } from "@/types";
import styles from "./PinDraftPanel.module.css";

export interface DraftForm {
  name: string;
  category: string;
  pref: string;
  rank: Rank;
  /** 登録する画像 URL 群。空配列 = 画像なし。1 番目が cover として扱われる。 */
  images: string[];
  desc: string;
}

interface Props {
  pin: LatLon | null;
  form: DraftForm;
  /** "new" = 新規追加 / "edit" = 既存候補の編集 */
  mode: "new" | "edit";
  /** pref 自動推測のヒント */
  suggestedPref: string | null;
  busy: boolean;
  onChange: (next: DraftForm) => void;
  onClear: () => void;
  onSave: () => void;
  onDelete: () => void;
}

const RANKS: ReadonlyArray<Rank> = ["S", "A", "B", "C"];

const RANK_CLASS: Record<Rank, string> = {
  S: styles.s,
  A: styles.a,
  B: styles.b,
  C: styles.c,
};

type LandmarkState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; hits: LandmarkHit[] }
  | { kind: "error"; message: string };

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

// Next.js は process.env.NODE_ENV をビルド時に inline するので、
// 本番ビルドではこの分岐ごと dead code として除去される。
const IS_DEV = process.env.NODE_ENV === "development";

export default function PinDraftPanel({
  pin,
  form,
  mode,
  suggestedPref,
  busy,
  onChange,
  onClear,
  onSave,
  onDelete,
}: Props) {
  // pin が新しく置かれた / 動かされたタイミングで pref ヒントを適用。
  // 初回マウント時の pin はスキップ（既存値を尊重）。
  const lastSeenPinRef = useRef<LatLon | null>(pin);
  const formRef = useRef(form);
  const suggestedPrefRef = useRef(suggestedPref);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    formRef.current = form;
    suggestedPrefRef.current = suggestedPref;
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (lastSeenPinRef.current === pin) return;
    lastSeenPinRef.current = pin;
    const f = formRef.current;
    const sp = suggestedPrefRef.current;
    if (pin && sp && !f.pref) {
      onChangeRef.current({ ...f, pref: sp });
    }
  }, [pin]);

  // 近隣ランドマーク。pin 変更でデバウンス再取得。
  // pin が null になった瞬間は React 19 の derived-state パターンで即 idle にリセット
  // (effect 内 setState を避けるため)。
  const [landmarks, setLandmarks] = useState<LandmarkState>({ kind: "idle" });
  const [lastSeenPin, setLastSeenPin] = useState<LatLon | null>(pin);
  if (lastSeenPin !== pin) {
    setLastSeenPin(pin);
    if (!pin) setLandmarks({ kind: "idle" });
  }
  useEffect(() => {
    if (!pin) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setLandmarks({ kind: "loading" });
      fetchNearbyLandmarks(pin.lat, pin.lon, { signal: ctrl.signal })
        .then(hits => setLandmarks({ kind: "ok", hits }))
        .catch(err => {
          if (ctrl.signal.aborted) return;
          setLandmarks({
            kind: "error",
            message: err instanceof Error ? err.message : "fetch failed",
          });
        });
    }, 500);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [pin]);

  const applyLandmark = useCallback(
    (hit: LandmarkHit) => {
      const next: DraftForm = { ...formRef.current, name: hit.name };
      if (hit.category && !next.category) next.category = hit.category;
      onChangeRef.current(next);
    },
    [],
  );

  // 画像アップロード
  const [upload, setUpload] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [urlDraft, setUrlDraft] = useState("");

  const appendImage = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const f = formRef.current;
    if (f.images.includes(trimmed)) return;
    onChangeRef.current({ ...f, images: [...f.images, trimmed] });
  }, []);

  const removeImage = useCallback((index: number) => {
    const f = formRef.current;
    const next = f.images.filter((_, i) => i !== index);
    onChangeRef.current({ ...f, images: next });
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const p = pin;
      if (!p) return;
      setUpload({ kind: "uploading" });
      try {
        const url = await uploadCandidateImage({
          file,
          lat: p.lat,
          lon: p.lon,
        });
        appendImage(url);
        setUpload({ kind: "idle" });
      } catch (err) {
        setUpload({
          kind: "error",
          message: err instanceof Error ? err.message : "upload failed",
        });
      }
    },
    [pin, appendImage],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = ""; // 同じファイル再選択を許す
      if (files.length === 0) return;
      for (const f of files) {
        await uploadFile(f);
      }
    },
    [uploadFile],
  );

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (urlDraft.trim()) {
          appendImage(urlDraft);
          setUrlDraft("");
        }
      }
    },
    [urlDraft, appendImage],
  );

  const dropEnabled =
    IS_DEV && !!pin && !busy && upload.kind !== "uploading";
  const { isOver: isDropOver, handlers: dropHandlers } = useImageDropzone({
    enabled: dropEnabled,
    onFile: uploadFile,
    multi: true,
  });

  if (!pin) {
    return (
      <aside className={styles.panel}>
        <div className={styles.head}>
          <div className={styles.title}>New Point</div>
          <div className={styles.sub}>Click on the map to begin</div>
        </div>
        <div className={styles.empty}>
          地図上の好きな場所をクリックすると、ここに新しい候補のフォームが出ます。
          <br /><br />
          既存のピンをクリックすると、その地点を編集できます。
          <br /><br />
          ピンはドラッグで微調整できます。
        </div>
      </aside>
    );
  }

  const isEdit = mode === "edit";
  const canSave = !!form.name.trim() && !!form.pref.trim() && !busy;

  return (
    <aside className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.title}>
          {isEdit ? "Edit Point" : "New Point"}
        </div>
        <div className={styles.sub}>
          {isEdit ? "Update · Delete · Save" : "Fill in details · Save"}
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.coordBlock}>
          <div className={styles.coordCell}>
            <div className={styles.coordLabel}>LAT</div>
            <div className={styles.coordValue}>{pin.lat.toFixed(5)}</div>
          </div>
          <div className={styles.coordCell}>
            <div className={styles.coordLabel}>LON</div>
            <div className={styles.coordValue}>{pin.lon.toFixed(5)}</div>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Nearby landmarks (OSM)</span>
          {landmarks.kind === "loading" && (
            <div className={styles.hint}>検索中…</div>
          )}
          {landmarks.kind === "error" && (
            <div className={styles.hint}>取得失敗: {landmarks.message}</div>
          )}
          {landmarks.kind === "ok" && landmarks.hits.length === 0 && (
            <div className={styles.hint}>該当ランドマークなし</div>
          )}
          {landmarks.kind === "ok" && landmarks.hits.length > 0 && (
            <ul className={styles.landmarkList}>
              {landmarks.hits.map(h => (
                <li key={h.id}>
                  <button
                    type="button"
                    className={styles.landmarkBtn}
                    onClick={() => applyLandmark(h)}
                    disabled={busy}
                    title="クリックで名前(と未設定ならカテゴリ)を適用"
                  >
                    <span className={styles.landmarkName}>{h.name}</span>
                    <span className={styles.landmarkMeta}>
                      {h.category ?? "—"} · {Math.round(h.distance)}m
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={form.name}
            onChange={e => onChange({ ...form, name: e.target.value })}
            placeholder="例: 旭山動物園"
            disabled={busy}
            maxLength={64}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Category</label>
          <input
            className={styles.input}
            value={form.category}
            onChange={e => onChange({ ...form, category: e.target.value })}
            placeholder="例: 動物園 / 美術館 / 城"
            disabled={busy}
            maxLength={32}
          />
          <div className={styles.hint}>
            設定すると結果カードで都道府県の代わりにここが表示されます
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Prefecture</label>
          <input
            className={styles.input}
            value={form.pref}
            onChange={e => onChange({ ...form, pref: e.target.value })}
            placeholder="都道府県"
            disabled={busy}
            maxLength={16}
          />
          {suggestedPref && form.pref !== suggestedPref && (
            <div className={styles.hint}>
              最寄り候補: {suggestedPref}{" "}
              <button
                type="button"
                onClick={() => onChange({ ...form, pref: suggestedPref })}
                className={styles.linkBtn}
              >
                use
              </button>
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Rank</label>
          <div className={styles.rankRow}>
            {RANKS.map(r => (
              <button
                key={r}
                type="button"
                className={`${styles.rankBtn} ${RANK_CLASS[r]} ${
                  form.rank === r ? styles.on : ""
                }`}
                onClick={() => onChange({ ...form, rank: r })}
                disabled={busy}
              >
                {r}
              </button>
            ))}
          </div>
          <RankLegend variant="operator" />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            Images (optional · {form.images.length})
          </span>
          {form.images.length > 0 && (
            <ul className={styles.thumbList}>
              {form.images.map((src, i) => (
                <li key={`${src}-${i}`} className={styles.thumbItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className={styles.thumbImg} />
                  {i === 0 && <span className={styles.thumbCover}>COVER</span>}
                  <button
                    type="button"
                    className={styles.thumbRemove}
                    onClick={() => removeImage(i)}
                    disabled={busy}
                    title="この画像を削除"
                    aria-label="この画像を削除"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {IS_DEV ? (
            <div
              className={`${styles.dropZone} ${isDropOver ? styles.dropZoneOver : ""}`}
              {...dropHandlers}
            >
              <div className={styles.dropHint}>
                {isDropOver
                  ? "ここにドロップして画像を追加"
                  : "画像ファイルをドラッグ&ドロップ (複数可)、または下から選択"}
              </div>
              <div className={styles.uploadRow}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={busy || upload.kind === "uploading"}
                  className={styles.fileInput}
                />
              </div>
              {upload.kind === "uploading" && (
                <div className={styles.hint}>アップロード中…</div>
              )}
              {upload.kind === "error" && (
                <div className={styles.hint}>
                  アップロード失敗: {upload.message}
                </div>
              )}
              <div className={styles.hint}>
                ローカル開発時のみアップロード可。
                <code>public/candidates/</code> に保存されるので、デプロイ前に git
                commit が必要です。
              </div>
            </div>
          ) : (
            <div className={styles.uploadDisabled}>
              <span className={styles.uploadDisabledTitle}>
                ファイルアップロードは無効
              </span>
              <span className={styles.uploadDisabledBody}>
                本番環境ではファイル保存先 (<code>public/</code>) が read-only
                のため、画像アップロード機能はローカル開発時のみ有効です。
                本番では下の URL 欄に画像 URL を貼り付けてください。
              </span>
            </div>
          )}
          <div className={styles.uploadRow}>
            <input
              className={styles.input}
              value={urlDraft}
              onChange={e => setUrlDraft(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="画像 URL を追加 (Enter で追加)"
              disabled={busy}
            />
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                if (urlDraft.trim()) {
                  appendImage(urlDraft);
                  setUrlDraft("");
                }
              }}
              disabled={busy || !urlDraft.trim()}
            >
              add
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description (optional)</label>
          <textarea
            className={styles.textarea}
            value={form.desc}
            onChange={e => onChange({ ...form, desc: e.target.value })}
            placeholder="この場所の説明文 (画面に表示されます)"
            disabled={busy}
            rows={3}
          />
        </div>

        <div className={styles.actions}>
          {isEdit ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={onDelete}
              disabled={busy}
            >
              Delete
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={onClear}
              disabled={busy}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onSave}
            disabled={!canSave}
          >
            {busy
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Save point"}
          </button>
        </div>
        {isEdit && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost} ${styles.cancelEditBtn}`}
            onClick={onClear}
            disabled={busy}
          >
            Cancel edit
          </button>
        )}
      </div>
    </aside>
  );
}
