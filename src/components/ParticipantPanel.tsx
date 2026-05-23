"use client";

import type { Mode } from "@/types";
import styles from "./ParticipantPanel.module.css";

interface Props {
  participantName: string;
  drawCount: number;
  remaining: number;
  disabled: boolean;
  models: ReadonlyArray<Mode>;
  activeModelId: string;
  onNameChange: (v: string) => void;
  onCountChange: (n: number) => void;
  onModelChange: (id: string) => void;
}

export default function ParticipantPanel({
  participantName,
  drawCount,
  remaining,
  disabled,
  models,
  activeModelId,
  onNameChange,
  onCountChange,
  onModelChange,
}: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.field}>
        <span className={styles.label}>Participant</span>
        <input
          className={styles.input}
          type="text"
          value={participantName}
          onChange={e => onNameChange(e.target.value)}
          placeholder="ユーザー名"
          disabled={disabled}
          maxLength={48}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Draws</span>
        <input
          className={`${styles.input} ${styles.numInput}`}
          type="number"
          min={1}
          max={50}
          value={drawCount}
          onChange={e => {
            const n = Number(e.target.value);
            onCountChange(Number.isFinite(n) ? n : 1);
          }}
          disabled={disabled}
        />
      </div>
      <div className={styles.field}>
        <span className={styles.labelRow}>
          <span className={styles.label}>Model</span>
          <span className={styles.help} tabIndex={0}>
            <span className={styles.helpIcon} aria-hidden>?</span>
            <span className={styles.tooltip} role="tooltip">
              {models.map(m => (
                <span key={m.id} className={styles.tooltipItem}>
                  <span className={styles.tooltipName}>{m.name}</span>
                  {m.description && (
                    <span className={styles.tooltipDesc}>{m.description}</span>
                  )}
                </span>
              ))}
            </span>
          </span>
        </span>
        <select
          className={`${styles.input} ${styles.select}`}
          value={activeModelId}
          onChange={e => onModelChange(e.target.value)}
          disabled={disabled}
        >
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {remaining > 0 && (
        <div className={styles.queue}>queue: {remaining}</div>
      )}
    </div>
  );
}
