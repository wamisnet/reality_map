"use client";

import { useCallback, useRef, useState } from "react";
import { uploadCandidateImage } from "@/lib/upload-image";
import { useImageDropzone } from "@/hooks/useImageDropzone";
import {
  getCandidateImages,
  type EditableCandidate,
  type Rank,
} from "@/types";
import editStyles from "./Edit.module.css";
import styles from "./CandidateRow.module.css";

const IS_DEV = process.env.NODE_ENV === "development";

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

interface Props {
  initial: EditableCandidate;
  isNew?: boolean;
  busy?: boolean;
  onSave: (id: string, patch: EditableCandidate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCancelNew?: () => void;
}

const RANK_CLASS: Record<Rank, string> = {
  S: styles.s,
  A: styles.a,
  B: styles.b,
  C: styles.c,
};

/** EditableCandidate.image / images を draft 内の単一 images: string[] に正規化 */
function normalizeDraft(c: EditableCandidate): EditableCandidate {
  const imgs = getCandidateImages(c);
  return {
    ...c,
    image: imgs[0] ?? null,
    images: imgs.length > 0 ? imgs : null,
  };
}

function imagesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default function CandidateRow({
  initial,
  isNew = false,
  busy = false,
  onSave,
  onDelete,
  onCancelNew,
}: Props) {
  const [draft, setDraft] = useState<EditableCandidate>(() => normalizeDraft(initial));
  const [trackedInitial, setTrackedInitial] = useState<EditableCandidate>(initial);
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // onSnapshot で同じ id の中身が変わったら draft をリセット
  if (trackedInitial !== initial) {
    setTrackedInitial(initial);
    setDraft(normalizeDraft(initial));
  }

  const draftImages = getCandidateImages(draft);
  const initialImages = getCandidateImages(initial);

  const dirty =
    draft.name !== initial.name ||
    draft.pref !== initial.pref ||
    draft.lon !== initial.lon ||
    draft.lat !== initial.lat ||
    draft.rank !== initial.rank ||
    draft.order !== initial.order ||
    !imagesEqual(draftImages, initialImages) ||
    (draft.desc ?? null) !== (initial.desc ?? null);

  const appendImage = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      setDraft(d => {
        const current = getCandidateImages(d);
        if (current.includes(trimmed)) return d;
        const next = [...current, trimmed];
        return {
          ...d,
          image: next[0] ?? null,
          images: next,
        };
      });
    },
    [],
  );

  const removeImage = useCallback((index: number) => {
    setDraft(d => {
      const current = getCandidateImages(d);
      const next = current.filter((_, i) => i !== index);
      return {
        ...d,
        image: next[0] ?? null,
        images: next.length > 0 ? next : null,
      };
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(initial.id, draft);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`「${initial.name}」を削除しますか？`)) return;
    setSaving(true);
    try {
      await onDelete(initial.id);
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = useCallback(
    async (file: File) => {
      // 座標未設定で意図しないファイル名になるのを防ぐ
      if (!draft.lat || !draft.lon) {
        setUpload({
          kind: "error",
          message: "lat/lon を先に設定してください",
        });
        return;
      }
      setUpload({ kind: "uploading" });
      try {
        const url = await uploadCandidateImage({
          file,
          lat: draft.lat,
          lon: draft.lon,
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
    [draft.lat, draft.lon, appendImage],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    for (const f of files) {
      await uploadFile(f);
    }
  };

  const canUpload = IS_DEV && !busy && !saving && !!draft.lat && !!draft.lon;

  const { isOver, handlers: dropHandlers } = useImageDropzone({
    enabled: IS_DEV && !busy && !saving,
    onFile: uploadFile,
    multi: true,
  });

  // URL を直接追加する用のローカル state
  const [urlDraft, setUrlDraft] = useState("");

  const rowClass = [
    styles.row,
    dirty ? styles.dirty : "",
    isNew ? styles.isNew : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rowClass}>
      <div className={styles.rankCell}>
        <select
          className={`${styles.rankSelect} ${RANK_CLASS[draft.rank]}`}
          value={draft.rank}
          onChange={e => setDraft({ ...draft, rank: e.target.value as Rank })}
          disabled={busy || saving}
        >
          <option value="S">S</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </div>
      <input
        className={editStyles.input}
        value={draft.name}
        onChange={e => setDraft({ ...draft, name: e.target.value })}
        placeholder="場所の名前"
        disabled={busy || saving}
      />
      <input
        className={editStyles.input}
        value={draft.pref}
        onChange={e => setDraft({ ...draft, pref: e.target.value })}
        placeholder="都道府県"
        disabled={busy || saving}
      />
      <input
        className={`${editStyles.input} ${styles.numInput}`}
        type="number"
        step="0.001"
        value={draft.lon}
        onChange={e => setDraft({ ...draft, lon: Number(e.target.value) })}
        placeholder="lon"
        disabled={busy || saving}
      />
      <input
        className={`${editStyles.input} ${styles.numInput}`}
        type="number"
        step="0.001"
        value={draft.lat}
        onChange={e => setDraft({ ...draft, lat: Number(e.target.value) })}
        placeholder="lat"
        disabled={busy || saving}
      />
      <input
        className={`${editStyles.input} ${styles.numInput}`}
        type="number"
        step="1"
        value={draft.order}
        onChange={e => setDraft({ ...draft, order: Number(e.target.value) })}
        placeholder="order"
        disabled={busy || saving}
      />
      <div
        className={`${styles.imageCell} ${isOver ? styles.imageCellOver : ""}`}
        {...(IS_DEV ? dropHandlers : {})}
        title={
          IS_DEV
            ? "画像をドラッグ&ドロップで追加 (複数可)"
            : undefined
        }
      >
        {draftImages.length > 0 && (
          <div className={styles.thumbStrip}>
            {draftImages.map((src, i) => (
              <span key={`${src}-${i}`} className={styles.thumbWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className={styles.imageThumb}
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                <button
                  type="button"
                  className={styles.thumbX}
                  onClick={() => removeImage(i)}
                  disabled={busy || saving}
                  aria-label="この画像を削除"
                  title="削除"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          className={`${editStyles.input} ${styles.urlInput}`}
          value={urlDraft}
          onChange={e => setUrlDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (urlDraft.trim()) {
                appendImage(urlDraft);
                setUrlDraft("");
              }
            }
          }}
          placeholder={
            IS_DEV
              ? draftImages.length > 0
                ? "URL 追加 (Enter)"
                : "URL or upload →"
              : "image URL (Enter で追加)"
          }
          disabled={busy || saving}
        />
        {IS_DEV && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={!canUpload || upload.kind === "uploading"}
              title={
                !draft.lat || !draft.lon
                  ? "lat/lon を先に設定してください"
                  : "画像をアップロード (ファイル名は座標+内容ハッシュ)"
              }
            >
              {upload.kind === "uploading" ? "…" : "↑"}
            </button>
          </>
        )}
        {upload.kind === "error" && (
          <span className={styles.uploadErr} title={upload.message}>
            !
          </span>
        )}
      </div>
      <div className={styles.rowActions}>
        <button
          className={styles.rowBtn}
          type="button"
          onClick={save}
          disabled={!dirty || busy || saving || !draft.name || !draft.pref}
        >
          {isNew ? "Add" : "Save"}
        </button>
        {isNew ? (
          <button
            className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
            type="button"
            onClick={onCancelNew}
            disabled={saving}
          >
            Cancel
          </button>
        ) : (
          <button
            className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
            type="button"
            onClick={handleDelete}
            disabled={busy || saving}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
