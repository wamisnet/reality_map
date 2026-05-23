"use client";

import "leaflet/dist/leaflet.css";
import L, { type Map as LMap } from "leaflet";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MapProjectionContext } from "./MapProjectionContext";
import * as JapanData from "@/lib/japan-data";
import type { MapController, ProjectFn } from "@/types";
import styles from "./RealBasemap.module.css";

type Layer = "satellite" | "terrain" | "dark" | "pale";

interface Props {
  layer?: Layer;
  showAtmosphere?: boolean;
  onReady?: (project: ProjectFn, controller: MapController) => void;
  children?: ReactNode;
}

const BOUNDS: L.LatLngBoundsLiteral = [
  [28, 128],
  [46, 146],
];

const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>';

const TILE_URLS: Record<
  Layer,
  { url: string; attribution: string; maxZoom: number }
> = {
  satellite: {
    url: "/tiles/seamlessphoto/{z}/{x}/{y}.jpg",
    attribution: `出典：${GSI_ATTRIBUTION}(シームレス空中写真)`,
    maxZoom: 18,
  },
  terrain: {
    url: "/tiles/std/{z}/{x}/{y}.png",
    attribution: `出典：${GSI_ATTRIBUTION}(標準地図)`,
    maxZoom: 18,
  },
  dark: {
    url: "/tiles/pale/{z}/{x}/{y}.png",
    attribution: `出典：${GSI_ATTRIBUTION}(淡色地図)`,
    maxZoom: 18,
  },
  pale: {
    url: "/tiles/pale/{z}/{x}/{y}.png",
    attribution: `出典：${GSI_ATTRIBUTION}(淡色地図)`,
    maxZoom: 18,
  },
};

export default function RealBasemap({
  layer = "satellite",
  showAtmosphere = true,
  onReady,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const m = L.map(node, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      touchZoom: false,
      keyboard: false,
      boxZoom: false,
      zoomSnap: 0.001,
    });

    const conf = TILE_URLS[layer];
    L.tileLayer(conf.url, {
      attribution: conf.attribution,
      maxZoom: conf.maxZoom,
      minZoom: 3,
    }).addTo(m);

    const fit = () => m.fitBounds(BOUNDS, { animate: false, padding: [0, 0] });

    const onResize = () => {
      const r = node.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      m.invalidateSize();
      fit();
    };

    mapRef.current = m;
    onResize();
    setReady(true);

    const onMove = () => setMapVersion(v => v + 1);
    m.on("move zoom moveend zoomend", onMove);

    const ro = new ResizeObserver(onResize);
    ro.observe(node);

    return () => {
      ro.disconnect();
      m.off("move zoom moveend zoomend", onMove);
      m.remove();
      mapRef.current = null;
    };
  }, [layer]);

  const project = useCallback<ProjectFn>(
    (lon, lat) => {
      const m = mapRef.current;
      if (!m || size.w === 0) return JapanData.project(lon, lat);
      const p = m.latLngToContainerPoint([lat, lon]);
      const scale = JapanData.WIDTH / size.w;
      return { x: p.x * scale, y: p.y * scale };
    },
    // mapVersion is bumped on every Leaflet move/zoom so consumers re-project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, mapVersion],
  );

  const controller = useMemo<MapController>(
    () => ({
      flyTo(lon, lat, zoom = 8, duration = 1.4) {
        const m = mapRef.current;
        if (!m) return;
        m.flyTo([lat, lon], zoom, { duration, easeLinearity: 0.18 });
      },
      reset(duration = 1.0) {
        const m = mapRef.current;
        if (!m) return;
        m.flyToBounds(BOUNDS, { duration, easeLinearity: 0.18 });
      },
      getZoom() {
        return mapRef.current?.getZoom();
      },
    }),
    [],
  );

  useEffect(() => {
    if (ready && size.w > 0 && onReadyRef.current) {
      onReadyRef.current(project, controller);
    }
  }, [project, controller, ready, size.w]);

  const vbW = JapanData.WIDTH;
  const vbH = size.w > 0 ? JapanData.WIDTH * (size.h / size.w) : JapanData.HEIGHT;

  return (
    <MapProjectionContext.Provider value={project}>
      <div className={styles.root} data-layer={layer}>
        <div ref={containerRef} className={styles.tiles} />
        {showAtmosphere && <div className={styles.atmosphere} />}
        <div className={styles.grain} />
        {ready && size.w > 0 && (
          <svg
            className={styles.overlay}
            width="100%"
            height="100%"
            viewBox={`0 0 ${vbW} ${vbH}`}
            preserveAspectRatio="none"
          >
            {children}
          </svg>
        )}
      </div>
    </MapProjectionContext.Provider>
  );
}
