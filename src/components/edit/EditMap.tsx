"use client";

import "leaflet/dist/leaflet.css";
import L, { type Map as LMap, type Marker as LMarker } from "leaflet";
import { useEffect, useRef } from "react";
import type { EditableCandidate, LatLon, Rank } from "@/types";
import styles from "./EditMap.module.css";

interface Props {
  /** 既存候補（ランク別カラードット） */
  existing: ReadonlyArray<EditableCandidate>;
  /** クリック/ドラッグで決まった暫定ピンの位置。null なら未配置 */
  draft: LatLon | null;
  /** 編集中の既存候補 id。一致する点はハイライト表示。 */
  editingId: string | null;
  /** ユーザーが地図(空白部分)をクリックしたとき */
  onPick: (ll: LatLon) => void;
  /** 暫定ピンをドラッグして位置調整したとき */
  onDraftMove: (ll: LatLon) => void;
  /** 既存ピンをクリックしたとき */
  onEditExisting: (id: string) => void;
}

// 日本全体の初期ビュー
const INITIAL_CENTER: [number, number] = [37.5, 138];
const INITIAL_ZOOM = 5;

// 地理院 淡色地図
const TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '出典：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>(淡色地図)';

const RANK_CLASS: Record<Rank, string> = {
  S: styles.dotS,
  A: styles.dotA,
  B: styles.dotB,
  C: styles.dotC,
};

function dotIcon(rank: Rank, highlighted: boolean) {
  const classes = [styles.dot, RANK_CLASS[rank], highlighted ? styles.dotActive : ""]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    html: `<div class="${classes}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function draftIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="${styles.draftPin}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function EditMap({
  existing,
  draft,
  editingId,
  onPick,
  onDraftMove,
  onEditExisting,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const existingLayerRef = useRef<L.LayerGroup | null>(null);
  const draftMarkerRef = useRef<LMarker | null>(null);

  // refs to latest callbacks (handlers are bound once at mount)
  const onPickRef = useRef(onPick);
  const onDraftMoveRef = useRef(onDraftMove);
  const onEditExistingRef = useRef(onEditExisting);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    onDraftMoveRef.current = onDraftMove;
  }, [onDraftMove]);
  useEffect(() => {
    onEditExistingRef.current = onEditExisting;
  }, [onEditExisting]);

  // ─── マップ初期化 ────────────────────────────────────────────────
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const m = L.map(node, {
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: false,
    }).setView(INITIAL_CENTER, INITIAL_ZOOM);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 18,
      minZoom: 4,
    }).addTo(m);

    const group = L.layerGroup().addTo(m);
    existingLayerRef.current = group;
    mapRef.current = m;

    m.on("click", e => {
      onPickRef.current({ lon: e.latlng.lng, lat: e.latlng.lat });
    });

    return () => {
      m.remove();
      mapRef.current = null;
      existingLayerRef.current = null;
      draftMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 既存候補の点を更新 ──────────────────────────────────────────
  useEffect(() => {
    const group = existingLayerRef.current;
    if (!group) return;
    group.clearLayers();
    for (const c of existing) {
      const marker = L.marker([c.lat, c.lon], {
        icon: dotIcon(c.rank, c.id === editingId),
        interactive: true,
        keyboard: false,
        riseOnHover: true,
        title: `${c.rank} · ${c.name}`,
      }).addTo(group);
      marker.on("click", e => {
        // 地図の click ハンドラに伝播させない (= 新規ピンを置かない)
        L.DomEvent.stopPropagation(e);
        onEditExistingRef.current(c.id);
      });
    }
  }, [existing, editingId]);

  // ─── 暫定ピンの配置/更新 ─────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (!draft) {
      if (draftMarkerRef.current) {
        draftMarkerRef.current.remove();
        draftMarkerRef.current = null;
      }
      return;
    }
    if (!draftMarkerRef.current) {
      const marker = L.marker([draft.lat, draft.lon], {
        icon: draftIcon(),
        draggable: true,
        autoPan: true,
      }).addTo(m);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        onDraftMoveRef.current({ lon: ll.lng, lat: ll.lat });
      });
      draftMarkerRef.current = marker;
    } else {
      draftMarkerRef.current.setLatLng([draft.lat, draft.lon]);
    }
  }, [draft]);

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.map} />
      <div className={styles.help}>
        {editingId
          ? "EDITING EXISTING POINT · DRAG TO RELOCATE · CLICK ELSEWHERE FOR NEW"
          : draft
            ? "DRAG PIN TO ADJUST · CLICK ELSEWHERE TO MOVE"
            : "CLICK A PIN TO EDIT · CLICK MAP TO ADD NEW"}
      </div>
      <div className={styles.legend} aria-hidden>
        {(["S", "A", "B", "C"] as Rank[]).map(r => (
          <span key={r} className={styles.legendItem}>
            <span className={`${styles.legendDot} ${RANK_CLASS[r]}`} />
            <span className={styles.legendLabel}>{r}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
