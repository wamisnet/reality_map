"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchParticipantSummaries,
  mergeParticipants,
  type ParticipantSummary,
} from "@/lib/participants";
import { useAuth } from "@/components/AuthProvider";
import editStyles from "./Edit.module.css";
import styles from "./ParticipantsAdmin.module.css";

const TEMPLATE_KEY = "crosshair.participantMessageTemplate";

const DEFAULT_TEMPLATE =
  "{name} さん、咲月わみの旅ガチャの抽選結果ページができたよ✦\nさっそく下のリンクから旅の行き先をチェックしてみてね!\n気に入ったら、X (旧 Twitter) などでシェアしてくれるとうれしいな♪\n{url}";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; rows: ParticipantSummary[] }
  | { kind: "error"; message: string };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

function renderMessage(template: string, name: string, url: string): string {
  return template.replaceAll("{name}", name).replaceAll("{url}", url);
}

export default function ParticipantsAdmin() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [origin, setOrigin] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeMsg, setMergeMsg] = useState<string | null>(null);

  // origin + saved template の読み込み (クライアントのみ)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
    const saved = window.localStorage.getItem(TEMPLATE_KEY);
    if (saved !== null) setTemplate(saved);
  }, []);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const rows = await fetchParticipantSummaries();
      setState({ kind: "ok", rows });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "load failed",
      });
    }
  }, []);

  const selectedRows = useMemo(() => {
    if (state.kind !== "ok") return [];
    return state.rows.filter(r => selected.has(r.participantId));
  }, [state, selected]);

  // 統合先のデフォルトは「最古に作られた」ID (firstAt 昇順の先頭)。
  // ユーザーが select で別の ID を選んでいる場合 (= 選択行に含まれる) はそれを尊重。
  const defaultMergeTargetId = useMemo(() => {
    if (selectedRows.length === 0) return "";
    const sorted = [...selectedRows].sort((a, b) => {
      const fa = a.firstAt ? a.firstAt.getTime() : Number.POSITIVE_INFINITY;
      const fb = b.firstAt ? b.firstAt.getTime() : Number.POSITIVE_INFINITY;
      return fa - fb;
    });
    return sorted[0]?.participantId ?? "";
  }, [selectedRows]);

  const effectiveMergeTargetId =
    mergeTargetId && selectedRows.some(r => r.participantId === mergeTargetId)
      ? mergeTargetId
      : defaultMergeTargetId;

  const toggleSelect = useCallback((pid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setMergeMsg(null);
  }, []);

  const runMerge = useCallback(async () => {
    if (!user) {
      setMergeMsg("サインインが必要です");
      return;
    }
    const targetId = effectiveMergeTargetId;
    if (selectedRows.length < 2 || !targetId) return;
    const fromIds = selectedRows
      .map(r => r.participantId)
      .filter(id => id !== targetId);
    const target = selectedRows.find(r => r.participantId === targetId);
    const targetName = target?.participantName ?? targetId;
    const ok = window.confirm(
      `${fromIds.length} 件の参加者を「${targetName} (${targetId})」に統合します。\n` +
        `元の participantId は履歴から消えます。元に戻すには手動で個別レコードの participantId を書き換える必要があります。\n\n` +
        `続行しますか？`,
    );
    if (!ok) return;
    setMergeBusy(true);
    setMergeMsg(null);
    try {
      const { updated } = await mergeParticipants(fromIds, targetId, user.uid);
      setMergeMsg(`${updated} 件を統合しました`);
      clearSelection();
      await load();
    } catch (err) {
      setMergeMsg(
        `マージ失敗: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setMergeBusy(false);
    }
  }, [user, selectedRows, effectiveMergeTargetId, clearSelection, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveTemplate = useCallback((next: string) => {
    setTemplate(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEMPLATE_KEY, next);
    }
  }, []);

  const resetTemplate = useCallback(() => {
    saveTemplate(DEFAULT_TEMPLATE);
  }, [saveTemplate]);

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(
        () => setCopiedKey(k => (k === key ? null : k)),
        1400,
      );
    } catch {
      // noop
    }
  }, []);

  const previewMessage = useMemo(
    () => renderMessage(template, "サンプル名", `${origin || "https://example"}/abcd1234`),
    [template, origin],
  );

  return (
    <div className={editStyles.page}>
      <div className={editStyles.heading}>
        <span className={editStyles.title}>Participants</span>
        <span className={editStyles.subtitle}>
          {state.kind === "ok"
            ? `${state.rows.length} people · ${state.kind === "ok" ? "live" : ""}`
            : state.kind === "loading"
              ? "loading…"
              : "error"}
        </span>
      </div>

      {state.kind === "error" && (
        <div className={editStyles.fallbackNotice}>
          参加者一覧の取得に失敗しました: {state.message}
        </div>
      )}

      <section className={styles.templateBox}>
        <div className={styles.templateHead}>
          <span className={styles.templateLabel}>メッセージテンプレート</span>
          <span className={styles.templateHint}>
            <code>{"{name}"}</code> = 表示名 / <code>{"{url}"}</code> =
            結果ページURL
          </span>
          <button
            type="button"
            className={styles.templateReset}
            onClick={resetTemplate}
          >
            初期値に戻す
          </button>
        </div>
        <textarea
          className={styles.templateInput}
          value={template}
          onChange={e => saveTemplate(e.target.value)}
          rows={3}
        />
        <div className={styles.templatePreviewLabel}>プレビュー</div>
        <pre className={styles.templatePreview}>{previewMessage}</pre>
      </section>

      <div className={editStyles.actions}>
        <button
          type="button"
          className={`${editStyles.btn} ${editStyles.btnPrimary}`}
          onClick={() => void load()}
          disabled={state.kind === "loading"}
        >
          {state.kind === "loading" ? "loading…" : "↻ Reload"}
        </button>
      </div>

      {selectedRows.length > 0 && (
        <div className={styles.mergeBar}>
          <span>Merge selected ({selectedRows.length})</span>
          <span>→</span>
          <select
            value={effectiveMergeTargetId}
            onChange={e => setMergeTargetId(e.target.value)}
            disabled={mergeBusy}
          >
            {selectedRows.map(r => (
              <option key={r.participantId} value={r.participantId}>
                {r.participantName} ({r.participantId})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void runMerge()}
            disabled={mergeBusy || selectedRows.length < 2 || !effectiveMergeTargetId}
          >
            {mergeBusy ? "merging…" : "Merge"}
          </button>
          <button
            type="button"
            className={styles.ghost}
            onClick={clearSelection}
            disabled={mergeBusy}
          >
            Clear
          </button>
          {mergeMsg && <span className={styles.mergeStatus}>{mergeMsg}</span>}
        </div>
      )}

      <div className={styles.list}>
        <div className={styles.headerRow}>
          <div></div>
          <div>NAME</div>
          <div>ID</div>
          <div>RESULTS</div>
          <div>LAST</div>
          <div>ACTIONS</div>
        </div>

        {state.kind === "ok" && state.rows.length === 0 && (
          <div className={editStyles.empty}>
            まだ抽選結果はありません。
          </div>
        )}

        {state.kind === "ok" &&
          state.rows.map(p => {
            const url = origin ? `${origin}/${p.participantId}` : "";
            const message = renderMessage(template, p.participantName, url);
            const msgKey = `msg:${p.participantId}`;
            const urlKey = `url:${p.participantId}`;
            const isSelected = selected.has(p.participantId);
            return (
              <div
                key={p.participantId}
                className={`${styles.row} ${isSelected ? styles.selected : ""}`}
              >
                <div className={styles.checkCell}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(p.participantId)}
                    disabled={mergeBusy}
                    aria-label={`select ${p.participantName}`}
                  />
                </div>
                <div className={styles.nameCell}>
                  <span className={styles.name}>{p.participantName}</span>
                </div>
                <div className={styles.idCell}>
                  <code className={styles.id}>{p.participantId}</code>
                </div>
                <div className={styles.numCell}>
                  {p.resultCount}
                  <span className={styles.unit}>件</span>
                </div>
                <div className={styles.dateCell}>{fmtDate(p.lastAt)}</div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copy(msgKey, message)}
                    disabled={!origin}
                    title="メッセージ文 (URL含む) をクリップボードへ"
                  >
                    {copiedKey === msgKey ? "✓ copied" : "メッセージをコピー"}
                  </button>
                  <button
                    type="button"
                    className={`${styles.copyBtn} ${styles.copyBtnGhost}`}
                    onClick={() => copy(urlKey, url)}
                    disabled={!origin}
                    title="URL のみコピー"
                  >
                    {copiedKey === urlKey ? "✓" : "URLのみ"}
                  </button>
                  <a
                    className={styles.openLink}
                    href={`/edit/participants/${p.participantId}`}
                  >
                    コンプリート →
                  </a>
                  <a
                    className={styles.openLink}
                    href={`/${p.participantId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    開く ↗
                  </a>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
