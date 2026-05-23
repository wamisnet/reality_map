"use client";

import dynamic from "next/dynamic";

/**
 * サーバーコンポーネントから LocationMap (Leaflet 使用 = window 参照) を
 * 呼び出すためのクライアントラッパー。
 * next/dynamic の `ssr: false` はクライアントコンポーネントからしか使えない。
 */
const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });

export default LocationMap;
