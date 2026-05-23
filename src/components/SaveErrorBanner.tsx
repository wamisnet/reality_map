"use client";

import styles from "./SaveErrorBanner.module.css";

export interface SaveErrorInfo {
  code: string | null;
  message: string;
}

interface Props {
  error: SaveErrorInfo | null;
  onDismiss: () => void;
}

export default function SaveErrorBanner({ error, onDismiss }: Props) {
  if (!error) return null;
  return (
    <div className={styles.root} role="alert">
      <button
        className={styles.close}
        onClick={onDismiss}
        type="button"
        aria-label="dismiss"
      >
        ×
      </button>
      <div className={styles.head}>
        <span>SAVE FAILED</span>
        {error.code && <span className={styles.code}>{error.code}</span>}
      </div>
      <div className={styles.msg}>{error.message}</div>
    </div>
  );
}

export function toSaveErrorInfo(err: unknown): SaveErrorInfo {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; message?: unknown };
    const code =
      typeof e.code === "string" && e.code.length > 0 ? e.code : null;
    const message =
      typeof e.message === "string" && e.message.length > 0
        ? e.message
        : String(err);
    return { code, message };
  }
  return { code: null, message: String(err) };
}
