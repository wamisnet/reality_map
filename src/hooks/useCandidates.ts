"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeCandidates } from "@/lib/candidates-store";
import { builtInCandidates } from "@/data/candidates";
import {
  toSaveErrorInfo,
  type SaveErrorInfo,
} from "@/components/SaveErrorBanner";
import type { EditableCandidate } from "@/types";

interface Result {
  candidates: ReadonlyArray<EditableCandidate>;
  loading: boolean;
  error: SaveErrorInfo | null;
  /** true なら in-code フォールバックを返している（Firestore 未seed） */
  usingFallback: boolean;
}

/**
 * Firestore の candidates を購読する。
 * - 初期はローディング状態。
 * - Firestore が空のときは in-code の builtInCandidates() を返す（usingFallback=true）。
 * - 取得失敗時は in-code にフォールバックしつつ error を出す。
 */
export function useCandidates(): Result {
  const fallback = useMemo(() => builtInCandidates(), []);
  const [list, setList] = useState<EditableCandidate[] | null>(null);
  const [error, setError] = useState<SaveErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    try {
      unsub = subscribeCandidates(
        next => {
          if (cancelled) return;
          setList(next);
        },
        err => {
          if (cancelled) return;
          console.error("[useCandidates] subscribe error", err);
          setError(toSaveErrorInfo(err));
          setList([]);
        },
      );
    } catch (err) {
      console.error("[useCandidates] init failed", err);
      queueMicrotask(() => {
        if (cancelled) return;
        setError(toSaveErrorInfo(err));
        setList([]);
      });
    }
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (list === null) {
    // ローディング中：UI は何かを出したいのでフォールバックを使う
    return { candidates: fallback, loading: true, error, usingFallback: true };
  }
  if (list.length === 0) {
    return { candidates: fallback, loading: false, error, usingFallback: true };
  }
  return { candidates: list, loading: false, error, usingFallback: false };
}
