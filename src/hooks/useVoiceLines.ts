"use client";

import { useSyncExternalStore } from "react";
import {
  EMPTY_VOICE_LINES,
  normalizeVoiceLines,
  type VoiceLines,
} from "@/data/voice-lines-types";

let cached: VoiceLines | null = null;
let loading = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

function ensureLoaded() {
  if (cached !== null || loading) return;
  if (typeof window === "undefined") return;
  loading = true;
  void fetch("/api/voice-lines", { cache: "no-store" })
    .then(async r => (r.ok ? ((await r.json()) as unknown) : null))
    .then(j => {
      cached = j ? normalizeVoiceLines(j) : EMPTY_VOICE_LINES;
      loading = false;
      notify();
    })
    .catch(() => {
      cached = EMPTY_VOICE_LINES;
      loading = false;
      notify();
    });
}

const store = {
  subscribe(listener: () => void) {
    ensureLoaded();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): VoiceLines {
    return cached ?? EMPTY_VOICE_LINES;
  },
  getServerSnapshot(): VoiceLines {
    return EMPTY_VOICE_LINES;
  },
};

export function useVoiceLines(): VoiceLines {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

/** エディタで保存後に呼ぶ。次の getSnapshot で再 fetch される。 */
export function invalidateVoiceLines() {
  cached = null;
  loading = false;
  ensureLoaded();
}
