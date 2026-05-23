import { useCallback, useEffect, useRef, useState } from "react";
import { SFX } from "@/lib/audio";
import { fmtCoord } from "@/lib/japan-data";
import { nowStamp } from "@/lib/format";
import { pickWeightedIndex } from "@/lib/weighted-pick";
import { useAnimationFrame } from "./useAnimationFrame";
import type {
  EditableCandidate,
  LatLon,
  MapController,
  Mode,
  Phase,
  Telemetry,
  Tweak,
  Winner,
} from "@/types";

const INITIAL_TELEMETRY: Telemetry = {
  signal: 87,
  noise: 12,
  drift: 0,
  frame: 0,
};

const CENTER: LatLon = { lon: 135, lat: 36 };

// ランクバッジを別タイマーで遅れて出すサスペンス1拍 (ms)
const REVEAL_RANK_DELAY_MS = 400;

interface Options {
  candidates: ReadonlyArray<EditableCandidate>;
  tweak: Tweak;
  controller: MapController | null;
  mode: Mode | null;
  onLocked?: (winner: Winner) => void;
}

interface Result {
  candidates: ReadonlyArray<EditableCandidate>;
  phase: Phase;
  scanIdx: number;
  locked: Winner | null;
  winners: ReadonlyArray<Winner>;
  posLL: LatLon;
  drift: number | null;
  telemetry: Telemetry;
  revealDetail: boolean;
  revealRank: boolean;
  fire: () => void;
  reset: () => void;
  fireAgain: () => void;
}

export function useCrosshairScan({
  candidates,
  tweak,
  controller,
  mode,
  onLocked,
}: Options): Result {
  const onLockedRef = useRef(onLocked);
  useEffect(() => {
    onLockedRef.current = onLocked;
  }, [onLocked]);

  // mode を最新で参照できるよう ref に保存（fire() 開始時に snapshot）
  const modeRef = useRef<Mode | null>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const [scanIdx, setScanIdx] = useState(0);
  const [locked, setLocked] = useState<Winner | null>(null);
  const [revealDetail, setRevealDetail] = useState(false);
  const [revealRank, setRevealRank] = useState(false);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [posLL, setPosLL] = useState<LatLon>(CENTER);
  const targetLLRef = useRef<LatLon>({ ...CENTER });
  const [drift, setDrift] = useState<number | null>(null);
  const lastDriftRef = useRef(0);
  const lastTickIdxRef = useRef(-1);
  const [telemetry, setTelemetry] = useState<Telemetry>(INITIAL_TELEMETRY);

  // 最新の controller を ref で保持（コールバックが古い値を掴まないように）
  const controllerRef = useRef<MapController | null>(controller);
  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  // ─── Per-frame: smooth reticle toward target, tick telemetry, idle drift.
  useAnimationFrame(
    useCallback(
      (_dt: number, now: number) => {
        setPosLL(prev => {
          const k = phaseRef.current === "scanning" ? 0.18 : 0.04;
          return {
            lon: prev.lon + (targetLLRef.current.lon - prev.lon) * k,
            lat: prev.lat + (targetLLRef.current.lat - prev.lat) * k,
          };
        });

        setTelemetry(t => ({
          signal: Math.max(
            72,
            Math.min(98, t.signal + (Math.random() - 0.5) * 2),
          ),
          noise: Math.max(
            3,
            Math.min(28, t.noise + (Math.random() - 0.5) * 1.6),
          ),
          drift: Number(
            (Math.sin(now / 1300) * 1.2 + (Math.random() - 0.5) * 0.3).toFixed(2),
          ),
          frame: t.frame + 1,
        }));

        if (
          phaseRef.current === "idle" &&
          candidates.length > 0 &&
          now - lastDriftRef.current > 3000 + Math.random() * 2000
        ) {
          lastDriftRef.current = now;
          const idx = Math.floor(Math.random() * candidates.length);
          const c = candidates[idx];
          targetLLRef.current = { lon: c.lon, lat: c.lat };
          setDrift(idx);
        }
      },
      [candidates],
    ),
  );

  // ─── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setLocked(null);
    setPhaseBoth("idle");
    lastDriftRef.current = 0;
    targetLLRef.current = { ...CENTER };
    setPosLL({ ...CENTER });
    controllerRef.current?.reset(1.0);
  }, [setPhaseBoth]);

  // ─── Fire trigger ─────────────────────────────────────────────────────────
  const fire = useCallback(
    () => {
      if (phaseRef.current !== "idle") return;
      if (candidates.length === 0) return;

      // 抽選開始時点のモードをスナップショット（途中でモード切替されてもこの fire は固定）
      const modeSnapshot = modeRef.current;

      SFX.ensure();
      SFX.sweep({ from: 180, to: 900, dur: 0.45 });
      setLocked(null);
      setPhaseBoth("scanning");
      lastTickIdxRef.current = -1;

      const finalIdx = pickWeightedIndex(candidates, modeSnapshot);
      if (finalIdx < 0) {
        // pickWeightedIndex がフィルタで何も選べなかった場合：idle に戻して空振り
        setPhaseBoth("idle");
        return;
      }

      const TICKS = 26;
      let i = 0;
      const step = () => {
        const t = i / TICKS;
        const span = Math.max(1, Math.floor((1 - t) * candidates.length * 0.4));
        const next =
          i === TICKS
            ? finalIdx
            : ((finalIdx + Math.floor((Math.random() * 2 - 1) * span)) +
                candidates.length) %
              candidates.length;
        setScanIdx(next);
        const cand = candidates[next];
        targetLLRef.current = { lon: cand.lon, lat: cand.lat };
        if (next !== lastTickIdxRef.current) {
          SFX.tick({ freq: 1100 + Math.random() * 700, vol: 0.18 });
          lastTickIdxRef.current = next;
        }
        if (i < TICKS) {
          const base = (22 + Math.pow(t, 2.4) * 220) / tweak.speed;
          i++;
          window.setTimeout(step, base);
        } else {
          const w = candidates[finalIdx];
          const c = fmtCoord(w.lat, w.lon);
          const snapshotImages =
            Array.isArray(w.images) && w.images.length > 0
              ? [...w.images]
              : w.image
                ? [w.image]
                : null;
          const winner: Winner = {
            name: w.name,
            pref: w.pref,
            lon: w.lon,
            lat: w.lat,
            image: snapshotImages?.[0] ?? null,
            images: snapshotImages,
            desc: w.desc ?? null,
            category: w.category ?? null,
            rank: w.rank,
            c,
            at: nowStamp(),
          };
          console.log(
            `[avatar-debug] ${performance.now().toFixed(1)}ms LOCKED rank=${winner.rank} name=${winner.name}`,
          );
          setLocked(winner);
          setWinners(ws => [winner, ...ws].slice(0, 5));
          setPhaseBoth("locked");
          onLockedRef.current?.(winner);
          SFX.lockOnByRank(winner.rank);
          const ctrl = controllerRef.current;
          if (ctrl) {
            const z = tweak.lockZoom ?? 11;
            window.setTimeout(() => ctrl.flyTo(w.lon, w.lat, z, 1.6), 280);
          }
        }
      };
      step();
    },
    [candidates, setPhaseBoth, tweak.speed, tweak.lockZoom],
  );

  // ─── Auto-fire mode ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!tweak.autoFire || phase !== "idle") return;
    const wait = 8000 + Math.random() * 6000;
    const t = window.setTimeout(() => fire(), wait);
    return () => window.clearTimeout(t);
  }, [tweak.autoFire, phase, winners.length, fire]);

  // ─── Auto-close after a delay in the locked state ────────────────────────
  useEffect(() => {
    if (phase !== "locked") return;
    const ms = (tweak.autoCloseSec ?? 60) * 1000;
    const t = window.setTimeout(() => reset(), ms);
    return () => window.clearTimeout(t);
  }, [phase, tweak.autoCloseSec, reset]);

  // ─── Delayed rank reveal: ロック直後、サスペンス1拍置いてからランクバッジを出す
  useEffect(() => {
    if (phase !== "locked") return;
    console.log(
      `[avatar-debug] ${performance.now().toFixed(1)}ms revealRank timer scheduled (+${REVEAL_RANK_DELAY_MS}ms)`,
    );
    const t = window.setTimeout(() => {
      console.log(
        `[avatar-debug] ${performance.now().toFixed(1)}ms revealRank=true (timer fired)`,
      );
      setRevealRank(true);
    }, REVEAL_RANK_DELAY_MS);
    return () => {
      window.clearTimeout(t);
      setRevealRank(false);
    };
  }, [phase, locked]);

  // ─── Delayed detail reveal (画像/説明文)
  useEffect(() => {
    if (phase !== "locked") return;
    const ms = (tweak.detailDelaySec ?? 1.6) * 1000;
    const t = window.setTimeout(() => setRevealDetail(true), ms);
    return () => {
      window.clearTimeout(t);
      setRevealDetail(false);
    };
  }, [phase, locked, tweak.detailDelaySec]);

  const fireAgain = useCallback(() => {
    reset();
    window.setTimeout(() => fire(), 2200);
  }, [reset, fire]);

  return {
    candidates,
    phase,
    scanIdx,
    locked,
    winners,
    posLL,
    drift,
    telemetry,
    revealDetail,
    revealRank,
    fire,
    reset,
    fireAgain,
  };
}
