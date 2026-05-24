"use client";

import { useEffect, useMemo, useState } from "react";
import { MODELS } from "@/data/models";
import { recommendedFromAmount } from "@/lib/gift-policy";
import type { GiftDoc } from "@/lib/gifts-store";
import type { Mode } from "@/types";
import styles from "./GiftQueuePanel.module.css";

const STORAGE_COLLAPSED = "giftQueue.collapsed";
const STORAGE_SINCE = "giftQueue.sinceMs";

export interface FireFromGiftArgs {
  giftId: string;
  giftUserRaw: string | null;
  giftAmount: number;
  giftName: string;
  giftSource: string | null;
  displayName: string;
  modeId: string;
  count: number;
  /** ON のときは giftUserRaw を保存せず、表示名ベースで新規 ID を発番させる */
  treatAsNewIdentity: boolean;
}

interface Props {
  gifts: ReadonlyArray<GiftDoc>;
  busy: boolean;
  onFire: (args: FireFromGiftArgs) => void;
  loading: boolean;
  error: string | null;
}

interface EditState {
  name: string;
  amount: number;
  giftName: string;
  count: number;
  modeId: string;
  countDirty: boolean;
  modeDirty: boolean;
  treatAsNewIdentity: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDate(at: Date | null): string {
  if (!at) return "—";
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
}

function fmtTime(at: Date | null): string {
  if (!at) return "—";
  return `${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function msToLocalInput(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localInputToMs(s: string): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

function modeNameOf(modeId: string): string {
  const m = MODELS.find(mm => mm.id === modeId);
  return m?.name ?? modeId;
}

function initialEdit(gift: GiftDoc, fallbackModeId: string): EditState {
  const rec = recommendedFromAmount(gift.amount);
  return {
    name: gift.user_display || gift.user_raw,
    amount: gift.amount,
    giftName: gift.gift_name,
    count: rec?.count ?? 1,
    modeId: rec?.modeId ?? fallbackModeId,
    countDirty: false,
    modeDirty: false,
    treatAsNewIdentity: false,
  };
}

export default function GiftQueuePanel({
  gifts,
  busy,
  onFire,
  loading,
  error,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [sinceMs, setSinceMs] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // localStorage から復元 (mount 後にだけ走らせて SSR とずらさない)
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_COLLAPSED) === "1") {
        setCollapsed(true);
      }
      const raw = window.localStorage.getItem(STORAGE_SINCE);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n)) setSinceMs(n);
      }
    } catch {
      // localStorage が使えない環境 (privacy mode 等) は黙って無視
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_COLLAPSED, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (sinceMs === null) window.localStorage.removeItem(STORAGE_SINCE);
      else window.localStorage.setItem(STORAGE_SINCE, String(sinceMs));
    } catch {
      /* ignore */
    }
  }, [sinceMs, hydrated]);

  const fallbackModeId = MODELS[0]?.id ?? "";

  const visible = useMemo(() => {
    if (sinceMs === null) return gifts;
    return gifts.filter(g => g.at !== null && g.at.getTime() >= sinceMs);
  }, [gifts, sinceMs]);

  function getEdit(g: GiftDoc): EditState {
    return edits[g.id] ?? initialEdit(g, fallbackModeId);
  }

  function patchEdit(g: GiftDoc, patch: Partial<EditState>) {
    setEdits(prev => {
      const cur = prev[g.id] ?? initialEdit(g, fallbackModeId);
      const next = { ...cur, ...patch };
      // amount が変わったら推奨を再計算 (ただし dirty で個別に上書き済みなら維持)
      if (patch.amount !== undefined && patch.amount !== cur.amount) {
        const rec = recommendedFromAmount(patch.amount);
        if (rec) {
          if (!next.countDirty) next.count = rec.count;
          if (!next.modeDirty) next.modeId = rec.modeId;
        }
      }
      return { ...prev, [g.id]: next };
    });
  }

  function resetEdit(g: GiftDoc) {
    setEdits(prev => {
      if (!(g.id in prev)) return prev;
      const next = { ...prev };
      delete next[g.id];
      return next;
    });
  }

  function fire(g: GiftDoc, edit: EditState, opts: { isReDraw?: boolean } = {}) {
    if (busy) return;
    const name = edit.name.trim();
    if (!name) return;
    if (edit.amount < 10) return;
    if (opts.isReDraw) {
      const ok = window.confirm(
        `${name} さん (${g.id}) を再抽選しますか？\n既に保存済みの結果は残ったまま、新しい結果が追加されます。`,
      );
      if (!ok) return;
    }
    onFire({
      giftId: g.id,
      giftUserRaw: g.user_raw || null,
      giftAmount: edit.amount,
      giftName: edit.giftName.trim(),
      giftSource: g.source,
      displayName: name,
      modeId: edit.modeId,
      count: Math.max(1, Math.min(50, Math.floor(edit.count))),
      treatAsNewIdentity: edit.treatAsNewIdentity,
    });
  }

  const filterActive = sinceMs !== null;
  // 「これから回すべきガチャの個数」= 未処理 & 抽選対象 (10C 以上) のギフト数。
  // フィルタ範囲内でカウントし、0件のときはヘッダーに数字を出さない。
  const pendingCount = useMemo(
    () =>
      visible.filter(
        g => g.lottery_processed_at === null && g.amount >= 10,
      ).length,
    [visible],
  );

  return (
    <div className={`${styles.root} ${collapsed ? styles.rootCollapsed : ""}`}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span className={styles.headTitle}>
          <span className={styles.caret}>{collapsed ? "▸" : "▾"}</span>
          GIFT QUEUE{pendingCount > 0 ? ` · ${pendingCount}` : ""}
        </span>
        <span className={styles.sub}>
          {loading ? "loading…" : error ? "error" : "live"}
        </span>
      </button>

      {!collapsed && (
        <div className={styles.filterBar}>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>開始時刻</span>
            <input
              type="datetime-local"
              className={styles.filterInput}
              value={msToLocalInput(sinceMs)}
              onChange={e => setSinceMs(localInputToMs(e.target.value))}
            />
          </label>
          <div className={styles.filterBtns}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => setSinceMs(startOfToday())}
              title="今日 00:00 以降を表示"
            >
              今日
            </button>
            {filterActive && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setSinceMs(null)}
              >
                クリア
              </button>
            )}
          </div>
        </div>
      )}

      {!collapsed && error && <div className={styles.error}>{error}</div>}

      {!collapsed && !loading && visible.length === 0 && (
        <div className={styles.empty}>
          {filterActive && gifts.length > 0
            ? "この期間にギフトはありません"
            : "まだギフトが届いていません"}
        </div>
      )}

      {!collapsed && (
      <div className={styles.list}>
        {visible.map(g => {
          const edit = getEdit(g);
          const rec = recommendedFromAmount(edit.amount);
          const isProcessed = g.lottery_processed_at !== null;
          const isOpen = openId === g.id;
          const tooSmall = edit.amount < 10;
          const canFire = !busy && !tooSmall && edit.name.trim().length > 0;
          const displayName = g.user_display || g.user_raw;
          return (
            <div
              key={g.id}
              className={`${styles.row} ${isProcessed ? styles.processed : ""}`}
            >
              <div className={styles.summary}>
                <div className={styles.who}>
                  <span className={styles.name}>{displayName}</span>
                  <span className={styles.stamp}>
                    <span className={styles.stampDate}>{fmtDate(g.at)}</span>
                    <span className={styles.stampTime}>{fmtTime(g.at)}</span>
                  </span>
                </div>
                <div className={styles.gift}>
                  <span className={styles.giftName}>{g.gift_name || "—"}</span>
                  <span className={styles.amount}>
                    {g.amount}
                    <span className={styles.unit}>C</span>
                  </span>
                  {g.source === "manual" && (
                    <span className={styles.manualTag}>MANUAL</span>
                  )}
                  {isProcessed && (
                    <span className={styles.doneTag}>DONE</span>
                  )}
                  {tooSmall && (
                    <span className={styles.skipTag}>対象外</span>
                  )}
                </div>
                <div className={styles.actions}>
                  {!isProcessed && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      disabled={!canFire}
                      onClick={() => fire(g, edit)}
                      title={
                        rec
                          ? `推奨: ${modeNameOf(rec.modeId)} × ${rec.count}`
                          : "対象外 (10C 未満)"
                      }
                    >
                      <span className={styles.btnAction}>抽選</span>
                      {tooSmall ? (
                        <span className={styles.btnMeta}>対象外</span>
                      ) : (
                        <span className={styles.btnMeta}>
                          <span className={styles.btnMode}>
                            {modeNameOf(edit.modeId)}
                          </span>
                          <span className={styles.btnTimes}>×{edit.count}</span>
                        </span>
                      )}
                    </button>
                  )}
                  {isProcessed && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnReDraw}`}
                      disabled={busy || tooSmall}
                      onClick={() => fire(g, edit, { isReDraw: true })}
                      title={
                        tooSmall
                          ? "対象外 (10C 未満)"
                          : `${modeNameOf(edit.modeId)} × ${edit.count} で再抽選`
                      }
                    >
                      <span className={styles.btnAction}>再抽選</span>
                      {!tooSmall && (
                        <span className={styles.btnMeta}>
                          <span className={styles.btnMode}>
                            {modeNameOf(edit.modeId)}
                          </span>
                          <span className={styles.btnTimes}>×{edit.count}</span>
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnGhost}`}
                    onClick={() => setOpenId(isOpen ? null : g.id)}
                  >
                    {isOpen ? "閉じる" : "編集"}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className={styles.editor}>
                  <div className={styles.editGrid}>
                    <label className={styles.field}>
                      <span className={styles.label}>表示名</span>
                      <input
                        type="text"
                        className={styles.input}
                        value={edit.name}
                        onChange={e => patchEdit(g, { name: e.target.value })}
                        maxLength={64}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>コイン</span>
                      <input
                        type="number"
                        className={`${styles.input} ${styles.num}`}
                        value={edit.amount}
                        min={0}
                        max={100000}
                        onChange={e => {
                          const n = Number(e.target.value);
                          patchEdit(g, {
                            amount: Number.isFinite(n) ? n : 0,
                          });
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>ギフト名</span>
                      <input
                        type="text"
                        className={styles.input}
                        value={edit.giftName}
                        onChange={e => patchEdit(g, { giftName: e.target.value })}
                        maxLength={64}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>回数</span>
                      <input
                        type="number"
                        className={`${styles.input} ${styles.num}`}
                        value={edit.count}
                        min={1}
                        max={50}
                        onChange={e => {
                          const n = Number(e.target.value);
                          patchEdit(g, {
                            count: Number.isFinite(n) ? n : 1,
                            countDirty: true,
                          });
                        }}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>モード</span>
                      <select
                        className={`${styles.input} ${styles.select}`}
                        value={edit.modeId}
                        onChange={e => patchEdit(g, {
                          modeId: e.target.value,
                          modeDirty: true,
                        })}
                      >
                        {MODELS.map((m: Mode) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className={styles.editFoot}>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={edit.treatAsNewIdentity}
                        onChange={e =>
                          patchEdit(g, { treatAsNewIdentity: e.target.checked })
                        }
                      />
                      <span>別人として記録 (新規ID)</span>
                    </label>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost}`}
                      onClick={() => resetEdit(g)}
                    >
                      推奨値に戻す
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
