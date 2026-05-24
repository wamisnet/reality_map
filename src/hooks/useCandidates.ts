"use client";

import { useEffect, useState } from "react";
import { subscribeCandidates } from "@/lib/candidates-store";
import {
  toSaveErrorInfo,
  type SaveErrorInfo,
} from "@/components/SaveErrorBanner";
import type { EditableCandidate } from "@/types";

interface Result {
  candidates: ReadonlyArray<EditableCandidate>;
  loading: boolean;
  error: SaveErrorInfo | null;
}

/**
 * Firestore の candidates を購読する。
 * 取得失敗時は空リスト + error を返す。
 */
export function useCandidates(): Result {
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
    return { candidates: [], loading: true, error };
  }
  return { candidates: list, loading: false, error };
}
