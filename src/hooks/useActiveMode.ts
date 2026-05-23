"use client";

import { useCallback, useState } from "react";
import type { Mode } from "@/types";

const STORAGE_KEY = "crosshair.activeModeId";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface Result {
  mode: Mode | null;
  activeModeId: string | null;
  setActiveModeId: (id: string | null) => void;
}

/**
 * localStorage 永続な「現在使用中のモードID」と、それを modes リストから解決した現モード。
 * このフックは "use client" コンポーネントからのみ呼ばれる前提なので、
 * mount 時に lazy initializer で localStorage を直接読む。
 */
export function useActiveMode(modes: ReadonlyArray<Mode>): Result {
  const [activeModeId, setActiveModeIdState] = useState<string | null>(readStored);

  const setActiveModeId = useCallback((id: string | null) => {
    setActiveModeIdState(id);
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  // 解決された現モード。指定 ID が見つからない場合は null（一様）。
  const mode = activeModeId
    ? (modes.find(m => m.id === activeModeId && m.enabled) ?? null)
    : null;

  return { mode, activeModeId, setActiveModeId };
}
