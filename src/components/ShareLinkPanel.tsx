"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./ShareLinkPanel.module.css";

interface Props {
  participantId: string | null;
  participantName: string | null;
  latestResultId: string | null;
}

export default function ShareLinkPanel({
  participantId,
  participantName,
  latestResultId,
}: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"list" | "latest" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const copy = useCallback(
    async (kind: "list" | "latest", url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(kind);
        window.setTimeout(() => setCopied(c => (c === kind ? null : c)), 1400);
      } catch {
        // noop
      }
    },
    [],
  );

  if (!participantId) return null;

  const listPath = `/${participantId}`;
  const latestPath = latestResultId ? `/${participantId}/${latestResultId}` : null;
  const listUrl = origin + listPath;
  const latestUrl = latestPath ? origin + latestPath : "";

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <span className={styles.label}>SHARE</span>
        {participantName && (
          <span className={styles.name}>{participantName}</span>
        )}
      </div>
      <div className={styles.row}>
        <span className={styles.kind}>LIST</span>
        <code className={styles.path}>{listPath}</code>
        <button
          className={styles.btn}
          type="button"
          onClick={() => copy("list", listUrl)}
          disabled={!origin}
        >
          {copied === "list" ? "✓" : "COPY"}
        </button>
      </div>
      {latestPath && (
        <div className={styles.row}>
          <span className={styles.kind}>LAST</span>
          <code className={styles.path}>{latestPath}</code>
          <button
            className={styles.btn}
            type="button"
            onClick={() => copy("latest", latestUrl)}
            disabled={!origin}
          >
            {copied === "latest" ? "✓" : "COPY"}
          </button>
        </div>
      )}
    </div>
  );
}
