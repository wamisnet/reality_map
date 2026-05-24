"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG, THEMES } from "@/data/config";
import { MODELS } from "@/data/models";
import { SFX } from "@/lib/audio";
import { fmtCoord } from "@/lib/japan-data";
import { markGiftProcessed } from "@/lib/gifts-store";
import { saveResult } from "@/lib/results";
import {
  pushUtterance,
  utterResultLine,
  utterStartLine,
} from "@/lib/utterances";
import { useCandidates } from "@/hooks/useCandidates";
import { useActiveMode } from "@/hooks/useActiveMode";
import { useCrosshairScan } from "@/hooks/useCrosshairScan";
import { useGifts } from "@/hooks/useGifts";
import type { MapController, ProjectFn, Winner } from "@/types";
import { useAuth } from "./AuthProvider";
import CandidatesPool from "./CandidatesPool";
import Frame from "./Frame";
import GiftQueuePanel, { type FireFromGiftArgs } from "./GiftQueuePanel";
import HudHeader from "./hud/HudHeader";
import MapOverlay from "./map/MapOverlay";
import OperatorAvatar from "./OperatorAvatar";
import ParticipantPanel from "./ParticipantPanel";
import ResultCard from "./ResultCard";
import SaveErrorBanner, {
  toSaveErrorInfo,
  type SaveErrorInfo,
} from "./SaveErrorBanner";
import StatusBar from "./StatusBar";
import TriggerControls from "./TriggerControls";
import WinnersLog, { type DrawLogEntry } from "./WinnersLog";
import hudStyles from "./hud/Hud.module.css";
import styles from "./CrosshairScanApp.module.css";

const RealBasemap = dynamic(() => import("./map/RealBasemap"), {
  ssr: false,
});

export default function CrosshairScanApp() {
  const tweak = CONFIG;
  const theme = THEMES[tweak.theme] ?? THEMES.green;
  const { user } = useAuth();

  const { candidates: candidatesData } = useCandidates();
  const { activeModeId, setActiveModeId } = useActiveMode(MODELS);

  // 固定モデル必須: 不正/未設定 ID は先頭モデルにフォールバック
  const effectiveModelId = useMemo(() => {
    if (activeModeId && MODELS.some(m => m.id === activeModeId)) return activeModeId;
    return MODELS[0]?.id ?? "";
  }, [activeModeId]);
  const mode = useMemo(
    () => MODELS.find(m => m.id === effectiveModelId) ?? null,
    [effectiveModelId],
  );

  const [, setProject] = useState<ProjectFn | null>(null);
  const [controller, setController] = useState<MapController | null>(null);

  const [participantName, setParticipantName] = useState("");
  const [drawCount, setDrawCount] = useState(1);
  const [remaining, setRemaining] = useState(0);
  const [saveError, setSaveError] = useState<SaveErrorInfo | null>(null);
  const [drawLog, setDrawLog] = useState<DrawLogEntry[]>([]);

  const { gifts, loading: giftsLoading, error: giftsError } = useGifts(
    user?.uid ?? null,
  );

  // 「次の抽選 (連続中も含む) はこのギフト由来」を示すスナップショット。
  // 編集後の値を保持し、handleLocked から saveResult に流す。
  const activeGiftRef = useRef<{
    giftId: string;
    giftUserRaw: string | null;
    giftAmount: number;
    giftName: string;
    giftSource: string | null;
    treatAsNewIdentity: boolean;
  } | null>(null);

  // 一括抽選用: 次に流すべきセッション (= ギフト) を順次積むキュー。
  // 各セッションは「個別 fire と同じ挙動」を取り、間に continuousLockSec の wait を挟む。
  const sessionQueueRef = useRef<FireFromGiftArgs[]>([]);
  const [queueLen, setQueueLen] = useState(0);
  function setQueue(next: FireFromGiftArgs[]) {
    sessionQueueRef.current = next;
    setQueueLen(next.length);
  }

  const participantRef = useRef(participantName);
  useEffect(() => {
    participantRef.current = participantName;
  }, [participantName]);

  // 抽選開始時点のモードを snapshot するため、最新の mode 情報を ref に保持
  const modeSnapshotRef = useRef<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  useEffect(() => {
    modeSnapshotRef.current = {
      id: mode?.id ?? null,
      name: mode?.name ?? null,
    };
  }, [mode]);

  const handleLocked = useCallback(
    (winner: Winner) => {
      const name = participantRef.current.trim();
      if (!name || !user) return;
      pushUtterance(user.uid, utterResultLine(winner.name, winner.desc));
      setDrawLog(prev => [{ winner, participantName: name }, ...prev].slice(0, 5));
      const { id: modeId, name: modeName } = modeSnapshotRef.current;
      const giftSnap = activeGiftRef.current;
      const giftArg = giftSnap
        ? {
            giftId: giftSnap.giftId,
            userRaw: giftSnap.treatAsNewIdentity ? null : giftSnap.giftUserRaw,
            amount: giftSnap.giftAmount,
            giftName: giftSnap.giftName,
            source: giftSnap.giftSource,
          }
        : null;
      saveResult({
        winner,
        participantName: name,
        operatorUid: user.uid,
        operatorName: user.displayName ?? user.email ?? null,
        modeId,
        modeName,
        gift: giftArg,
      }).catch(err => {
        console.error("[saveResult] failed", err);
        setSaveError(toSaveErrorInfo(err));
      });
      // ギフト由来抽選なら、ギフトドキュメント本体にも「処理済み」フラグを書き戻す。
      // 連続抽選で複数回呼ばれても merge update なので冪等 (最新時刻で上書き)。
      // 失敗しても抽選結果自体は results に保存済みなのでログだけ。
      if (giftSnap) {
        markGiftProcessed(user.uid, giftSnap.giftId, user.uid).catch(err => {
          console.error("[markGiftProcessed] failed", err);
        });
      }
    },
    [user],
  );

  const {
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
  } = useCrosshairScan({
    candidates: candidatesData,
    tweak,
    controller,
    mode,
    onLocked: handleLocked,
  });

  useEffect(() => {
    SFX.setEnabled(tweak.sound);
  }, [tweak.sound]);

  const trimmedName = participantName.trim();
  const canFire = trimmedName.length > 0;

  const handleFire = useCallback(() => {
    if (!canFire) return;
    setSaveError(null);
    activeGiftRef.current = null; // 手入力経路: gift メタを必ずクリア
    setQueue([]); // 手動 fire はキューを破棄
    const n = Math.max(1, Math.min(50, Math.floor(drawCount)));
    setRemaining(n - 1);
    if (user) pushUtterance(user.uid, utterStartLine(participantRef.current));
    fire();
  }, [canFire, drawCount, fire, user]);

  const handleFireAgain = useCallback(() => {
    if (!canFire) return;
    setSaveError(null);
    activeGiftRef.current = null;
    setQueue([]);
    if (user) pushUtterance(user.uid, utterStartLine(participantRef.current));
    fireAgain();
  }, [canFire, fireAgain, user]);

  const handleCancelQueue = useCallback(() => {
    setRemaining(0);
    activeGiftRef.current = null;
    setQueue([]); // 一括抽選の残りセッションも破棄
  }, []);

  /**
   * 1ギフト = 1セッション分の state を立てて fire() する内部ヘルパー。
   * handleFireFromGift / 一括抽選の次セッション進行 から共有される。
   */
  const startSession = useCallback(
    (s: FireFromGiftArgs) => {
      activeGiftRef.current = {
        giftId: s.giftId,
        giftUserRaw: s.giftUserRaw,
        giftAmount: s.giftAmount,
        giftName: s.giftName,
        giftSource: s.giftSource,
        treatAsNewIdentity: s.treatAsNewIdentity,
      };
      setParticipantName(s.displayName);
      participantRef.current = s.displayName;
      setActiveModeId(s.modeId);
      setDrawCount(s.count);
      const n = Math.max(1, Math.min(50, Math.floor(s.count)));
      setRemaining(n - 1);
      if (user) pushUtterance(user.uid, utterStartLine(s.displayName));
      fire();
    },
    [fire, setActiveModeId, user],
  );

  const handleFireFromGift = useCallback(
    (sessions: FireFromGiftArgs[]) => {
      if (phase === "scanning" || remaining > 0) return;
      if (sessions.length === 0) return;
      setSaveError(null);
      // 先頭セッションを即実行、残りはキューに積む (continuousLockSec 間隔で順次進む)
      setQueue(sessions.slice(1));
      startSession(sessions[0]);
    },
    [phase, remaining, startSession],
  );

  // Continuous draws: after each locked result, auto reset → fire until queue drained.
  useEffect(() => {
    if (phase !== "locked" || remaining <= 0) return;
    const lockMs = Math.max(0, tweak.continuousLockSec * 1000);
    const t = window.setTimeout(() => {
      setRemaining(r => Math.max(0, r - 1));
      reset();
      window.setTimeout(() => fire(), 800);
    }, lockMs);
    return () => window.clearTimeout(t);
  }, [phase, remaining, reset, fire, tweak.continuousLockSec]);

  // 一括抽選の次セッション進行:
  // 現セッションの連続抽選が全部済んだ (locked & remaining=0) かつキューが残っているなら、
  // continuousLockSec 待って次のセッション (= 次のギフト) を独立 fire し直す。
  // queueLen 経由で deps を効かせている (ref だけだと effect が trigger しない)。
  useEffect(() => {
    if (phase !== "locked" || remaining !== 0) return;
    if (queueLen === 0) return;
    const lockMs = Math.max(0, tweak.continuousLockSec * 1000);
    const t = window.setTimeout(() => {
      const next = sessionQueueRef.current[0];
      if (!next) return;
      setQueue(sessionQueueRef.current.slice(1));
      reset();
      window.setTimeout(() => startSession(next), 800);
    }, lockMs);
    return () => window.clearTimeout(t);
  }, [phase, remaining, queueLen, reset, startSession, tweak.continuousLockSec]);

  // 全セッション (連続抽選もキューも) 完了したら gift snapshot を解除して手入力モードに戻す。
  useEffect(() => {
    if (phase === "idle" && remaining === 0 && queueLen === 0) {
      activeGiftRef.current = null;
    }
  }, [phase, remaining, queueLen]);

  const active = phase === "locked" ? locked : candidates[scanIdx];
  const display = active ?? candidates[0] ?? null;
  const coord = useMemo(
    () =>
      display
        ? fmtCoord(display.lat, display.lon)
        : { lat: "—", lon: "—", dec: "—" },
    [display],
  );

  const themeVars = {
    "--primary": theme.primary,
    "--soft": theme.soft,
    "--danger": theme.danger,
  } as React.CSSProperties;

  if (!display) {
    return (
      <div
        className={styles.root}
        data-theme={tweak.theme}
        style={themeVars}
      >
        <Frame />
        <div className={hudStyles.root}>
          <div className={hudStyles.row}>
            <HudHeader />
          </div>
        </div>
        <div className={styles.emptyState}>
          候補がまだ登録されていません。
          <a href="/edit">/edit</a> から追加してください。
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root} data-theme={tweak.theme} style={themeVars}>
      <div className={styles.map}>
        <RealBasemap
          layer="pale"
          onReady={(fn, ctrl) => {
            setProject(() => fn);
            setController(ctrl);
          }}
        >
          <MapOverlay
            candidates={candidates}
            scanIdx={scanIdx}
            phase={phase}
            drift={drift}
            locked={locked}
            posLL={posLL}
            winners={winners}
          />
        </RealBasemap>
      </div>

      <div className={styles.scanline} />
      <div
        key={locked?.at ?? "idle"}
        className={`${styles.flash} ${phase === "locked" ? styles.flashGo : ""}`}
      />

      <Frame />

      <div className={hudStyles.root}>
        <div className={hudStyles.row}>
          <HudHeader />
        </div>
      </div>

      <ParticipantPanel
        participantName={participantName}
        drawCount={drawCount}
        remaining={remaining}
        disabled={phase === "scanning" || remaining > 0}
        models={MODELS}
        activeModelId={effectiveModelId}
        onNameChange={setParticipantName}
        onCountChange={setDrawCount}
        onModelChange={setActiveModeId}
      />

      <CandidatesPool candidates={candidates} />

      {phase === "idle" && remaining === 0 && queueLen === 0 && (
        <GiftQueuePanel
          gifts={gifts}
          busy={false}
          onFire={handleFireFromGift}
          loading={giftsLoading}
          error={giftsError}
        />
      )}

      <OperatorAvatar
        phase={phase}
        locked={locked}
        revealRank={revealRank}
      />
      <WinnersLog entries={drawLog} />
      <ResultCard
        phase={phase}
        display={display}
        locked={locked}
        revealDetail={revealDetail}
        revealRank={revealRank}
        resultStyle={tweak.resultStyle}
        coord={coord}
      />
      <TriggerControls
        phase={phase}
        canFire={canFire}
        drawCount={drawCount}
        remaining={remaining}
        onFire={handleFire}
        onReset={reset}
        onFireAgain={handleFireAgain}
        onCancelQueue={handleCancelQueue}
      />
      <StatusBar
        phase={phase}
        frame={telemetry.frame}
        autoFire={tweak.autoFire}
      />
      <SaveErrorBanner
        error={saveError}
        onDismiss={() => setSaveError(null)}
      />
    </div>
  );
}
