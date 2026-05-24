"use client";

import { useEffect, useState } from "react";
import { subscribeGifts, type GiftDoc } from "@/lib/gifts-store";

interface Result {
  gifts: ReadonlyArray<GiftDoc>;
  loading: boolean;
  error: string | null;
}

/**
 * オペレーター本人 (= 配信者) の uid 配下のギフトをリアルタイム購読する。
 * uid が null の間は購読しない (= サインイン待ち)。
 */
export function useGifts(uid: string | null): Result {
  const [list, setList] = useState<GiftDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setList(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    let unsub = () => {};
    try {
      unsub = subscribeGifts(
        uid,
        next => {
          if (cancelled) return;
          setList(next);
        },
        err => {
          if (cancelled) return;
          console.error("[useGifts] subscribe error", err);
          setError(err.message);
          setList([]);
        },
      );
    } catch (err) {
      console.error("[useGifts] init failed", err);
      queueMicrotask(() => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setList([]);
      });
    }
    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid]);

  if (list === null) {
    return { gifts: [], loading: uid !== null, error };
  }
  return { gifts: list, loading: false, error };
}
