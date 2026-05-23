"use client";

import { useSyncExternalStore } from "react";
import { type CharacterPose } from "@/data/character";

type Manifest = Partial<Record<CharacterPose, string>>;

// Stable empty reference used as the initial / fallback snapshot.
// useSyncExternalStore requires getSnapshot to return the same object
// across renders when the state has not changed.
const EMPTY_MANIFEST: Manifest = Object.freeze({}) as Manifest;

let cached: Manifest | null = null;
let loading = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

function ts() {
  return performance.now().toFixed(1);
}

// GC で消えないよう module スコープで強参照を保持する。読み込み完了後も保持し続けることで
// ブラウザ画像キャッシュにヒントを残し、後続の <img src=...> 切替が即時で済むようにする。
const preloadedImages = new Set<HTMLImageElement>();
const preloadedUrls = new Set<string>();

function preloadAll(manifest: Manifest) {
  if (typeof window === "undefined") return;
  const entries = Object.entries(manifest).filter(
    (e): e is [string, string] =>
      typeof e[1] === "string" && e[1].length > 0 && !preloadedUrls.has(e[1]),
  );
  console.log(`[avatar-debug] ${ts()}ms preloadAll start: ${entries.length} urls`);
  let remaining = entries.length;
  const batchStartedAt = performance.now();
  for (const [pose, url] of entries) {
    const startedAt = performance.now();
    const img = new window.Image();
    preloadedImages.add(img);
    preloadedUrls.add(url);
    img.decoding = "async";
    img.onload = () => {
      console.log(
        `[avatar-debug] ${ts()}ms preload onload pose=${pose} took=${(performance.now() - startedAt).toFixed(1)}ms url=${url}`,
      );
      remaining--;
      if (remaining === 0) {
        console.log(
          `[avatar-debug] ${ts()}ms preloadAll DONE total=${(performance.now() - batchStartedAt).toFixed(1)}ms`,
        );
      }
    };
    img.onerror = () => {
      console.log(`[avatar-debug] ${ts()}ms preload ONERROR pose=${pose} url=${url}`);
      preloadedUrls.delete(url);
      remaining--;
    };
    img.src = url;
  }
}

function ensureLoaded() {
  if (cached !== null || loading) return;
  if (typeof window === "undefined") return;
  loading = true;
  console.log(`[avatar-debug] ${ts()}ms manifest fetch start`);
  void fetch("/character/manifest.json", { cache: "no-store" })
    .then(async r => {
      if (!r.ok) return null;
      return (await r.json()) as unknown;
    })
    .then(m => {
      cached =
        m && typeof m === "object" ? (m as Manifest) : EMPTY_MANIFEST;
      loading = false;
      console.log(
        `[avatar-debug] ${ts()}ms manifest fetch done keys=${Object.keys(cached).length}`,
      );
      preloadAll(cached);
      notify();
    })
    .catch(err => {
      cached = EMPTY_MANIFEST;
      loading = false;
      console.log(`[avatar-debug] ${ts()}ms manifest fetch FAILED`, err);
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
  getSnapshot(): Manifest {
    return cached ?? EMPTY_MANIFEST;
  },
  getServerSnapshot(): Manifest {
    return EMPTY_MANIFEST;
  },
};

/**
 * 指定したポーズに対する画像 URL を返す。
 * manifest.json にまだ読み込めていない / そのポーズの登録が無い場合は null を返す。
 * 呼び出し側は null のときは <img> を描画しない、というポリシーで運用する。
 */
export function useCharacterSrc(pose: CharacterPose): string | null {
  const manifest = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return manifest[pose] ?? null;
}

/** Force-refresh the manifest cache (called after upload). */
export function invalidateCharacterManifest() {
  cached = null;
  loading = false;
  // 直ちに再 fetch を仕掛ける。完了後に listeners が notify される。
  ensureLoaded();
}
