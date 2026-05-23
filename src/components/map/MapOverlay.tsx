"use client";

import { useMapProject } from "./MapProjectionContext";
import * as JapanData from "@/lib/japan-data";
import { fmtCoord } from "@/lib/japan-data";
import type { Candidate, LatLon, Phase, Rank, Winner } from "@/types";

const RANK_FILL: Record<Rank, string> = {
  S: "oklch(0.72 0.16 80)",     // amber
  A: "var(--danger)",
  B: "oklch(0.6 0.15 230)",      // soft steel blue
  C: "oklch(0.55 0.03 60)",      // warm gray
};

interface Props {
  candidates: ReadonlyArray<Candidate>;
  scanIdx: number;
  phase: Phase;
  drift: number | null;
  locked: Winner | null;
  posLL: LatLon;
  winners: ReadonlyArray<Winner>;
}

export default function MapOverlay({
  candidates,
  scanIdx,
  phase,
  drift,
  locked,
  posLL,
  winners,
}: Props) {
  const project = useMapProject();

  const reticleP =
    phase === "locked" && locked
      ? project(locked.lon, locked.lat)
      : project(posLL.lon, posLL.lat);

  // Candidate dot base color (visible on the light/pale map)
  const dotIdle = "var(--primary)";
  const dotActive = "var(--danger)";

  return (
    <>
      {/* All candidate dots */}
      {candidates.map((cnd, i) => {
        const p = project(cnd.lon, cnd.lat);
        const isActive =
          i === scanIdx && (phase === "scanning" || phase === "locked");
        const isDriftFocus = phase === "idle" && i === drift;
        const r = isActive ? 9 : isDriftFocus ? 7 : 5;
        const fill = isActive ? dotActive : dotIdle;
        return (
          <g key={i} style={{ filter: `drop-shadow(0 0 5px ${fill})` }}>
            <circle cx={p.x} cy={p.y} r={r + 4} fill={fill} opacity="0.22" />
            <circle cx={p.x} cy={p.y} r={r} fill={fill} />
            {isActive && phase === "scanning" && (
              <circle
                cx={p.x}
                cy={p.y}
                r="14"
                fill="none"
                stroke="var(--danger)"
                strokeWidth="1.4"
                opacity="0.9"
              >
                <animate
                  attributeName="r"
                  from="14"
                  to="60"
                  dur="0.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.9"
                  to="0"
                  dur="0.8s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        );
      })}

      {/* Past winners on map */}
      {winners.slice(1).map((w, i) => {
        const p = project(w.lon, w.lat);
        return (
          <g
            key={`win-${i}`}
            opacity={Math.max(0.3, 0.7 - i * 0.12)}
            style={{ filter: "drop-shadow(0 0 3px var(--danger))" }}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r="9"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="1.4"
            />
            <circle cx={p.x} cy={p.y} r="3" fill="var(--danger)" />
          </g>
        );
      })}

      {/* Tracking reticle */}
      {phase !== "locked" && (() => {
        const c = phase === "scanning" ? "var(--danger)" : "var(--primary)";
        return (
          <g
            transform={`translate(${reticleP.x} ${reticleP.y})`}
            style={{
              filter: `drop-shadow(0 0 6px ${c})`,
            }}
          >
            <circle r="84" fill="none" stroke={c} strokeWidth="1.4" opacity="0.85">
              {phase === "scanning" && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 0 0"
                  to="360 0 0"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
            <circle
              r="42"
              fill="none"
              stroke={c}
              strokeWidth="0.9"
              opacity="0.7"
              strokeDasharray="6 8"
            />
            {[
              { x1: -140, y1: 0, x2: -26, y2: 0 },
              { x1: 26, y1: 0, x2: 140, y2: 0 },
              { x1: 0, y1: -140, x2: 0, y2: -26 },
              { x1: 0, y1: 26, x2: 0, y2: 140 },
            ].map((ln, i) => (
              <line
                key={i}
                {...ln}
                stroke={c}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            ))}
            {(
              [
                [-84, -84, 1, 1],
                [84, -84, -1, 1],
                [-84, 84, 1, -1],
                [84, 84, -1, -1],
              ] as const
            ).map(([cx, cy, sx, sy], i) => (
              <g key={i} transform={`translate(${cx} ${cy})`}>
                <line
                  x1="0"
                  y1="0"
                  x2={sx * 18}
                  y2="0"
                  stroke={c}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={sy * 18}
                  stroke={c}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </g>
            ))}
            <circle r="2.5" fill={c} />
          </g>
        );
      })()}

      {/* Lock callout */}
      {phase === "locked" && locked && (() => {
        const p = project(locked.lon, locked.lat);
        const c = fmtCoord(locked.lat, locked.lon);
        const onRight = p.x < JapanData.WIDTH * 0.55;
        const sx = onRight ? 1 : -1;
        const panelW = 520;
        const panelH = 200;
        const elbow = { x: p.x + sx * 200, y: p.y - 180 };
        const panelX = onRight ? elbow.x : elbow.x - panelW;
        const panelTop = elbow.y - panelH;
        const textX = panelX + 24;
        return (
          <g
            style={{
              filter:
                "drop-shadow(0 0 10px var(--danger)) drop-shadow(0 0 2px var(--danger))",
            }}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r="65"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="1.5"
              opacity="0.85"
            >
              <animate
                attributeName="r"
                values="65;260"
                dur="1.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.85;0"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={p.x}
              cy={p.y}
              r="65"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="1.5"
              opacity="0.85"
            >
              <animate
                attributeName="r"
                values="65;260"
                dur="1.8s"
                begin="0.9s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.85;0"
                dur="1.8s"
                begin="0.9s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={p.x}
              cy={p.y}
              r="96"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="1.5"
              opacity="0.95"
            />
            <circle
              cx={p.x}
              cy={p.y}
              r="58"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="0.9"
              strokeDasharray="6 10"
              opacity="0.85"
            />

            {[
              { x1: p.x - 190, y1: p.y, x2: p.x - 58, y2: p.y },
              { x1: p.x + 58, y1: p.y, x2: p.x + 190, y2: p.y },
              { x1: p.x, y1: p.y - 190, x2: p.x, y2: p.y - 58 },
              { x1: p.x, y1: p.y + 58, x2: p.x, y2: p.y + 190 },
            ].map((ln, i) => (
              <line
                key={i}
                {...ln}
                stroke="var(--danger)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ))}

            <line
              x1={p.x - 26}
              y1={p.y}
              x2={p.x + 26}
              y2={p.y}
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1={p.x}
              y1={p.y - 26}
              x2={p.x}
              y2={p.y + 26}
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {(
              [
                [-1, -1],
                [1, -1],
                [-1, 1],
                [1, 1],
              ] as const
            ).map(([cx, cy], i) => (
              <g
                key={i}
                transform={`translate(${p.x + cx * 96} ${p.y + cy * 96})`}
              >
                <line
                  x1="0"
                  y1="0"
                  x2={-cx * 22}
                  y2="0"
                  stroke="var(--danger)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={-cy * 22}
                  stroke="var(--danger)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </g>
            ))}

            <circle cx={p.x} cy={p.y} r="6" fill="var(--danger)" />
            <circle cx={p.x} cy={p.y} r="2.5" fill="#ffffff" />

            <line
              x1={p.x + sx * 96}
              y1={p.y - 22}
              x2={elbow.x}
              y2={elbow.y}
              stroke="var(--danger)"
              strokeWidth="1.2"
              opacity="0.9"
            />
            <line
              x1={elbow.x}
              y1={elbow.y}
              x2={panelX + (onRight ? 0 : panelW)}
              y2={elbow.y}
              stroke="var(--danger)"
              strokeWidth="1.2"
              opacity="0.9"
            />

            {/* White callout panel with soft shadow */}
            <rect
              x={panelX}
              y={panelTop}
              width={panelW}
              height={panelH}
              rx="14"
              fill="rgba(255, 255, 255, 0.96)"
            />
            <rect
              x={onRight ? panelX : panelX + panelW - 4}
              y={panelTop}
              width="4"
              height={panelH}
              rx="2"
              fill="var(--danger)"
            />

            <text
              x={textX}
              y={panelTop + 36}
              fontFamily="JetBrains Mono, monospace"
              fontSize="14"
              fontWeight="500"
              letterSpacing="6"
              fill="var(--danger)"
            >
              TARGET LOCKED
            </text>
            <text
              x={panelX + panelW - 24}
              y={panelTop + 40}
              fontFamily="JetBrains Mono, monospace"
              fontSize="32"
              fontWeight="700"
              letterSpacing="2"
              textAnchor="end"
              fill={RANK_FILL[locked.rank]}
            >
              {locked.rank}
            </text>
            <text
              x={textX}
              y={panelTop + 76}
              fontFamily="JetBrains Mono, monospace"
              fontSize="13"
              letterSpacing="3"
              fill="rgba(58, 42, 37, 0.55)"
            >
              {locked.category || locked.pref}
            </text>
            <text
              x={textX}
              y={panelTop + 132}
              fontFamily="Noto Sans JP, sans-serif"
              fontSize="46"
              fontWeight="500"
              letterSpacing="2"
              fill="#3a2a25"
            >
              {locked.name}
            </text>
            <text
              x={textX}
              y={panelTop + 172}
              fontFamily="JetBrains Mono, monospace"
              fontSize="13"
              letterSpacing="2"
              fill="rgba(58, 42, 37, 0.6)"
            >
              {c.lat} · {c.lon}
            </text>
          </g>
        );
      })()}
    </>
  );
}
