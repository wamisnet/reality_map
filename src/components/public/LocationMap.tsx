"use client";

import "leaflet/dist/leaflet.css";
import L, { type Map as LMap } from "leaflet";
import { useEffect, useRef } from "react";
import styles from "./LocationMap.module.css";

interface Props {
  lat: number;
  lon: number;
  /** ピン上のツールチップ用ラベル (例: 場所の名前) */
  label?: string;
  /** 初期ズーム (default 13) */
  zoom?: number;
  className?: string;
}

const TILE_URL = "/tiles/pale/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '出典：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>(淡色地図)';

/**
 * 公開詳細ページに埋め込む小さい Leaflet マップ。
 * GSI 淡色タイル + シンプルなピン。スクロール/ピンチで拡縮、ドラッグで移動可。
 */
export default function LocationMap({
  lat,
  lon,
  label,
  zoom = 13,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const map = L.map(node, {
      center: [lat, lon],
      zoom,
      scrollWheelZoom: true,
      attributionControl: true,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 18,
    }).addTo(map);

    const pinHtml = `<div class="${styles.pin}"><div class="${styles.pinDot}"></div></div>`;
    const icon = L.divIcon({
      className: "",
      html: pinHtml,
      iconSize: [28, 36],
      iconAnchor: [14, 32],
    });

    const marker = L.marker([lat, lon], { icon, keyboard: false }).addTo(map);
    if (label) marker.bindTooltip(label, { direction: "top", offset: [0, -28] });

    // ResizeObserver で親サイズ変更時に再計算
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(node);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // lat/lon が変わったら再作成 (この詳細ページではほぼ起こらないが念のため)
  }, [lat, lon, zoom, label]);

  return (
    <div
      ref={containerRef}
      className={`${styles.root} ${className ?? ""}`}
      aria-label={label ? `${label} の地図` : "地図"}
      role="img"
    />
  );
}
