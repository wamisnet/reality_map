"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG, THEMES } from "@/data/config";
import { MODELS } from "@/data/models";
import { SFX } from "@/lib/audio";
import { fmtCoord } from "@/lib/japan-data";
import { saveResult } from "@/lib/results";
import { useCandidates } from "@/hooks/useCandidates";
import { useActiveMode } from "@/hooks/useActiveMode";
import { useCrosshairScan } from "@/hooks/useCrosshairScan";
import type { MapController, ProjectFn, Winner } from "@/types";
import { useAuth } from "./AuthProvider";
import CandidatesPool from "./CandidatesPool";
import Frame from "./Frame";
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
      setDrawLog(prev => [{ winner, participantName: name }, ...prev].slice(0, 5));
      const { id: modeId, name: modeName } = modeSnapshotRef.current;
      saveResult({
        winner,
        participantName: name,
        operatorUid: user.uid,
        operatorName: user.displayName ?? user.email ?? null,
        modeId,
        modeName,
      }).catch(err => {
        console.error("[saveResult] failed", err);
        setSaveError(toSaveErrorInfo(err));
      });
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
    const n = Math.max(1, Math.min(50, Math.floor(drawCount)));
    setRemaining(n - 1);
    fire();
  }, [canFire, drawCount, fire]);

  const handleFireAgain = useCallback(() => {
    if (!canFire) return;
    setSaveError(null);
    fireAgain();
  }, [canFire, fireAgain]);

  const handleCancelQueue = useCallback(() => {
    setRemaining(0);
  }, []);

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

  const active = phase === "locked" ? locked : candidates[scanIdx];
  const display = active ?? candidates[0];
  const coord = useMemo(
    () => fmtCoord(display.lat, display.lon),
    [display.lat, display.lon],
  );

  const themeVars = {
    "--primary": theme.primary,
    "--soft": theme.soft,
    "--danger": theme.danger,
  } as React.CSSProperties;

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
